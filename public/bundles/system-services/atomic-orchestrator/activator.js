import { 
    FLOW_SERVICE, 
    YAML_SERVICE, 
    ATOMIC_MARKER_HEADER, 
    CAPABILITIES_DATA_SERVICE, 
    PERMISSION_DATA_SERVICE,
    FEATURE_DATA_SERVICE,
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    BO_EXTENSION_SERVICE,
    LIMES_SERVICE
} from "../../../shared-types.js";

export default class Activator {
  async start(context) {
    console.log("Atomic Orchestrator: Starting...");

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
                
                const specUrl = `./bundles/${bundle.getSymbolicName().replace(/\./g, '/')}/spec.yaml`;
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

        // 3. Register Ingestion Service for remote ingestion
        context.registerService("prototyper.atomic.ingestion", {
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
    const { id, label, capabilities, permissionKeys, features, guards, ui, domainObject } = spec;
    const bsn = bundle ? bundle.getSymbolicName() : `synthetic.${source}.${id}`;
    const headers = bundle ? bundle.getHeaders() : {};
    
    console.log(`Atomic Orchestrator: Registering components for ${bsn} (${id}) from ${source}`);

    // Helper to get service reference and service
    const getSvc = (id) => {
        const ref = context.getServiceReference(id);
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

    // --- 0. Pre-register Security Infrastructure (Permissions, Features, Capabilities, Guards) ---
    // This MUST happen before DO registration to avoid Limes evaluation race conditions.

    // 0. Permission Keys
    if (permissionKeys) {
        const permSvc = getSvc(PERMISSION_DATA_SERVICE);
        if (permSvc) {
            console.log(`Atomic Orchestrator: Registering ${Object.keys(permissionKeys).length} permission keys for ${id}`);
            const current = permSvc.getPermissions() || {};
            Object.entries(permissionKeys).forEach(([key, val]) => {
                current[key] = { id: key, label: key.toLowerCase().replace(/_/g, ':'), value: key.toLowerCase().replace(/_/g, ':'), ...val };
            });
            permSvc.setPermissions(current);
        }
    }

    // 1. Features
    if (features) {
        const featSvc = getSvc(FEATURE_DATA_SERVICE);
        if (featSvc) {
            console.log(`Atomic Orchestrator: Registering ${Object.keys(features).length} features for ${id}`);
            const current = featSvc.getFeatures() || {};
            Object.entries(features).forEach(([key, val]) => {
                current[key] = { id: key, label: key.toLowerCase().replace(/_/g, ':'), ...val };
            });
            featSvc.setFeatures(current);
        }
    }

    // 2. Capability Strategies
    if (capabilities) {
        const capSvc = getSvc(CAPABILITIES_DATA_SERVICE);
        if (capSvc) {
            console.log(`Atomic Orchestrator: Registering ${capabilities.length} capabilities for ${id}`);
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
    if (guards) {
        const limes = getSvc(LIMES_SERVICE);
        if (limes) {
            console.log(`Atomic Orchestrator: Registering ${guards.length} UI guards for ${id}`);
            guards.forEach(g => {
                if (Array.isArray(g.features)) {
                    g.features = g.features.map(f => typeof f === 'string' ? { id: f } : f);
                }
                limes.registerStrategy(g.id, g);
            });
        }
    }

    // 4. Register Flow Service (UI-DSL)
    if (ui) {
        context.registerService(FLOW_SERVICE, {
            id,
            title: label || id,
            icon: spec.flow?.icon || manifestConfig.icon || "fas fa-atom",
            launch: (container) => {
                const factoryRef = context.getServiceReference("prototyper.ui.factory");
                const factorySvc = factoryRef ? context.getService(factoryRef) : null;
                if (factorySvc) {
                    const el = factorySvc.create(spec.ui);
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
        });

        // Register as Backoffice Extension
        context.registerService(BO_EXTENSION_SERVICE, {
            id,
            name: label || id,
            icon: spec.flow?.icon || manifestConfig.icon || "fas fa-atom",
            launch: (container) => {
                const factoryRef = context.getServiceReference("prototyper.ui.factory");
                const factorySvc = factoryRef ? context.getService(factoryRef) : null;
                if (factorySvc) {
                    const el = factorySvc.create(spec.ui);
                    container.innerHTML = "";
                    container.appendChild(el);
                    if (el.render) el.render();
                }
            }
        }, {
            "bundle.symbolicName": bsn
        });
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
            // Register Instance
            doRegistry.addInstance({
                id,
                strategyId: domainObject.strategyId,
                label: domainObject.label || label || id,
                properties: domainObject.properties || []
            });

            // Register Action Handler for 'view' if UI exists
            if (ui) {
                const registerHandler = () => {
                   const registry = getSvc(DOMAIN_OBJECT_REGISTRY_SERVICE);
                   if (registry && registry.registerActionHandler) {
                       console.log(`Atomic Orchestrator: Registering 'view' handler for ${id}`);
                       registry.registerActionHandler({
                           id: "view",
                           match: (inst) => inst.id === id,
                           execute: (_inst, host) => {
                               console.log(`Atomic Orchestrator: [EXECUTE] Launching extension for ${id}`);

                               if (host && host.loadStep) {
                                   const hostName = host === globalThis.backofficeState ? "Backoffice" : "Business Portal";
                                   console.log(`Atomic Orchestrator: Navigating to ${id} via active shell: ${hostName}`);
                                   host.loadStep(id);
                                } else {
                                    console.error("Atomic Orchestrator: [ERROR] Context missing in execute(). Host provided:", host ? typeof host : "undefined/null");
                                    if (!host) {
                                        console.warn("Atomic Orchestrator: [RECOVERY] Attempting fallback to DOM detection...");
                                        const fallback = document.getElementById("backoffice-root-container") ? globalThis.backofficeState : globalThis.businessPortalState;
                                        if (fallback && fallback.loadStep) {
                                            console.log("Atomic Orchestrator: [RECOVERY] Navigating via fallback host:", fallback === globalThis.backofficeState ? "Backoffice" : "Business Portal");
                                            fallback.loadStep(id);
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
            }
        }
    }

    console.log(`Atomic Orchestrator: Successfully registered all components for ${bsn} (${id})`);
  }

  stop(_context) {
    console.log("Atomic Orchestrator: Stopped.");
  }
}
