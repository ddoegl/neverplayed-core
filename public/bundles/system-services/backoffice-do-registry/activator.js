import { 
    YAML_SERVICE, 
    BO_EXTENSION_SERVICE, 
    YAML_EDITOR_SERVICE, 
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    LIMES_SERVICE, 
    ATOMIC_SPEC_INGESTION_SERVICE,
    EVALUATOR_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    LOG_SERVICE,
    DO_INSTANCES_PID
} from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  _logger = console;
  _context = null;
  _persistenceManager = null;
  _yamlService = null;
  _limesService = null;
  _isInitialized = false;
  _runtimeStrategies = new Map();

  start(context) {
    this._context = context;

    // 1. System Logger Integration
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            this._logger = logAdmin.getLogger("backoffice-do-registry");
            return logAdmin;
        },
        removedService: () => { this._logger = console; }
    }).open();

    // 2. Track Behavioral Strategies (OSGi)
    context.trackService(`(objectClass=${DOMAIN_STRATEGY_SERVICE})`, {
        addingService: (ref) => {
            const strategy = context.getService(ref);
            this._runtimeStrategies.set(strategy.id, strategy);
            if (globalThis.backofficeState) globalThis.backofficeState.recompile?.();
            return strategy;
        },
        removedService: (ref) => {
            const strategy = context.getService(ref);
            this._runtimeStrategies.delete(strategy.id);
            if (globalThis.backofficeState) globalThis.backofficeState.recompile?.();
        }
    }).open();

    // 3. Track Dependency: Limes
    context.trackService(`(objectClass=${LIMES_SERVICE})`, {
        addingService: (ref) => { this._limesService = context.getService(ref); },
        removedService: () => { this._limesService = null; }
    }).open();

    // 4. Track Critical Dependency: Persistence Manager
    context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
        addingService: (ref) => { 
            this._persistenceManager = context.getService(ref); 
            this._checkReady();
            return this._persistenceManager;
        },
        removedService: () => { this._persistenceManager = null; }
    }).open();

    // 5. Track Critical Dependency: YAML Service
    context.trackService(`(objectClass=${YAML_SERVICE})`, {
        addingService: (ref) => { 
            this._yamlService = context.getService(ref); 
            this._checkReady();
            return this._yamlService;
        },
        removedService: () => { this._yamlService = null; }
    }).open();

    // 6. Evaluator Registration (No dependencies required for reactive Eval)
    context.registerService(EVALUATOR_SERVICE, {
        order: 500,
        evaluate: (userCapabilities) => {
            const pm = this._persistenceManager;
            if (!pm) return userCapabilities;

            const instContent = pm.load(DO_INSTANCES_PID);
            if (!instContent) return userCapabilities;

            const instances = instContent || {};
            return userCapabilities.map(entry => {
                const visibleDOs = Object.values(instances).map(inst => {
                    const strategy = this._runtimeStrategies.get(inst.strategyId);
                    const allowedActions = (strategy?.actions || []).map(action => ({ ...action, allowed: true }));
                    return { ...inst, allowedActions, strategy };
                });
                return { ...entry, domainObjects: visibleDOs };
            });
        }
    });
  }

  async _checkReady() {
    if (this._isInitialized || !this._yamlService || !this._persistenceManager) return;
    this._isInitialized = true;

    try {
        const context = this._context;
        const pm = this._persistenceManager;
        const yaml = this._yamlService;
        const logger = this._logger;

        // A. Seed Static Strategies
        const resStrats = await fetch("./bundles/system-services/backoffice-do-registry/data/strategies.yaml");
        const stratsText = await resStrats.text();
        const yamlStrats = yaml.load(stratsText) || {};
        for (const s of Object.values(yamlStrats)) {
            this._runtimeStrategies.set(s.id, s);
        }

        // B. Ensure Instance State
        if (!pm.load(DO_INSTANCES_PID)) {
            pm.store(DO_INSTANCES_PID, {});
        }

        // C. Build Registry Service
        const actionHandlers = [];
        const systemSpecs = [];

        const registryService = {
            getStrategies: () => Array.from(this._runtimeStrategies.values()),
            getInstances: () => pm.load(DO_INSTANCES_PID),
            setStrategies: (newStrats) => {
                for (const s of Object.values(newStrats)) this._runtimeStrategies.set(s.id, s);
                syncWithHost();
            },
            setInstances: (newInst) => {
                pm.store(DO_INSTANCES_PID, newInst);
                syncWithHost();
            },
            getInstance: (id) => (pm.load(DO_INSTANCES_PID) || {})[id],
            getStrategy: (id) => this._runtimeStrategies.get(id),
            addStrategy: (strategy) => {
                this._runtimeStrategies.set(strategy.id, strategy);
                syncWithHost();
            },
            addInstance: (instance) => {
                const current = pm.load(DO_INSTANCES_PID) || {};
                current[instance.id] = instance;
                pm.store(DO_INSTANCES_PID, current);
                syncWithHost();
            },
            removeInstance: (id) => {
                const current = pm.load(DO_INSTANCES_PID) || {};
                if (current[id]) {
                    delete current[id];
                    pm.store(DO_INSTANCES_PID, current);
                    syncWithHost();
                }
            },
            addBlueprint: (spec) => {
                const idx = systemSpecs.findIndex(s => s.id === spec.id);
                if (idx !== -1) systemSpecs[idx] = spec; else systemSpecs.push(spec);
                syncWithHost();
            },
            registerActionHandler: (handler) => {
                if (handler._sourceFlowId) {
                    const idx = actionHandlers.findIndex(h => h.id === handler.id && h._sourceFlowId === handler._sourceFlowId);
                    if (idx !== -1) { actionHandlers[idx] = handler; return; }
                }
                actionHandlers.push(handler);
            },
            handleAction: (action, instance, host) => {
                const handler = actionHandlers.find(h => h.id === action.id && h.match(instance));
                if (handler) handler.execute(instance, host);
            }
        };

        const syncWithHost = () => {
            const states = [globalThis.backofficeState, globalThis.businessPortalState].filter(Boolean);
            const raw = localStorage.getItem('atomic_persisted_specs');
            const persisted = raw ? JSON.parse(raw) : [];
            const mergedBlueprints = [...systemSpecs];
            persisted.forEach(ps => { if (!mergedBlueprints.find(s => s.id === ps.id)) mergedBlueprints.push(ps); });

            states.forEach(s => {
                s.domainObjectSpecs = mergedBlueprints;
                s.domainObjectStrategies = Object.fromEntries(this._runtimeStrategies);
                s.domainObjectInstances = pm.load(DO_INSTANCES_PID) || {};
                s.parsedDOStrategies = s.domainObjectStrategies;
                s.parsedDOInstances = s.domainObjectInstances;

                if (!s.handleAction) {
                    s.handleAction = (action, instance) => registryService.handleAction(action, instance, s);
                }
                if (!s.instantiateDO) {
                    s.instantiateDO = (specId) => {
                        const spec = s.domainObjectSpecs.find(sp => sp.id === specId);
                        if (!spec) return logger.error(`DO Registry: Spec ${specId} not found.`);
                        const strategyId = spec.domainObject?.strategyId || "LOCAL_STRATEGY";
                        const strategySvc = this._runtimeStrategies.get(strategyId);
                        if (!strategySvc?.createInstance) return logger.error(`DO Registry: Strategy [${strategyId}] not ready.`);
                        const inst = strategySvc.createInstance(spec);
                        if (s.recompile) s.recompile();
                        return inst;
                    };
                }
                if (s.recompile) s.recompile();
            });
        };

        // D. Register Default Handlers
        registryService.registerActionHandler({
            id: 'view',
            match: () => true,
            execute: (instance, host) => {
                const blueprint = (host.domainObjectSpecs || []).find(s => s.id === instance.blueprintId);
                if (blueprint?.ui) {
                    const params = { instanceId: instance.id };
                    if (typeof host.launchFlow === 'function') host.launchFlow(blueprint.id, null, params);
                    else globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: blueprint.id, step: null, params } }));
                }
            }
        });

        registryService.registerActionHandler({
            id: 'delete',
            match: () => true,
            execute: (instance) => {
                const strategyId = instance.strategyId || "LOCAL_STRATEGY";
                const strategySvc = this._runtimeStrategies.get(strategyId);
                if (strategySvc?.deleteInstance) strategySvc.deleteInstance(instance.id, instance.blueprintId);
            }
        });

        // E. Register Services
        context.registerService(DOMAIN_OBJECT_REGISTRY_SERVICE, registryService);
        context.registerService(BO_EXTENSION_SERVICE, {
            id: "domain-objects",
            name: "Domain Objects",
            icon: "fas fa-cubes",
            templateUrl: "./bundles/system-services/backoffice-do-registry/templates/overview.html",
            onActivate: (hostState) => {
                syncWithHost();
                if (!Object.getOwnPropertyDescriptor(hostState, 'currentDOs')) {
                    Object.defineProperty(hostState, 'currentDOs', {
                        get() {
                            const host = globalThis.backofficeState || globalThis.businessPortalState || hostState;
                            const userId = host?.session?.currentUser?.id;
                            if (!userId) return [];
                            const entry = Array.isArray(host?.evaluatedData) ? host.evaluatedData.find(d => String(d.user) === String(userId)) : null;
                            return Array.isArray(entry?.domainObjects) ? entry.domainObjects : [];
                        },
                        enumerable: true,
                        configurable: true
                    });
                }
            }
        });

        this._logger.info("DO Registry: Service Registered successfully. 🏛️✅");
        globalThis.dispatchEvent(new CustomEvent('do-registry-ready'));

    } catch (err) {
        this._logger.error("DO Registry: Initialization failed:", err);
        this._isInitialized = false;
    }
  }

  stop() {}
}
