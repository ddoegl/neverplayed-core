/**
 * @file Activator for org.neverplayed.atomic-orchestrator
 * @module platform/bundles/org.neverplayed.atomic-orchestrator
 */

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
    LOG_SERVICE as _LOG_SERVICE,
    ATOMIC_SPEC_INGESTION_SERVICE,
    UI_FACTORY_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    ACTION_SERVICE,
    SHELL_COMMAND_SERVICE,
    PERSISTENCE_MANAGER_SERVICE,
    INTERACTOR_SERVICE
} from "core-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
  constructor() {
      super();
      this.registrations = {};
      this.specs = {}; // Store all specs for re-registration after reset
      this._managedContainers = new Set();
      this._warnedBlueprints = new Set(); // Track quiet retries
  }

  onStart(context) {
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
                this.logger.debug(`Security Service arrived [${svcId}]. Re-applying configs...`);
                // Give the service a moment to initialize its internal defaults if necessary
                setTimeout(() => this.reapplySecurityByService(context, svcId), 100);
            }
        }).open();
    });

    try {
        const yamlRef = context.getServiceReference(YAML_SERVICE);
        if (!yamlRef) {
            this.logger.error("Atomic Orchestrator: YAML_SERVICE reference is null!");
        }
        const yaml = yamlRef ? context.getService(yamlRef) : null;
        if (!yaml) {
            this.logger.error("Atomic Orchestrator: YAML_SERVICE could not be retrieved!");
        }

        const scanBundle = async (bundle) => {
            try {
                if (!bundle) return;
                const bsn = bundle.getSymbolicName();
                const state = bundle.getState();
                const headers = bundle.getHeaders() || {};
                
                // Helper for universal header access (Defensive against Map vs Object in varied Pandino containers)
                const getHeader = (h, key) => {
                    if (typeof h.get === 'function') return h.get(key);
                    const normalized = key.toLowerCase();
                    const actualKey = Object.keys(h).find(k => k.toLowerCase() === normalized);
                    return actualKey ? h[actualKey] : undefined;
                };

                const marker = getHeader(headers, ATOMIC_MARKER_HEADER);
                const isAtomic = marker === "true" || marker === true;

                this.logger.debug(`Scanning: ${bsn} | Atomic Marker: ${isAtomic}`);
                
                if (!isAtomic) return;

                // Rule 11: Aggressive Ingestion - Process RESOLVED or ACTIVE bundles
                if (state < 4) return; // Below RESOLVED
                const baseUrl = BaseActivator.getBundleBaseUrl(bundle);
                if (!baseUrl) {
                    this.logger.warn(`Atomic Orchestrator: Could not resolve base URL for ${bsn}. Skipping.`);
                    return;
                }

                const specUrl = `${baseUrl}spec.yaml`;
                const res = await fetch(specUrl);
                if (!res.ok) return;
                
                const text = await res.text();
                const spec = yaml.load(text);
                if (!spec || !spec.id) {
                    this.logger.error(`[FORENSIC] Atomic Orchestrator: Spec at ${specUrl} is malformed or missing ID.`);
                    return;
                }
                
                this.logger.debug(`[FORENSIC] Atomic Orchestrator: [INGEST] Successfully parsed spec '${spec.id}' from ${bsn}`);
                this.registerAtomicComponents(context, bundle, spec);
            } catch (e) {
                this.logger.error(`Atomic Orchestrator: Exception during scan for ${bundle?.getSymbolicName ? bundle.getSymbolicName() : 'unknown'}: ${e.message}`, e);
            }
        };

        // Tracking for existing and new bundles
        context.addBundleListener({
            bundleChanged: (event) => {
                if (event.type === 1 || event.type === 4 || event.type === 32 || 
                    event.type === "INSTALLED" || event.type === "RESOLVED" || event.type === "STARTED") { 
                    scanBundle(event.bundle);
                }
            }
        });

        // 2. Persistence Manager Discovery & Hydration Gating (SDN-0047)
        this._pmTracker = context.trackService(`(objectClass=${PERSISTENCE_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                const pm = context.getService(ref);
                this.persistence = pm;
                this.logger.info("Atomic Orchestrator: Persistence Manager discovered. Configuring routing policies...");
                
                (async () => {
                    if (typeof pm.waitReady === 'function') {
                        this.logger.info("Atomic Orchestrator: Awaiting Persistence Hub hydration...");
                        await pm.waitReady();
                    }
                    
                    this.scanLocalStorage(context);
                })();
                
                return pm;
            },
            removedService: () => {
                this.persistence = null;
            }
        });
        this._pmTracker.open();

        // 2.5 Universal Interactor Discovery
        this._interactorTracker = context.trackService(`(objectClass=${INTERACTOR_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this._interactor = svc;
                this.logger.info("Atomic Orchestrator: Universal Interactor discovered. Archival safeguards active.");
                return svc;
            },
            removedService: () => {
                this._interactor = null;
            }
        });
        this._interactorTracker.open();

        // 3. Centralized Discovery Cycle (Boot & Refresh)
        const runRefresh = (log = console.log) => {
            const allBundles = context.getBundles() || [];
            allBundles.forEach(b => scanBundle(b));
            this.scanLocalStorage(context);
            this.scanDomainObjects(context);
            log("Atomic Orchestrator: Universe discovery cycle complete.");
        };

        // Rule 16: Immediate Boot Discovery (SDN-0071)
        runRefresh();

        // 4. Register Ingestion Service for remote ingestion
        context.registerService(ATOMIC_SPEC_INGESTION_SERVICE, {
            ingest: (spec, options = {}) => {
                const { source = "remote", persist = false } = options;
                this.logger.info(`Atomic Orchestrator: Ingesting spec from ${source} (persist=${persist})`, spec);
                
                if (persist) {
                    try {
                        const pmRef = context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
                        const pm = this.persistence || (pmRef ? context.getService(pmRef) : null);
                        if (pm) {
                            const bucket = `realm.design.blueprints_${spec.id}`;
                            const persistedSpec = { ...spec, _isPersisted: true };
                            pm.store(bucket, persistedSpec);
                            this.logger.info(`Atomic Orchestrator: Spec ${spec.id} persisted to sovereign bucket [${bucket}]`);
                        }
                    } catch (e) {
                        this.logger.error("Atomic Orchestrator: Failed to persist ingested spec", e);
                    }
                }

                this.registerAtomicComponents(context, null, spec, source);
            }
        });

        // 5. Global Action Listener for Blueprint Persistence (Extended with feedback)
        globalThis.addEventListener('atomic-default-action', (e) => {
            const { action, spec, values: _values } = e.detail;
            if (action === 'blueprint.save') {
                this.logger.info(`Atomic Orchestrator: Persistence request for blueprint ${spec?.id || 'unknown'}`);
                if (!spec || !spec.id) return this.logger.error("Atomic Orchestrator: Save aborted. Spec ID missing.");
                
                // Rule 19: Sovereignty Guard (SDN-0139) - Protect Institutional Infrastructure
                if (spec._isBundleBlueprint) {
                    this.logger.warn(`Atomic Orchestrator: [SOVEREIGNTY WARNING] Persistence REJECTED for Institutional Blueprint [${spec.id}]. Bundle-resident tools cannot be shadowed.`);
                    alert(`Persistence Rejected: '${spec.id}' is a protected bundle blueprint and cannot be shadowed to Cloud/Local storage.`);
                    return;
                }

                try {
                    const pm = this.persistence || context.getService(context.getServiceReference(PERSISTENCE_MANAGER_SERVICE));
                    const bucket = `realm.design.blueprints_${spec.id}`;
                    
                    // Mark as persisted for registry bypass
                    const persistedSpec = { ...spec, _isPersisted: true };
                    pm.store(bucket, persistedSpec);
                    this.logger.info(`Atomic Orchestrator: Blueprint ${persistedSpec.id} saved to individual bucket [${bucket}].`);
                    
                    // User Feedback
                    alert(`Blueprint '${persistedSpec.id}' successfully saved and registered.`);

                    // Re-register to update UI immediately
                    this.registerAtomicComponents(context, null, persistedSpec, "persistence-sync");
                } catch (err) {
                    this.logger.error("Atomic Orchestrator: Save failed.", err);
                    alert(`Failed to save blueprint: ${err.message}`);
                }
            }
            
            if (action === 'blueprint.archive') {
                const id = spec?.id;
                this.logger.info(`Atomic Orchestrator: Archival request for blueprint ${id}`);
                if (!id) return;

                const archiveLogic = async () => {
                    try {
                        const pm = this.persistence || context.getService(context.getServiceReference(PERSISTENCE_MANAGER_SERVICE));
                        const bucket = `realm.design.blueprints_${id}`;
                        
                        this.logger.info(`Atomic Orchestrator: ARCHIVAL PROTOCOL STARTED for blueprint [${id}]`);

                        // Physical Liquidation (Delete from Firestore)
                        pm.store(bucket, null);
                        this.logger.info(`Atomic Orchestrator: Blueprint [${id}] physically liquidated from [${bucket}]`);

                        // Cascading Purge Handshake
                        const registryRef = context.getServiceReference(DOMAIN_OBJECT_REGISTRY_SERVICE);
                        const registry = registryRef ? context.getService(registryRef) : null;
                        
                        if (registry) {
                            const rawInstances = registry.getInstances() || {};
                            const allInstances = Array.isArray(rawInstances) ? rawInstances : Object.values(rawInstances);
                            const instances = allInstances.filter(ins => ins.blueprintId === id);
                            this.logger.info(`Atomic Orchestrator: Cascading Purge Assessment: Discovered ${instances.length} instances for blueprint [${id}] (Registry Scan: ${allInstances.length} total)`);

                            if (instances.length > 0) {
                                // Re-check Interactor for freshest reference
                                const interactor = this._interactor || (context.getServiceReference(INTERACTOR_SERVICE) ? context.getService(context.getServiceReference(INTERACTOR_SERVICE)) : null);
                                
                                const confirmed = interactor 
                                    ? await interactor.confirm(`Archive ${instances.length} orphaned instances associated with '${id}'?`)
                                    : globalThis.confirm(`Archive ${instances.length} orphaned instances associated with '${id}'?`);
                                
                                if (confirmed) {
                                    this.logger.info(`Atomic Orchestrator: ARCHIVING blueprint [${id}] and its orphaned instances.`);
                                    
                                    if (registry.purgeBlueprint) {
                                        registry.purgeBlueprint(id);
                                    } else {
                                        // Fallback if registry hasn't updated yet
                                        instances.forEach(ins => registry.removeInstance(ins.id));
                                        if (registry.removeBlueprint) registry.removeBlueprint(id);
                                    }
                                } else {
                                    this.logger.info(`Atomic Orchestrator: USER PRESERVED ${instances.length} orphaned instances.`);
                                }
                            } else if (registry.purgeBlueprint) {
                                registry.purgeBlueprint(id);
                            } else if (registry.removeBlueprint) {
                                registry.removeBlueprint(id);
                            }
                        } else {
                            this.logger.warn(`Atomic Orchestrator: CASCADING PURGE SKIPPED. DO-Registry not available during archival of [${id}]`);
                        }

                        // Unregister and cleanup in Orchestrator
                        if (this.registrations[id]) {
                            this.registrations[id].forEach(reg => { try { reg.unregister(); } catch (_e) {
                              this.logger.error(`Atomic Orchestrator: Failed to unregister ${id}`, _e);
                            } });
                            delete this.registrations[id];
                        }
                        delete this.specs[id];

                        this.logger.info(`Atomic Orchestrator: Blueprint [${id}] ARCHIVAL COMPLETE.`);
                    } catch (err) {
                        this.logger.error(`Atomic Orchestrator: ARCHIVAL PROTOCOL FAILED for [${id}]`, err);
                    }
                };

                archiveLogic();
            }
        });

        // 5.5 Global Persistence Bridge (Rule 8): Sync UIFactory changes to Registry
        globalThis.addEventListener('uif-persist', (e) => {
            const { instanceId, properties, currentStep } = e.detail;
            const keys = Object.keys(properties || {});
            this.logger.info(`Atomic Orchestrator: [GLOBAL SYNC] Persistence pulse for ${instanceId}. Keys: [${keys.join(', ')}]`, properties);
            
            const registryRef = context.getServiceReference(DOMAIN_OBJECT_REGISTRY_SERVICE);
            const registry = registryRef ? context.getService(registryRef) : null;
            
            if (registry) {
                const instance = registry.getInstance(instanceId);
                if (instance) {
                    // Update instance in place and re-register
                    instance.properties = { ...instance.properties, ...properties };
                    if (currentStep) instance.currentStep = currentStep;
                    registry.addInstance(instance);
                    this.logger.info(`Atomic Orchestrator: [GLOBAL SYNC] Successfully updated Registry for ${instanceId}. Step: ${instance.currentStep || 'intro'}. Keys: [${keys.join(', ')}]`);
                }
            }
        });

        // 6. Diagnostic CLI Command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: 'atomic:list',
            description: 'List all blueprints registered by the Atomic Orchestrator',
            execute: (_args, _ctx, log) => {
                const filter = _args[0]?.toLowerCase();
                const items = Object.values(this.specs);
                log(`Atomic Specs Discovery Status (${items.length}):`);
                items.forEach(({ id, spec, source }) => {
                    const finalId = id || spec?.id || "unknown";
                    if (!filter || finalId.toLowerCase().includes(filter)) {
                        const icon = spec?._isPersisted ? "💾" : (spec?._isBundleBlueprint ? "📦" : "🌐");
                        const src = source || (spec?._isBundleBlueprint ? "bundle" : "local");
                        log(` ${icon} [${finalId.padEnd(20)}] Source: ${src.padEnd(15)} Label: ${spec?.label || 'n/a'}`);
                    }
                });
            }
        });

        // 7. Refresh Command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: 'atomic:refresh',
            description: 'Trigger a re-scan of all bundles for atomic specs',
            execute: (_args, _ctx, log) => {
                log("Atomic Orchestrator: Triggering full universe re-scan...");
                runRefresh(log);
            }
        });

        // 8. Domain Object Registry Tracker (Rule 12: Registration Persistence)
        context.trackService(`(objectClass=${DOMAIN_OBJECT_REGISTRY_SERVICE})`, {
            addingService: (ref) => {
                const registry = context.getService(ref);
                const specCount = Object.keys(this.specs).length;
                if (specCount > 0) {
                    this.logger.info(`Atomic Orchestrator: Registry [${ref.getProperty("service.id")}] arrived. Re-syncing ${specCount} blueprints...`);
                    Object.values(this.specs).forEach(({ spec }) => {
                        registry.addBlueprint(spec);
                    });
                }
                return registry;
            }
        }).open();

    } catch (err) {
        this.logger.error("Atomic Orchestrator: Unhandled error in start method:", err);
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
            this.logger.info(`Atomic Orchestrator [Security]: Registering permission keys for ${id}`);
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
            this.logger.info(`Atomic Orchestrator [Security]: Registering features for ${id}`);
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
            this.logger.info(`Atomic Orchestrator [Security]: Registering capabilities for ${id}`);
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
            this.logger.info(`Atomic Orchestrator [Security]: Registering UI guards for ${id}`);
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
            // Rule 4: Use absolute path for reliable discovery across bundle context relocations
            const res = await fetch(`/domain-objects/${file}`);
            if (res.ok) {
                const text = await res.text();
                const spec = yaml.load(text);
                this.registerAtomicComponents(context, null, spec, "server");
            }
        } catch (e) {
            this.logger.error(`Atomic Orchestrator: Failed to scan remote ${file}`, e);
        }
    }
  }

  async scanLocalStorage(context) {
    try {
        const pmRef = context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
        const pm = this.persistence || (pmRef ? context.getService(pmRef) : null);
        if (!pm) return;
        
        // SPOP Blueprint Discovery (Rule 4)
        if (pm.listKeys) {
            const keys = await pm.listKeys("realm.design.blueprints_");
            this.logger.info(`Atomic Orchestrator: [HYDRATION] Discovered ${keys.length} sovereign blueprint buckets.`);
            for (const bucket of keys) {
                const spec = pm.load(bucket);
                if (spec) {
                    this.logger.debug(`Atomic Orchestrator: [HYDRATION] Loading sovereign blueprint: ${spec.id}`);
                    this.registerAtomicComponents(context, null, spec, "persistence");
                }
            }
        }
    } catch (e) {
        this.logger.error("Atomic Orchestrator: Failed to scan PersistenceManager blueprints", e);
    }
  }

  registerAtomicComponents(context, bundle, spec, source = "bundle") {
    const { id, label, ui, domainObject, actions, caseTypes } = spec;

    // Rule 6: Source Attribution (Institutional vs. Volatile)
    if (!bundle || source !== "bundle") {
      spec._isPersisted = true;
    } else {
      spec._isBundleBlueprint = true;
    }

    const bsn = bundle ? bundle.getSymbolicName() : `synthetic.${source}.${id}`;
    const headers = bundle ? bundle.getHeaders() : {};
    
    this.logger.info(`Atomic Orchestrator: Registering components for ${bsn} (${id}) from ${source}`);

    // Persist spec for re-registration after reset
    this.specs[id] = { bundle, spec, source };

    // Cleanup previous registrations for this ID (e.g., during live-editing)
    if (this.registrations[id]) {
      this.logger.info(`Atomic Orchestrator: Unregistering previous components for ${id}`);
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
          this.logger.warn(`Atomic Orchestrator: Failed to parse Configuration for ${bsn}`, e);
        }
      }
    }

    const flowType = manifestConfig.flowType || spec.flowType || "atomic-flow";
    const channels = manifestConfig.channels || spec.channels || ["business-channel-web"];

    // 1. Register Domain Object Strategy
    if (domainObject) {
      const doRegistry = getSvc(DOMAIN_OBJECT_REGISTRY_SERVICE);
      if (doRegistry && domainObject.strategyId) {
        const existing = doRegistry.getStrategy(domainObject.strategyId);
        if (!existing) {
          trackReg(context.registerService(DOMAIN_STRATEGY_SERVICE, {
            id: domainObject.strategyId,
            label: domainObject.label || id,
            limesPrefix: domainObject.limesPrefix || id.split('-')[0].toUpperCase(),
            actions
          }));
        }
      }
    }

    // 2. Independent Handover - Register blueprint in DO Registry (Rule 12)
    const registerBlueprint = () => {
      const ref = context.getServiceReference(DOMAIN_OBJECT_REGISTRY_SERVICE);
      const registry = ref ? context.getService(ref) : null;
      if (registry && registry.addBlueprint) {
        this.logger.info(`[FORENSIC] Atomic Orchestrator: Handing over blueprint [${id}] to Registry.`);
        registry.addBlueprint(spec);
        this._warnedBlueprints.delete(id);
      } else {
        if (!this._warnedBlueprints.has(id)) {
           this.logger.warn(`[FORENSIC] Atomic Orchestrator: Registry not ready for [${id}]. Retrying... (Ref: ${!!ref}, Svc: ${!!registry})`);
           this._warnedBlueprints.add(id);
        }
        setTimeout(registerBlueprint, 100);
      }
    };
    registerBlueprint();

    // 3. Register Flow Service (UI-DSL)
    if (ui) {
      trackReg(context.registerService(FLOW_SERVICE, {
        id,
        title: label || id,
        icon: spec.flow?.icon || manifestConfig.icon || "fas fa-atom",
        launch: (container, params = {}) => {
          const factoryRef = context.getServiceReference(UI_FACTORY_SERVICE);
          const factorySvc = factoryRef ? context.getService(factoryRef) : null;

          if (factorySvc) {
            const instanceId = params.instanceId;
            const el = factorySvc.create(spec, { ...params, instanceId });
            // 💾 Persistence Bridge (Rule 8): Captured via Global Listener in onStart
            container.innerHTML = "";
            container.appendChild(el);
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
          const factorySvc = getSvc(UI_FACTORY_SERVICE);
          if (factorySvc) {
            const el = factorySvc.create(spec, params);
            if (container) {
              this._managedContainers.add(container);
              container.innerHTML = "";
              container.appendChild(el);
            }
          }
        }
      }, {
        "bundle.symbolicName": bsn
      }));

      // Legacy action handlers purged to favor forensic OSGi ACTION_SERVICEs (SDN-0043)
    }

    // 4. Register Case Types
    if (caseTypes) {
      const signingSvc = getSvc(SIGNING_DATA_SERVICE);
      if (signingSvc) {
        this.logger.info(`Atomic Orchestrator: Registering case types for ${id}`);
        const current = signingSvc.getCaseTypes() || [];
        const newTypes = Array.isArray(caseTypes) ? caseTypes : [caseTypes];
        newTypes.forEach(nt => {
          const idx = current.findIndex(t => t.id === nt.id);
          if (idx === -1) current.push(nt); else current[idx] = nt;
        });
        signingSvc.setCaseTypes(current);
      }
    }

    // 5. Register Synthetic Actions
    if (actions) {
      Object.entries(actions).forEach(([aid, actionSpec]) => {
        trackReg(context.registerService(ACTION_SERVICE, {
          execute: async (params) => {
            const outreachRef = context.getServiceReference(ACTION_SERVICE, "(action.id=apiService)");
            const outreachSvc = outreachRef ? context.getService(outreachRef) : null;
            if (outreachSvc && actionSpec.type === "API") {
              const merged = JSON.parse(JSON.stringify({ ...actionSpec.params, ...params }));
              return await outreachSvc.execute(merged);
            }
            throw new Error(`Action handler for ${aid} (type: ${actionSpec.type}) not found.`);
          }
        }, {
          "action.id": aid,
          "bundle.symbolicName": bsn
        }));
      });
    }

    this.logger.info(`Atomic Orchestrator: Successfully registered all components for ${bsn} (${id})`);
  }

  onStop(context) {
    if (this._managedContainers) {
      this._managedContainers.forEach(container => {
        try { if (container) container.innerHTML = ""; } catch (_e) { /* ignore */ }
      });
      this._managedContainers.clear();
    }
    
    // Purge staging areas
    ["#flow-stage", "#flow-root", ".atomic-root-container"].forEach(sel => {
        try { const el = document.querySelector(sel); if (el) el.innerHTML = ""; } catch (_e) { /* ignore */ }
    });

    if (this._pmTracker) this._pmTracker.close();
    if (this._interactorTracker) this._interactorTracker.close();
    this.logger.log("Atomic Orchestrator: Stopped.");
    super.onStop(context);
  }
}
