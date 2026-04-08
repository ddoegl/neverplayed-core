import { 
    YAML_SERVICE, 
    SESSION_SERVICE, 
    LIMES_SERVICE, 
    ATOMIC_COMPONENT_REGISTRY_SERVICE,
    DOMAIN_STRATEGY_SERVICE,
    ACTION_SERVICE,
    DOMAIN_OBJECT_INSTANCE_SERVICE,
    DOMAIN_OBJECT_REGISTRY_SERVICE,
    LOG_SERVICE
} from "core-types";

import { PartRegistry } from "./ui-factory/registry.js";
import * as PathResolver from "../utils/path-resolver.js";

// Decoupled from Domain-specific listeners. Logic moved to domain orchestrators.

if (!globalThis.UI_FACTORY_DEBUG) {
    globalThis.UI_FACTORY_DEBUG = true; 
}

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
        delete(id) { this._map.delete(id); },
        getAll() { return Object.fromEntries(this._map); }
    };
}

class UIFactory extends HTMLElement {
    constructor() {
        super();
        this._spec = null;
        this._context = null;
        this._yamlService = null;
        this._registryService = null;
        this._rendered = false;
        this._initialized = false;
        this._id = "uif-" + Math.random().toString(36).substring(7);
        this._params = {};
        this._effects = []; // Track Alpine effects for cleanup
        this._instanceId = null;
        this._instanceTracker = null;
        this._isHydrating = false;
        this._lastFingerprint = null; // Fingerprint to prevent recursion
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
        
        // Final save on disconnection - GUARDED
        if (this._context && typeof this._context.isValid === 'function' && this._context.isValid()) {
            this.saveInstance();
        } else {
            this.logger.warn(`UIFactory [${this._id}]: Bundle Context invalid during disconnect. Skipping save.`);
        }

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

        // Track Component Registry reactively
        this._context.trackService(`(objectClass=${ATOMIC_COMPONENT_REGISTRY_SERVICE})`, {
            addingService: (ref) => {
                this._registryService = this._context.getService(ref);
                this.logger.info(`UIFactory [${this._id}]: Component Registry arrived. Re-syncing atomic tags...`);
                // Pattern 17: Non-destructive sync. Don't reset _rendered.
                this.render();
                return this._registryService;
            },
            modifiedService: () => {
                this.logger.info(`UIFactory [${this._id}]: Component Registry UPDATED. Re-syncing...`);
                this.render();
            },
            removedService: () => { this._registryService = null; }
        }).open();

        // 🚀 Synchronous Registry Peek: Handshake immediately if already registered
        const regRef = this._context.getServiceReference(ATOMIC_COMPONENT_REGISTRY_SERVICE);
        if (regRef) {
            this._registryService = this._context.getService(regRef);
            this.logger.info(`UIFactory [${this._id}]: Component Registry found synchronously. Matching Truth.`);
        }

        this.logger.info(`UIFactory [${this._id}]: Bundle Context received. Setting up service trackers...`);
        
        // Track YAML Service reactively
        this._context.trackService(`(objectClass=${YAML_SERVICE})`, {
            addingService: (ref) => { this._yamlService = this._context.getService(ref); },
            removedService: () => { this._yamlService = null; }
        }).open();
        
        // Track the specific Domain Object Instance Service reactively
        this._setupInstanceTracker();
        
        if (this._spec) this.render();
    }

    _setupInstanceTracker() {
        if (!this._context || this._instanceTracker) return;
        
        this.logger.info(`UIFactory [${this._id}]: Opening instance service tracker...`);
        this._instanceTracker = this._context.trackService(`(objectClass=${DOMAIN_OBJECT_INSTANCE_SERVICE})`, {
            addingService: (ref) => {
                const id = ref.getProperty("instance.id");
                if (id === this._instanceId) {
                    this.logger.info(`UIFactory [${this._id}]: Matching Instance Service found: [${id}]. Hydrating (if not already done)...`);
                    // Only hydrate if _createState didn't already pre-hydrate via _getFreshInstance
                    if (this._state && !this._state._hydrated) {
                        const fresh = this._getFreshInstance(id) || this._context.getService(ref);
                        this.hydrateFromService(fresh);
                    }
                }
            },
            modifiedService: (ref) => {
                // This fires every time we save (setProperties is called by addInstance).
                // Do NOT re-hydrate here — it would apply the stale boot-time service object
                // and reset uifStep back to the original step, breaking navigation.
                const id = ref.getProperty("instance.id");
                if (id === this._instanceId) {
                    this.logger.debug(`UIFactory [${this._id}]: Instance Service updated [${id}] — save loopback acknowledged, not re-hydrating.`);
                }
            },
            removedService: (ref) => {
                 if (ref.getProperty("instance.id") === this._instanceId) {
                     this.logger.warn(`UIFactory [${this._id}]: Instance service lost.`);
                 }
            }
        });
        this._instanceTracker.open();

        // 🚀 CRITICAL: Perform an immediate check in case it was already registered
        if (this._instanceId) {
            this._checkHydration();
        }
    }

