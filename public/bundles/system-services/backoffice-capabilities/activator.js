import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, BIZ_FUNC_DATA_SERVICE, PLEXUS_ENGINE_SERVICE, CAPABILITIES_DATA_SERVICE,
    RULES_DATA_SERVICE,
    PERMISSION_DATA_SERVICE,
    FEATURE_DATA_SERVICE,
    EVALUATOR_SERVICE,
    CAPABILITIES_PID,
    PERMISSIONS_PID,
    FEATURES_PID,
    PLEXUS_KNOWLEDGE_PROVIDER
} from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const CAPABILITIES_PID_VAL = CAPABILITIES_PID;
    const PERMISSIONS_PID_VAL = PERMISSIONS_PID;
    const FEATURES_PID_VAL = FEATURES_PID;

    // 1. Manage Capability Strategies (Layer 2)
    const loadAndSync = async (pid, path, currentData) => {
        const res = await fetch(path);
        const text = await res.text();
        const yamlData = yaml.load(text) || (pid.includes('catalog') ? {} : []);
        
        let persistentData = currentData || pm.load(pid);
        if (!persistentData) {
            persistentData = yamlData;
        } else {
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
      getKnowledge: () => capabilities,
      setStrategies: (newCaps) => {
        capabilities = newCaps;
        pm.store(CAPABILITIES_PID_VAL, capabilities);
        if (globalThis.backofficeState) {
          globalThis.backofficeState.parsedCapabilities = capabilities;
          globalThis.backofficeState.recompile?.();
        }
      }
    };

    const permissionsService = {
      getPermissions: () => permissions,
      getKnowledge: () => permissions,
      setPermissions: (newPerms) => {
        permissions = newPerms;
        pm.store(PERMISSIONS_PID_VAL, permissions);
        if (globalThis.backofficeState) {
          globalThis.backofficeState.parsedPermissions = permissions;
          globalThis.backofficeState.recompile?.();
        }
      }
    };

    const featuresService = {
      getFeatures: () => features,
      getKnowledge: () => features,
      setFeatures: (newFeatures) => {
        features = newFeatures;
        pm.store(FEATURES_PID_VAL, features);
        if (globalThis.backofficeState) {
          globalThis.backofficeState.parsedFeatures = features;
          globalThis.backofficeState.recompile?.();
        }
      }
    };

    // Provide services
    context.registerService(CAPABILITIES_DATA_SERVICE, capabilitiesService);
    context.registerService(PERMISSION_DATA_SERVICE, permissionsService);
    context.registerService(FEATURE_DATA_SERVICE, featuresService);

    // Register as Plexus Knowledge Providers
    context.registerService(PLEXUS_KNOWLEDGE_PROVIDER, capabilitiesService, { "plexus.domain": "capabilities" });
    context.registerService(PLEXUS_KNOWLEDGE_PROVIDER, permissionsService, { "plexus.domain": "permissions" });
    context.registerService(PLEXUS_KNOWLEDGE_PROVIDER, featuresService, { "plexus.domain": "features" });

    // 3. Register Harmonized Evaluator Plugin
    context.registerService(EVALUATOR_SERVICE, {
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

    this.availableRoles = [];
    this.hostState = null;

    context.trackService(`(objectClass=${BIZ_FUNC_DATA_SERVICE})`, {
      addingService: (ref) => {
        this.availableRoles = context.getService(ref).getBusinessFunctions() || [];
        if (this.hostState) this.hostState.parsedBusinessFunctions = this.availableRoles;
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
            matchers: [{ type: "matchAlways" }],
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
