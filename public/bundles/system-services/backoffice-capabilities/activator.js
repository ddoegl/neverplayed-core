import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, BIZ_FUNC_DATA_SERVICE, PLEXUS_ENGINE_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const CAPABILITIES_PID = "pandino.backoffice.capabilities.strategies";
    const PERMISSIONS_PID = "pandino.backoffice.permissions.keys";
    const FEATURES_PID = "pandino.backoffice.features.catalog";

    // 1. Manage Capability Strategies (Layer 2)
    const loadAndSync = async (pid, path, currentData) => {
        const res = await fetch(path);
        const text = await res.text();
        const yamlData = yaml.load(text) || (pid.includes('catalog') ? {} : []);
        
        let persistentData = currentData || pm.load(pid);
        if (!persistentData) {
            persistentData = yamlData;
        } else {
            // Force sync YAML updates (especially IDs and Keys) into persistence
            if (Array.isArray(yamlData)) {
                yamlData.forEach(yItem => {
                    const idx = persistentData.findIndex(pItem => pItem.id === yItem.id);
                    if (idx === -1) persistentData.push(yItem);
                    else persistentData[idx] = yItem;
                });
            } else if (typeof yamlData === 'object') {
                Object.assign(persistentData, yamlData);
            }
        }
        pm.store(pid, persistentData);
        return persistentData;
    };

    const projectState = (data) => {
        [globalThis.backofficeState, globalThis.businessPortalState].forEach(state => {
            if (state) {
                if (data.capabilities) state.parsedCapabilities = data.capabilities;
                if (data.permissions) state.parsedPermissions = data.permissions;
                if (data.features) state.parsedFeatures = data.features;
            }
        });
    };

    console.log("BO Capabilities: Syncing configurations from YAML...");
    let capabilities = await loadAndSync(CAPABILITIES_PID, "./bundles/system-services/backoffice-capabilities/data/capabiltiy-strategies.yaml", null);
    let permissions = await loadAndSync(PERMISSIONS_PID, "./bundles/system-services/backoffice-capabilities/data/pemission-keys.yaml", null);
    let features = await loadAndSync(FEATURES_PID, "./bundles/system-services/backoffice-capabilities/data/feature-catalog.yaml", null);
    
    projectState({ capabilities, permissions, features });

    const capabilitiesService = {
      getStrategies: () => capabilities,
      setStrategies: (newCaps) => {
        capabilities = newCaps;
        pm.store(CAPABILITIES_PID, capabilities);
        if (globalThis.backofficeState) {
          globalThis.backofficeState.parsedCapabilities = capabilities;
          globalThis.backofficeState.recompile?.();
        }
      }
    };

    const permissionsService = {
      getPermissions: () => permissions,
      setPermissions: (newPerms) => {
        permissions = newPerms;
        pm.store(PERMISSIONS_PID, permissions);
        if (globalThis.backofficeState) {
          globalThis.backofficeState.parsedPermissions = permissions;
          globalThis.backofficeState.recompile?.();
        }
      }
    };

    const featuresService = {
      getFeatures: () => features,
      setFeatures: (newFeatures) => {
        features = newFeatures;
        pm.store(FEATURES_PID, features);
        if (globalThis.backofficeState) {
          globalThis.backofficeState.parsedFeatures = features;
          globalThis.backofficeState.recompile?.();
        }
      }
    };

    // Provide services
    context.registerService("backoffice.capabilities.data", capabilitiesService);
    context.registerService("backoffice.permissions.data", permissionsService);
    context.registerService("backoffice.features.data", featuresService);

    // 3. Register Harmonized Evaluator Plugin
    context.registerService("backoffice.evaluator", {
        order: 200,
        evaluate: (userCapabilities, _parsedLicenses, hostState) => {
            const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
            const engine = engineRef ? context.getService(engineRef) : null;
            const matcherEngine = engine ? engine.getMatcherEngine() : null;
            
            if (!matcherEngine || !hostState.parsedCapabilities) return userCapabilities;

            return userCapabilities.map(entry => {
                const { categories, grantedKeys } = matcherEngine.evaluateCapabilitiesDynamic(
                    hostState.parsedCapabilities,
                    entry.rawUser,
                    { license: entry.license }
                );
                
                const existingCaps = Array.isArray(entry.capabilities) ? entry.capabilities : [];
                const mergedGrants = { ...(entry.grantedKeys || {}), ...(grantedKeys || {}) };

                return { 
                    ...entry, 
                    capabilities: [...existingCaps, ...categories],
                    grantedKeys: mergedGrants
                };
            });
        }
    });

    // 4. Shared state for the bundle
    this.availableRoles = [];
    this.availablePrimitives = [{ id: "matchAlways" }];
    this.hostState = null;

    context.trackService(BIZ_FUNC_DATA_SERVICE, {
      addingService: (ref) => {
        this.availableRoles = context.getService(ref).getBusinessFunctions() || [];
        if (this.hostState) this.hostState.parsedBusinessFunctions = this.availableRoles;
      }
    }).open();

    context.trackService("backoffice.rules.data", {
      addingService: (ref) => {
        this.availablePrimitives = context.getService(ref).getStrategies() || [];
        // Available primitives are now centrally handled via poc.evaluator.engine in global-state
      }
    }).open();

    // Register UI Extension Service
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "capabilities",
      name: "Capabilities",
      icon: "fas fa-key",
      templateUrl: "./bundles/system-services/backoffice-capabilities/templates/capabilities.html",
      onActivate: (hostState) => {
        this.hostState = hostState;
        
        // Re-fetch LIVE Business Functions and Rule Strategies directly from services on activation
        const bfRef = context.getServiceReference(BIZ_FUNC_DATA_SERVICE);
        if (bfRef) {
            this.availableRoles = context.getService(bfRef).getBusinessFunctions() || [];
        }
        
        hostState.parsedCapabilities = capabilities;
        hostState.parsedPermissions = permissions;
        hostState.parsedFeatures = features;
        hostState.parsedBusinessFunctions = this.availableRoles;
        hostState.openCapabilitiesEditor = (target = 'capabilities') => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) { alert("YAML Editor service not available yet."); return; }
          
          let data = capabilities;
          let onSave = (newData) => capabilitiesService.setStrategies(newData);
          let title = "Capability Strategy Configuration";

          if (target === 'catalog') {
            data = features;
            onSave = (newData) => featuresService.setFeatures(newData);
            title = "Feature Catalog Configuration";
          } else if (target === 'registry') {
            data = permissions;
            onSave = (newData) => permissionsService.setPermissions(newData);
            title = "Permission Registry Configuration";
          }

          editor.edit({ title, data, onSave });
        };

        hostState.addStrategy = () => {
          if (!Array.isArray(hostState.parsedCapabilities)) hostState.parsedCapabilities = [];
          hostState.parsedCapabilities.push({
            id: `NEW_STRATEGY_${Date.now()}`,
            operator: "AND",
            matchers: [
              { type: "matchAlways" }
            ],
            keys: [],
            features: []
          });
          hostState.saveCapabilities();
        };

        hostState.removeStrategy = (idx) => {
          if (confirm("Delete this capability strategy?")) {
            hostState.parsedCapabilities.splice(idx, 1);
            hostState.saveCapabilities();
          }
        };

        hostState.saveCapabilities = () => capabilitiesService.setStrategies(hostState.parsedCapabilities);
        hostState.saveCatalog = () => featuresService.setFeatures(hostState.parsedFeatures || {});
        hostState.savePermissions = () => permissionsService.setPermissions(hostState.parsedPermissions);
        
        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