    hydrateFromService(instance) {
        if (!instance || !this._state || this._isHydrating) return;
        this._isHydrating = true;
        const keysBefore = Object.keys(this._state.uifValues).length;
        this.logger.info(`UIFactory [${this._id}]: Received Instance Service. Properties: [${Object.keys(instance.properties || {}).join(', ')}]`);
        
        // Deep reactive merge
        Object.entries(instance.properties || {}).forEach(([k, v]) => {
            this._state.uifValues[k] = v;
        });

        if (instance.currentStep) this._state.uifStep = instance.currentStep;
        if (instance.history) this._state.history = instance.history || [];
        this._state._hydrated = true;
        
        // Sync fingerprint after hydration to block redundant loopback
        const rawValues = globalThis.Alpine?.raw ? globalThis.Alpine.raw(this._state.uifValues) : { ...this._state.uifValues };
        const capturedValues = {};
        const BLACKLIST = ['activeLicense', 'activeLicenseStatus', 'fellowsData', 'companies', 'persons', 'currentUser', 'currentMembers', 'currentFellows'];
        Object.keys(rawValues).forEach(key => { if (!BLACKLIST.includes(key)) capturedValues[key] = rawValues[key]; });
        
        this._lastFingerprint = JSON.stringify({
            step: this._state.uifStep,
            props: capturedValues,
            history: (this._state.history || [])
        });

        this.logger.info(`UIFactory [${this._id}]: Hydration complete. Keys: ${keysBefore} -> ${Object.keys(this._state.uifValues).length}. Rerunning guards...`);
        this.resolveGuards(this._state);
        
        // Finalize hydration in next tick to allow loop to settle
        globalThis.Alpine?.nextTick(() => { 
             this._isHydrating = false;
        });
    }

    _getService(id) {
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

    /**
     * Gets the freshest instance data from the DO Registry's live internal Map.
     * Necessary because Pandino's context.getService(ref) returns the ORIGINAL
     * object registered at boot-time — it is never updated when instance data changes.
     */
    _getFreshInstance(instanceId) {
        if (!this._context || !instanceId) return null;
        try {
            const regRef = this._context.getServiceReference(DOMAIN_OBJECT_REGISTRY_SERVICE);
            if (regRef) {
                const registry = this._context.getService(regRef);
                if (registry?.getInstance) return registry.getInstance(instanceId);
            }
        } catch (_e) { /* ignore */ }
        return null;
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
        
        // Smart Unified Scope (Path A): Reactively merge into state if initialized
        if (this._state?.uifValues) {
            this.logger.debug(`UIFactory [${this._id}]: Reactively merging params into uifValues`);
            Object.entries(this._params).forEach(([k, v]) => {
                if (k === 'instanceId') return;
                // Reactive Override: Explicit setParams calls take precedence to allow shell-driven updates
                this._state.uifValues[k] = v;
            });
        }

        if (this._params.instanceId) {
            this._instanceId = this._params.instanceId;
            this._checkHydration();
        }
    }

    _checkHydration() {
        if (!this._context || !this._instanceId) return;
        const refs = this._context.getServiceReferences(DOMAIN_OBJECT_INSTANCE_SERVICE, `(instance.id=${this._instanceId})`);
        if (refs && refs.length > 0) {
            this.logger.info(`UIFactory [${this._id}]: Synchronous check found service for ${this._instanceId}`);
            this.hydrateFromService(this._context.getService(refs[0]));
        }
    }

    static get observedAttributes() {
        return ["data-uif-id"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "data-uif-id" && newValue && oldValue !== newValue) {
            this.logger.info(`UIFactory [${this._id}]: ID changing from attribute to ${newValue}`);
            const oldId = this._id;
            this._id = newValue;
            
            // Re-register in registry if state exists
            if (this._state && globalThis.__UI_FACTORY_REGISTRY) {
                globalThis.__UI_FACTORY_REGISTRY.delete(oldId);
                globalThis.__UI_FACTORY_REGISTRY.set(this._id, this._state);
                this._state.uifId = this._id;
            }
        }
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
            console.log(`UIFactory [${this._id}]: atomic-change for [${id}] -> [${value}]`);
            e.stopPropagation(); 
            if (this._state && this._state.uifValues) {
                this._state.uifValues[id] = value;
                this._state.data = null; 
                this.saveInstance(); // PERSIST
            }
        });

