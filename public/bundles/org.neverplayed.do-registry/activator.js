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
    LOG_SERVICE as _LOG_SERVICE
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

        handleAction: async (action, instance) => {
            const handler = this.actionHandlers.find(h => h.id === action.id && (!h.match || h.match(instance)));
            if (handler) return await handler.execute(instance, this.state);

            const actionId = action.id;
            const refs = context.getServiceReferences(ACTION_SERVICE, `(action.id=${actionId})`);
            if (refs && refs.length > 0) {
                const svc = context.getService(refs[0]);
                if (svc && typeof svc.execute === 'function') {
                    return await svc.execute({ ...action.params, targetId: instance.id, context: instance });
                }
            }
            logger.error(`No handler or service found for action: ${actionId}`);
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
            const yamlSvc = context.getService(context.getServiceReference(YAML_SERVICE));
            const editorSvc = context.getService(context.getServiceReference(_YAML_EDITOR_SERVICE));
            if (yamlSvc && editorSvc) {
                editorSvc.edit({
                    title: "Instances",
                    data: pm.load(DO_INSTANCES_PID) || {},
                    onSave: (val) => {
                        try { pm.store(DO_INSTANCES_PID, val); this.sync(); } catch (e) { alert(e.message); }
                    }
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
            this._pm = context.getService(ref);
            this.logger.info("DO Registry: Persistence Manager discovered. Syncing...");
            
            if (this.state) {
                this.state.loadingData = false;
                // NEW: Register explicit Local routing policy for Domain Objects
                if (typeof this._pm.setRoutingPolicy === 'function') {
                    this._pm.setRoutingPolicy("realm.do", "local", true);
                }
            }
            
            this.refreshMaster(true);
            this.sync();
            return this._pm;
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
            const idx = this.systemSpecs.findIndex(s => s.id === spec.id);
            if (idx !== -1) this.systemSpecs[idx] = spec; else this.systemSpecs.push(spec);
            this.sync();
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
            (this._pm || this.persistence).store(DO_INSTANCES_PID, Object.fromEntries(this._instances));
            this.sync();
        },
        removeInstance: (id) => {
            this._instances.delete(id);
            if (this._registrations.has(id)) {
                this._registrations.get(id).unregister();
                this._registrations.delete(id);
            }
            (this._pm || this.persistence).store(DO_INSTANCES_PID, Object.fromEntries(this._instances));
            this.sync();
        },
        registerActionHandler: (handler) => this.actionHandlers.push(handler),
        handleAction: (action, instance) => this.state.handleAction(action, instance),
        setRealmContext: (_realmId, domainObjects = null) => {
            this._realmBlueprintIds = domainObjects ? domainObjects.map(d => d.id) : null;
            this.sync();
        }
    };
    context.registerService(DOMAIN_OBJECT_REGISTRY_SERVICE, this.registryService);

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
            if (strategySvc?.deleteInstance) strategySvc.deleteInstance(instance.id, instance.blueprintId);
            else {
                this._instances.delete(instance.id);
                (this._pm || this.persistence).store(DO_INSTANCES_PID, Object.fromEntries(this._instances));
                this.sync();
            }
        }
    });

    context.registerService(FLOW_SERVICE, {
        id: "domain-objects",
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
    }, { "flow.id": "domain-objects", "sidebar": true });

    await this.refreshMaster(true);
    this.seed();
    this.sync();
  }

  refreshMaster(triggerSync = true) {
     const pm = this._pm || this.persistence;
     if (!pm) return;
     
     let data = pm.load(DO_INSTANCES_PID) || {};
     
     // --- Strategic Migration Check (Anti-Gravity Fallback) ---
     const legacyKey = "org.neverplayed.do.instances";
     if (Object.keys(data).length === 0) {
         const legacyData = pm.load(legacyKey) || {};
         if (Object.keys(legacyData).length > 0) {
             this.logger.info(`[Registry] Migrating ${Object.keys(legacyData).length} instances from legacy key ${legacyKey}`);
             data = legacyData;
             pm.store(DO_INSTANCES_PID, data); // Promote to new Local Tier
         }
     }

     this.logger.info(`[Registry] Refreshing from PM. Found ${Object.keys(data).length} instances in bucket ${DO_INSTANCES_PID}`);
     
     const countBefore = this._instances.size;
     Object.entries(data).forEach(([id, inst]) => {
         if (inst && id) {
             const existing = this._instances.get(id);
             const propsCount = Object.keys(inst.properties || {}).length;
             const existingPropsCount = existing ? Object.keys(existing.properties || {}).length : 0;
             if (existing && existingPropsCount > 0 && propsCount === 0) return;
             const instance = { ...inst, id };
             this._instances.set(id, instance);
             this.registerInstanceService(id, instance);
         }
     });
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
    const finalBlueprints = this._realmBlueprintIds ? this.systemSpecs.filter(s => this._realmBlueprintIds.includes(s.id)) : [...this.systemSpecs];
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
