import { 
    YAML_SERVICE, 
    BO_EXTENSION_SERVICE, 
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    LIMES_SERVICE, 
    EVALUATOR_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    LOG_SERVICE,
    DO_INSTANCES_PID,
    FLOW_SERVICE,
    SESSION_SERVICE,
    YAML_EDITOR_SERVICE
} from "shared-types";
import { BaseActivator } from "osgi-base";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator extends BaseActivator {
  constructor() {
    super();
    this._persistenceManager = null;
    this._yamlService = null;
    this._limesService = null;
    this._isInitialized = false;
    this._runtimeStrategies = new Map();
  }

  onStart(context) {
    // Core BaseActivator handles context and logger (this.logger)

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

    // 7. Track Session Changes (Phase 10)
    globalThis.addEventListener('session-changed', () => {
        this.logger.info("DO Registry: Session changed, re-syncing host...");
        this._isInitialized = false; 
        this._checkReady();
    });
  }

  async _checkReady() {
    if (this._isInitialized || !this._yamlService || !this._persistenceManager) return;
    this._isInitialized = true;

    try {
        const context = this.context;
        const pm = this._persistenceManager;
        const yaml = this._yamlService;
        const logger = this.logger;

        // A. Seed Static Strategies
        const strategiesPath = this.resolveResource("data/strategies.yaml");
        const resStrats = await fetch(strategiesPath);
        if (resStrats.ok) {
            const stratsText = await resStrats.text();
            const yamlStrats = yaml.load(stratsText) || {};
            for (const s of Object.values(yamlStrats)) {
                this._runtimeStrategies.set(s.id, s);
            }
            this.logger.info(`DO Registry: Loaded ${Object.keys(yamlStrats).length} static strategies.`);
        } else {
            this.logger.warn(`DO Registry: Could not load static strategies from ${strategiesPath}`);
        }

        // B. Ensure Instance State
        // Bugfix: Removed preemptive pm.store(DO_INSTANCES_PID, {}) here to prevent overwriting
        // remote Firebase data with {} before Firebase PM has fully hydrated.

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

            // Enrich raw instances for "Show All" mode (Phase 9)
            const instances = pm.load(DO_INSTANCES_PID) || {};
            const enrichedInstances = Object.fromEntries(
                Object.entries(instances).map(([id, inst]) => {
                    const strategy = this._runtimeStrategies.get(inst.strategyId || "LOCAL_STRATEGY");
                    const allowedActions = (strategy?.actions || []).map(a => ({ ...a, allowed: true }));
                    return [id, { ...inst, strategy, allowedActions }];
                })
            );

            states.forEach(s => {
                s.domainObjectSpecs = mergedBlueprints;
                s.domainObjectStrategies = Object.fromEntries(this._runtimeStrategies);
                s.domainObjectInstances = instances;
                s.parsedDOStrategies = s.domainObjectStrategies;
                s.parsedDOInstances = enrichedInstances;


                
                // Initialize Admin Toggle State
                if (s.showAllDOs === undefined) s.showAllDOs = false;
                
                // Admin Helper (Never Played Realm Standard)
                s.isRegistryAdmin = () => {
                    let user = s.session?.currentUser;
                    if (!user && context) {
                        const sRef = context.getServiceReference(SESSION_SERVICE);
                        if (sRef) user = context.getService(sRef)?.currentUser;
                    }
                    if (!user) return false;
                    
                    // 1. Check Capabilities (NPRF Standard Array)
                    const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
                    
                    // 2. Check Attributes (Generic Object/Array)
                    const rawAttrs = user.attributes || {};
                    const attrs = Array.isArray(rawAttrs) ? rawAttrs : Object.keys(rawAttrs).filter(k => !!rawAttrs[k]);
                    
                    const adminRoles = ['neverplayed-admin', 'realm-admin', 'admin', 'superuser'];
                    const hasRole = adminRoles.some(role => caps.includes(role) || attrs.includes(role));
                    
                    // 3. Fallback for Local Dev / Known Admin IDs
                    const isKnownAdmin = ['dd', 'daniela', 'system', 'daniel.doegl@doegl.info'].includes(user.id);
                    
                    return hasRole || isKnownAdmin;
                };

                if (!s.handleAction) {
                    s.handleAction = (action, instance) => registryService.handleAction(action, instance, s);
                }
                
                // Trigger Limes Re-evaluation when toggle changes (Phase 9)
                s.toggleShowAllDOs = () => {
                    s.showAllDOs = !s.showAllDOs;
                    if (!s.showAllDOs) {
                        globalThis.dispatchEvent(new CustomEvent('shell-security-reevaluate'));
                        this.logger.info("DO Registry: Toggle OFF -> Triggered security re-evaluation.");
                    }
                    if (s.recompile) s.recompile();
                };

                if (!s.instantiateDO) {
                    s.instantiateDO = (specId) => {
                        const spec = s.domainObjectSpecs.find(sp => sp.id === specId);
                        if (!spec) return this.logger.error(`DO Registry: Spec ${specId} not found.`);
                        const strategyId = spec.domainObject?.strategyId || "LOCAL_STRATEGY";
                        const strategySvc = this._runtimeStrategies.get(strategyId);
                        if (!strategySvc?.createInstance) return this.logger.error(`DO Registry: Strategy [${strategyId}] not ready.`);
                        const inst = strategySvc.createInstance(spec);
                        if (s.recompile) s.recompile();
                        return inst;
                    };
                }

                // Bridge Methods for Design-Time Editors (Phase 7 Harmonization)
                if (!s.editDomainObjectVisual) {
                    s.editDomainObjectVisual = (id) => this.logger.warn(`DO Registry: Visual Editor not available for ${id}`);
                }
                if (!s.editDomainObjectYAML) {
                    s.editDomainObjectYAML = (id) => {
                        const spec = s.domainObjectSpecs.find(sp => sp.id === id);
                        if (!spec) return this.logger.error(`DO Registry: Spec ${id} not found.`);
                        
                        const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
                        const editorSvc = editorRef ? context.getService(editorRef) : null;
                        
                        if (editorSvc) {
                            editorSvc.edit({
                                title: `Edit Blueprint: ${id}`,
                                data: spec,
                                onSave: (updated) => {
                                    registryService.addBlueprint(updated);
                                    this.logger.info(`DO Registry: Blueprint ${id} updated.`);
                                    if (s.recompile) s.recompile();
                                }
                            });
                        } else {
                            this.logger.warn("DO Registry: YAML_EDITOR_SERVICE not found.");
                            alert("YAML Editor Service is not available.");
                        }
                    };
                }
                if (!s.openDOStrategiesEditor) {
                    s.openDOStrategiesEditor = () => this.logger.warn("DO Registry: Strategies Editor not available");
                }

                if (s.recompile) s.recompile();
            });

            // Force a security re-evaluation so 'host.currentDOs' (and evaluatedData) updates on add/delete
            globalThis.dispatchEvent(new CustomEvent('shell-security-reevaluate'));
        };

        // Poll a few times after boot to catch asynchronous PM hydration (Firebase)
        [1000, 2500, 5000].forEach(delay => setTimeout(syncWithHost, delay));

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
            templateUrl: this.resolveResource("templates/overview.html"),
            onActivate: (hostState) => {
                syncWithHost();
                if (!Object.getOwnPropertyDescriptor(hostState, 'currentDOs')) {
                    Object.defineProperty(hostState, 'currentDOs', {
                        get() {
                            const host = globalThis.backofficeState || globalThis.businessPortalState || hostState;
                            let user = host?.session?.currentUser;
                            if (!user && context) {
                                const sRef = context.getServiceReference(SESSION_SERVICE);
                                if (sRef) user = context.getService(sRef)?.currentUser;
                            }
                            const userId = user?.id;
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

        // Register Sidebar Proxy Flow (Rule 13 Compatibility)
        context.registerService(FLOW_SERVICE, {
            id: "domain-objects",
            title: "Domain Objects",
            launch: async (targetElement) => {
                const bsn = context.getBundle().getSymbolicName();
                if (targetElement.getAttribute('data-bsn') === bsn) return;

                const template = await (await fetch(this.resolveResource("templates/overview.html"))).text();
                targetElement.setAttribute('data-bsn', bsn);
                targetElement.innerHTML = `
                    <div id="do-registry-container" class="h-full w-full" x-data="{ host: globalThis.backofficeState || globalThis.businessPortalState }">
                        ${template}
                    </div>
                `;
                
                // Ensure state is synced before Alpine starts parsing
                syncWithHost();
                
                await globalThis.Alpine.nextTick();
                globalThis.Alpine.initTree(targetElement);
            }
        }, {
            "flow.id": "domain-objects",
            "sidebar": true,
            "icon": "fas fa-cubes",
            "title": "Domain Objects"
        });

        // F. Scan for discovery specs (Rule 4: Configuration over Code)
        const baseUrl = this.getBaseUrl();
        
        // Discovery: Scan for additional specs in data subfolder
        const specsPath = `${baseUrl}data/specs.yaml`;
        fetch(specsPath).then(async res => {
            if (res.ok) {
                const text = await res.text();
                const specData = yaml.load(text) || {};
                const specs = Array.isArray(specData) ? specData : (specData.domainObjectSpecs || []);
                this.logger.info(`DO Registry: Found ${specs.length} local specs via discovery.`);
                specs.forEach(s => registryService.addBlueprint(s));
            }
        }).catch(err => {
            if (err.status !== 404) this.logger.warn("DO Registry: Local spec discovery failed:", err);
        });

        // G. Scan for existing instances (Delayed to allow PM hydration and prevent overwrite loops)
        const instancesPath = `${baseUrl}data/instances.yaml`;
        setTimeout(() => {
            fetch(instancesPath).then(async res => {
                if (res.ok) {
                    const text = await res.text();
                    const instanceData = yaml.load(text) || {};
                    const instances = Array.isArray(instanceData) ? instanceData : (instanceData.domainObjectInstances || instanceData);
                    if (typeof instances === 'object' && !Array.isArray(instances)) {
                        for (const [id, inst] of Object.entries(instances)) registryService.addInstance({ ...inst, id });
                    } else if (Array.isArray(instances)) {
                        instances.forEach(inst => registryService.addInstance(inst));
                    }
                    this.logger.info(`DO Registry: Found ${Object.keys(instances).length} local instances via discovery.`);
                }
            }).catch(_err => {
                // Silently skip if no instances provided
            });
        }, 3000);

        this.logger.info("DO Registry: Service Registered successfully. 🏛️✅");
        globalThis.dispatchEvent(new CustomEvent('do-registry-ready'));

    } catch (err) {
        this.logger.error("DO Registry: Initialization failed:", err);
        this._isInitialized = false;
    }
  }

  stop() {}
}