        if (this._spec) this.render();

        // Ensure Alpine discovery in complex/nested DOM insertion contexts (Passive)
        setTimeout(() => {
            const root = this.querySelector('.ui-f-root');
            if (this._state && globalThis.Alpine) {
                if (root && (root.__x || root._x_dataStack)) {
                    this.logger.info(`UIFactory [${this._id}]: Alpine discovery successful on root div.`);
                } else {
                    this.logger.warn(`UIFactory [${this._id}]: Alpine not yet connected to root div. Check for x-cloak blocking.`);
                }
            }
        }, 800);
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

        // 2.1 Critical Sync: IDs and Metadata only on the host. 
        // x-data MOVES to the root in 2.2
        this.setAttribute('data-uif-id', this._id);
        
        root = document.createElement('div');
        root.className = 'ui-f-root relative min-h-[50px]';
        // 🚀 ATOMIC BINDING: Move x-data to the stable inner root
        root.setAttribute('x-data', `globalThis.__UI_FACTORY_REGISTRY.get('${this._id}')`);
        
        body = document.createElement('div');
        body.className = 'uif-body flex flex-col gap-4'; 
        root.appendChild(body);
        
        // 2.2 Atomic Swap: Clear existing content (if any) and inject the root
        this.innerHTML = "";
        this.container = body;
        this.hydrateBody(body, ui);

        // Append the prepared tree
        this.appendChild(root);

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
        
        // Pulse Alpine to discover new bindings
        if (globalThis.Alpine) {
            globalThis.Alpine.initTree(this.container || root);
        }

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
                if (s.title) {
                    let existingH3 = stepWrapper.querySelector('h3.uif-step-title');
                    if (!existingH3) {
                        existingH3 = document.createElement('h3');
                        existingH3.className = "uif-step-title text-lg font-black mb-6 text-gray-800 tracking-tight";
                        stepWrapper.prepend(existingH3);
                    }
                    // Rule 5: Segmented Variable Resolution
                    const titleHtml = s.title.replace(/(?:\${(this\.)?(.+?)}|\{\{\s*(this\.)?(.+?)\s*\}\})/g, (_, _p1, k1, _p2, k2) => {
                        const path = k1 || k2;
                        const decodedPath = path.replace(/&amp;/g, '&');
                        return `<span x-text="$uifResolve('${decodedPath.replace(/'/g, "\\'")}')"></span>`;
                    });
                    if (existingH3.innerHTML !== titleHtml) {
                        existingH3.innerHTML = titleHtml;
                    }
                } else {
                    const existingH3 = stepWrapper.querySelector('h3.uif-step-title');
                    if (existingH3) existingH3.remove();
                }

                // Hydrate Parts (Reconcile)
                const partsContainer = stepWrapper; 
                const currentPartEls = Array.from(partsContainer.querySelectorAll('[data-part-id]'));
                const newPartIds = Object.keys(s.parts || {});
                
                // Remove obsolete
                currentPartEls.forEach(el => {
                    if (!newPartIds.includes(el.getAttribute('data-part-id'))) el.remove();
                });

