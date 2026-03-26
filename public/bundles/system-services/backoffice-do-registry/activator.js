import { 
    YAML_SERVICE, 
    BO_EXTENSION_SERVICE, 
    YAML_EDITOR_SERVICE, 
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    LIMES_SERVICE, 
    ATOMIC_SPEC_INGESTION_SERVICE,
    EVALUATOR_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    DO_STRATEGIES_PID,
    DO_INSTANCES_PID
} from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  start(context) {
    // Using constants from shared-types.js

    // Helper for resilient service retrieval
    const getSvc = (id) => {
        const ref = context.getServiceReference(id);
        return ref ? context.getService(ref) : null;
    };

    // 1. Register Evaluator Service IMMEDIATELY (Pattern Alignment)
    // This ensure the property "domainObjects" is added at the right time in the eval chain
    context.registerService(EVALUATOR_SERVICE, {
        order: 500, // Run after roles and capabilities
        evaluate: (userCapabilities, _parsedLicenses, _hostState) => {
            const limes = getSvc(LIMES_SERVICE);
            const pm = getSvc(PM_INTERFACE_KEY);
            
            if (!limes || !pm) {
                if (!limes) console.warn("DO Registry: Limes service NOT found during evaluation.");
                return userCapabilities;
            }

            const instances = pm.load(DO_INSTANCES_PID) || {};
            const rawStrategies = pm.load(DO_STRATEGIES_PID) || {};
            const strategiesMap = Object.values(rawStrategies).reduce((acc, s) => {
                acc[s.id] = s;
                return acc;
            }, {});

            return userCapabilities.map(entry => {
                const visibleDOs = Object.values(instances).map(inst => {
                    const strategy = strategiesMap[inst.strategyId];
                    const allowedActions = (strategy?.actions || []).map(action => {
                        // For now, allow all actions (matchAlways)
                        return { ...action, allowed: true };
                    });
                    
                    return { ...inst, allowedActions, strategy };
                });

                //console.log(`DO Registry: Evaluated ${entry.user} -> Showing all ${visibleDOs.length} DOs for debugging.`);
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
        pm.store(DO_STRATEGIES_PID, yamlStrats);

        // Intialize empty Instances if null
        if (!pm.load(DO_INSTANCES_PID)) {
            pm.store(DO_INSTANCES_PID, {});
        }

        const actionHandlers = [];
        const systemSpecs = [];

        const registryService = {
            getStrategies: () => pm.load(DO_STRATEGIES_PID),
            getInstances: () => pm.load(DO_INSTANCES_PID),
            
            setStrategies: (newStrats) => {
                pm.store(DO_STRATEGIES_PID, newStrats);
                syncWithHost();
                if (globalThis.backofficeState) globalThis.backofficeState.recompile?.();
            },
            
            setInstances: (newInst) => {
                pm.store(DO_INSTANCES_PID, newInst);
                syncWithHost();
                if (globalThis.backofficeState) globalThis.backofficeState.recompile?.();
            },

            getInstance: (id) => {
                const insts = pm.load(DO_INSTANCES_PID) || {};
                const inst = insts[id];
                console.log(`DO Registry: getInstance(${id}) -> Found: ${!!inst} (Index size: ${Object.keys(insts).length})`);
                return inst;
            },

            getStrategy: (id) => {
                const strats = pm.load(DO_STRATEGIES_PID);
                return Object.values(strats || {}).find(s => s.id === id);
            },

            addStrategy: (strategy) => {
                const current = pm.load(DO_STRATEGIES_PID) || {};
                current[strategy.id] = strategy;
                registryService.setStrategies(current);
            },

            addInstance: (instance) => {
                const current = pm.load(DO_INSTANCES_PID) || {};
                current[instance.id] = instance;
                pm.store(DO_INSTANCES_PID, current); // PERIST!
                registryService.setInstances(current);
            },
            
            removeInstance: (id) => {
                const current = pm.load(DO_INSTANCES_PID) || {};
                if (current[id]) {
                    delete current[id];
                    pm.store(DO_INSTANCES_PID, current);
                    registryService.setInstances(current);
                }
            },

            addBlueprint: (spec) => {
                const idx = systemSpecs.findIndex(s => s.id === spec.id);
                if (idx !== -1) {
                    systemSpecs[idx] = spec;
                } else {
                    systemSpecs.push(spec);
                }
                syncWithHost();
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
                    handler.execute(instance, host);
                } else {
                    console.warn(`DO Registry: No handler found for ${action.id}`);
                }
            }
        };

        const syncWithHost = () => {
            const states = [globalThis.backofficeState, globalThis.businessPortalState].filter(Boolean);
            
            // Merge System Specs with Persisted Specs
            const raw = localStorage.getItem('atomic_persisted_specs');
            const persisted = raw ? JSON.parse(raw) : [];
            const mergedBlueprints = [...systemSpecs];
            
            persisted.forEach(ps => {
                if (!mergedBlueprints.find(s => s.id === ps.id)) mergedBlueprints.push(ps);
            });

            states.forEach(s => {
                s.domainObjectSpecs = mergedBlueprints;
                s.domainObjectStrategies = pm.load(DO_STRATEGIES_PID) || {};
                s.domainObjectInstances = pm.load(DO_INSTANCES_PID) || {};
                
                // Legacy compatibility
                s.parsedDOStrategies = s.domainObjectStrategies;
                s.parsedDOInstances = s.domainObjectInstances;

                // INJECT HELPERS into all states for cross-portal consistency
                if (!s.handleAction) {
                    s.handleAction = (action, instance) => {
                        console.log(`DO Registry: [ACTION] Triggering ${action.id} for ${instance.id}`);
                        registryService.handleAction(action, instance, s);
                    };
                }

                if (!s.instantiateDO) {
                    s.instantiateDO = (specId) => {
                        const spec = s.domainObjectSpecs.find(sp => sp.id === specId);
                        if (!spec) return console.error(`DO Registry: Spec ${specId} not found.`);

                        const strategyId = spec.domainObject?.strategyId || "LOCAL_STRATEGY";
                        
                        // Look up strategy from OSGi
                        const stratRefs = context.getServiceReferences(DOMAIN_STRATEGY_SERVICE) || [];
                        let strategySvc = null;
                        for (const ref of stratRefs) {
                            const svc = context.getService(ref);
                            if (svc && svc.id === strategyId) {
                                strategySvc = svc;
                                break;
                            }
                        }

                        if (!strategySvc) {
                            return console.error(`DO Registry: Strategy engine [${strategyId}] not found.`);
                        }

                        if (strategySvc.createInstance) {
                            const inst = strategySvc.createInstance(spec);
                            console.log(`DO Registry: Instantiated ${specId} via ${strategyId}`);
                            if (s.recompile) s.recompile();
                            return inst;
                        }
                    };
                }

                if (typeof s.recompile === 'function') {
                    s.recompile();
                }
            });
        };
        syncWithHost();

        // 3. REGISTER DEFAULT HANDLERS
        registryService.registerActionHandler({
            id: 'view',
            match: (_instance) => true,
            execute: (instance, host) => {
                console.log(`DO Registry: [SERVICE] Handling action view for instance ${instance.id}`);
                const blueprint = (host.domainObjectSpecs || []).find(s => s.id === instance.blueprintId);
                // Launch the flow with the specific instanceId
                if (blueprint?.ui) {
                    const params = { instanceId: instance.id };
                    console.log(`DO Registry: [NAVIGATE] Launching flow ${blueprint.id} for instance ${instance.id}`);
                    
                    if (typeof host.launchFlow === 'function') {
                        host.launchFlow(blueprint.id, null, params);
                    } else if (typeof host.loadStep === 'function') {
                        host.loadStep(blueprint.id, params);
                    } else {
                        globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: blueprint.id, step: null, params } }));
                    }
                } else {
                    console.error("DO Registry: Blueprint has no UI configuration, cannot view flow.");
                }
            }
        });

        registryService.registerActionHandler({
            id: 'delete',
            match: (_instance) => true,
            execute: (instance, host) => {
                console.log(`DO Registry: [SERVICE] Handling action delete for instance ${instance.id}`);
                const blueprint = (host.domainObjectSpecs || []).find(s => s.id === instance.blueprintId);
                const strategyId = instance.strategyId || blueprint?.domainObject?.strategyId || "LOCAL_STRATEGY";
                
                const stratRefs = context.getServiceReferences(DOMAIN_STRATEGY_SERVICE) || [];
                let strategySvc = null;
                for (const ref of stratRefs) {
                    const svc = context.getService(ref);
                    if (svc && svc.id === strategyId) {
                        strategySvc = svc;
                        break;
                    }
                }

                if (strategySvc?.deleteInstance) {
                    strategySvc.deleteInstance(instance.id, instance.blueprintId);
                } else {
                    console.error(`DO Registry: Strategy ${strategyId} does not support delete.`);
                }
            }
        });

        // Register Service
        context.registerService(DOMAIN_OBJECT_REGISTRY_SERVICE, registryService);
        console.log("DO Registry Service registered.");
        globalThis.dispatchEvent(new CustomEvent('do-registry-ready'));
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
                        syncWithHost();
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
                                    p.subParts = Object.entries(p.parts || {}).map(([spid, spart]) => {
                                        const sp = { id: spid, ...spart };
                                        if (sp.params) sp.paramsYaml = Object.entries(sp.params).map(([k,v]) => `${k}: "${v}"`).join('\n');
                                        return sp;
                                    });
                                    delete p.parts;
                                } else if (p.kind === 'command-button') {
                                    if (p.params) p.paramsYaml = Object.entries(p.params).map(([k,v]) => `${k}: "${v}"`).join('\n');
                                }
                                return p;
                            })
                        })).sort((a,b) => (a.order||0) - (b.order||0));

                        const propsArray = Object.entries(spec.domainObject?.properties || {}).map(([key, value]) => ({ key, value }));
                        const caseTypesArray = Object.values(spec.caseTypes || {});
                        const actionsArray = Object.entries(spec.actions || {}).map(([id, act]) => {
                            const paramsYaml = act.params ? Object.entries(act.params).map(([k,v]) => `${k}: "${v}"`).join('\n') : '';
                            return { id, type: act.type || 'LOCAL', paramsYaml };
                        });

                        hostState.visualEditorData = {
                            id: spec.id,
                            label: spec.label,
                            strategyId: spec.domainObject?.strategyId || "LOCAL_STRATEGY",
                            strategyLabel: spec.domainObject?.label || spec.label,
                            properties: propsArray,
                            caseTypes: caseTypesArray,
                            actions: actionsArray,
                            steps: stepsArray,
                            _originalSpec: spec // keep the remainder
                        };
                    };
                    
                    hostState.saveVisualEditor = async () => {
                        const data = hostState.visualEditorData;
                        const ingestion = getSvc(ATOMIC_SPEC_INGESTION_SERVICE);
                        if (!ingestion) return console.error("DO Registry: Ingestion service NOT found.");
                        
                        const parseParams = (yaml) => {
                            if (!yaml) return undefined;
                            const p = {};
                            yaml.split('\n').filter(l => l.trim()).forEach(l => {
                                const [k, ...v] = l.split(':');
                                if (k && v.length) p[k.trim()] = v.join(':').trim().replace(/^['"](.*)['"]$/, '$1');
                            });
                            return Object.keys(p).length > 0 ? p : undefined;
                        };

                        // Un-hydrate back into nested format
                        const stepsObj = {};
                        data.steps.forEach((step, idx) => {
                            const partsObj = {};
                            step.parts.forEach(p => {
                                const { id, subParts, paramsYaml, ...rest } = p;
                                if (rest.type === 'row') {
                                    rest.parts = {};
                                    (subParts || []).forEach(sp => {
                                        const { id: spid, paramsYaml: spYaml, ...sprest } = sp;
                                        if (spYaml) sprest.params = parseParams(spYaml);
                                        sprest.id = spid; // Retain explicit ID for components
                                        rest.parts[spid] = sprest;
                                    });
                                } else if (rest.kind === 'command-button' && paramsYaml) {
                                    rest.params = parseParams(paramsYaml);
                                }
                                rest.id = id; // Retain explicit ID for components
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
                        
                        const propsObj = {};
                        (data.properties || []).forEach(p => { if (p.key) propsObj[p.key] = p.value; });

                        spec.domainObject = {
                            strategyId: data.strategyId,
                            label: data.strategyLabel,
                            properties: Object.keys(propsObj).length > 0 ? propsObj : (spec.domainObject?.properties || { "Status": "Draft" }),
                            actions: spec.domainObject?.actions || [{ id: "view", label: "Open Flow", icon: "fas fa-folder-open" }]
                        };
                        spec.ui = spec.ui || {};
                        spec.ui.initialStep = data.steps[0]?.id || "step_init";
                        spec.ui.steps = stepsObj;

                        if (data.caseTypes && data.caseTypes.length > 0) {
                            spec.caseTypes = {};
                            data.caseTypes.forEach(ct => { spec.caseTypes[ct.id] = ct; });
                        } else {
                            delete spec.caseTypes;
                        }

                        if (data.actions && data.actions.length > 0) {
                            spec.actions = {};
                            data.actions.forEach(act => {
                                spec.actions[act.id] = { type: act.type, params: parseParams(act.paramsYaml) };
                            });
                        } else {
                            delete spec.actions;
                        }

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
