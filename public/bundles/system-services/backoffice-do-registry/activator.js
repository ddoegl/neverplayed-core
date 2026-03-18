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
                if (handler._sourceFlowId) {
                    const idx = actionHandlers.findIndex(h => h.id === handler.id && h._sourceFlowId === handler._sourceFlowId);
                    if (idx !== -1) {
                        actionHandlers[idx] = handler;
                        return;
                    }
                }
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

                // Expose DO Specs from LocalStorage (persisted via Ingestion Service) as reactive array
                if (!hostState.refreshSpecs) {
                    hostState.refreshSpecs = () => {
                        try {
                            const raw = localStorage.getItem('atomic_persisted_specs');
                            hostState.domainObjectSpecs = raw ? JSON.parse(raw) : [];
                        } catch (_e) {
                            hostState.domainObjectSpecs = [];
                        }
                    };
                    hostState.refreshSpecs();
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
                            hostState.refreshSpecs();
                        } catch (e) {
                            console.error(`DO Registry: Failed to ingest from server`, e);
                            alert(`Failed: ${e.message}`);
                        }
                    };
                }

                if (!hostState.moveItem) {
                    hostState.moveItem = (arr, index, offset) => {
                        if (!arr || !Array.isArray(arr)) return;
                        const newIdx = index + offset;
                        if (newIdx >= 0 && newIdx < arr.length) {
                            const temp = arr[index];
                            arr[index] = arr[newIdx];
                            arr[newIdx] = temp;
                        }
                    };
                }

                if (!hostState.createDomainObjectYAML) {
                    hostState.createDomainObjectYAML = () => {
                        const editor = getSvc(YAML_EDITOR_SERVICE);
                        const ingestion = getSvc(ATOMIC_SPEC_INGESTION_SERVICE);
                        
                        if (!editor || !ingestion) return console.error("DO Registry: Editor or Ingestion service NOT found.");

                        const template = {
                            id: "new-domain-object",
                            label: "New Domain Object",
                            domainObject: {
                                strategyId: "LOCAL_STRATEGY",
                                label: "Local Strategy",
                                properties: { "Status": "Draft" },
                                actions: [{ id: "view", label: "Open Flow", icon: "fas fa-folder-open" }]
                            },
                            permissionKeys: {
                                LOCAL_VIEW: { id: "LOCAL_VIEW", label: "local:view", value: "local:view" }
                            },
                            features: {
                                LOCAL_FLOWS: { id: "LOCAL_FLOWS", label: "local:flows", keys: ["LOCAL_VIEW"] }
                            },
                            capabilities: [
                                { id: "LOCAL_USER", operator: "OR", matchers: [{ type: "matchAlways" }], features: [{ id: "LOCAL_FLOWS", keys: ["LOCAL_VIEW"] }] }
                            ],
                            guards: [
                                { id: "LOCAL_VIEW", operator: "OR", matchers: [{ type: "matchAlways" }], features: [{ id: "LOCAL_FLOWS", keys: ["LOCAL_VIEW"] }] }
                            ],
                            ui: {
                                initialStep: "step_init",
                                steps: {
                                    step_init: {
                                        order: 1,
                                        title: "Initial Step",
                                        parts: {
                                            intro: { type: "text", value: "Hello from your new Flow!" }
                                        }
                                    }
                                }
                            }
                        };

                        editor.edit({
                            title: "Create Domain Object (YAML Developer Mode)",
                            data: template,
                            onSave: async (newSpec) => {
                                await ingestion.ingest(newSpec, { source: "local-storage", persist: true });
                                hostState.refreshSpecs();
                            }
                        });
                    };
                }

                if (!hostState.editDomainObjectYAML) {
                    hostState.editDomainObjectYAML = (specId) => {
                        const editor = getSvc(YAML_EDITOR_SERVICE);
                        const ingestion = getSvc(ATOMIC_SPEC_INGESTION_SERVICE);
                        
                        if (!editor || !ingestion) return console.error("DO Registry: Editor or Ingestion service NOT found.");

                        const spec = hostState.domainObjectSpecs.find(s => s.id === specId);
                        if (!spec) return console.error(`DO Registry: Spec ${specId} not found.`);

                        editor.edit({
                            title: `Edit DO - ${specId} (YAML)`,
                            data: spec,
                            onSave: async (updatedSpec) => {
                                await ingestion.ingest(updatedSpec, { source: "local-storage", persist: true });
                                hostState.refreshSpecs();
                            }
                        });
                    };
                }
                
                // Visual Editor State Modal Handlers
                if (!hostState.openVisualEditor) {
                    hostState.visualEditorData = null;
                    
                    hostState.createDomainObjectVisual = () => {
                        // Initialize empty state for the visual editor
                        hostState.visualEditorData = {
                            id: "new-domain-object",
                            label: "New Domain Object",
                            strategyId: "LOCAL_STRATEGY",
                            strategyLabel: "Local Strategy",
                            steps: []
                        };
                    };

                    hostState.editDomainObjectVisual = (specId) => {
                        const spec = hostState.domainObjectSpecs.find(s => s.id === specId);
                        if (!spec) return console.error(`DO Registry: Spec ${specId} not found.`);
                        
                        // Hydrate visual state from complex spec
                        const stepsArray = Object.entries(spec.ui?.steps || {}).map(([id, step]) => ({
                            id,
                            title: step.title,
                            order: step.order,
                            parts: Object.entries(step.parts || {}).map(([pid, part]) => {
                                const p = { id: pid, ...part };
                                if (p.type === 'row') {
                                    p.subParts = Object.entries(p.parts || {}).map(([spid, spart]) => ({ id: spid, ...spart }));
                                    delete p.parts;
                                }
                                return p;
                            })
                        })).sort((a,b) => (a.order||0) - (b.order||0));

                        hostState.visualEditorData = {
                            id: spec.id,
                            label: spec.label,
                            strategyId: spec.domainObject?.strategyId || "LOCAL_STRATEGY",
                            strategyLabel: spec.domainObject?.label || spec.label,
                            steps: stepsArray,
                            _originalSpec: spec // keep the remainder
                        };
                    };
                    
                    hostState.saveVisualEditor = async () => {
                        const data = hostState.visualEditorData;
                        const ingestion = getSvc(ATOMIC_SPEC_INGESTION_SERVICE);
                        if (!ingestion) return console.error("DO Registry: Ingestion service NOT found.");
                        
                        // Un-hydrate back into nested format
                        const stepsObj = {};
                        data.steps.forEach((step, idx) => {
                            const partsObj = {};
                            step.parts.forEach(p => {
                                const { id, subParts, ...rest } = p;
                                if (rest.type === 'row') {
                                    rest.parts = {};
                                    (subParts || []).forEach(sp => {
                                        const { id: spid, ...sprest } = sp;
                                        rest.parts[spid] = sprest;
                                    });
                                }
                                partsObj[id] = rest;
                            });
                            stepsObj[step.id] = {
                                order: idx + 1,
                                title: step.title,
                                parts: partsObj
                            };
                        });

                        const spec = data._originalSpec || {
                            permissionKeys: { LOCAL_VIEW: { id: "LOCAL_VIEW", label: "local:view", value: "local:view" } },
                            features: { LOCAL_FLOWS: { id: "LOCAL_FLOWS", label: "local:flows", keys: ["LOCAL_VIEW"] } },
                            capabilities: [{ id: "LOCAL_USER", operator: "OR", matchers: [{ type: "matchAlways" }], features: [{ id: "LOCAL_FLOWS", keys: ["LOCAL_VIEW"] }] }],
                            guards: [{ id: "LOCAL_VIEW", operator: "OR", matchers: [{ type: "matchAlways" }], features: [{ id: "LOCAL_FLOWS", keys: ["LOCAL_VIEW"] }] }]
                        };

                        spec.id = data.id;
                        spec.label = data.label;
                        spec.domainObject = {
                            strategyId: data.strategyId,
                            label: data.strategyLabel,
                            properties: spec.domainObject?.properties || { "Status": "Draft" },
                            actions: spec.domainObject?.actions || [{ id: "view", label: "Open Flow", icon: "fas fa-folder-open" }]
                        };
                        spec.ui = spec.ui || {};
                        spec.ui.initialStep = data.steps[0]?.id || "step_init";
                        spec.ui.steps = stepsObj;

                        await ingestion.ingest(spec, { source: "local-storage", persist: true });
                        hostState.refreshSpecs();
                        hostState.visualEditorData = null; // Close modal
                    };
                    
                    hostState.closeVisualEditor = () => {
                        hostState.visualEditorData = null;
                    }
                }
            }
        });
    };

    initData();
  }

  stop(_context) {}
}
