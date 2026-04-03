import { 
    YAML_SERVICE, 
    BO_EXTENSION_SERVICE as _BO_EXTENSION_SERVICE, 
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    LIMES_SERVICE as _LIMES_SERVICE, 
    EVALUATOR_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    DO_INSTANCES_PID,
    FLOW_SERVICE,
    SESSION_SERVICE,
    YAML_EDITOR_SERVICE as _YAML_EDITOR_SERVICE,
    LOG_SERVICE as _LOG_SERVICE,
    CONFIG_ADMIN_SERVICE as _CONFIG_ADMIN_SERVICE
} from "core-types";
import { CoreAlpineActivator } from "alpine-base";
import { INTERFACE_KEY as _PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator extends CoreAlpineActivator {
  constructor() {
    super();
    this.runtimeStrategies = new Map();
    this.actionHandlers = [];
    this.systemSpecs = [];
    this._realmBlueprintIds = null;
  }

  onCoreStart(context) {
    const pm = this.persistence;
    const logger = this.logger;
    
    // 1. Setup reactive store as 'host' for templates
    const host = this.initStore('do_registry', {
        domainObjectSpecs: [],
        parsedDOStrategies: {},
        parsedDOInstances: {},
        showAllDOs: false,
        visualEditorData: null,
        currentDOs: [],
        
        isRegistryAdmin() {
            const session = context.getService(context.getServiceReference(SESSION_SERVICE));
            const user = session?.currentUser;
            if (!user) return false;
            
            // 1. Check Global Attributes (Identity Level)
            const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
            const attrs = Array.isArray(user.attributes) ? user.attributes : Object.keys(user.attributes || {}).filter(k => !!user.attributes[k]);
            
            // 2. Check Scoped Attributes (Context Level - Injected by RealmManager)
            const scopedAttrs = session.scopedUsers?.["global"]?.attributes || {};
            const hasScopedAdmin = scopedAttrs["realm-admin"] || scopedAttrs["neverplayed-admin"];

            const admins = ['neverplayed-admin', 'realm-admin'];
            const isIdentityAdmin = admins.some(r => caps.includes(r) || attrs.includes(r));
            
            return isIdentityAdmin || hasScopedAdmin || ['dd', 'system'].includes(user.id) || user.email === 'daniel.doegl@doegl.info';
        },

        toggleShowAllDOs() {
            this.showAllDOs = !this.showAllDOs;
            if (!this.showAllDOs) globalThis.dispatchEvent(new CustomEvent('shell-security-reevaluate'));
        },

        instantiateDO: (specId) => {
            const spec = this.host.domainObjectSpecs.find(sp => sp.id === specId);
            if (!spec) return logger.error(`Spec ${specId} not found.`);
            const strategyId = spec.domainObject?.strategyId || "LOCAL_STRATEGY";
            const strategySvc = this.runtimeStrategies.get(strategyId);
            if (!strategySvc?.createInstance) return logger.error(`Strategy [${strategyId}] not ready.`);
            return strategySvc.createInstance(spec);
        },
        handleAction: (action, instance) => {
            const handler = this.actionHandlers.find(h => h.id === action.id && h.match(instance));
            if (handler) handler.execute(instance, this.host);
        },
    });
    this.host = host;

    // 2. Track Behavioral Strategies
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

    // 3. Evaluator Registration
    context.registerService(EVALUATOR_SERVICE, {
        order: 500,
        evaluate: (userCapabilities) => {
            const instances = pm.load(DO_INSTANCES_PID) || {};
            const visibleDOs = Object.values(instances).map(inst => {
                const strategy = this.runtimeStrategies.get(inst.strategyId);
                const allowedActions = (strategy?.actions || []).map(action => ({ ...action, allowed: true }));
                return { ...inst, allowedActions, strategy };
            });
            return userCapabilities.map(entry => ({ ...entry, domainObjects: visibleDOs }));
        }
    });

    // 4. Registry Service
    const registryService = {
        addBlueprint: (spec) => {
            const idx = this.systemSpecs.findIndex(s => s.id === spec.id);
            if (idx !== -1) this.systemSpecs[idx] = spec; else this.systemSpecs.push(spec);
            this.sync();
        },
        getStrategy: (id) => this.runtimeStrategies.get(id),
        addInstance: (instance) => {
            const current = pm.load(DO_INSTANCES_PID) || {};
            current[instance.id] = instance;
            pm.store(DO_INSTANCES_PID, current);
            this.sync();
        },
        registerActionHandler: (handler) => this.actionHandlers.push(handler),
        handleAction: (action, instance, _h) => host.handleAction(action, instance),
        setRealmContext: async (_realmId, domainObjects = null) => {
            if (!domainObjects) {
                this._realmBlueprintIds = null;
            } else {
                this._realmBlueprintIds = domainObjects.map(d => d.id);
                for (const d of domainObjects) {
                    if (d.persistence && pm.setRoutingPolicy) pm.setRoutingPolicy(`instances.${d.id}.`, d.persistence.tier, d.persistence.enforce);
                    if (d.spec) {
                        try {
                            const spec = (await import(this.resolveResource(d.spec))).default || (await (await fetch(this.resolveResource(d.spec))).json());
                            registryService.addBlueprint(spec);
                        } catch (_e) { logger.error(`Failed loading spec ${d.spec}`); }
                    }
                }
            }
            this.sync();
        }
    };
    context.registerService(DOMAIN_OBJECT_REGISTRY_SERVICE, registryService);

    // 5. Default Handlers
    registryService.registerActionHandler({
        id: 'view',
        match: () => true,
        execute: (instance) => {
            const blueprint = this.systemSpecs.find(s => s.id === instance.blueprintId);
            if (blueprint?.ui) globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: blueprint.id, params: { instanceId: instance.id } } }));
        }
    });

    // 6. Flow Registration
    context.registerService(FLOW_SERVICE, {
        id: "domain-objects",
        title: "Domain Objects",
        icon: "fas fa-cubes",
        launch: async (target) => {
            if (!target.id) target.id = "flow-target-do-registry";
            await this.render("#" + target.id, "templates/overview.html", () => ({
                get host() { return host; }
            }));
            this.sync();
        }
    }, { "flow.id": "domain-objects", "sidebar": true, "icon": "fas fa-cubes" });

    // 7. Initial Data Seed
    this.seed();
  }

  sync() {
    if (!this.host) return;
    const instances = this.persistence.load(DO_INSTANCES_PID) || {};
    
    // 1. Build Strat Map (Runtime + Static)
    // Merge runtime-registered services into the reactive store
    for (const [id, s] of this.runtimeStrategies.entries()) {
        this.host.parsedDOStrategies[id] = s;
    }
    
    // 2. Synchronize Specs (Filtered by Realm if applicable)
    if (this._realmBlueprintIds) {
        this.host.domainObjectSpecs = this.systemSpecs.filter(s => this._realmBlueprintIds.includes(s.id));
    } else {
        this.host.domainObjectSpecs = [...this.systemSpecs];
    }
    this.host.parsedDOInstances = Object.fromEntries(
        Object.entries(instances).map(([id, inst]) => [id, { ...inst, allowedActions: [] }])
    );
    
    // Force Alpine refresh
    globalThis.Alpine?.nextTick(() => {});
  }

  async seed() {
    const yamlSvc = this.context.getService(this.context.getServiceReference(YAML_SERVICE));
    if (!yamlSvc) return;

    try {
        const res = await fetch(this.resolveResource("data/strategies.yaml"));
        if (res.ok) {
            const data = yamlSvc.load(await res.text()) || {};
            Object.values(data).forEach(s => this.host.parsedDOStrategies[s.id] = s);
        }
    } catch (_e) { /* Ignore */ }
    this.sync();
  }
}