                Object.entries(s.parts || {}).forEach(([pid, p]) => {
                    const existing = partsContainer.querySelector(`[data-part-id="${pid}"]`);
                    const partEl = this.renderPart(pid, p, existing);
                    if (partEl && !partsContainer.contains(partEl)) partsContainer.appendChild(partEl);
                    if (partEl && partsContainer.contains(partEl)) partsContainer.appendChild(partEl); // Stable order
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
                if (partEl && !container.contains(partEl)) container.appendChild(partEl);
            });
        }
    }

    _createState(spec) {
        this.logger.debug(`UIFactory [${this._id}]: _createState starting...`);
        const instanceId = this._params?.instanceId || `uif-local-${Math.random().toString(36).substring(7)}`;
        const instance = this._getFreshInstance(instanceId);
        
        const instanceData = instance?.properties || {};
        const instanceStep = instance?.currentStep;
        const instanceHistory = instance?.history || [];

        // 1. Initial State Definition
        const steps = spec.ui?.steps || {};
        const stepKeys = Object.keys(steps);
        const initialStep = spec.ui?.initialStep || (stepKeys.length > 0 ? stepKeys[0] : null);

        const s = {
            loading: false,
            data: null,
            uifGuards: {},
            uifValues: { ...this._params }, // Seed with initial parameters
            uifStep: instanceStep || initialStep || (stepKeys.length > 0 ? stepKeys[0] : null),
            uifStepKeys: stepKeys,
            uifInitialStep: initialStep || (stepKeys.length > 0 ? stepKeys[0] : null),
            history: instanceHistory,
            _hydrated: !!instance,
            _registryReady: false,
            get globals() {
                return globalThis.backofficeState || globalThis.businessPortalState || {};
            },
            instanceId: instanceId,
            uifId: this._id,
            uifResolve(expr) {
                try {
                    // DIAGNOSTIC: Log the current state once per step or on big changes? 
                    // No, let's just log the resolution attempt.
                    const val = this._factory ? this._factory.resolveValue(expr, this) : PathResolver.resolveValue(expr, this);
                    
                    if (globalThis.UI_FACTORY_DEBUG) {
                        console.log(`UIFactory [${this.uifId}] RESOLVE: '${expr}' ->`, val, " | Current uifValues:", { ...this.uifValues });
                    }
                    
                    if (val !== undefined && val !== null) return val;

                    if (expr && (/[?|&:<>=!]/.test(expr) || expr.includes(' '))) {
                        // Complex Evaluation with Unified Scope
                        const scopeProxy = new Proxy(this.uifValues, {
                            get: (target, key) => {
                                if (key === 'this' || key === 'uifValues' || key === 'values') return target;
                                if (key === 'globals') return this.globals;
                                if (key === 'uifResolve' || key === 'resolve') return this.uifResolve.bind(this);
                                if (key === 'uifGuards' || key === 'guards') return this.uifGuards;
                                
                                // Order: Local -> Global -> Alpine Scope
                                return target[key] !== undefined ? target[key] : (this.globals[key] !== undefined ? this.globals[key] : (this[key] !== undefined ? this[key] : undefined));
                            },
                            has: () => true
                        });
                        return (new Function('v', `with(v) { return ${expr} }`))(scopeProxy);
                    }
                } catch (_e) { /* silent */ }
                return undefined;
            },
            init() {
                if (!this._factory) {
                    const factory = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`);
                    if (factory) {
                        factory._state = this;
                        this._factory = factory;
                    }
                }
                if (this._factory) {
                    this._factory.resolveGuards(this);
                }
            }
        };

        const collect = (parts) => {
            Object.entries(parts || {}).forEach(([partKey, p]) => {
                const kind = p.kind || p.type;
                const id = p.id || partKey; // Identity Injection (ADR-0025)
                
                if (p.guard) s.uifGuards[p.guard] = true;
                
                if ((kind === 'text-input' || kind === 'input' || kind === 'select-input' || kind === 'radio-input' || kind === 'checkbox-input')) {
                    if (s.uifValues[id] === undefined) {
                        s.uifValues[id] = p.value !== undefined ? p.value : "";
                    }
                }
                
                // PROOF OF LIFE: Force inject some values for atomic-showcase if they are missing
                if (spec.id === 'atomic-showcase' && !s.uifValues['name']) {
                    s.uifValues['name'] = "TestUser_" + Math.floor(Math.random() * 1000);
                    s.uifValues['role'] = "dev";
                }

                if (p.parts) collect(p.parts);
            });
        };
        Object.values(steps).forEach(sStep => collect(sStep.parts || {}));

        // 2. Sync Properties from Actions (Legacy Support)
        Object.values(steps).forEach(sStep => {
            Object.values(sStep.parts || {}).forEach(p => {
                const params = p.params || {};
                if (params.linkToProperty) {
                    if (s.uifValues[params.linkToProperty] === undefined) s.uifValues[params.linkToProperty] = "";
                    if (s.uifValues[params.linkToProperty + 'Status'] === undefined) s.uifValues[params.linkToProperty + 'Status'] = "";
                }
            });
        });

        // 3. Hydrate from Instance Data (Source of Truth)
        Object.assign(s.uifValues, instanceData);

        this._state = globalThis.Alpine.reactive(s);
        this._state._factory = this; // Immediate handshake to avoid init race

        // Build guard config map from spec for declarative matcher evaluation
        this._guardConfig = {};
        const specGuards = spec.guards || spec.ui?.guards || [];
        (Array.isArray(specGuards) ? specGuards : Object.values(specGuards)).forEach(g => {
            if (g.id) this._guardConfig[g.id] = g;
        });
        this.logger.info(`UIFactory [${this._id}]: Loaded ${Object.keys(this._guardConfig).length} guard configs:`, Object.keys(this._guardConfig));

        // --- Standard Reactive Engine (Persistence & Guards) ---
        const masterEffect = globalThis.Alpine.effect(() => {
            if (this._isDisconnected || this._isHydrating) return;
            if (this._context && typeof this._context.isValid === 'function' && !this._context.isValid()) return;
            
            const state = this._state;
            if (!state) return;

            // Persist on change
            this.saveInstance(state);
            
            // Re-evaluate guards reactively
            this.resolveGuards(state);
        });
        this._effects.push(masterEffect);

        // --- Live Portals Sync (Dual-Portal Aware) ---
        const syncEffect = globalThis.Alpine.effect(() => {
            try {
                if (this._isDisconnected || this._isHydrating) return;
                if (this._context && typeof this._context.isValid === 'function' && !this._context.isValid()) return;
                
                const state = this._state.uifValues;
                const globalHostData = globalThis.backofficeState || globalThis.businessPortalState || {};
                
                // Fail-safe: if no platform state is available, skip sync
                if (!globalHostData || Object.keys(globalHostData).length === 0) return;

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
            } catch (_e) {
                // Fail-Silent: The platform state is likely tearing down
            }
        });
        this._effects.push(syncEffect);

        return this._state;
    }

    /**
     * Explicitly persists the current state to the Domain Object registry/strategy.
     */
    saveInstance(state = this._state) {
        if (!state || !this._context) return;
        
        // OSGi Lifecycle Guard
        if (typeof this._context.isValid === 'function' && !this._context.isValid()) {
            return;
        }

        const instanceId = this.getAttribute('instance-id') || this._params?.instanceId;
        if (!instanceId) return;

        const spec = this._spec || {};
        const strategyId = spec.domainObject?.strategyId || (spec.ui || spec).domainObject?.strategyId || "LOCAL_STRATEGY";

        // --- Improved Capture Engine ---
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

        // 1. Change Guard: Deep-Fingerprint check to prevent Loop Recursion
        const currentFingerprint = JSON.stringify({
            step: state.uifStep,
            props: capturedValues,
            history: (state.history || [])
        });
        if (currentFingerprint === this._lastFingerprint) return;

        // Safety: Avoid overwriting with empty properties during initial boot
        if (this._instanceId && !state._hydrated) {
            this.logger.debug(`UIFactory [${this._id}]: Persistence deferred. Waiting for initial hydration.`);
            return;
        }

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
            this._lastFingerprint = currentFingerprint;
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
        return PathResolver.interpolate(str, scope, extra, (expr) => {
            return scope && typeof scope.uifResolve === 'function' ? scope.uifResolve(expr) : undefined;
        });
    }

    /**
     * Resolves a value from the state. Supports deep paths and prefixes.
     */
    resolveValue(expr, scope) {
        return PathResolver.resolveValue(expr, scope);
    }

    /**
     * Renders a part using the delegated PartRegistry.
     */
    renderPart(_id, p, existingEl = null) {
        return PartRegistry.render(_id, p, this._context, PathResolver, this, existingEl);
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
                    this.logger.info(`UIFactory [${this._id}]: Guard [${guardKey}] evaluated. Matchers: [${results.join(', ')}]. Result: ${allPass}`);
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
                                this.logger.info(`UIFactory [${this._id}]: Limes Guard [${g}] evaluated. Result: ${ok}`);
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

// --- Alpine Magic Registration: $uifResolve (Global Shield) ---
if (globalThis.Alpine && !globalThis.Alpine._uifResolveRegistered) {
    globalThis.Alpine.magic('uifResolve', (el) => {
        return (expr) => {
            const uifEl = el.closest('ui-factory');
            const uifId = uifEl?.getAttribute('data-uif-id');
            if (!uifId) return undefined;
            const state = globalThis.__UI_FACTORY_REGISTRY.get(uifId);
            if (!state) return undefined;
            
            // HINT to Alpine: Use state.uifValues to trigger reactive dependency tracking
            const _reactiveBridge = state.uifValues; 
            
            const val = state.uifResolve(expr);
            if (globalThis.UI_FACTORY_DEBUG) {
                console.log(`UIFactory [${uifId}]: $uifResolve('${expr}') ->`, val);
            }
            return val;
        };
    });
    globalThis.Alpine._uifResolveRegistered = true;
}

export default UIFactory;
