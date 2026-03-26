import { marked } from "https://esm.sh/marked@12.0.1";
import { 
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    CASE_SERVICE, 
    YAML_SERVICE, 
    SESSION_SERVICE, 
    LIMES_SERVICE, 
    ATOMIC_COMPONENT_REGISTRY_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    ACTION_SERVICE,
    CASE_ADDED_TOPIC,
    CASE_UPDATED_TOPIC,
    LOG_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC
} from "../../../../shared-types.js";

// --- OSGi-to-DOM Event Bridge (Dual-Bridge Pattern) ---
// --- OSGi-to-DOM Event Bridge (Persistent & Registry-Aware) ---
let caseUpdateBridgeStarted = false;
let _sharedCaseService = null;
let _sharedRegistryService = null;

const startCaseUpdateBridge = (context) => {
    if (caseUpdateBridgeStarted || !context) return;
    caseUpdateBridgeStarted = true;
    
    // Attempt to get a logger early (fallback to console for system boot observability)
    let logger = console;
    const logRef = context.getServiceReference(LOG_SERVICE);
    if (logRef) {
        logger = context.getService(logRef).getLogger("ui-factory-bridge");
    }

    logger.info("UIFactory: [BRIDGE] Starting OSGi bridge...");
    // Track services globally for the bridge
    context.trackService(`(objectClass=${CASE_SERVICE})`, {
        addingService: (_ref) => { _sharedCaseService = context.getService(_ref); },
        removedService: () => { _sharedCaseService = null; }
    }).open();

    context.trackService(`(objectClass=${DOMAIN_OBJECT_REGISTRY_SERVICE})`, {
        addingService: (_ref) => { _sharedRegistryService = context.getService(_ref); },
        removedService: () => { _sharedRegistryService = null; }
    }).open();

    logger.info("UIFactory: [BRIDGE] Registering persistent, registry-aware EventHandler service...");
    const eventHandler = {
        handleEvent: async (event) => {
            const topic = typeof event.getTopic === 'function' ? event.getTopic() : event.topic;
            const id = typeof event.getProperty === 'function' ? event.getProperty('id') : event.id;
            if (!topic || !id) return;

            const domTopic = topic.replaceAll('/', '-');
            // Using globalThis.Services.log if _sharedLogger not yet set
            if (globalThis.Services?.[LOG_SERVICE]) {
                const l = globalThis.Services[LOG_SERVICE].getLogger("ui-factory-bridge");
                l.info(`Event [${topic}] received for ID ${id}. Bridge updating...`);
            }

            // 1. Fetch latest status from service
            let status = null;
            if (_sharedCaseService) {
                try {
                    const c = await _sharedCaseService.getCase(id);
                    status = c?.status;
                } catch (e) { logger.error("UIFactory [BRIDGE]: Fetch failed", e); }
            }
            logger.info("UIFactory [BRIDGE]: Status", status); 

            // 2. DISPATCH to DOM (for mounted components)
            globalThis.dispatchEvent(new CustomEvent(domTopic, { detail: { id, status } }));

            // 3. UPDATE REGISTRY (for unmounted components)
            if (_sharedRegistryService && status) {
                const instancesMap = typeof _sharedRegistryService.getInstances === 'function' ? _sharedRegistryService.getInstances() : {};
                const instances = Object.values(instancesMap);
                
                for (const inst of instances) {
                    let changed = false;
                    for (const prop in (inst.properties || {})) {
                        if (inst.properties[prop] === id) {
                            const statusProp = prop + 'Status';
                            if (inst.properties[statusProp] !== status) {
                                // bridge status
                                inst.properties[statusProp] = status;
                                changed = true;
                            }
                        }
                    }
                    if (changed && inst.strategyId) {
                        const stratRefs = context.getServiceReferences(DOMAIN_STRATEGY_SERVICE) || [];
                        const strat = stratRefs.map(r => context.getService(r)).find(s => s.id === inst.strategyId);
                        if (strat?.updateInstance) {
                            strat.updateInstance(inst.id, inst.blueprintId, inst);
                        }
                    }
                }
            }
        }
    };

    context.registerService(EVENT_HANDLER_INTERFACE, eventHandler, {
        [EVENT_TOPIC]: [CASE_ADDED_TOPIC, CASE_UPDATED_TOPIC]
    });

    
    
};

if (!globalThis.__UI_FACTORY_REGISTRY) {
    globalThis.__UI_FACTORY_REGISTRY = {
        _map: new Map(),
        set(id, state) { 
            if (globalThis.Services?.[LOG_SERVICE]) {
                globalThis.Services[LOG_SERVICE].getLogger("ui-factory-registry").info(`Registering [${id}] (Has uifResolve: ${!!state.uifResolve})`);
            } else {
                console.log(`UIFactory Registry: Registering [${id}] (Has uifResolve: ${!!state.uifResolve})`);
            }
            this._map.set(id, state); 
        },
        get(id) { 
            const s = this._map.get(id);
            if (!s) {
                 const msg = `UIFactory Registry: MISSING state for ID ${id}! Current IDs: ` + Array.from(this._map.keys()).join(', ');
                 if (globalThis.Services?.[LOG_SERVICE]) {
                     globalThis.Services[LOG_SERVICE].getLogger("ui-factory-registry").warn(msg);
                 } else {
                     console.warn(msg);
                 }
            }
            return s;
        },
        delete(id) { this._map.delete(id); }
    };
}

class UIFactory extends HTMLElement {
    constructor() {
        super();
        this._spec = null;
        this._context = null;
        this._yamlService = null;
        this._componentRegistry = null;
        this._rendered = false;
        this._initialized = false;
        this._id = "uif-" + Math.random().toString(36).substring(7);
        this._params = {};
        this._effects = []; // Track Alpine effects for cleanup
        this._instanceId = null;
        this._logger = null; 
        this.logger.info(`UIFactory [${this._id}]: Instance created`);
    }

    get logger() {
        if (this._logger) return this._logger;
        if (globalThis.Services?.[LOG_SERVICE]) {
            return globalThis.Services[LOG_SERVICE].getLogger("ui-factory");
        }
        return console;
    }

    disconnectedCallback() {
        this.logger.info(`UIFactory [${this._id}]: disconnected from DOM. Cleaning up ${this._effects.length} effects.`);
        this._isDisconnected = true;
        
        // Final save on disconnection
        this.saveInstance();

        // Cleanup global listeners
        if (this._caseUpdateHandler) {
            globalThis.removeEventListener('backoffice-cases-updated', this._caseUpdateHandler);
            globalThis.removeEventListener('backoffice-cases-added', this._caseUpdateHandler);
        }

        this._effects.forEach(cleanup => {
            if (typeof cleanup === 'function') cleanup();
        });
        this._effects = [];
        if (this._guardInterval) clearInterval(this._guardInterval);
    }

