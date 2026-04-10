/**
 * @file Activator for org.neverplayed.do-registry
 * @module platform/bundles/org.neverplayed.do-registry
 */

import { 
    YAML_SERVICE, 
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    DOMAIN_OBJECT_INSTANCE_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    DO_INSTANCES_PID,
    FLOW_SERVICE,
    SESSION_SERVICE,
    SHELL_COMMAND_SERVICE,
    ACTION_REGISTRY_SERVICE,
    ACTION_SERVICE,
    PERSISTENCE_MANAGER_SERVICE,
    YAML_EDITOR_SERVICE as _YAML_EDITOR_SERVICE,
    LOG_SERVICE as _LOG_SERVICE,
    DOMAIN_OBJECTS_FLOW,
    INTERACTOR_SERVICE
} from "core-types";
import { CoreAlpineActivator } from "alpine-base";

export default class Activator extends CoreAlpineActivator {
  constructor() {
    super();
    this._instances = new Map();
    this.runtimeStrategies = new Map();
    this.actionHandlers = [];
    this.systemSpecs = [];
    this._registrations = new Map();
    this._realmBlueprintIds = null;
    this._actionRegistry = null;
    this._pm = null;
    this._pmTracker = null;
  }

  async onCoreStart(context) {
    const pm = this.persistence;
    const logger = this.logger;

    // 1. Initialize Store as 'state' to avoid base class collision
    this.state = this.initStore('do_registry', {
        domainObjectSpecs: [],
        parsedDOStrategies: {},
        parsedDOInstances: {},
        showAllDOs: pm.load('do:show-all') === true,
        visualEditorData: null,
        currentDOs: [],
        sessionAvailable: false,
        loadingData: true,
        
        isRegistryAdmin: () => {
            if (!this._session) return false;
            try {
                const user = this._session.currentUser;
                if (!user) return false;
                const scopedAttrs = this._session.scopedUsers?.["global"]?.attributes || {};
                const isScopedAdmin = scopedAttrs["realm-admin"] || scopedAttrs["neverplayed-admin"];
                const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
                const isIdentityAdmin = ['neverplayed-admin', 'realm-admin'].some(r => caps.includes(r));
                return isIdentityAdmin || isScopedAdmin || ['dd', 'system'].includes(user.id) || user.email === 'daniel.doegl@doegl.info';
            } catch (_e) { return false; }
        },

        toggleShowAllDOs: () => {
            this.state.showAllDOs = !this.state.showAllDOs;
            pm.store('do:show-all', this.state.showAllDOs);
            this.sync();
        },

        instantiateDO: (specId) => {
            const spec = this.state.domainObjectSpecs.find(sp => sp.id === specId);
            if (!spec) return logger.error(`Spec ${specId} not found.`);
            const strategyId = spec.domainObject?.strategyId || "LOCAL_STRATEGY";
            const strategySvc = this.runtimeStrategies.get(strategyId);
            if (!strategySvc?.createInstance) return logger.error(`Strategy [${strategyId}] not ready.`);
            return strategySvc.createInstance(spec);
        },

        handleAction: async (action, target) => {
            // Rule 17: Hybrid Action Filtering (SDN-0075)
            // If target is a Blueprint (has 'id' and 'domainObject' vs 'blueprintId')
            if (action.id === 'blueprint.archive') {
                const confirmed = await this.interactor?.confirm(`Permanently archive blueprint '${target.id}'? This will remove it from ALL environments.`);
                if (confirmed) {
                    this.registryService.archiveBlueprint(target.id);
                }
                return;
            }

            const instance = target;
            this.logger.info(`DO Registry: Routing action [${action.id}] for instance [${instance.id}]`);
            
            const handler = this.actionHandlers.find(h => h.id === action.id && (!h.match || h.match(instance)));
            if (handler) {
                this.logger.info(`DO Registry: Executing local handler for [${action.id}]`);
                return await handler.execute(instance, this.state);
            }

            const actionId = action.id;
            this.logger.info(`DO Registry: No local handler found for [${actionId}]. Falling back to OSGi Service lookup...`);
            
            const refs = context.getServiceReferences(ACTION_SERVICE, `(action.id=${actionId})`);
            if (refs && refs.length > 0) {
                const svc = context.getService(refs[0]);
                if (svc && (typeof svc.execute === 'function' || typeof svc === 'function')) {
                    const execFn = typeof svc === 'function' ? svc : svc.execute;
                    return await execFn.apply(svc, [{ ...action.params, targetId: instance.id, context: instance }]);
                }
            }
            logger.error(`DO Registry: No handler or service found for action [${actionId}]`);
        },

        editDomainObjectYAML: (specId) => {
            const spec = this.state.domainObjectSpecs.find(s => s.id === specId);
            const yamlSvc = context.getService(context.getServiceReference(YAML_SERVICE));
            const editorSvc = context.getService(context.getServiceReference(_YAML_EDITOR_SERVICE));
            if (spec && yamlSvc && editorSvc) {
                editorSvc.edit({
                    title: `Edit Blueprint: ${specId}`,
                    data: spec,
                    onSave: (val) => {
                        try { this.registryService.addBlueprint(val); } catch (e) { alert(e.message); }
                    }
                });
            }
        },
        createDomainObjectYAML: () => {
            const yamlSvc = context.getService(context.getServiceReference(YAML_SERVICE));
            const editorSvc = context.getService(context.getServiceReference(_YAML_EDITOR_SERVICE));
            if (yamlSvc && editorSvc) {
                editorSvc.edit({
                    title: "Create Blueprint",
                    data: { id: 'new-do', label: 'New DO', domainObject: { strategyId: 'LOCAL_STRATEGY' } },
                    onSave: (val) => {
                        try { this.registryService.addBlueprint(val); } catch (e) { alert(e.message); }
                    }
                });
            }
        },
        openDOStrategiesEditor: () => {
             const editorSvc = context.getService(context.getServiceReference(_YAML_EDITOR_SERVICE));
             if (editorSvc) editorSvc.edit({ title: "Strategies", data: Object.fromEntries(this.runtimeStrategies), onSave: () => {} });
        },
        openDOInstancesEditor: () => {
             const editorSvc = context.getService(context.getServiceReference(_YAML_EDITOR_SERVICE));
             if (editorSvc) {
                 editorSvc.edit({
                     title: "Active Instances (Managed)",
                     data: Object.fromEntries(this._instances),
                     onSave: () => {} // Read-only in this view for safety
                 });
             }
        },
        editDomainObjectVisual: (specId) => {
            const spec = this.state.domainObjectSpecs.find(s => s.id === specId);
            if (spec) {
                this.state.visualEditorData = JSON.parse(JSON.stringify(spec));
                const props = [];
                if (spec.domainObject?.properties) Object.entries(spec.domainObject.properties).forEach(([key, value]) => props.push({ key, value }));
                this.state.visualEditorData.properties = props;
                this.sync();
            }
        },
        createDomainObjectVisual: () => {
            this.state.visualEditorData = { id: 'new-do', label: 'New DO', domainObject: { strategyId: 'LOCAL_STRATEGY' }, steps: [], properties: [] };
            this.sync();
        },
        closeVisualEditor: () => { this.state.visualEditorData = null; this.sync(); },
        moveItem: (arr, idx, delta) => {
            const newIdx = idx + delta;
            if (newIdx >= 0 && newIdx < arr.length) {
                const item = arr.splice(idx, 1)[0];
                arr.splice(newIdx, 0, item);
            }
            this.sync();
        },
        saveVisualEditor: () => {
            const data = this.state.visualEditorData;
            if (data) {
                const props = {};
                (data.properties || []).forEach(p => { if (p.key) props[p.key] = p.value; });
                const blueprint = { ...data, domainObject: { ...data.domainObject, properties: props } };
                delete blueprint.properties;
                this.registryService.addBlueprint(blueprint);
                this.state.visualEditorData = null;
                this.sync();
            }
        },
        ingestFromServer: () => this.seed()
    });

    this._interactorTracker = context.trackService(`(objectClass=${INTERACTOR_SERVICE})`, {
        addingService: (ref) => { this.interactor = context.getService(ref); return this.interactor; },
        removedService: () => { this.interactor = null; }
    });
    this._interactorTracker.open();

    this._sessionTracker = context.trackService(`(objectClass=${SESSION_SERVICE})`, {
        addingService: (ref) => {
            if (this._sessionTimeout) clearTimeout(this._sessionTimeout);
            this._session = context.getService(ref);
            if (this.state) this.state.sessionAvailable = true;
            this.sync();
            return this._session;
        },
        removedService: () => {
            this._sessionTimeout = setTimeout(() => {
                this._session = null;
                if (this.state) this.state.sessionAvailable = false;
                this.sync();
            }, 500);
        }
    });
    this._sessionTracker.open();
    
    this._pmTracker = context.trackService(`(objectClass=${PERSISTENCE_MANAGER_SERVICE})`, {
        addingService: (ref) => {
            const pm = context.getService(ref);
            this._pm = pm;
            this.logger.info("DO Registry: Persistence Manager discovered. Checking hydration status...");
            
            // Rule 4: Dynamic Identity Discovery (SDN-0061)
            (async () => {
                const discoveryPrefix = "realm.do.instances_";
                if (typeof pm.waitReady === 'function') {
                    this.logger.info(`DO Registry: Awaiting PM readiness for discovery prefix ${discoveryPrefix}...`);
                    await pm.waitReady(discoveryPrefix);
                }
                
                if (this.state) {
                    this.state.loadingData = false;
                    // NEW: Register explicit Local routing policy for Domain Objects
                    if (typeof this._pm.setRoutingPolicy === 'function') {
                        this._pm.setRoutingPolicy("realm.do", "local", true);
                    }
                    this.refreshMaster(true);
                    this.sync();
                }
            })();

            return pm;
        },
        removedService: () => {
            this._pm = null;
            if (this.state) this.state.loadingData = true;
            this.sync();
        }
    });
    this._pmTracker.open();

    globalThis.addEventListener('pm-hydrated', () => {
        this.logger.info("DO Registry: Persistence Hydration detected. Refreshing Master Map.");
        this.refreshMaster();
    });

    context.registerService(SHELL_COMMAND_SERVICE, {
        name: "do:inspect",
        description: "Deep-inspect the Domain Object registry and hydration state.",
        execute: (args, _ctx, log) => {
            const out = ["--- DOMAIN OBJECT REGISTRY INSPECTION ---"];
            const insts = this.registryService.getInstances();
            const filter = args && args[0] ? args[0].toLowerCase() : null;
            Object.entries(insts).forEach(([id, inst]) => {
                if (filter && !id.toLowerCase().includes(filter) && !inst.blueprintId?.toLowerCase().includes(filter)) return;
                const props = inst.properties || {};
                const keys = Object.keys(props);
                out.push(`[${id.padEnd(20)}] -> Blueprint: ${inst.blueprintId || 'N/A'}`);
                out.push(`  - State: ${keys.length > 0 ? 'WARM' : 'COLD'} (${keys.length} properties)`);
                if (keys.length > 0) out.push(`  - Keys: ${keys.join(', ')}`);
                out.push(`  - Step: ${inst.currentStep || 'intro'}`);
            });
            if (Object.keys(insts).length === 0) out.push("NO INSTANCES REGISTERED.");
            const result = out.join("\n");
            if (log) log(result);
            return result;
        }
    }, { "shell.command": "do:inspect" });

    this.track(`(objectClass=${DOMAIN_STRATEGY_SERVICE})`, {
        addingService: (ref) => {
            const s = context.getService(ref);
            this.runtimeStrategies.set(s.id, s);
            this.sync();
            return s;
        },
        removedService: (ref) => {
            this.runtimeStrategies.delete(context.getService(ref).id);
            this.sync();
        }
    });

    this.track(`(objectClass=${ACTION_REGISTRY_SERVICE})`, {
        addingService: (ref) => {
            this._actionRegistry = context.getService(ref);
            this._actionRegistry.register({ id: 'view', label: 'View', icon: 'fas fa-eye' });
            this._actionRegistry.register({ id: 'delete', label: 'Delete', icon: 'fas fa-trash', variant: 'danger' });
            this.sync();
            return this._actionRegistry;
        },
        removedService: () => {
            this._actionRegistry = null;
            this.sync();
        }
    });

    this.registryService = {
        addBlueprint: (spec) => {
            if (!spec || !spec.id) return;
            this.logger.debug(`[FORENSIC] DO Registry: Ingesting blueprint [${spec.id}] (Source: ${spec._isBundleBlueprint ? 'Bundle' : 'Persisted'})`);
            const idx = this.systemSpecs.findIndex(s => s.id === spec.id);
            if (idx !== -1) {
                this.logger.debug(`[FORENSIC] DO Registry: Updating existing blueprint [${spec.id}]`);
                this.systemSpecs[idx] = spec;
            } else {
                this.logger.debug(`[FORENSIC] DO Registry: Adding NEW blueprint [${spec.id}]`);
                this.systemSpecs.push(spec);
            }
            this.sync();
        },
        removeBlueprint: (id) => {
            this.logger.info(`DO Registry: Archiving blueprint [${id}] from master spec list`);
            const idx = this.systemSpecs.findIndex(s => s.id === id);
            if (idx !== -1) {
                this.systemSpecs.splice(idx, 1);
                this.sync();
            }
        },
        archiveBlueprint: (id) => {
            const spec = this.systemSpecs.find(s => s.id === id);
            if (spec) {
                // Rule 18: Silent Logic Handshake (SDN-0076)
                // Dispatches intentional event without UI blocking
                globalThis.dispatchEvent(new CustomEvent('atomic-default-action', { 
                    detail: { action: 'blueprint.archive', spec } 
                }));
            }
        },
        getStrategy: (id) => this.runtimeStrategies.get(id),
        getInstances: () => {
            this.refreshMaster(false);
            return Object.fromEntries(this._instances);
        },
        getInstance: (id) => {
            if (!this._instances.has(id)) {
                const pmData = (this._pm || this.persistence).load(DO_INSTANCES_PID) || {};
                if (pmData[id]) this._instances.set(id, { ...pmData[id], id });
            }
            return this._instances.get(id) || null;
        },
        addInstance: (instance) => {
            const existing = this._instances.get(instance.id);
            const newCount = Object.keys(instance.properties || {}).length;
            const oldCount = existing ? Object.keys(existing.properties || {}).length : 0;
            if (existing && newCount === 0 && oldCount > 0) {
                this.logger.warn(`DO Registry: Blocked 'Cold Overwrite' attempt for ${instance.id}. Registry is Warm (${oldCount} props), UI is Cold (0 props).`);
                return;
            }
            this._instances.set(instance.id, { ...instance });
            this.registerInstanceService(instance.id, instance);
            const bucket = `realm.do.instances_${instance.id}`;
            (this._pm || this.persistence).store(bucket, { ...instance, id: instance.id });
            this.sync();
        },
        removeInstance: (id) => {
            this._instances.delete(id);
            if (this._registrations.has(id)) {
                this._registrations.get(id).unregister();
                this._registrations.delete(id);
            }
            (this._pm || this.persistence).store(`realm.do.instances_${id}`, null); // Single-Phase Purge
            this.sync();
        },
        registerActionHandler: (handler) => this.actionHandlers.push(handler),
        handleAction: (action, instance) => this.state.handleAction(action, instance),
        setRealmContext: (realmId, domainObjects = null) => {
            this.logger.info(`DO Registry: Setting Realm Context [${realmId}] with ${domainObjects?.length || 0} object filters.`);
            this._activeRealmId = realmId;
            this._realmBlueprintIds = domainObjects ? domainObjects.map(d => d.id) : null;
            this.sync();
        }
    };
    context.registerService(DOMAIN_OBJECT_REGISTRY_SERVICE, this.registryService);

    // 5. Diagnostic CLI Command
    context.registerService(SHELL_COMMAND_SERVICE, {
        name: 'do:list',
        description: 'Verify internal Domain Object Registry state and realm filters',
        execute: (_args, _ctx, log) => {
            log(`Registry Diagnostics:`);
            log(` - Total System Specs: ${this.systemSpecs.length}`);
            log(` - Active Realm: ${this._activeRealmId || 'none'}`);
            log(` - Realm Blueprint IDs: ${JSON.stringify(this._realmBlueprintIds || 'ALL')}`);
            
            const visible = this._realmBlueprintIds 
                ? this.systemSpecs.filter(s => this._realmBlueprintIds.includes(s.id) || s._isPersisted || !s._isBundleBlueprint) 
                : [...this.systemSpecs];
            
            log(` - Visible Blueprints (${visible.length}):`);
            visible.forEach(s => log(`   - ${s.id} (Persisted: ${!!s._isPersisted}, Bundle: ${!!s._isBundleBlueprint})`));
        }
    });

    // --- FORENSIC ACTION HANDLERS (SDN-0043) ---
    // Rule 12: Always update Master Index during archival to prevent UI ghosting

    this.registryService.registerActionHandler({
        id: 'view',
        match: () => true,
        execute: (instance) => {
            const spec = this.state.domainObjectSpecs.find(s => s.id === instance.blueprintId);
            if (spec?.ui) globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: spec.id, params: { instanceId: instance.id } } }));
        }
    });

    this.registryService.registerActionHandler({
        id: 'delete',
        match: () => true,
        execute: (instance) => {
            const strategyId = instance.strategyId || "LOCAL_STRATEGY";
            const strategySvc = this.runtimeStrategies.get(strategyId);
            
            this.logger.info(`DO Registry: Archiving instance [${instance.id}] via strategy [${strategyId}]`);

            // 1. Dispatch to strategy for data cleanup
            if (strategySvc?.deleteInstance) strategySvc.deleteInstance(instance.id, instance.blueprintId);
            
            // 2. SINGLE-PHASE PURGE: Clearing the bucket removes it from discovery
            this.registryService.removeInstance(instance.id);
            
            // 3. Sync UI State
            this.sync();
            this.logger.info(`DO Registry: Archival complete. Bucket [realm.do.instances_${instance.id}] liquidated.`);
        }
    });

    // --- OSGi DECENTRALIZED SERVICES ---

    context.registerService(ACTION_SERVICE, {
        execute: async (params) => {
            const id = params.targetId || params.id;
            this.logger.info(`Action: view triggered for targetId [${id}]`, params);
            const instance = this.registryService.getInstance(id);
            if (instance) return await this.state.handleAction({ id: 'view' }, instance);
            return { success: false, error: `Instance not found: ${id}` };
        }
    }, {
        "action.id": "view",
        "action.label": "View Instance",
        "action.description": "Launches the UI flow for a specific domain object instance.",
        "action.icon": "fas fa-eye",
        "action.params": {
            "targetId": "The unique ID of the instance to view."
        }
    });

    context.registerService(ACTION_SERVICE, {
        execute: async (params) => {
            const id = params.targetId || params.id;
            this.logger.info(`Action: delete (archive) triggered for targetId [${id}]`, params);
            if (!id) return { success: false, error: "No targetId provided or resolved." };

            if (confirm(`Are you sure you want to archive/delete instance ${id}?`)) {
                const instance = this.registryService.getInstance(id);
                if (instance) {
                    await this.state.handleAction({ id: 'delete' }, instance);
                    return { success: true };
                }
            }
            return { success: false, error: "Instance not found or cancelled" };
        }
    }, {
        "action.id": "delete",
        "action.label": "Archive Instance",
        "action.description": "Removes a domain object instance from the active registry and archives its state.",
        "action.icon": "fas fa-trash",
        "action.metadata": {
            "style": "danger"
        },
        "action.params": {
            "targetId": "The unique ID of the instance to archive (defaults to current instance)."
        }
    });

    context.registerService(FLOW_SERVICE, {
        id: DOMAIN_OBJECTS_FLOW,
        title: "Domain Objects",
        icon: "fas fa-cubes",
        launch: async (target) => {
            const registry = this.state;
            await this.render("#" + (target.id || "flow-target-do-registry"), "templates/overview.html", () => ({
                registry
            }));
            this.sync();
        },
        onActivate: (_hostState) => this.sync()
    }, { "flow.id": DOMAIN_OBJECTS_FLOW, "sidebar": true });

    await this.refreshMaster(true);
    this.seed();
    this.sync();
  }

  refreshMaster(triggerSync = true) {
     const pm = this._pm || this.persistence;
     if (!pm || typeof pm.listKeys !== 'function') return;
     
     const prefix = "realm.do.instances_";
     const discoveredKeys = pm.listKeys(prefix);
     this.logger.info(`[Registry] Discovery found ${discoveredKeys.length} instance buckets.`);
     
     const countBefore = this._instances.size;
     for (const bucket of discoveredKeys) {
         try {
             const inst = pm.load(bucket);
             if (inst && inst.id) {
                const instance = { ...inst };
                this._instances.set(inst.id, instance);
                this.registerInstanceService(inst.id, instance);
             }
         } catch (e) {
             this.logger.error(`[Registry] Failed to load discovered bucket ${bucket}: ${e.message}`);
         }
     }
     if (triggerSync || this._instances.size !== countBefore) this.sync();
  }

  registerInstanceService(id, instance) {
      if (this._registrations.has(id)) {
          this._registrations.get(id).setProperties({
              "instance.id": id,
              "blueprint.id": instance.blueprintId,
              "strategy.id": instance.strategyId || "LOCAL_STRATEGY",
              "instance.updated": Date.now()
          });
          return;
      }
      const reg = this.context.registerService(DOMAIN_OBJECT_INSTANCE_SERVICE, instance, {
          "instance.id": id,
          "blueprint.id": instance.blueprintId,
          "strategy.id": instance.strategyId || "LOCAL_STRATEGY",
          "instance.updated": Date.now()
      });
      this._registrations.set(id, reg);
  }

  sync() {
    if (!this.state) return;
    
    // Rule 7: Flexible Visibility - Merge Realm-mandated blueprints with Local/Cloud persisted ones
    const finalBlueprints = this._realmBlueprintIds 
        ? this.systemSpecs.filter(s => {
            const isInfra = s.id.includes('registry') || s.id.includes('provisioner');
            const isWhitelisted = this._realmBlueprintIds.includes(s.id);
            const isPersisted = !!s._isPersisted;
            const isBundle = !!s._isBundleBlueprint;

            const visible = isInfra || isWhitelisted || isPersisted || !isBundle;
            
            this.logger.debug(`[DEEP-FORENSIC] DO Registry: Filter Check [${s.id}]: Visible=${visible} (Infra=${isInfra}, Hub=${isWhitelisted}, Persisted=${isPersisted}, Bundle=${isBundle})`);
            
            return visible;
        }) 
        : [...this.systemSpecs];

    this.logger.debug(`[FORENSIC] DO Registry: Sync Pulse. Whitelist: [${this._realmBlueprintIds?.join(', ') || 'NONE'}]. Result Count: ${finalBlueprints.length} / Total Specs: ${this.systemSpecs.length}`);
    const allActions = this._actionRegistry?.getActions() || [];
    const enrichedInstances = {};
    const instancesArray = [];
    this._instances.forEach((inst, id) => {
        const strategy = this.runtimeStrategies.get(inst.strategyId || "LOCAL_STRATEGY");
        const actionMap = new Map();
        allActions.forEach(a => { if (a?.id && this.actionHandlers.some(h => h.id === a.id && (!h.match || h.match(inst)))) actionMap.set(a.id, { ...a }); });
        if (strategy?.actions) strategy.actions.forEach(a => { if (a?.id) actionMap.set(a.id, { ...a }); });
        const enriched = { ...inst, strategy, allowedActions: Array.from(actionMap.values()).map(a => ({ ...a, label: a.label || a.id, icon: a.icon || "fas fa-play" })) };
        enrichedInstances[id] = enriched;
        instancesArray.push(enriched);
    });
    this.state.domainObjectSpecs = finalBlueprints;
    this.state.parsedDOStrategies = Object.fromEntries(this.runtimeStrategies);
    this.state.parsedDOInstances = enrichedInstances;
    this.state.currentDOs = this.state.showAllDOs ? instancesArray : (this._realmBlueprintIds ? instancesArray.filter(inst => this._realmBlueprintIds.includes(inst.blueprintId)) : instancesArray);
  }

  async seed() {
    const yamlSvc = this.context.getService(this.context.getServiceReference(YAML_SERVICE));
    if (!yamlSvc) return;
    try {
        const res = await fetch(this.resolveResource("data/strategies.yaml"));
        if (res.ok) {
            const data = yamlSvc.load(await res.text()) || {};
            Object.values(data).forEach(s => { if (this.state) this.state.parsedDOStrategies[s.id] = s; });
        }
    } catch (e) {
        this.logger.warn(`DO Registry: Seeding failed (this is expected in local-only mode): ${e.message}`);
    }
    this.sync();
  }

  onStop(_context) {
    if (this._pmTracker) this._pmTracker.close();
    if (this._sessionTracker) this._sessionTracker.close();
    this.logger.info("DO Registry: Stopped.");
  }
}
