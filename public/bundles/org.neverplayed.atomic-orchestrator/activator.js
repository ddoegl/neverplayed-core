import { 
    FLOW_SERVICE, 
    YAML_SERVICE, 
    ATOMIC_MARKER_HEADER, 
    CAPABILITIES_DATA_SERVICE, 
    PERMISSION_DATA_SERVICE,
    FEATURE_DATA_SERVICE,
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    BO_EXTENSION_SERVICE,
    LIMES_SERVICE, 
    SIGNING_DATA_SERVICE,
    LOG_SERVICE,
    ATOMIC_SPEC_INGESTION_SERVICE,
    UI_FACTORY_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    ACTION_SERVICE
} from "core-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
  constructor() {
      super();
      this.registrations = {};
      this.specs = {}; // Store all specs for re-registration after reset
  }

  async onStart(context) {
    // 1. Setup Security Services Tracking
    const securityServices = [
        PERMISSION_DATA_SERVICE,
        FEATURE_DATA_SERVICE,
        CAPABILITIES_DATA_SERVICE,
        LIMES_SERVICE
    ];

    securityServices.forEach(svcId => {
        context.trackService(`(objectClass=${svcId})`, {
            addingService: (_ref) => {
                console.log(`Atomic Orchestrator: Security Service arrived [${svcId}]. Re-applying all known atomic security configs...`);
                // Give the service a moment to initialize its internal defaults if necessary
                setTimeout(() => this.reapplySecurityByService(context, svcId), 100);
            }
        }).open();
    });

    try {
        const yamlRef = context.getServiceReference(YAML_SERVICE);
        if (!yamlRef) {
            console.error("Atomic Orchestrator: YAML_SERVICE reference is null!");
        }
        const yaml = yamlRef ? context.getService(yamlRef) : null;
        if (!yaml) {
            console.error("Atomic Orchestrator: YAML_SERVICE could not be retrieved!");
        }

        const scanBundle = async (bundle) => {
            try {
                const headers = bundle.getHeaders() || {};
                const isAtomic = headers[ATOMIC_MARKER_HEADER] === "true" || 
                               (headers[ATOMIC_MARKER_HEADER.toLowerCase()] === "true") ||
                               (headers['x-atomic-bundle'] === "true") ||
                               (headers['X-Atomic-Bundle'] === "true");
                
                console.log(`[Atomic Orchestrator] Checking bundle ${bundle.getSymbolicName() || 'unknown'}: isAtomic=${isAtomic}`);

                if (!isAtomic) return;

                console.log(`Atomic Orchestrator: Processing bundle ${bundle.getSymbolicName()}`);
                
                // Robust Location Discovery (Rule 4: Configuration over Code)
                const baseUrl = BaseActivator.getBundleBaseUrl(bundle);
                const specUrl = `${baseUrl}spec.yaml`;

                const res = await fetch(specUrl);
                if (!res.ok) throw new Error(`Spec not found at ${specUrl}`);
                
                const text = await res.text();
                const spec = yaml.load(text);
                
                this.registerAtomicComponents(context, bundle, spec);
            } catch (e) {
                console.error(`Atomic Orchestrator: Failed to process ${bundle?.getSymbolicName ? bundle.getSymbolicName() : 'unknown'}`, e);
            }
        };

        // Tracking for existing and new bundles
        context.addBundleListener({
            bundleChanged: (event) => {
                // Trigger scan on installation or start
                if (event.type === 1 || event.type === 32 || 
                    event.type === "INSTALLED" || event.type === "STARTED") { 
                    scanBundle(event.bundle);
                }
            }
        });

        const bundles = context.getBundles() || [];
        console.log(`Atomic Orchestrator: Found ${bundles.length} bundles to scan initially.`);
        for (const b of bundles) {
            await scanBundle(b);
        }

        // 2. Scan LocalStorage
        this.scanLocalStorage(context);

        // 3. Scan domain-objects directory
        this.scanDomainObjects(context);

        // 4. Register Ingestion Service for remote ingestion
        context.registerService(ATOMIC_SPEC_INGESTION_SERVICE, {
            ingest: (spec, options = {}) => {
                const { source = "remote", persist = false } = options;
                console.log(`Atomic Orchestrator: Ingesting spec from ${source} (persist=${persist})`, spec);
                
                if (persist) {
                    try {
                        const key = 'atomic_persisted_specs';
                        const currentRaw = localStorage.getItem(key);
                        const current = currentRaw ? JSON.parse(currentRaw) : [];
                        // Avoid duplicates by ID
                        const filtered = current.filter(s => s.id !== spec.id);
                        filtered.push(spec);
                        localStorage.setItem(key, JSON.stringify(filtered));
                        console.log(`Atomic Orchestrator: Persisted spec ${spec.id} to LocalStorage`);
                    } catch (e) {
                        console.error("Atomic Orchestrator: Failed to persist spec", e);
                    }
                }

                this.registerAtomicComponents(context, null, spec, source);
            }
        });

    } catch (err) {
        console.error("Atomic Orchestrator: Unhandled error in start method:", err);
    }
  }

  reapplySecurityByService(context, serviceId) {
      Object.keys(this.specs).forEach(id => {
          const { bundle, spec, source } = this.specs[id];
          this.registerSecurity(context, bundle, spec, source, serviceId);
      });
  }

  registerSecurity(context, _bundle, spec, _source, specificServiceId = null) {
    const { id, capabilities, permissionKeys, features, guards } = spec;
    
    // Helper to get service reference and service
    const getSvc = (svcId) => {
        const ref = context.getServiceReference(svcId);
        return ref ? context.getService(ref) : null;
    };

    // 0. Permission Keys
    if (permissionKeys && (!specificServiceId || specificServiceId === PERMISSION_DATA_SERVICE)) {
        const permSvc = getSvc(PERMISSION_DATA_SERVICE);
        if (permSvc) {
            console.log(`Atomic Orchestrator [Security]: Registering permission keys for ${id}`);
            const current = permSvc.getPermissions() || {};
            Object.entries(permissionKeys).forEach(([key, val]) => {
                current[key] = { id: key, label: key.toLowerCase().replace(/_/g, ':'), value: key.toLowerCase().replace(/_/g, ':'), ...val };
            });
            permSvc.setPermissions(current);
        }
    }

    // 1. Features
    if (features && (!specificServiceId || specificServiceId === FEATURE_DATA_SERVICE)) {
        const featSvc = getSvc(FEATURE_DATA_SERVICE);
        if (featSvc) {
            console.log(`Atomic Orchestrator [Security]: Registering features for ${id}`);
            const current = featSvc.getFeatures() || {};
            Object.entries(features).forEach(([key, val]) => {
                current[key] = { id: key, label: key.toLowerCase().replace(/_/g, ':'), ...val };
            });
            featSvc.setFeatures(current);
        }
    }

    // 2. Capability Strategies
    if (capabilities && (!specificServiceId || specificServiceId === CAPABILITIES_DATA_SERVICE)) {
        const capSvc = getSvc(CAPABILITIES_DATA_SERVICE);
        if (capSvc) {
            console.log(`Atomic Orchestrator [Security]: Registering capabilities for ${id}`);
            const current = capSvc.getStrategies() || [];
            capabilities.forEach(newCap => {
                if (Array.isArray(newCap.features)) {
                    newCap.features = newCap.features.map(f => typeof f === 'string' ? { id: f } : f);
                }
                const idx = current.findIndex(c => c.id === newCap.id);
                if (idx === -1) current.push(newCap);
                else current[idx] = newCap;
            });
            capSvc.setStrategies(current);
        }
    }

    // 3. UI Guards (Limes Strategies)
    if (guards && (!specificServiceId || specificServiceId === LIMES_SERVICE)) {
        const limes = getSvc(LIMES_SERVICE);
        if (limes) {
            console.log(`Atomic Orchestrator [Security]: Registering UI guards for ${id}`);
            guards.forEach(g => {
                if (Array.isArray(g.features)) {
                    g.features = g.features.map(f => typeof f === 'string' ? { id: f } : f);
                }
                limes.registerStrategy(g.id, g);
            });
        }
    }
  }

  async scanDomainObjects(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = yamlRef ? context.getService(yamlRef) : null;
    if (!yaml) return;

    // In a real system, we'd fetch an index.json or scan the dir.
    // For this POC, we register the known remote-style specs.
    const remotes = ["sample-do.yaml"];//, "business-account-order.yaml"];
    
    for (const file of remotes) {
        try {
            const res = await fetch(`./domain-objects/${file}`);
            if (res.ok) {
                const text = await res.text();
                const spec = yaml.load(text);
                this.registerAtomicComponents(context, null, spec, "server");
            }
        } catch (e) {
            console.error(`Atomic Orchestrator: Failed to scan remote ${file}`, e);
        }
    }
  }

  scanLocalStorage(context) {
    try {
        const key = 'atomic_persisted_specs';
        const localSpecsRaw = localStorage.getItem(key);
        if (localSpecsRaw) {
            const specs = JSON.parse(localSpecsRaw);
            if (Array.isArray(specs)) {
                console.log(`Atomic Orchestrator: Found ${specs.length} specs in LocalStorage (${key})`);
                specs.forEach(spec => {
                    this.registerAtomicComponents(context, null, spec, "local-storage");
                });
            }
        }
    } catch (e) {
        console.error("Atomic Orchestrator: Failed to scan LocalStorage", e);
    }
  }

  registerAtomicComponents(context, bundle, spec, source = "bundle") {
    const { id, label, ui, domainObject, actions, caseTypes } = spec;
    const bsn = bundle ? bundle.getSymbolicName() : `synthetic.${source}.${id}`;
    const headers = bundle ? bundle.getHeaders() : {};
    
    console.log(`Atomic Orchestrator: Registering components for ${bsn} (${id}) from ${source}`);

    // Persist spec for re-registration after reset
    this.specs[id] = { bundle, spec, source };

    // Cleanup previous registrations for this DO (e.g., during live-editing)
    if (this.registrations[id]) {
        console.log(`Atomic Orchestrator: Unregistering previous components for ${id}`);
        this.registrations[id].forEach(reg => { try { reg.unregister(); } catch (_e) { /* ignore */ } });
    }
    this.registrations[id] = [];
    const trackReg = (reg) => { if (reg) this.registrations[id].push(reg); return reg; };

    // 0. Register Security Infrastructure (Permissions, Features, Capabilities, Guards)
    this.registerSecurity(context, bundle, spec, source);

    // Helper to get service reference and service
    const getSvc = (svcId) => {
        const ref = context.getServiceReference(svcId);
        return ref ? context.getService(ref) : null;
    };

    // Attempt to parse Configuration from manifest
    let manifestConfig = {};
    if (bundle) {
        const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
        const configRaw = headers[configKey];
        if (configRaw) {
            try {
                manifestConfig = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw;
            } catch (e) {
                console.warn(`Atomic Orchestrator: Failed to parse Configuration for ${bsn}`, e);
            }
        }
    }

    const flowType = manifestConfig.flowType || "atomic-flow";
    const channels = manifestConfig.channels || ["business-channel-web"];

    // 4. Register Flow Service (UI-DSL)
    if (ui) {
        trackReg(context.registerService(FLOW_SERVICE, {
            id,
            title: label || id,
            icon: spec.flow?.icon || manifestConfig.icon || "fas fa-atom",
            launch: (container, params = {}) => {
                const factoryRef = context.getServiceReference(UI_FACTORY_SERVICE);
                const factorySvc = factoryRef ? context.getService(factoryRef) : null;
                if (factorySvc) {
                    const el = factorySvc.create(spec, params);
                    container.innerHTML = "";
                    container.appendChild(el);
                    if (el.render) el.render();
                } else {
                    container.innerHTML = `<div class="p-4 text-red-500">UI Factory service not available.</div>`;
                }
            }
        }, {
            "flow.id": id,
            "flow.title": label || id,
            "flow.icon": spec.flow?.icon || manifestConfig.icon || "fas fa-atom",
            "flowType": flowType,
            "channels": channels,
            "bundle.symbolicName": bsn
        }));

        // Register as Backoffice Extension
        trackReg(context.registerService(BO_EXTENSION_SERVICE, {
            id,
            name: label || id,
            icon: spec.flow?.icon || manifestConfig.icon || "fas fa-atom",
            launch: (container, params = {}) => {
                const factoryRef = context.getServiceReference(UI_FACTORY_SERVICE);
                const factorySvc = factoryRef ? context.getService(factoryRef) : null;
                if (factorySvc) {
                    const el = factorySvc.create(spec, params);
                    container.innerHTML = "";
                    container.appendChild(el);
                    if (el.render) el.render();
                }
            }
        }, {
            "bundle.symbolicName": bsn
        }));
    }

    // 5. Register Domain Object Strategy & Instance
    if (domainObject) {
        const doRegistry = getSvc(DOMAIN_OBJECT_REGISTRY_SERVICE);
        if (doRegistry) {
            console.log(`Atomic Orchestrator: Registering DO for ${id}`);
            
            // Register Strategy if defined
            if (domainObject.strategyId) {
                const existingStrat = doRegistry.getStrategy(domainObject.strategyId);
                if (!existingStrat) {
                    // Default Actions if UI exists but no actions defined
                    let actions = domainObject.actions || [];
                    if (actions.length === 0 && ui) {
                        actions = [{ id: "view", label: "View Details", icon: "fas fa-eye" }];
                    }

                    doRegistry.addStrategy({
                        id: domainObject.strategyId,
                        label: domainObject.label || id,
                        limesPrefix: domainObject.limesPrefix || id.split('-')[0].toUpperCase(),
                        actions
                    });
                }
            }

            // Register the Blueprint (Specification) itself
            if (doRegistry.addBlueprint) {
                doRegistry.addBlueprint(spec);
            }

            // Register Action Handler for 'view' if UI exists
            if (ui) {
                const registerHandler = () => {
                   const registry = getSvc(DOMAIN_OBJECT_REGISTRY_SERVICE);
                   if (registry && registry.registerActionHandler) {
                       console.log(`Atomic Orchestrator: Registering 'view' handler for ${id}`);
                       registry.registerActionHandler({
                           id: "view",
                           _sourceFlowId: id, // Used for deduplication during live-reloads
                           match: (inst) => inst.blueprintId === id || inst.id === id, // Legacy support just in case
                           execute: (_inst, host) => {
                               console.log(`Atomic Orchestrator: [EXECUTE] Launching extension for ${id} (Instance: ${_inst.id})`);

                               if (host && host.loadStep) {
                                   const hostName = host === globalThis.backofficeState ? "Backoffice" : "Business Portal";
                                   console.log(`Atomic Orchestrator: Navigating to ${id} via active shell: ${hostName}`);
                                   host.loadStep(id, { instanceId: _inst.id });
                                } else {
                                    console.error("Atomic Orchestrator: [ERROR] Context missing in execute(). Host provided:", host ? typeof host : "undefined/null");
                                    if (!host) {
                                        console.warn("Atomic Orchestrator: [RECOVERY] Attempting fallback to DOM detection...");
                                        const fallback = document.getElementById("backoffice-root-container") ? globalThis.backofficeState : globalThis.businessPortalState;
                                        if (fallback && fallback.loadStep) {
                                            console.log("Atomic Orchestrator: [RECOVERY] Navigating via fallback host:", fallback === globalThis.backofficeState ? "Backoffice" : "Business Portal");
                                            fallback.loadStep(id, { instanceId: _inst.id });
                                        }
                                    }
                                }
                           }
                       });
                   } else {
                       console.warn(`Atomic Orchestrator: DO Registry not ready for handler registration (${id}). Retrying...`);
                       setTimeout(registerHandler, 500);
                   }
                };
                registerHandler();
               
                const registerDeleteHandler = () => {
                    const registry = getSvc(DOMAIN_OBJECT_REGISTRY_SERVICE);
                    if (registry && registry.registerActionHandler) {
                        console.log(`Atomic Orchestrator: Registering 'delete' handler for ${id}`);
                        registry.registerActionHandler({
                            id: "delete",
                            _sourceFlowId: id,
                            match: (inst) => inst.blueprintId === id || inst.id === id,
                            execute: (_inst, host) => {
                                console.log(`Atomic Orchestrator: [EXECUTE] Deleting instance ${_inst.id}`);
                                
                                // Look up strategy
                                const stratRefs = context.getServiceReferences(DOMAIN_STRATEGY_SERVICE) || [];
                                let strategySvc = null;
                                for (const ref of stratRefs) {
                                    const svc = context.getService(ref);
                                    if (svc && svc.id === _inst.strategyId) {
                                        strategySvc = svc;
                                        break;
                                    }
                                }

                                if (strategySvc && strategySvc.deleteInstance) {
                                    const success = strategySvc.deleteInstance(_inst.id, _inst.blueprintId);
                                    if (success && host && host.recompile) {
                                        host.recompile(); // Refresh UI
                                    }
                                } else {
                                    console.error(`Atomic Orchestrator: [ERROR] Delete handler failed. Strategy ${_inst.strategyId} not found or missing deleteInstance().`);
                                }
                            }
                        });
                    } else {
                        setTimeout(registerDeleteHandler, 500);
                    }
                };
                registerDeleteHandler();
            }
        }
    }

    // 6. Register Case Types
    if (caseTypes) {
        const signingSvc = getSvc(SIGNING_DATA_SERVICE);
        if (signingSvc) {
            console.log(`Atomic Orchestrator: Registering ${Object.keys(caseTypes).length} case types for ${id}`);
            const current = signingSvc.getCaseTypes() || [];
            const newTypes = Array.isArray(caseTypes) ? caseTypes : 
                             Object.entries(caseTypes).map(([cid, val]) => ({ id: cid, ...val }));
            
            newTypes.forEach(nt => {
                const idx = current.findIndex(t => t.id === nt.id);
                if (idx === -1) current.push(nt);
                else current[idx] = nt;
            });
            signingSvc.setCaseTypes(current);
        }
    }

    // 7. Register Action Services from Spec
    if (actions) {
        Object.entries(actions).forEach(([aid, actionSpec]) => {
            console.log(`Atomic Orchestrator: Registering action service ${aid} for ${id}`);
            
            trackReg(context.registerService(ACTION_SERVICE, {
                execute: async (params) => {
                    // Find the underlying outreach service for API calls
                    const outreachRef = context.getServiceReference(ACTION_SERVICE, "(action.id=apiService)");
                    const outreachSvc = outreachRef ? context.getService(outreachRef) : null;
                    
                    if (outreachSvc && actionSpec.type === "API") {
                        const mergedParams = JSON.parse(JSON.stringify({ ...actionSpec.params, ...params }));
                        
                        // Deep interpolation for synthetic actions
                        const deepInterp = (obj) => {
                            for (const k in obj) {
                                if (typeof obj[k] === 'string') {
                                    obj[k] = obj[k].replace(/\${(.+?)}/g, (_, varName) => mergedParams[varName] ?? "");
                                } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                                    deepInterp(obj[k]);
                                }
                            }
                        };
                        deepInterp(mergedParams);

                        return await outreachSvc.execute(mergedParams);
                    }
                    throw new Error(`Action handler for ${aid} (type: ${actionSpec.type}) not found.`);
                }
            }, {
                "action.id": aid,
                "bundle.symbolicName": bsn
            }));
        });
    }

    console.log(`Atomic Orchestrator: Successfully registered all components for ${bsn} (${id})`);
  }

  stop(_context) {
    console.log("Atomic Orchestrator: Stopped.");
  }
}