    set context(ctx) { this.setBundleContext(ctx); }
    setBundleContext(ctx) {
        if (!ctx) return;
        this._context = ctx;
        
        // Track LogService for standardized logging
        this._context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = this._context.getService(ref);
                this._logger = logAdmin.getLogger("ui-factory");
                this._logger.info(`Initialized (ID: ${this._id})`);
            },
            removedService: () => { this._logger = null; }
        }).open();

        const registryRef = ctx.getServiceReference(ATOMIC_COMPONENT_REGISTRY_SERVICE);
        this._componentRegistry = registryRef ? ctx.getService(registryRef) : null;

        this.logger.info(`UIFactory [${this._id}]: Bundle Context received. Setting up service trackers...`);
        
        // Track YAML Service reactively
        this._context.trackService(`(objectClass=${YAML_SERVICE})`, {
            addingService: (ref) => { this._yamlService = this._context.getService(ref); },
            removedService: () => { this._yamlService = null; }
        }).open();

        // Track Case Service reactively
        this._context.trackService(`(objectClass=${CASE_SERVICE})`, {
            addingService: (ref) => { 
                this.logger.info(`UIFactory [${this._id}]: Case Service ${CASE_SERVICE} discovered via tracker.`);
                this._caseService = this._context.getService(ref); 
                // Auto-retry status resolution now that we have the service!
                if (this._state?.resolveCaseStatuses) {
                    this.logger.info(`UIFactory [${this._id}]: Retrying status resolution...`);
                    this._state.resolveCaseStatuses();
                }
            },
            removedService: () => { this._caseService = null; }
        }).open();
        
        if (this._spec) this.render();
    }

    _getService(id) {
        if (id === CASE_SERVICE && this._caseService) return this._caseService;
        if (id === YAML_SERVICE && this._yamlService) return this._yamlService;
        
        if (!this._context) return globalThis.Services?.[id];
        try {
            // Pandino/OSGi: getService requires a ServiceReference
            if (this._context.getServiceReference) {
                const ref = this._context.getServiceReference(id);
                if (ref) return this._context.getService(ref);
            }
            // Fallback to global registry
            return globalThis.Services?.[id];
        } catch (_e) {
            return globalThis.Services?.[id];
        }
    }

    set spec(value) { this.setSpec(value); }
    setSpec(value) {
        this.logger.info(`UIFactory [${this._id}]: setSpec called`, value ? "OK" : "NULL");
        this._spec = value;
        this.render();
    }

    setParams(value) {
        this.logger.info(`UIFactory [${this._id}]: setParams called`, value);
        this._params = value || {};
    }

    connectedCallback() {
        this.logger.info(`UIFactory [${this._id}]: connectedCallback triggered`);
        if (this._initialized) {
            this.logger.info(`UIFactory [${this._id}]: Re-connected to DOM. Re-triggering render if needed.`);
            if (this._spec) this.render();
            return;
        }
        this._initialized = true;
        this.logger.info(`UIFactory [${this._id}]: connected to DOM (Initial)`);
        
        // Listen for standard Atomic Component events
        this.addEventListener('atomic-action', (e) => {
            this.logger.info(`UIFactory [${this._id}]: atomic-action received`, e.detail.action);
            e.stopPropagation(); 
            this.runAction(e.detail.action, this._state);
        });

        this.addEventListener('atomic-change', (e) => {
            const { id, value } = e.detail;
            this.logger.info(`UIFactory [${this._id}]: atomic-change received`, id, value);
            e.stopPropagation(); 
            this._state.uifValues[id] = value;
            this._state.data = null; 
        });

        if (this._spec) this.render();

        // Ensure Alpine discovery in complex/nested DOM insertion contexts (Delayed & Safe)
        setTimeout(() => {
            if (this._state && globalThis.Alpine && globalThis.Alpine.initTree) {
                // If it already has a data stack, Alpine has already initialized it or its parent.
                if (this._x_dataStack) {
                    this.logger.info(`UIFactory [${this._id}]: Alpine already initialized.`);
                    return;
                }
                this.logger.info(`UIFactory [${this._id}]: Forcing Alpine init...`);
                try {
                    globalThis.Alpine.initTree(this);
                } catch (_e) {
                    this.logger.warn(`UIFactory [${this._id}]: Alpine initTree failed:`, _e);
                }
            }
        }, 100);
    }

    render(newSpec = null) {
        if (newSpec) this._spec = newSpec;
        const spec = this._spec;
        if (!spec) return;
        const ui = spec.ui || spec || {};

        // --- 1. IDEMPOTENT RENDER (Reuse existing root if present) ---
        let root = this.querySelector(':scope > .ui-f-root');
        let body = root?.querySelector('.uif-body');

        if (this._rendered && root && body) {
            this.logger.info(`UIFactory [${this._id}]: Partial update (newSpec=${!!newSpec})`);
            
            // Sync uifStep if new spec provides a different initialStep
            if (this._state && newSpec) {
                const initialStep = ui.initialStep || (Object.keys(ui.steps || {}).length > 0 ? Object.keys(ui.steps)[0] : null);
                if (initialStep) {
                    this.logger.info(`UIFactory [${this._id}]: Syncing uifStep to ${initialStep} from updated spec`);
                    this._state.uifStep = initialStep;
                }
                if (ui.steps) {
                    this._state.uifStepKeys = Object.keys(ui.steps);
                }
            }

            this.hydrateBody(body, ui);
            return;
        }

        // --- 2. INITIAL FULL RENDER ---
        this.logger.info(`UIFactory [${this._id}]: Initial render. Spec ID: ${spec.id || 'N/A'}, Steps: ${Object.keys(ui.steps || {}).length}`);

        if (!this._state) {
            this._state = this._createState(spec);
            globalThis.__UI_FACTORY_REGISTRY.set(this._id, this._state);
        }

        this.setAttribute('data-uif-id', this._id);
        this.setAttribute('x-data', `globalThis.__UI_FACTORY_REGISTRY.get('${this._id}')`);
        
        root = document.createElement('div');
        root.className = 'ui-f-root relative min-h-[50px]';
        
        body = document.createElement('div');
        body.className = 'uif-body flex flex-col gap-4'; 
        root.appendChild(body);
        
        this.innerHTML = "";
        this.appendChild(root);
        
        this.container = body;
        this.hydrateBody(body, ui);

        // Append styles only once
        if (!this.querySelector('style.uif-styles')) {
            const styleEl = document.createElement('style');
            styleEl.className = 'uif-styles';
            styleEl.textContent = `
                ui-factory { display: block !important; visibility: visible !important; min-height: 50px; }
                [x-cloak] { display: none !important; }
                .ui-f-root { position: relative; }
            `;
            this.appendChild(styleEl);
        }
        
        this._rendered = true;
        setTimeout(() => this.resolveGuards(this._state), 200);
    }

    hydrateBody(container, spec) {
        const steps = spec.steps || {};
        const parts = spec.parts || {};

        if (Object.keys(steps).length > 0) {
            Object.entries(steps).forEach(([sid, s]) => {
                const lowerSid = sid.toLowerCase();
                let stepWrapper = container.querySelector(`.uif-step-wrapper[data-sid="${lowerSid}"]`);
                
                if (!stepWrapper) {
                    stepWrapper = document.createElement('div');
                    stepWrapper.className = "uif-step-wrapper p-1";
                    stepWrapper.setAttribute('data-sid', lowerSid);
                    stepWrapper.setAttribute('x-show', `(typeof uifStep !== 'undefined' && uifStep) && uifStep.toLowerCase() === '${lowerSid}'`);
                    stepWrapper.setAttribute('x-cloak', '');
                    container.appendChild(stepWrapper);
                }
                
                // Clear and re-hydrate title if needed
                const existingH3 = stepWrapper.querySelector('h3.uif-step-title');
                if (s.title) {
                    if (!existingH3) {
                        const h3 = document.createElement('h3');
                        h3.className = "uif-step-title text-lg font-black mb-6 text-gray-800 tracking-tight";
                        const titleText = s.title.replace(/\${this\.(.+?)}/g, `<span x-text="uifValues.$1"></span>`);
                        h3.innerHTML = titleText;
                        stepWrapper.prepend(h3);
                    }
                } else if (existingH3) {
                    existingH3.remove();
                }

                // Hydrate Parts (Reconcile)
                const partsContainer = stepWrapper; // or a dedicated child
                const currentPartEls = Array.from(partsContainer.querySelectorAll('[data-part-id]'));
                const newPartIds = Object.keys(s.parts || {});
                
                // Remove obsolete
                currentPartEls.forEach(el => {
                    if (!newPartIds.includes(el.getAttribute('data-part-id'))) el.remove();
                });

                Object.entries(s.parts || {}).forEach(([pid, p]) => {
                    const existing = partsContainer.querySelector(`[data-part-id="${pid}"]`);
                    const partEl = this.renderPart(pid, p, existing);
                    if (partEl) partsContainer.appendChild(partEl); // ALWAYS append to maintain DOM order
                });
            });

            // Reconcile Fallback banner
            const allFallbacks = Array.from(container.querySelectorAll('.uif-fallback-banner'));
            let fallback = allFallbacks[0];
            
            // Remove any extra banners if they exist
            if (allFallbacks.length > 1) {
                allFallbacks.slice(1).forEach(el => el.remove());
            }

            if (!fallback) {
                fallback = document.createElement('div');
                fallback.className = "uif-fallback-banner p-6 bg-amber-50 rounded-3xl border border-amber-100 text-amber-900 text-sm italic";
                fallback.setAttribute('x-cloak', '');
                container.appendChild(fallback);
            }
            
            // Update banner attributes reactively
            fallback.setAttribute('x-show', "typeof uifStep === 'undefined' || !uifStep || !uifStepKeys.some(k => k.toLowerCase() === uifStep.toLowerCase())");
            
            // Log for diagnostics only if uifStep is set
            fallback.setAttribute('x-effect', `if (typeof uifStep !== 'undefined' && uifStep && uifStepKeys.length > 0 && !uifStepKeys.some(k => k.toLowerCase() === uifStep.toLowerCase())) { 
                const msg = 'UIFactory [' + this._id + ']: Navigation Mismatch! uifStep=' + uifStep + ' is NOT in uifStepKeys: ' + uifStepKeys.join(', ');
                if (globalThis.Services?.['${LOG_SERVICE}']) {
                    globalThis.Services['${LOG_SERVICE}'].getLogger("ui-factory").warn(msg);
                } else {
                    console.warn(msg);
                }
            }`);

            fallback.innerHTML = `State sync requested for \${uifStep}... <button @click="uifStep = uifInitialStep" class="font-bold underline ml-1">Restart</button>`;
        } else {
            const currentPartEls = Array.from(container.querySelectorAll('[data-part-id]'));
            const newPartIds = Object.keys(parts);
            
            currentPartEls.forEach(el => {
                if (!newPartIds.includes(el.getAttribute('data-part-id'))) el.remove();
            });

            Object.entries(parts).forEach(([pid, p]) => {
                const existing = container.querySelector(`[data-part-id="${pid}"]`);
                const partEl = this.renderPart(pid, p, existing);
                if (partEl) container.appendChild(partEl); // ALWAY append to maintain DOM order
            });
        }
    }

    _createState(spec) {
        const logger = this.logger;
        // Bridge existing global host data if available
        const globalHostData = globalThis.backofficeState || globalThis.businessPortalState || {};
        const baseValues = {
            activeLicense: globalHostData.activeLicense || {},
            companies: globalHostData.companies || [],
            persons: globalHostData.persons || [],
            currentUser: globalHostData.currentUser || this._getService(SESSION_SERVICE)?.currentUser || {},
            fellowsData: globalHostData.fellowsData || { FELLOWS: [] },
            parsedLicenses: globalHostData.parsedLicenses || { LICENSES: [] },
            ...globalHostData.currentApplication
        };

        const ui = spec.ui || spec;
        const stepKeys = Object.keys(ui.steps || {});
        const initialStep = ui.initialStep || (stepKeys.length > 0 ? stepKeys[0] : null);
 
        // --- Instance Hydration ---
        let instanceData = {};
        let instanceStep = initialStep;
        let instanceHistory = [];
        let instance = null;
        this._instanceId = this._params?.instanceId;
        const instanceId = this._instanceId;
 
        if (instanceId) {
            logger.info(`UIFactory [${this._id}]: Found instanceId ${instanceId}, attempting hydration...`);
            const registry = this._getService(DOMAIN_OBJECT_REGISTRY_SERVICE);
            instance = registry?.getInstance(instanceId);
            if (instance) {
                logger.info(`UIFactory [${this._id}]: Hydration SUCCESS for ${instanceId}. Found properties:`, Object.keys(instance.properties || {}));
                instanceData = instance.properties || {};
                if (instance.currentStep) instanceStep = instance.currentStep;
                if (instance.history) instanceHistory = instance.history || [];
            } else {
                logger.warn(`UIFactory [${this._id}]: Hydration FAILED for ${instanceId}. Instance not found in registry.`);
            }
        }
 
        const s = {
            loading: false,
            data: null,
            uifGuards: {},
            uifValues: { ...baseValues, ...instanceData },
            uifStep: instanceStep || initialStep || stepKeys[0],
            uifStepKeys: stepKeys,
            uifInitialStep: initialStep || stepKeys[0],
            history: instanceHistory,
            _hydrated: !!instance,
            _registryReady: false,
            instanceId: instanceId,
            uifId: this._id,
            uifResolve(expr) {
                try {
                    // 1. Direct path lookup (fastest for simple keys)
                    const val = this._factory ? this._factory.resolveValue(expr, this) : undefined;
                    if (val !== undefined && val !== null) return val;

                    // 2. Complex Expression Evaluation
                    // We detect expressions by checking for operators (symbols) or spaces
                    if (expr && (/[?|&:<>=!]/.test(expr) || expr.includes(' '))) {
                        // Create a context where uifValues are top-level. 
                        const scopeProxy = new Proxy(this.uifValues, {
                            get: (target, key) => {
                                if (key === 'uifValues' || key === 'values') return target; // Support prefixes
                                if (key === 'uifResolve' || key === 'resolve') return this.uifResolve.bind(this);
                                if (key === 'uifGuards' || key === 'guards') return this.uifGuards;
                                return target[key] !== undefined ? target[key] : (this[key] !== undefined ? this[key] : undefined);
                            },
                            has: () => true // Force 'with' to stay within this proxy to avoid global naming collisions
                        });
                        return (new Function('v', `with(v) { return ${expr} }`))(scopeProxy);
                    }
                } catch (_e) {
                    // SILENT
                }
                return undefined;
            },
            init() {
                logger.info(`UIFactory [${this.instanceId || 'anon'}]: Alpine Init. uifStep=${this.uifStep}, uifStepKeys=[${this.uifStepKeys.join(', ')}]`);
                // IMPORTANT: 'this' inside Alpine init() is the Proxy. 
                // We bind it back to the factory to ensure all subsequent 
                // updates (from render or runAction) are reactive.
                const factory = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`);
                if (factory) {
                    factory._state = this;
                    this._factory = factory;
                }

                logger.info(`UIFactory [${this.instanceId}] connected to Alpine Data`);
                
                // Track Case Updates reactively via DOM Bridge (from OSGi)
                const caseUpdateHandler = async (e) => {
                    const updatedCaseId = e.detail?.id;
                    logger.info(`UIFactory [${this.instanceId}]: Global Event [${e.type}] received for Case ${updatedCaseId}`);
                    // Scan all values to see if we are tracking this case
                    for (const key in this.uifValues) {
                        if (this.uifValues[key] === updatedCaseId) {
                            logger.info(`UIFactory [${this.instanceId}]: Notched update for tracked Case ${updatedCaseId}. Syncing...`);
                            await this.syncCaseStatus(updatedCaseId);
                        }
                    }
                };
                
                // Store the handler on the factory element for cleanup
                if (factory) {
                    factory._caseUpdateHandler = caseUpdateHandler;
                }
                
                globalThis.addEventListener('backoffice-cases-updated', caseUpdateHandler);
                globalThis.addEventListener('backoffice-cases-added', caseUpdateHandler);
                
                // Start the OSGi bridge if we have access to context
                if (factory?._context) {
                    logger.info(`UIFactory [${this.instanceId}]: OSGI-Context available. Starting OSGi bridge.`);
                    startCaseUpdateBridge(factory._context);
                } else {
                    logger.info(`UIFactory [${this.instanceId}]: NO OSGI-Context available. Waiting for registry.`);
                }
                
                globalThis.addEventListener('do-registry-ready', () => {
                    logger.info(`UIFactory [${this.instanceId}]: Registry Ready event received, triggering re-run.`);
                    this._state._registryReady = !this._state._registryReady; 
                });

                // Periodic Guard Re-evaluation disabled in favor of targeted event-based updates
                // this._guardInterval = setInterval(() => this.resolveGuards(), 2000);
                this.resolveGuards();
                
                // Initial Case Status Sync
                this.resolveCaseStatuses();

                // Sync uifStep back to Editor if it changes internally
                this.$watch('uifStep', (val) => {
                    if (val) {
                        globalThis.dispatchEvent(new CustomEvent('atomic-step-changed', { 
                            detail: { 
                                stepId: val, 
                                instanceId: this.instanceId,
                                uifId: this.uifId
                            } 
                        }));
                    }
                });
            },

            async syncCaseStatus(caseId) {
                if (!caseId) return;
                const factory = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`);
                if (!factory || factory._isDisconnected) {
                    logger.warn(`UIFactory [${this.instanceId}]: syncCaseStatus skipped. Factory not found/disconnected (ID: ${this.uifId})`);
                    return;
                }

                logger.info(`UIFactory [${this.instanceId}]: syncCaseStatus(${caseId}) started using uifId ${this.uifId}...`);
                try {
                    // Prefer the reactively tracked service if available
                    const caseSvc = factory?._caseService || factory?._getService(CASE_SERVICE);
                    if (!caseSvc) {
                        logger.warn(`UIFactory [${this.instanceId}]: Case Service ${CASE_SERVICE} not found! (Context: ${!!factory?._context})`);
                        return;
                    }
                
                    const c = await caseSvc.getCase(caseId);
                    if (c) {
                        // Correctly find the property key tracking this case ID
                        let propKey = null;
                        for (const key in this.uifValues) {
                            if (this.uifValues[key] === caseId) {
                                propKey = key + 'Status';
                                break;
                            }
                        }
                        
                        const prevStatus = propKey ? this.uifValues[propKey] : null;
                        const changed = prevStatus !== c.status;

                        if (changed) {
                            logger.info(`UIFactory [${this.instanceId}]: Fetched Case ${caseId} status: ${c.status} (Updated from: ${prevStatus})`);
                            if (propKey) {
                                this.uifValues[propKey] = c.status;
                                
                                // PERSIST: Manually trigger the factory's persistence engine
                                const factoryEl = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`);
                                if (factoryEl) {
                                    factoryEl.saveInstance(this);
                                }
                            }
                        } else {
                            logger.info(`UIFactory [${this.instanceId}]: Case ${caseId} status unchanged (${c.status}).`);
                        }
                    } else {
                        logger.warn(`UIFactory [${this.instanceId}]: Case ${caseId} not found in service!`);
                    }
                } catch (e) {
                    logger.error(`UIFactory [${this.instanceId}]: syncCaseStatus failed for ${caseId}:`, e);
                }
            },

            async resolveCaseStatuses() {
                // Use raw values to ensure reliable iteration in Alpine proxy
                const rawValues = globalThis.Alpine.raw(this.uifValues);
                const keys = Object.keys(rawValues);
                logger.info(`UIFactory [${this.instanceId}]: Manually resolving Case Statuses for keys:`, keys);
                
                for (const key of keys) {
                    const val = this.uifValues[key];
                    logger.info(`UIFactory [${this.instanceId}]: Checking key ${key}: ${val} (Type: ${typeof val})`);
                    // Generic Case ID pattern: uppercase prefix followed by hyphen and numbers (e.g., BUSI-123)
                    const isCaseId = typeof val === 'string' && /^[A-Z0-9]+-[0-9]+$/.test(val);
                    if (isCaseId) {
                        logger.info(`UIFactory [${this.instanceId}]: Found case reference to sync: ${key}=${val}`);
                        await this.syncCaseStatus(val);
                    }
                }
            },

            async resolveGuards(scope) {
                const factory = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`);
                if (factory && factory.resolveGuards) {
                    await factory.resolveGuards(scope || this);
                }
            },

            async performAction(action) {
                const factory = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`) || 
                                this.$el?.closest('ui-factory');
                if (factory && factory.runAction) {
                    await factory.runAction(action, this);
                }
            }
        };

        // Bind methods to ensure stable 'this' context
        s.syncCaseStatus = s.syncCaseStatus.bind(s);
        s.resolveCaseStatuses = s.resolveCaseStatuses.bind(s);
        s.resolveGuards = s.resolveGuards.bind(s);
        s.performAction = s.performAction.bind(s);
        
        s.instanceId = instanceId || this._params?.instanceId;
        s.uifId = this._id;

        const collect = (parts) => {
            Object.values(parts).forEach(p => {
                const kind = p.kind || p.type;
                if (p.guard) s.uifGuards[p.guard] = true;
                
                // Ensure properties mentioned in actions are initialized for reactivity & persistence
                const params = p.params || {};
                if (params.linkToProperty) {
                    if (s.uifValues[params.linkToProperty] === undefined) s.uifValues[params.linkToProperty] = "";
                    if (s.uifValues[params.linkToProperty + 'Status'] === undefined) s.uifValues[params.linkToProperty + 'Status'] = "";
                }
                if (params.statusProperty && s.uifValues[params.statusProperty] === undefined) {
                    s.uifValues[params.statusProperty] = "";
                }

                if ((kind === 'text-input' || kind === 'input' || kind === 'select-input') && p.id) {
                    if (s.uifValues[p.id] === undefined) {
                        s.uifValues[p.id] = p.value || "";
                    }
                }
                if (p.parts) collect(p.parts);
            });
        };
        Object.values(ui.steps || {}).forEach(step => collect(step.parts || {}));

        this._state = globalThis.Alpine.reactive(s);

        // Build guard config map from spec for declarative matcher evaluation
        this._guardConfig = {};
        const specGuards = spec.guards || spec.ui?.guards || [];
        (Array.isArray(specGuards) ? specGuards : Object.values(specGuards)).forEach(g => {
            if (g.id) this._guardConfig[g.id] = g;
        });
        this.logger.info(`UIFactory [${this._id}]: Loaded ${Object.keys(this._guardConfig).length} guard configs:`, Object.keys(this._guardConfig));

        // --- Standard Reactive Engine (Persistence & Guards) ---
        const masterEffect = globalThis.Alpine.effect(() => {
            if (this._isDisconnected) return;
            const state = this._state;
            
            // 1. Reactive Tracking (Deep)
            const _track = JSON.stringify(state.uifValues);
            const _trackStep = state.uifStep;
            
            // 2. Resolve Guards immediately (Synchronous micro-update)
            this.resolveGuards(state);

            // 3. Auto-Save
            const instanceId = this.getAttribute('instance-id') || this._params?.instanceId;
            if (instanceId && state._hydrated) {
                this.saveInstance(state);
            }
        });
        this._effects.push(masterEffect);

        // --- Live Portals Sync (Dual-Portal Aware) ---
        const syncEffect = globalThis.Alpine.effect(() => {
            const state = this._state.uifValues;
            const globalHostData = globalThis.backofficeState || globalThis.businessPortalState || {};
            const hActive = globalHostData.activeLicense || null;
            const hFellows = globalHostData.fellowsData || null;
            const hCompanies = globalHostData.companies || [];
            const hPersons = globalHostData.persons || [];
            const rCurrentUser = globalHostData.currentUser || globalHostData.currentUser || this._getService(SESSION_SERVICE)?.currentUser || {};

            if (hActive && hActive.id && state.activeLicense?.id !== hActive.id) {
                this.logger.info(`UIFactory [${this._id}]: Syncing activeLicense (New ID: ${hActive.id})`);
                state.activeLicense = hActive;
            }
            if (hActive && hActive.id && state.activeLicenseStatus !== hActive.status) {
                this.logger.info(`UIFactory [${this._id}]: Syncing activeLicenseStatus (New Status: ${hActive.status})`);
                state.activeLicenseStatus = hActive.status;
            }
            if (hFellows && state.fellowsData !== hFellows) {
                state.fellowsData = hFellows;
            }
            // Use length + first ID + second ID as a simple fingerprint for change
            const companiesFingerprint = (hCompanies.length || 0) + (hCompanies[0]?.id || '') + (hCompanies[1]?.id || '');
            if (state._companiesFingerprint !== companiesFingerprint) {
                state.companies = hCompanies;
                state._companiesFingerprint = companiesFingerprint;
            }
            const personsFingerprint = (hPersons.length || 0) + (hPersons[0]?.id || '') + (hPersons[1]?.id || '');
            if (state._personsFingerprint !== personsFingerprint) {
                state.persons = hPersons;
                state._personsFingerprint = personsFingerprint;
            }
            if (rCurrentUser && rCurrentUser.id && state.currentUser?.id !== rCurrentUser.id) {
                state.currentUser = rCurrentUser;
            }

            // 1. Derive Members from current License Customers (Reactive)
            const customers = (state.activeLicense?.customers || []);
            const newMembers = customers.map(id => {
                const entity = (state.companies || []).find(c => String(c.id) === String(id)) || 
                               (state.persons || []).find(p => String(p.id) === String(id));
                return {
                    id: String(id),
                    displayName: entity ? (entity.name || `${entity.firstname || ''} ${entity.lastname || ''}`.trim()) : id
                };
            });
            if (JSON.stringify(state.currentMembers) !== JSON.stringify(newMembers)) {
                state.currentMembers = newMembers;
            }

            // 2. Derive Fellows from selected Member (Reactive)
            const selectedMemberId = state.selectedMember || state.selectedMemberId;
            if (selectedMemberId) {
                const allFellows = state.fellowsData?.FELLOWS || [];
                const filteredFellows = allFellows.filter(f => String(f.fellowOf) === String(selectedMemberId));
                const newFellows = filteredFellows.map(f => {
                    const person = (state.persons || []).find(p => String(p.id) === String(f.personId));
                    return {
                        id: f.personId,
                        displayName: person ? `${person.firstname || ''} ${person.lastname || ''}`.trim() : f.personId
                    };
                });
                if (JSON.stringify(state.currentFellows) !== JSON.stringify(newFellows)) {
                    state.currentFellows = newFellows;
                }
            } else {
                state.currentFellows = [];
            }
        });
        this._effects.push(syncEffect);

        return this._state;
    }

    /**
     * Explicitly persists the current state to the Domain Object registry/strategy.
     */
    saveInstance(state = this._state) {
        if (!state) return;
        
        const instanceId = this.getAttribute('instance-id') || this._params?.instanceId;
        if (!instanceId) return;

        const spec = this._spec || {};
        const strategyId = spec.domainObject?.strategyId || (spec.ui || spec).domainObject?.strategyId || "LOCAL_STRATEGY";

        // --- Improved Capture Engine: Grab the entire property bag but exclude synced global state ---
        const BLACKLIST = [
            'activeLicense', 'activeLicenseStatus', 'fellowsData', 
            'companies', '_companiesFingerprint', 'persons', '_personsFingerprint', 
            'currentUser', 'currentMembers', 'currentFellows', 'parsedLicenses'
        ];

        const rawValues = globalThis.Alpine?.raw ? globalThis.Alpine.raw(state.uifValues) : { ...state.uifValues };
        const capturedValues = {};
        
        Object.keys(rawValues).forEach(key => {
            if (!BLACKLIST.includes(key)) {
                capturedValues[key] = rawValues[key];
            }
        });

        // Safety: Avoid overwriting with empty properties during initial boot
        if (Object.keys(capturedValues).length === 0 && !state.uifStep) return;

        const stratRefs = this._context.getServiceReferences(DOMAIN_STRATEGY_SERVICE) || [];
        let strategySvc = null;
        for (const ref of stratRefs) {
            const svc = this._context.getService(ref);
            if (svc?.id === strategyId) {
                strategySvc = svc;
                break;
            }
        }

        if (strategySvc?.updateInstance) {
            this.logger.info(`UIFactory [${this._id}]: Persisting instance ${instanceId} (${Object.keys(capturedValues).length} properties)`, capturedValues);
            strategySvc.updateInstance(instanceId, (spec.id || spec.ui?.id), {
                currentStep: state.uifStep,
                properties: capturedValues,
                history: globalThis.Alpine?.raw ? globalThis.Alpine.raw(state.history || []) : [...(state.history || [])]
            });
        }
    }

    async runAction(action, scope) {
        if (!action) return;

        // Nav
        if (action.call === "NEXT_STEP" || action.type === "NEXT_STEP") {
            const idx = scope.uifStepKeys.indexOf(scope.uifStep);
            if (idx < scope.uifStepKeys.length - 1) {
                scope.history.push(scope.uifStep);
                scope.uifStep = scope.uifStepKeys[idx + 1];
                scope.data = null;
            }
            return;
        }

        if (action.call === "PREV_STEP" || action.type === "PREV_STEP") {
            if (scope.history.length > 0) {
                scope.uifStep = scope.history.pop();
                scope.data = null;
            }
            return;
        }

        if (!action.call) return;
        // Exec
        scope.loading = true;
        try {
            // 1. Resolve Action Handler
            let finalParams = JSON.parse(JSON.stringify(action.params || {}));

            // Check if action is defined in local SPEC first
            const localAction = this._spec.actions?.[action.call];
            if (localAction) {
                this.logger.info(`UIFactory: Executing local action definition for ${action.call}`);
                if (localAction.type === "API") {
                    // Map local action to the global apiService
                    action.call = "apiService";
                    finalParams = { ...localAction.params, ...finalParams };
                }
            }

            // Interpolate params - two-pass strategy to handle dependencies
            const doInterp = (passParams) => {
                for (const k in finalParams) {
                    if (typeof finalParams[k] === "string") {
                        finalParams[k] = this.interpolate(finalParams[k], scope, passParams);
                    } else if (typeof finalParams[k] === "object" && finalParams[k] !== null) {
                        // Deep interp
                        const deep = (obj) => {
                            for (const dk in obj) {
                                if (typeof obj[dk] === "string") obj[dk] = this.interpolate(obj[dk], scope, passParams);
                                else if (typeof obj[dk] === "object" && obj[dk] !== null) deep(obj[dk]);
                            }
                        };
                        deep(finalParams[k]);
                    }
                }
            };
            
            // Pass 1: Resolve against State (scope)
            doInterp({}); 
            // Pass 2: Resolve against other Params (finalParams)
            doInterp(finalParams);

            // Handle synthetic actions
            if (action.call === 'step.navigate') {
                const target = finalParams.target || finalParams.step;
                if (target) {
                    this.logger.info(`UIFactory: Navigating to step ${target}`);
                    // Case-insensitive lookup for robustness
                    const exact = scope.uifStepKeys.find(k => k === target);
                    const fuzzy = scope.uifStepKeys.find(k => k.toLowerCase() === target.toLowerCase());
                    scope.uifStep = exact || fuzzy || target;
                }
                scope.loading = false;
                return;
            }

            if (action.call === 'default') {
                this.logger.info(`UIFactory: Triggering default action: ${finalParams.action}`, finalParams);
                globalThis.dispatchEvent(new CustomEvent('atomic-default-action', { 
                    detail: { 
                        action: finalParams.action, 
                        params: finalParams,
                        spec: this._spec,
                        values: scope.uifValues
                    } 
                }));
                scope.loading = false;
                return;
            }

            // --- DECENTRALIZED OSGi ACTION LOOKUP ---
            let res = null;
            if (this._context) {
                const refs = this._context.getServiceReferences(ACTION_SERVICE, `(action.id=${action.call})`);
                if (refs?.[0]) {
                    const svcObj = this._context.getService(refs[0]);
                    const execFn = typeof svcObj === 'function' ? svcObj : svcObj.execute;
                    if (execFn) {
                        this.logger.info(`UIFactory: Executing decentralized action: ${action.call}`, finalParams);
                        res = await execFn.apply(svcObj, [finalParams]);
                    }
                }
            }

            // Fallback to global Service Registry for backward compatibility
            if (!res && globalThis.Services?.[action.call]) {
                const svc = globalThis.Services[action.call];
                res = await (typeof svc === "function" ? svc(finalParams) : svc.execute(finalParams));
            }

            if (!res && action.call !== 'step.navigate' && !action.call.includes('STEP')) {
                throw new Error(`Action ${action.call} not found or failed to return result`);
            }

            // --- GENERIC POST-EXECUTION HOOKS (Linking, Redirection, Success Messaging) ---
            if (res) {
                scope.data = res;

                // 1. LINKING: Store result ID in UI state if requested
                if (finalParams.linkToProperty && (res.id || typeof res === 'string')) {
                    const targetId = res.id || res;
                    scope.uifValues[finalParams.linkToProperty] = targetId;
                    if (res.status) scope.uifValues[finalParams.linkToProperty + 'Status'] = res.status;
                    
                    this.logger.info(`UIFactory: Action result linked to property [${finalParams.linkToProperty}]: ${targetId}`);
                    this.saveInstance(scope);
                    this.resolveGuards(scope);
                }

                // 2. SUCCESS MESSAGING
                if (finalParams.successMessage) {
                    alert(this.interpolate(finalParams.successMessage, scope));
                }

                // 3. FLOW REDIRECTION / RESET
                if (finalParams.onSuccess === "RESET") {
                    scope.uifStep = scope.uifStepKeys[0];
                    scope.history = [];
                    scope.uifValues = { activeLicense: scope.uifValues.activeLicense }; 
                    this.saveInstance(scope);
                } else if (finalParams.onSuccess === "REDIRECT" && finalParams.redirectFlowId) {
                    const isPortal = !!globalThis.businessPortalState;
                    const isSubflow = !!document.getElementById('business-subflow-container');
                    const eventName = isPortal ? 'business-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow');
                    
                    globalThis.dispatchEvent(new CustomEvent(eventName, { 
                        detail: { 
                            id: finalParams.redirectFlowId, 
                            params: finalParams.redirectParams 
                        } 
                    }));
                }
            }

        } catch (e) {
            this.logger.error(e);
            scope.data = { error: e.message };
        } finally {
            scope.loading = false;
        }
    }

    interpolate(str, scope, extra = {}) {
        if (!str) return "";
        return str.replace(/(?:\${(this\.)?(.+?)}|\{\{\s*(this\.)?(.+?)\s*\}\})/g, (_, _p1, k1, _p2, k2) => {
            const key = k1 || k2;
            const val = extra[key] ?? scope.uifValues[key] ?? scope[key] ?? null;
            if (val !== null && val !== undefined) return val;
            
            // Try deep resolution if key contains dots
            if (key.includes('.')) {
                const parts = key.split('.');
                const deep = parts.reduce((acc, part) => acc && acc[part], scope.uifValues) ?? 
                             parts.reduce((acc, part) => acc && acc[part], scope);
                if (deep !== undefined && deep !== null) return deep;
            }
            return "";
        });
    }

    resolveValue(expr, scope) {
        if (typeof expr !== 'string') return expr;
        
        // 1. Check if it's an explicit expression: ${path} or {{path}}
        const match = expr.match(/^(?:\${(this\.)?(.+?)}$|\{\{\s*(this\.)?(.+?)\s*\}\})$/);
        const path = match ? (match[2] || match[4]) : expr;

        // 2. Resolve Path Helper
        const resolvePath = (obj, p) => {
            if (!obj || !p) return undefined;
            if (p.startsWith('this.')) p = p.substring(5);
            if (p.startsWith('uifValues.')) p = p.substring(10);
            if (p.startsWith('values.')) p = p.substring(7); // Compatibility
            return p.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, obj);
        };

        // 3. Try to find the value in uifValues or root scope
        const result = resolvePath(scope.uifValues, path) ?? resolvePath(scope, path);
        if (result !== undefined) return result;

        // 4. If it was a literal path that failed, return undefined
        return undefined;
    }

    renderPart(_id, p, existingEl = null) {
        const kind = p.kind || p.type;
        const tagName = this._componentRegistry ? this._componentRegistry.get(kind) : null;
        
        if (tagName) {
            let el = existingEl;
            // If it's a wrapper, get the child
            if (el && el.getAttribute('data-part-id') !== _id) {
                el = el.querySelector(`[data-part-id="${_id}"]`);
            }

            if (!el || el.tagName.toLowerCase() !== tagName.toLowerCase()) {
                el = document.createElement(tagName);
                el.setAttribute('data-part-id', _id);
            }

            if (el.hydrate) {
                const isNew = !existingEl;
                this.logger.info(`UIFactory [${this._id}]: ${isNew ? 'Creating' : 'Reusing'} part [${_id}] (${kind})`);
                el.hydrate(
                    { ...p, id: _id }, 
                    this._context, 
                    (s) => this.interpolate(s, this._state),
                    (path) => this.resolveValue(path, this._state)
                );
            }
            
            if (p.guard) {
                // Return simple wrapper for guards, but keep the el inside
                const wrapper = (existingEl && existingEl.classList.contains('uif-guard-wrapper')) ? existingEl : document.createElement('div');
                wrapper.className = 'uif-guard-wrapper';
                wrapper.setAttribute('data-part-id', _id);
                const escapedGuard = p.guard.replace(/'/g, "\\\\'");
                wrapper.setAttribute('x-show', `uifGuards['${escapedGuard}'] === true`);
                wrapper.setAttribute('x-cloak', '');
                if (!wrapper.contains(el)) wrapper.appendChild(el);
                return wrapper;
            }
            return el;
        }

        // Logic for specialized structural elements
        let container = existingEl;
        if (!container || !container.classList.contains('uif-structural-container')) {
            container = document.createElement('div');
            container.setAttribute('data-part-id', _id);
            container.classList.add('uif-structural-container');
        }
        
        container.className = "uif-structural-container mb-4";

        if (p.type === 'row') {
            container.classList.add("flex", "space-x-3");
            // Hydrate children of the row
            const currentChildren = Array.from(container.querySelectorAll(':scope > [data-part-id]'));
            const newChildIds = Object.keys(p.parts || {});
            currentChildren.forEach(el => {
                if (!newChildIds.includes(el.getAttribute('data-part-id'))) el.remove();
            });
            Object.entries(p.parts || {}).forEach(([cid, cp]) => {
                const existing = container.querySelector(`:scope > [data-part-id="${cid}"]`);
                const childEl = this.renderPart(cid, cp, existing);
                if (childEl) container.appendChild(childEl); // ALWAYS append to maintain DOM order
            });
            return container;
        } else if (p.type === 'card') {
            const variant = p.variant || 'plain';
            const styles = {
                plain: "bg-white border-gray-200 shadow-sm",
                info: "bg-blue-50 border-blue-200 text-blue-800 shadow-blue-100",
                success: "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100",
                error: "bg-red-50 border-red-200 text-red-800 shadow-red-100",
                warning: "bg-amber-50 border-amber-200 text-amber-800 shadow-amber-100"
            };
            container.className = `uif-structural-container p-6 rounded-3xl border-2 border-solid mb-6 block transition-all ${styles[variant] || styles.plain}`;
            
            // Reconcile label (h4)
            let h4 = container.querySelector('h4.uif-card-label');
            if (p.label) {
                if (!h4) {
                    h4 = document.createElement('h4');
                    h4.className = "uif-card-label text-xs uppercase font-black tracking-widest mb-4 opacity-50";
                    container.prepend(h4);
                }
                h4.innerText = this.interpolate(p.label, this._state);
            } else if (h4) {
                h4.remove();
            }

            // Hydrate children of the card
            const currentChildren = Array.from(container.querySelectorAll(':scope > [data-part-id]'));
            const newChildIds = Object.keys(p.parts || {});
            currentChildren.forEach(el => {
                if (!newChildIds.includes(el.getAttribute('data-part-id'))) el.remove();
            });
            Object.entries(p.parts || {}).forEach(([cid, cp]) => {
                const existing = container.querySelector(`:scope > [data-part-id="${cid}"]`);
                const childEl = this.renderPart(cid, cp, existing);
                if (childEl) container.appendChild(childEl); // ALWAYS append to maintain DOM order
            });
            return container;
        } else if (p.type === 'result') {
            container.setAttribute('x-show', 'data');
            container.setAttribute('x-transition', '');
            container.className = "mb-4 p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-auto max-h-80";
            container.innerHTML = `<pre x-text="JSON.stringify(data, null, 2)" class="text-[10px] text-gray-400 font-mono leading-relaxed"></pre>`;
            return container; 
        }

        // 3. Render children or text (Reconcile-Style)
        if (p.parts) {
            // Cleanup orphaned sub-parts
            const newSubIds = Object.keys(p.parts);
            Array.from(container.children).forEach(el => {
                const pid = el.getAttribute('data-part-id');
                if (pid && !newSubIds.includes(pid)) el.remove();
            });

            Object.entries(p.parts).forEach(([sid, sp]) => {
                const existing = container.querySelector(`:scope > [data-part-id="${sid}"]`);
                const child = this.renderPart(sid, sp, existing);
                if (child) container.appendChild(child); // ALWAYS append to maintain DOM order
            });
        } else if (p.type === 'text' || typeof p.value === 'string') {
            // Reconcile text as a leaf leaf
            let inner = container.querySelector('.uif-text-content');
            if (!inner) {
                inner = document.createElement('div');
                inner.className = "uif-text-content text-gray-500 leading-relaxed font-semibold prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 prose-strong:text-gray-700";
                container.appendChild(inner);
            }
            
            let html = "";
            try {
                html = marked.parse(p.value || "");
            } catch (_e) {
                html = p.value || "";
            }
            // Use a temporary map to hold expressions while we set up the DOM
            const reactiveSegments = [];
            const maskedHtml = html.replace(/(?:\${(this\.)?(.+?)}|\{\{\s*(this\.)?(.+?)\s*\}\})/g, (_, _p1, k1, _p2, k2) => {
                const id = `uif-r-${Math.random().toString(36).slice(2, 9)}`;
                reactiveSegments.push({ id, path: k1 || k2 });
                return `<span id="${id}" class="uif-reactive-placeholder"></span>`;
            });

            inner.innerHTML = maskedHtml;

            // Now safely attach x-text to each placeholder using setAttribute (which is literal)
            reactiveSegments.forEach(seg => {
                const span = inner.querySelector(`#${seg.id}`);
                if (span) {
                    // We remove the ID to keep DOM clean, but keep a class for debugging if needed
                    span.removeAttribute('id');
                    span.className = "uif-reactive text-blue-600 font-bold whitespace-pre-wrap font-mono";
                    
                    // CRITICAL: Decode HTML entities (like &#39;) introduced by marked.parse
                    const temp = document.createElement('div');
                    temp.innerHTML = seg.path;
                    const decodedPath = temp.textContent;

                    const escapedPath = decodedPath.replace(/'/g, "\\'"); // Single backslash for setAttribute
                    span.setAttribute('x-text', `((v) => (typeof v === 'object' && v !== null) ? JSON.stringify(v, null, 2) : (v ?? ''))(uifResolve('${escapedPath}'))`);
                }
            });
        }

        if (p.guard) {
            const escapedGuard = p.guard.replace(/'/g, "\\\\'");
            const guardWrap = document.createElement('div');
            // Use both x-show and direct style binding for maximum robustness against CSS overrides
            guardWrap.setAttribute('x-show', `uifGuards['${escapedGuard}'] === true`);
            guardWrap.setAttribute(':style', `{ display: uifGuards['${escapedGuard}'] ? '' : 'none !important' }`);
            guardWrap.setAttribute('x-cloak', '');
            guardWrap.setAttribute('x-effect', `if (uifGuards['${escapedGuard}']) {
                const msg = 'UIFactory [' + this._id + ']: Guard ${escapedGuard} attached/visible';
                if (globalThis.Services?.['${LOG_SERVICE}']) {
                    globalThis.Services['${LOG_SERVICE}'].getLogger("ui-factory").info(msg);
                } else {
                    console.log(msg);
                }
            }`);
            guardWrap.appendChild(container);
            return guardWrap;
        }
        return container;
    }

    async resolveGuards(scope) {
        if (!scope || !scope.uifGuards) return;
        
        // Batch evaluations to a microtask if already pending, otherwise run
        if (this._pendingGuardEval) return;
        this._pendingGuardEval = true;

        try {
            const lime = this._getService(LIMES_SERVICE);
            const bp = globalThis.businessPortalState || {};
            const bo = globalThis.backofficeState || {};
            const user = bp.currentUser || bo.currentUser || this._getService(SESSION_SERVICE)?.currentUser;
            const vals = globalThis.Alpine.raw(scope.uifValues);

            for (const guardKey in scope.uifGuards) {
                const guardDef = this._guardConfig?.[guardKey];
                let allPass = true;

                if (guardDef && Array.isArray(guardDef.matchers) && guardDef.matchers.length > 0) {
                    const op = (guardDef.operator || 'OR').toUpperCase();
                    const results = guardDef.matchers.map(m => {
                        const type = m.type || '';
                        const key = m.key || m.property || '';
                        const val = m.value;
                        let pass = true;
                        switch (type) {
                            case 'matchAlways': pass = true; break;
                            case 'matchNever': pass = false; break;
                            case 'matchPropertyNotEmpty': pass = !!(vals[key]); break;
                            case 'matchPropertyEmpty': pass = !(vals[key]); break;
                            case 'matchPropertyEquals': pass = String(vals[key]) === String(val); break;
                            case 'matchPropertyNotEquals': pass = String(vals[key]) !== String(val); break;
                            default: pass = true; break;
                        }
                        return pass;
                    });
                    allPass = op === 'OR' ? results.some(r => r) : results.every(r => r);
                } else if (guardDef) {
                    allPass = true;
                } else {
                    const parts = guardKey.split(/&&/).map(g => g.trim());
                    for (const g of parts) {
                        if (g.startsWith('matchPropertyEmpty:')) {
                            if (vals[g.substring(19)]) allPass = false;
                        } else if (g.startsWith('matchPropertyNotEmpty:')) {
                            if (!vals[g.substring(22)]) allPass = false;
                        } else if (g.startsWith('matchPropertyEquals:')) {
                            const [prop, val] = g.substring(20).split(',');
                            if (String(vals[prop]) !== String(val)) allPass = false;
                        } else if (lime) {
                            try {
                                const ok = typeof lime === 'function' ? await lime(g, vals) : await lime.isAllowed(user, g, vals);
                                if (!ok) allPass = false;
                            } catch (_e) { /* ignore */ }
                        }
                        if (!allPass) break;
                    }
                }

                // Only update if changed to minimize DOM thrashing
                if (scope.uifGuards[guardKey] !== allPass) {
                    this.logger.info(`UIFactory [${this._id}]: Guard flipping [${guardKey}] -> ${allPass}`);
                    scope.uifGuards[guardKey] = allPass;
                    // Trigger object-level reactivity for Alpine
                    scope.uifGuards = { ...scope.uifGuards };
                }
            }
        } finally {
            this._pendingGuardEval = false;
        }
    }
}

if (!customElements.get("ui-factory")) {
    customElements.define("ui-factory", UIFactory);
}

export default UIFactory;
