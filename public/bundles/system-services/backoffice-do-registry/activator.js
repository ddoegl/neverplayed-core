import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, DOMAIN_OBJECT_REGISTRY_SERVICE, LIMES_SERVICE, ATOMIC_SPEC_INGESTION_SERVICE } from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  start(context) {
    const STRATEGIES_PID = "pandino.backoffice.do.strategies";
    const INSTANCES_PID = "pandino.backoffice.do.instances";

    // Helper for resilient service retrieval
    const getSvc = (id) => {
        const ref = context.getServiceReference(id);
        return ref ? context.getService(ref) : null;
    };

    // 1. Register Evaluator Service IMMEDIATELY (Pattern Alignment)
    // This ensure the property "domainObjects" is added at the right time in the eval chain
    context.registerService("backoffice.evaluator", {
        order: 500, // Run after roles and capabilities
        evaluate: (userCapabilities, _parsedLicenses, _hostState) => {
            const limes = getSvc(LIMES_SERVICE);
            const pm = getSvc(PM_INTERFACE_KEY);
            
            if (!limes || !pm) {
                if (!limes) console.warn("DO Registry: Limes service NOT found during evaluation.");
                return userCapabilities;
            }

            const instances = pm.load(INSTANCES_PID) || {};
            const rawStrategies = pm.load(STRATEGIES_PID) || {};
            const strategiesMap = Object.values(rawStrategies).reduce((acc, s) => {
                acc[s.id] = s;
                return acc;
            }, {});

            return userCapabilities.map(entry => {
                const visibleDOs = Object.values(instances).filter(inst => {
                    const strategy = strategiesMap[inst.strategyId];
                    const prefix = (strategy?.limesPrefix || "DO").toUpperCase();
                    const strategyId = strategy?.limesPrefix ? `${prefix}_VIEW` : `${prefix}_VIEW_ALLOWED`;
                    const allowed = limes.isAllowed(entry, strategyId, inst);
                    // console.debug(`DO Registry: Checking visibility for ${inst.id} (${strategyId}) -> ${allowed}`);
                    return allowed;
                }).map(inst => {
                    const strategy = strategiesMap[inst.strategyId];
                    const prefix = (strategy?.limesPrefix || "DO").toUpperCase();
                    const allowedActions = (strategy?.actions || []).filter(action => {
                        const actionId = action.id.toUpperCase();
                        const actionKey = strategy?.limesPrefix ? `${prefix}_${actionId}` : `${prefix}_${actionId}_ALLOWED`;
                        const allowed = limes.isAllowed(entry, actionKey, inst);
                        console.debug(`DO Registry: Action ${actionKey} for ${inst.id} -> ${allowed}`);
                        return allowed;
                    });
                    if (allowedActions.length === 0) {
                        const keys = entry.grantedKeys || {};
                        console.warn(`DO Registry: NO actions found for ${inst.id}. User keys:`, Object.keys(keys).filter(k => k.startsWith('DO_')));
                    }
                    return { ...inst, allowedActions, strategy };
                });

                console.log(`DO Registry: Evaluated ${entry.user} -> Found ${visibleDOs.length} DOs.`);
                return { 
                    ...entry, 
                    domainObjects: visibleDOs 
                };
            });
        }
    });

    // 2. Initial Seeding/Loading (Async)
    const initData = async () => {
        const yaml = getSvc(YAML_SERVICE);
        const pm = getSvc(PM_INTERFACE_KEY);

        if (!yaml || !pm) {
            console.warn("DO Registry: Infrastructure services not ready for seeding. Retrying in 100ms...");
            setTimeout(initData, 100);
            return;
        }

        // Strategies
        const resStrats = await fetch("./bundles/system-services/backoffice-do-registry/data/strategies.yaml");
        const stratsText = await resStrats.text();
        const yamlStrats = yaml.load(stratsText) || {};
        pm.store(STRATEGIES_PID, yamlStrats);

        // Instances
        const resInst = await fetch("./bundles/system-services/backoffice-do-registry/data/instances.yaml");
        const instText = await resInst.text();
        const yamlInst = yaml.load(instText) || {};
        pm.store(INSTANCES_PID, yamlInst);

        // Sync with global-state for reactivity
        const syncWithHost = () => {
            const states = [globalThis.backofficeState, globalThis.businessPortalState].filter(Boolean);
            states.forEach(s => {
                s.parsedDOStrategies = pm.load(STRATEGIES_PID);
                s.parsedDOInstances = pm.load(INSTANCES_PID);
                if (typeof s.recompile === 'function') {
                    console.log("DO Registry: Triggering re-evaluation on host state after seeding.");
                    s.recompile();
                }
            });
        };
        syncWithHost();

        const actionHandlers = [];

        const registryService = {
            getStrategies: () => pm.load(STRATEGIES_PID),
            getInstances: () => pm.load(INSTANCES_PID),
            
            setStrategies: (newStrats) => {
                pm.store(STRATEGIES_PID, newStrats);
                syncWithHost();
                if (globalThis.backofficeState) globalThis.backofficeState.recompile?.();
            },
            
            setInstances: (newInst) => {
                pm.store(INSTANCES_PID, newInst);
                syncWithHost();
                if (globalThis.backofficeState) globalThis.backofficeState.recompile?.();
            },

            getInstance: (id) => {
                const insts = pm.load(INSTANCES_PID);
                return Object.values(insts || {}).find(i => i.id === id);
            },

            getStrategy: (id) => {
                const strats = pm.load(STRATEGIES_PID);
                return Object.values(strats || {}).find(s => s.id === id);
            },

            addStrategy: (strategy) => {
                const current = pm.load(STRATEGIES_PID) || {};
                // Force ID as key for consistency/no-duplicates
                current[strategy.id] = strategy;
                registryService.setStrategies(current);
            },

            addInstance: (instance) => {
                const current = pm.load(INSTANCES_PID) || {};
                // Force ID as key for consistency/no-duplicates
                current[instance.id] = instance;
                registryService.setInstances(current);
            },

            registerActionHandler: (handler) => {
                console.log("DO Registry: Registering action handler", handler);
                actionHandlers.push(handler);
            },

            handleAction: (action, instance, host) => {
                console.log(`DO Registry: [SERVICE] Handling action ${action.id} for instance ${instance.id}`);
                const handler = actionHandlers.find(h => h.id === action.id && h.match(instance));
                if (handler) {
                    console.log("DO Registry: [SERVICE] Handler found, executing...");
                    handler.execute(instance, host);
                } else {
                    console.warn(`DO Registry: [SERVICE] No handler found for action ${action.id} (Instances matched: ${actionHandlers.filter(h => h.id === action.id).length})`);
                }
            }
        };

        // Register Service
        context.registerService(DOMAIN_OBJECT_REGISTRY_SERVICE, registryService);
        console.log("DO Registry: Service Registered successfully. 🏛️✅");

        // Register UI Extension
        context.registerService(BO_EXTENSION_SERVICE, {
            id: "domain-objects",
            name: "Domain Objects",
            icon: "fas fa-cubes",
            templateUrl: "./bundles/system-services/backoffice-do-registry/templates/overview.html",
            onActivate: (hostState) => {
                // Initial sync when activated
                syncWithHost();

                // Expose handleAction to Alpine.js
                if (!hostState.handleAction) {
                    hostState.handleAction = (action, instance) => {
                        console.log(`DO Registry: [ACTION] Triggering ${action.id} for ${instance.id}`);
                        registryService.handleAction(action, instance, hostState);
                    };
                }

                // Expose evaluated DOs for the current user
                if (!Object.getOwnPropertyDescriptor(hostState, 'currentDOs')) {
                    Object.defineProperty(hostState, 'currentDOs', {
                        get() {
                            const getActiveHost = () => {
                                if (globalThis.backofficeState?.session?.currentUser) return globalThis.backofficeState;
                                if (globalThis.businessPortalState?.session?.currentUser) return globalThis.businessPortalState;
                                return hostState;
                            };
                            const host = getActiveHost();
                            const userId = host?.session?.currentUser?.id;
                            if (!userId) return [];
                            const entry = Array.isArray(host?.evaluatedData) ? host.evaluatedData.find(d => String(d.user) === String(userId)) : null;
                            // console.debug(`DO Registry: Resolved currentDOs for ${userId} -> ${entry?.domainObjects?.length || 0} items`);
                            return Array.isArray(entry?.domainObjects) ? entry.domainObjects : [];
                        },
                        enumerable: true,
                        configurable: true
                    });
                }

                if (!hostState.openDOStrategiesEditor) {
                    hostState.openDOStrategiesEditor = () => {
                        const editor = getSvc(YAML_EDITOR_SERVICE);
                        if (editor) {
                            const data = registryService.getStrategies();
                            console.log("DO Registry: Opening Strategies Editor with data:", data);
                            editor.edit({
                                title: "DO Strategy Configuration",
                                data,
                                onSave: (newData) => {
                                    console.log("DO Registry: Saving Strategies:", newData);
                                    registryService.setStrategies(newData);
                                }
                            });
                        } else {
                            console.error("DO Registry: YAML Editor service NOT found.");
                        }
                    };
                }

                if (!hostState.openDOInstancesEditor) {
                    hostState.openDOInstancesEditor = () => {
                        const editor = getSvc(YAML_EDITOR_SERVICE);
                        if (editor) {
                            const data = registryService.getInstances();
                            console.log("DO Registry: Opening Instances Editor with data:", data);
                            editor.edit({
                                title: "DO Instance Configuration",
                                data,
                                onSave: (newData) => {
                                    console.log("DO Registry: Saving Instances:", newData);
                                    registryService.setInstances(newData);
                                }
                            });
                        } else {
                            console.error("DO Registry: YAML Editor service NOT found.");
                        }
                    };
                }

                if (!hostState.ingestFromServer) {
                    hostState.ingestFromServer = async () => {
                        const name = prompt("Enter Domain Object Name (e.g. sample-do):");
                        if (!name) return;
                        
                        const yaml = getSvc(YAML_SERVICE);
                        const ingestion = getSvc(ATOMIC_SPEC_INGESTION_SERVICE);
                        
                        if (!yaml || !ingestion) {
                            console.error("DO Registry: Infrastructure services not ready.");
                            return;
                        }

                        try {
                            const res = await fetch(`./domain-objects/${name}.yaml`);
                            if (!res.ok) throw new Error(`DO spec not found: ${name}`);
                            const text = await res.text();
                            const spec = yaml.load(text);
                            // Persist remote specs!
                            await ingestion.ingest(spec, { source: "server", persist: true });
                        } catch (e) {
                            console.error(`DO Registry: Failed to ingest from server`, e);
                            alert(`Failed: ${e.message}`);
                        }
                    };
                }

                if (!hostState.addLocalDO) {
                    hostState.addLocalDO = () => {
                        const editor = getSvc(YAML_EDITOR_SERVICE);
                        const ingestion = getSvc(ATOMIC_SPEC_INGESTION_SERVICE);
                        
                        if (!editor || !ingestion) {
                            console.error("DO Registry: Editor or Ingestion service NOT found.");
                            return;
                        }

                        const template = {
                            id: "local-" + Date.now(),
                            label: "My Local DO",
                            domainObject: {
                                strategyId: "LOCAL_STRATEGY",
                                label: "Local Strategy",
                                properties: {
                                    "Status": "Draft"
                                }
                            },
                            ui: {
                                parts: {
                                    "title": { type: "text", value: "Hello from Local Storage!" }
                                }
                            }
                        };

                        editor.edit({
                            title: "Define Local Domain Object",
                            data: template,
                            onSave: async (newSpec) => {
                                // Persistence is now handled by the ingestion service!
                                await ingestion.ingest(newSpec, { source: "local-storage", persist: true });
                            }
                        });
                    };
                }
            }
        });
    };

    initData();
  }

  stop(_context) {}
}
