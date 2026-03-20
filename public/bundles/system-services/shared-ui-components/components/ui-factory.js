import { marked } from "https://esm.sh/marked@12.0.1";
import { DOMAIN_OBJECT_REGISTRY_SERVICE, CASE_SERVICE, YAML_SERVICE, SESSION_SERVICE, LIMES_SERVICE, ATOMIC_COMPONENT_REGISTRY_SERVICE } from "../../../../shared-types.js";
import { EVENT_HANDLER_INTERFACE_KEY, EVENT_TOPIC } from "https://esm.sh/@pandino/event-api@0.8.33";

// --- OSGi-to-DOM Event Bridge (Dual-Bridge Pattern) ---
// --- OSGi-to-DOM Event Bridge (Persistent & Registry-Aware) ---
let caseUpdateBridgeStarted = false;
let _sharedCaseService = null;
let _sharedRegistryService = null;

const startCaseUpdateBridge = (context) => {
    console.log("UIFactory: [BRIDGE] startCaseUpdateBridge called with context:", context);
    console.log("UIFactory: [BRIDGE] caseUpdateBridgeStarted:", caseUpdateBridgeStarted);
    if (caseUpdateBridgeStarted || !context) return;
    caseUpdateBridgeStarted = true;
    console.log("UIFactory: [BRIDGE] Starting OSGi bridge...");
    // Track services globally for the bridge
    context.trackService(`(objectClass=${CASE_SERVICE})`, {
        addingService: (_ref) => { _sharedCaseService = context.getService(_ref); },
        removedService: () => { _sharedCaseService = null; }
    }).open();

    context.trackService(`(objectClass=${DOMAIN_OBJECT_REGISTRY_SERVICE})`, {
        addingService: (_ref) => { _sharedRegistryService = context.getService(_ref); },
        removedService: () => { _sharedRegistryService = null; }
    }).open();

    console.log("UIFactory: [BRIDGE] Registering persistent, registry-aware EventHandler service...");
    const eventHandler = {
        handleEvent: async (event) => {
            const topic = typeof event.getTopic === 'function' ? event.getTopic() : event.topic;
            const id = typeof event.getProperty === 'function' ? event.getProperty('id') : event.id;
            if (!topic || !id) return;

            const domTopic = topic.replaceAll('/', '-');
            console.log(`UIFactory: [BRIDGE] Event [${topic}] received for ID ${id}. Bridge updating...`);

            // 1. Fetch latest status from service
            let status = null;
            if (_sharedCaseService) {
                try {
                    const c = await _sharedCaseService.getCase(id);
                    status = c?.status;
                } catch (e) { console.error("UIFactory [BRIDGE]: Fetch failed", e); }
            }
            console.log("UIFactory [BRIDGE]: Status", status); 

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
                                console.log(`UIFactory: [BRIDGE] Updating Registry instance ${inst.id}: ${statusProp} -> ${status}`);
                                inst.properties[statusProp] = status;
                                changed = true;
                            }
                        }
                    }
                    if (changed && inst.strategyId) {
                        const stratRefs = context.getServiceReferences("prototyper.domain.strategy") || [];
                        const strat = stratRefs.map(r => context.getService(r)).find(s => s.id === inst.strategyId);
                        if (strat?.updateInstance) {
                            strat.updateInstance(inst.id, inst.blueprintId, inst);
                        }
                    }
                }
            }
        }
    };

    context.registerService(EVENT_HANDLER_INTERFACE_KEY, eventHandler, {
        [EVENT_TOPIC]: ['backoffice/cases/added', 'backoffice/cases/updated']
    });

    
    
};

if (!globalThis.__UI_FACTORY_REGISTRY) {
    globalThis.__UI_FACTORY_REGISTRY = new Map();
}

class UIFactory extends HTMLElement {
    constructor() {
        super();
        this._spec = null;
        this._context = null;
        this._yamlService = null;
        this._componentRegistry = null;
        this._rendered = false;
        this._id = "uif-" + Math.random().toString(36).substring(7);
        this._params = {};
        this._effects = []; // Track Alpine effects for cleanup
        this._instanceId = null;
    }

    disconnectedCallback() {
        console.log(`UIFactory [${this._id}]: disconnected from DOM. Cleaning up ${this._effects.length} effects.`);
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
        
        const registryRef = ctx.getServiceReference(ATOMIC_COMPONENT_REGISTRY_SERVICE);
        this._componentRegistry = registryRef ? ctx.getService(registryRef) : null;

        console.log(`UIFactory [${this._id}]: Bundle Context received. Setting up service trackers...`);
        
        // Track YAML Service reactively
        this._context.trackService(`(objectClass=${YAML_SERVICE})`, {
            addingService: (ref) => { this._yamlService = this._context.getService(ref); },
            removedService: () => { this._yamlService = null; }
        }).open();

        // Track Case Service reactively
        this._context.trackService(`(objectClass=${CASE_SERVICE})`, {
            addingService: (ref) => { 
                console.log(`UIFactory [${this._id}]: Case Service ${CASE_SERVICE} discovered via tracker.`);
                this._caseService = this._context.getService(ref); 
                // Auto-retry status resolution now that we have the service!
                if (this._state?.resolveCaseStatuses) {
                    console.log(`UIFactory [${this._id}]: Retrying status resolution...`);
                    this._state.resolveCaseStatuses();
                }
            },
            removedService: () => { this._caseService = null; }
        }).open();
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
        console.log(`UIFactory [${this._id}]: setSpec called`, value ? "OK" : "NULL");
        this._spec = value;
        this.render();
    }

    setParams(value) {
        console.log(`UIFactory [${this._id}]: setParams called`, value);
        this._params = value || {};
    }

    connectedCallback() {
        console.log(`UIFactory [${this._id}]: connected to DOM`);
        globalThis.__UI_FACTORY_REGISTRY.set(this._id, this._state);
        
        // Listen for standard Atomic Component events
        this.addEventListener('atomic-action', (e) => {
            console.log(`UIFactory [${this._id}]: atomic-action received`, e.detail.action);
            e.stopPropagation(); // Prevent bubbling to parent factories (e.g. Editor)
            this.runAction(e.detail.action, this._state);
        });

        this.addEventListener('atomic-change', (e) => {
            const { id, value } = e.detail;
            console.log(`UIFactory [${this._id}]: atomic-change received`, id, value);
            e.stopPropagation(); // Prevent bubbling to parent factories (e.g. Editor)
            this._state.values[id] = value;
            this._state.data = null; // Clear results on input change
        });

        // If we already have a spec, render now
        if (this._spec) this.render();
        else setTimeout(() => this.render(), 200);
    }

    render(newSpec = null) {
        if (newSpec) this._spec = newSpec;
        let spec = this._spec;
        const script = this.querySelector('script[type="text/yaml"]');
        if (!spec && script) {
            const raw = script.textContent.trim();
            try {
                if (this._yamlService) spec = this._yamlService.load(raw);
                else if (globalThis.YAML) spec = globalThis.YAML.parse(raw);
            } catch (_e) { /* silent */ }
        }

        if (!spec) {
            if (!this._rendered) {
                this.innerHTML = `
                    <div class="p-8 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400">
                        <i class="fas fa-microchip mb-4 text-3xl animate-pulse"></i>
                        <p class="text-xs font-mono uppercase tracking-widest">Waiting for Spec...</p>
                    </div>
                `;
                this._rendered = true;
            }
            return;
        }

        // --- 1. IDEMPOTENT RENDER (Reuse existing root if present) ---
        if (this._rendered && this.container && this.querySelector('.ui-f-root')) {
            console.log(`UIFactory [${this._id}]: Reactive structure update (newSpec=${!!newSpec})`);
            
            // Clear current structure
            this.container.innerHTML = "";
            
            // Update state metadata to handle new steps if they changed
            const ui = spec.ui || spec;
            const newKeys = Object.keys(ui.steps || {});
            if (this._state) {
                this._state.stepKeys = newKeys;
                this._state.initialStep = ui.initialStep || (newKeys.length > 0 ? newKeys[0] : null);
                
                // --- FORCED STEP SYNC (Crucial for Live Preview) ---
                // If a new spec was explicitly provided (e.g. from editor), 
                // we force the current step to the new initialStep.
                if (newSpec && this._state.initialStep) {
                    this._state.currentStep = this._state.initialStep;
                }
            }

            // Re-hydrate structure into the existing container
            this.hydrateBody(this.container, ui);
            
            // If we have a new spec, ensure the state knows its values might have changed
            if (this._state && newSpec) { 
                // We keep the old values to avoid resetting the user's progress
                // but we could merge defaults here if needed.
            }
            return;
        }

        this._spec = spec;
        if (!this._state) {
            this._state = this._createState(spec);
            globalThis.__UI_FACTORY_REGISTRY.set(this._id, this._state);
        }

        this.setAttribute('data-uif-id', this._id);
        
        // --- HYDRATION ENGINE START ---
        const root = document.createElement('div');
        root.className = 'ui-f-root';
        root.setAttribute('x-data', `globalThis.__UI_FACTORY_REGISTRY.get('${this._id}')`);
        
        const body = document.createElement('div');
        body.id = 'uif-body';
        root.appendChild(body);
        
        this.hydrateBody(body, spec.ui || spec);

        this.innerHTML = `
            <style>
                ui-factory { display: block !important; visibility: visible !important; min-height: 50px; }
                [x-cloak] { display: none !important; }
                .ui-f-root { opacity: 0; animation: ui-fade 0.4s forwards; }
                @keyframes ui-fade { to { opacity: 1; } }
            </style>
        `;
        this.appendChild(root);
        this.container = body;
        
        this._rendered = true;
        setTimeout(() => this.resolveGuards(this._state), 200);
    }

    hydrateBody(container, spec) {
        const steps = spec.steps || {};
        const parts = spec.parts || {};

        if (Object.keys(steps).length > 0) {
            Object.entries(steps).forEach(([sid, s]) => {
                const stepWrapper = document.createElement('div');
                stepWrapper.setAttribute('x-show', `currentStep === '${sid}'`);
                stepWrapper.setAttribute('x-cloak', '');
                stepWrapper.className = "p-1";
                
                if (s.title) {
                    const h3 = document.createElement('h3');
                    h3.className = "text-lg font-black mb-6 text-gray-800 tracking-tight";
                    // Interpolate title reactively - use dot notation for deep paths
                    const titleText = s.title.replace(/\${this\.(.+?)}/g, `<span x-text="values.$1"></span>`);
                    h3.innerHTML = titleText;
                    stepWrapper.appendChild(h3);
                }

                Object.entries(s.parts || {}).forEach(([pid, p]) => {
                    const partEl = this.renderPart(pid, p);
                    if (partEl) stepWrapper.appendChild(partEl);
                });

                container.appendChild(stepWrapper);
            });
            
            // Fallback banner
            const fallback = document.createElement('div');
            // Make the banner logic case-insensitive too for robustness
            fallback.setAttribute('x-show', "!currentStep || !stepKeys.some(k => k.toLowerCase() === currentStep.toLowerCase())");
            fallback.className = "p-6 bg-amber-50 rounded-3xl border border-amber-100 text-amber-900 text-sm italic";
            fallback.setAttribute('x-cloak', '');
            
            // Log for diagnostics
            fallback.setAttribute('x-effect', `if (currentStep && !stepKeys.includes(currentStep)) { 
                console.warn('UIFactory [' + instanceId + ']: Navigation Mismatch! currentStep=' + currentStep + ' is NOT in stepKeys:', stepKeys);
            }`);

            fallback.innerHTML = `State sync requested for \${currentStep}... <button @click="currentStep = initialStep" class="font-bold underline ml-1">Restart</button>`;
            container.appendChild(fallback);
        } else {
            Object.entries(parts).forEach(([pid, p]) => {
                const partEl = this.renderPart(pid, p);
                if (partEl) container.appendChild(partEl);
            });
        }
    }

    _createState(spec) {
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
        const initialStep = ui.initialStep || (Object.keys(ui.steps || {}).length > 0 ? Object.keys(ui.steps)[0] : null);

        // --- Instance Hydration ---
        let instanceData = {};
        let instanceStep = initialStep;
        let instanceHistory = [];
        let instance = null;
        this._instanceId = this._params?.instanceId;
        const instanceId = this._instanceId;

        if (instanceId) {
            console.log(`UIFactory [${this._id}]: Found instanceId ${instanceId}, attempting hydration...`);
            const registry = this._getService(DOMAIN_OBJECT_REGISTRY_SERVICE);
            instance = registry?.getInstance(instanceId);
            if (instance) {
                console.log(`UIFactory [${this._id}]: Hydration SUCCESS for ${instanceId}. Found properties:`, Object.keys(instance.properties || {}));
                instanceData = instance.properties || {};
                if (instance.currentStep) instanceStep = instance.currentStep;
                if (instance.history) instanceHistory = instance.history || [];
            } else {
                console.warn(`UIFactory [${this._id}]: Hydration FAILED for ${instanceId}. Instance not found in registry.`);
            }
        }

        const s = {
            loading: false,
            data: null,
            guards: {},
            values: { ...baseValues, ...instanceData },
            currentStep: instanceStep,
            _hydrated: !!instance,
            history: instanceHistory,
            initialStep: initialStep,
            _registryReady: false,
            stepKeys: Object.keys(ui.steps || {}),
            instanceId: instanceId,
            resolve: (path) => this.resolveValue(path, this._state),
            init() {
                // IMPORTANT: 'this' inside Alpine init() is the Proxy. 
                // We bind it back to the factory to ensure all subsequent 
                // updates (from render or runAction) are reactive.
                const factory = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`);
                if (factory) {
                    factory._state = this;
                    this._factory = factory;
                }

                console.log(`UIFactory [${this.instanceId}] connected to Alpine Data`);
                
                // Track Case Updates reactively via DOM Bridge (from OSGi)
                const caseUpdateHandler = async (e) => {
                    const updatedCaseId = e.detail?.id;
                    console.log(`UIFactory [${this.instanceId}]: Global Event [${e.type}] received for Case ${updatedCaseId}`);
                    // Scan all values to see if we are tracking this case
                    for (const key in this.values) {
                        if (this.values[key] === updatedCaseId) {
                            console.log(`UIFactory [${this.instanceId}]: Notched update for tracked Case ${updatedCaseId}. Syncing...`);
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
                    console.log(`UIFactory [${this.instanceId}]: OSGI-Context available. Starting OSGi bridge.`);
                    startCaseUpdateBridge(factory._context);
                } else {
                    console.log(`UIFactory [${this.instanceId}]: NO OSGI-Context available. Waiting for registry.`);
                }
                
                globalThis.addEventListener('do-registry-ready', () => {
                    console.log(`UIFactory [${this.instanceId}]: Registry Ready event received, triggering re-run.`);
                    this._state._registryReady = !this._state._registryReady; 
                });

                // Periodic Guard Re-evaluation disabled in favor of targeted event-based updates
                // this._guardInterval = setInterval(() => this.resolveGuards(), 2000);
                this.resolveGuards();
                
                // Initial Case Status Sync
                this.resolveCaseStatuses();

                // Sync currentStep back to Editor if it changes internally
                this.$watch('currentStep', (val) => {
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
                    console.warn(`UIFactory [${this.instanceId}]: syncCaseStatus skipped. Factory not found/disconnected (ID: ${this.uifId})`);
                    return;
                }

                console.log(`UIFactory [${this.instanceId}]: syncCaseStatus(${caseId}) started using uifId ${this.uifId}...`);
                try {
                    // Prefer the reactively tracked service if available
                    const caseSvc = factory?._caseService || factory?._getService(CASE_SERVICE);
                    if (!caseSvc) {
                        console.warn(`UIFactory [${this.instanceId}]: Case Service ${CASE_SERVICE} not found! (Context: ${!!factory?._context})`);
                        return;
                    }
                
                    const c = await caseSvc.getCase(caseId);
                    if (c) {
                        // Correctly find the property key tracking this case ID
                        let propKey = null;
                        for (const key in this.values) {
                            if (this.values[key] === caseId) {
                                propKey = key + 'Status';
                                break;
                            }
                        }
                        
                        const prevStatus = propKey ? this.values[propKey] : null;
                        const changed = prevStatus !== c.status;

                        if (changed) {
                            console.log(`UIFactory [${this.instanceId}]: Fetched Case ${caseId} status: ${c.status} (Updated from: ${prevStatus})`);
                            if (propKey) {
                                this.values[propKey] = c.status;
                                
                                // PERSIST: Manually trigger the factory's persistence engine
                                const factoryEl = document.querySelector(`ui-factory[data-uif-id="${this.uifId}"]`);
                                if (factoryEl) {
                                    factoryEl.saveInstance(this);
                                }
                            }
                        } else {
                            console.log(`UIFactory [${this.instanceId}]: Case ${caseId} status unchanged (${c.status}).`);
                        }
                    } else {
                        console.warn(`UIFactory [${this.instanceId}]: Case ${caseId} not found in service!`);
                    }
                } catch (e) {
                    console.error(`UIFactory [${this.instanceId}]: syncCaseStatus failed for ${caseId}:`, e);
                }
            },

            async resolveCaseStatuses() {
                // Use raw values to ensure reliable iteration in Alpine proxy
                const rawValues = globalThis.Alpine.raw(this.values);
                const keys = Object.keys(rawValues);
                console.log(`UIFactory [${this.instanceId}]: Manually resolving Case Statuses for keys:`, keys);
                
                for (const key of keys) {
                    const val = this.values[key];
                    console.log(`UIFactory [${this.instanceId}]: Checking key ${key}: ${val} (Type: ${typeof val})`);
                    // Generic Case ID pattern: uppercase prefix followed by hyphen and numbers (e.g., BUSI-123)
                    const isCaseId = typeof val === 'string' && /^[A-Z0-9]+-[0-9]+$/.test(val);
                    if (isCaseId) {
                        console.log(`UIFactory [${this.instanceId}]: Found case reference to sync: ${key}=${val}`);
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
                if (p.guard) s.guards[p.guard] = true;
                
                // Ensure properties mentioned in actions are initialized for reactivity & persistence
                const params = p.params || {};
                if (params.linkToProperty) {
                    if (s.values[params.linkToProperty] === undefined) s.values[params.linkToProperty] = "";
                    if (s.values[params.linkToProperty + 'Status'] === undefined) s.values[params.linkToProperty + 'Status'] = "";
                }
                if (params.statusProperty && s.values[params.statusProperty] === undefined) {
                    s.values[params.statusProperty] = "";
                }

                if ((kind === 'text-input' || kind === 'input' || kind === 'select-input') && p.id) {
                    if (s.values[p.id] === undefined) {
                        s.values[p.id] = p.value || "";
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
        console.log(`UIFactory [${this._id}]: Loaded ${Object.keys(this._guardConfig).length} guard configs:`, Object.keys(this._guardConfig));

        // --- Standard Reactive Engine (Persistence & Guards) ---
        const masterEffect = globalThis.Alpine.effect(() => {
            if (this._isDisconnected) return;
            const state = this._state;
            
            // 1. Reactive Tracking (Deep)
            const _track = JSON.stringify(state.values);
            const _trackStep = state.currentStep;
            
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
            const state = this._state.values;
            const globalHostData = globalThis.backofficeState || globalThis.businessPortalState || {};
            const hActive = globalHostData.activeLicense || null;
            const hFellows = globalHostData.fellowsData || null;
            const hCompanies = globalHostData.companies || [];
            const hPersons = globalHostData.persons || [];
            const rCurrentUser = globalHostData.currentUser || globalHostData.currentUser || this._getService(SESSION_SERVICE)?.currentUser || {};

            if (hActive && hActive.id && state.activeLicense?.id !== hActive.id) {
                console.log(`UIFactory [${this._id}]: Syncing activeLicense (New ID: ${hActive.id})`);
                state.activeLicense = hActive;
            }
            if (hActive && hActive.id && state.activeLicenseStatus !== hActive.status) {
                console.log(`UIFactory [${this._id}]: Syncing activeLicenseStatus (New Status: ${hActive.status})`);
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
            const selectedMemberId = state.selectedMemberId;
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

        const rawValues = globalThis.Alpine?.raw ? globalThis.Alpine.raw(state.values) : { ...state.values };
        const capturedValues = {};
        
        Object.keys(rawValues).forEach(key => {
            if (!BLACKLIST.includes(key)) {
                capturedValues[key] = rawValues[key];
            }
        });

        // Safety: Avoid overwriting with empty properties during initial boot
        if (Object.keys(capturedValues).length === 0 && !state.currentStep) return;

        const stratRefs = this._context.getServiceReferences("prototyper.domain.strategy") || [];
        let strategySvc = null;
        for (const ref of stratRefs) {
            const svc = this._context.getService(ref);
            if (svc?.id === strategyId) {
                strategySvc = svc;
                break;
            }
        }

        if (strategySvc?.updateInstance) {
            console.log(`UIFactory [${this._id}]: Persisting instance ${instanceId} (${Object.keys(capturedValues).length} properties)`, capturedValues);
            strategySvc.updateInstance(instanceId, (spec.id || spec.ui?.id), {
                currentStep: state.currentStep,
                properties: capturedValues,
                history: globalThis.Alpine?.raw ? globalThis.Alpine.raw(state.history || []) : [...(state.history || [])]
            });
        }
    }

    async runAction(action, scope) {
        if (!action) return;

        // Nav
        if (action.call === "NEXT_STEP" || action.type === "NEXT_STEP") {
            const idx = scope.stepKeys.indexOf(scope.currentStep);
            if (idx < scope.stepKeys.length - 1) {
                scope.history.push(scope.currentStep);
                scope.currentStep = scope.stepKeys[idx + 1];
                scope.data = null;
            }
            return;
        }

        if (action.call === "PREV_STEP" || action.type === "PREV_STEP") {
            if (scope.history.length > 0) {
                scope.currentStep = scope.history.pop();
                scope.data = null;
            }
            return;
        }

        if (!action.call) return;

        // Exec
        scope.loading = true;
        try {
            // 1. Resolve Action Handler
            let svc = null;
            let finalParams = JSON.parse(JSON.stringify(action.params || {}));

            // Check if action is defined in local SPEC first
            const localAction = this._spec.actions?.[action.call];
            if (localAction) {
                console.log(`UIFactory: Executing local action definition for ${action.call}`);
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
                    console.log(`UIFactory: Navigating to step ${target}`);
                    // Case-insensitive lookup for robustness
                    const exact = scope.stepKeys.find(k => k === target);
                    const fuzzy = scope.stepKeys.find(k => k.toLowerCase() === target.toLowerCase());
                    scope.currentStep = exact || fuzzy || target;
                }
                scope.loading = false;
                return;
            }

            if (action.call === 'default') {
                console.log(`UIFactory: Triggering default action: ${finalParams.action}`, finalParams);
                globalThis.dispatchEvent(new CustomEvent('atomic-default-action', { 
                    detail: { 
                        action: finalParams.action, 
                        params: finalParams,
                        spec: this._spec,
                        values: scope.values
                    } 
                }));
                scope.loading = false;
                return;
            }

            if (action.call === 'synthetic.client.summary-alert') {
                alert(finalParams.message || "Action Completed!");
                scope.loading = false;
                return;
            }

            if (action.call === 'synthetic.case.create') {
                const caseSvc = this._getService(CASE_SERVICE);
                if (!caseSvc) throw new Error("Case Service not available.");

                console.log(`UIFactory: Creating case of type ${finalParams.caseTypeId}`, finalParams);
                const newCase = await caseSvc.createCase(
                    finalParams.caseTypeId, 
                    {
                        companyId: finalParams.companyId,
                        targetPersonId: finalParams.targetPersonId,
                        title: finalParams.title || `Case for ${finalParams.companyId || finalParams.targetPersonId || 'Atomic Flow'}`,
                        description: finalParams.description || `Created via Atomic Flow`
                    },
                    finalParams.html
                );

                if (newCase) {
                    // LINKING: Store Case Metadata immediately for reactivity
                    if (finalParams.linkToProperty) {
                       scope.values[finalParams.linkToProperty] = newCase.id;
                       scope.values[finalParams.linkToProperty + 'Status'] = newCase.status;
                       
                       // Explicitly trigger persistence now (before potential navigation)
                       this.saveInstance(scope);
                       
                       // Refresh UI immediately (Show/Hide buttons)
                       this.resolveGuards(scope);
                    }

                    if (finalParams.onSuccess === "WAIT_FOR_CASE" || finalParams.onSuccess === "VIEW_STATUS") {
                       console.log(`UIFactory: Case created, staying on step to view status.`);
                       // No reset/redirect triggered
                    } else {
                        alert(finalParams.successMessage || `Case ${newCase.id} created successfully!`);
                        if (finalParams.onSuccess === "RESET") {
                            scope.currentStep = scope.stepKeys[0];
                            scope.history = [];
                            scope.values = { activeLicense: scope.values.activeLicense }; 
                        } else if (finalParams.onSuccess === "REDIRECT" && finalParams.redirectFlowId) {
                            console.log(`UIFactory: Redirecting to flow ${finalParams.redirectFlowId} with params:`, finalParams.redirectParams);
                            
                            const isPortal = !!globalThis.businessPortalState;
                            const isSubflow = !!document.getElementById('business-subflow-container');
                            const eventName = isPortal ? 'business-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow');
                            
                            console.log(`UIFactory: Dispatching redirect event: ${eventName}`);
                            globalThis.dispatchEvent(new CustomEvent(eventName, { 
                                detail: { 
                                    id: finalParams.redirectFlowId, 
                                    params: finalParams.redirectParams 
                                } 
                            }));
                        }
                    }
                }
                scope.loading = false;
                return;
            }

            // 2. Lookup Service
            if (this._context) {
                const refs = this._context.getServiceReferences("prototyper.action.service", `(action.id=${action.call})`);
                if (refs?.[0]) {
                    svc = this._context.getService(refs[0]);
                    if (svc.execute) svc = svc.execute.bind(svc);
                }
            }
            if (!svc && globalThis.Services?.[action.call]) svc = globalThis.Services[action.call];
            
            if (!svc) throw new Error(`Action ${action.call} not found`);

            const res = await (typeof svc === "function" ? svc(finalParams) : svc.execute(finalParams));
            scope.data = res;
        } catch (e) {
            console.error(e);
            scope.data = { error: e.message };
        } finally {
            scope.loading = false;
        }
    }

    interpolate(str, scope, extra = {}) {
        if (!str) return "";
        return str.replace(/(?:\${(this\.)?(.+?)}|\{\{\s*(this\.)?(.+?)\s*\}\})/g, (_, _p1, k1, _p2, k2) => {
            const key = k1 || k2;
            const val = extra[key] ?? scope.values[key] ?? scope[key] ?? null;
            if (val !== null && val !== undefined) return val;
            
            // Try deep resolution if key contains dots
            if (key.includes('.')) {
                const parts = key.split('.');
                const deep = parts.reduce((acc, part) => acc && acc[part], scope.values) ?? 
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
            if (p.startsWith('values.')) p = p.substring(7);
            return p.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, obj);
        };

        // 3. Try to find the value in values or root scope
        const result = resolvePath(scope.values, path) ?? resolvePath(scope, path);
        if (result !== undefined) return result;

        // 4. If it was a literal path that failed, fallback to interpolation
        return match ? undefined : this.interpolate(expr, scope);
    }

    renderPart(_id, p) {
        const kind = p.kind || p.type;
        const tagName = this._componentRegistry ? this._componentRegistry.get(kind) : null;
        if (tagName) {
            const el = document.createElement(tagName);
            if (el.hydrate) {
                el.hydrate(
                    { ...p, id: _id }, 
                    this._context, 
                    (s) => this.interpolate(s, this._state),
                    (path) => this.resolveValue(path, this._state)
                );
            }
            if (p.guard) {
                const wrapper = document.createElement('div');
                wrapper.setAttribute('x-show', `guards['${p.guard}'] === true`);
                wrapper.setAttribute('x-cloak', '');
                wrapper.appendChild(el);
                return wrapper;
            }
            return el;
        }

        // Logic for specialized structural elements
        const container = document.createElement('div');
        container.className = "mb-4";

        if (p.type === 'row') {
            container.className += " flex space-x-3";
        } else if (p.type === 'card') {
            const variant = p.variant || 'plain';
            const styles = {
                plain: "bg-white border-gray-200 shadow-sm",
                info: "bg-blue-50 border-blue-200 text-blue-800 shadow-blue-100",
                error: "bg-red-50 border-red-200 text-red-800 shadow-red-100",
                warning: "bg-amber-50 border-amber-200 text-amber-800 shadow-amber-100"
            };
            container.className = `p-6 rounded-3xl border-2 border-solid mb-6 block transition-all ${styles[variant] || styles.plain}`;
            
            if (p.label) {
                const h4 = document.createElement('h4');
                h4.className = "text-xs uppercase font-black tracking-widest mb-4 opacity-50";
                h4.innerText = this.interpolate(p.label, this._state);
                container.appendChild(h4);
            }
        } else if (p.type === 'result') {
            container.setAttribute('x-show', 'data');
            container.setAttribute('x-transition', '');
            container.className = "mb-4 p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-auto max-h-80";
            container.innerHTML = `<pre x-text="JSON.stringify(data, null, 2)" class="text-[10px] text-gray-400 font-mono leading-relaxed"></pre>`;
            return container; 
        }

        // Render children if they exist
        if (p.parts) {
            Object.entries(p.parts).forEach(([sid, sp]) => {
                const child = this.renderPart(sid, sp);
                if (child) container.appendChild(child);
            });
        } else if (p.type === 'text' || typeof p.value === 'string') {
            // Render text as a leaf node
            const inner = document.createElement('div');
            inner.className = "text-gray-500 leading-relaxed font-semibold prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 prose-strong:text-gray-700";
            let html = "";
            try {
                html = marked.parse(p.value || "");
            } catch (_e) {
                html = p.value || "";
            }
            inner.innerHTML = html.replace(/(?:\${(this\.)?(.+?)}|\{\{\s*(this\.)?(.+?)\s*\}\})/g, (_, _p1, k1, _p2, k2) => {
                const path = k1 || k2;
                return `<span x-text="((v) => (typeof v === 'object' && v !== null) ? JSON.stringify(v, null, 2) : (v ?? ''))(resolve('${path}'))" class="text-blue-600 font-bold whitespace-pre-wrap font-mono"></span>`;
            });
            container.appendChild(inner);
        }

        if (p.guard) {
            const guardWrap = document.createElement('div');
            // Use both x-show and direct style binding for maximum robustness against CSS overrides
            guardWrap.setAttribute('x-show', `guards['${p.guard}'] === true`);
            guardWrap.setAttribute(':style', `{ display: guards['${p.guard}'] ? '' : 'none !important' }`);
            guardWrap.setAttribute('x-cloak', '');
            guardWrap.setAttribute('x-init', `console.log('UIFactory [${this._id}]: Guard ${p.guard} attached to DOM', $el)`);
            guardWrap.appendChild(container);
            return guardWrap;
        }
        return container;
    }

    async resolveGuards(scope) {
        if (!scope || !scope.guards) return;
        
        // Batch evaluations to a microtask if already pending, otherwise run
        if (this._pendingGuardEval) return;
        this._pendingGuardEval = true;

        try {
            const lime = this._getService(LIMES_SERVICE);
            const bp = globalThis.businessPortalState || {};
            const bo = globalThis.backofficeState || {};
            const user = bp.currentUser || bo.currentUser || this._getService(SESSION_SERVICE)?.currentUser;
            const vals = globalThis.Alpine.raw(scope.values);

            for (const guardKey in scope.guards) {
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
                if (scope.guards[guardKey] !== allPass) {
                    console.log(`UIFactory [${this._id}]: Guard flipping [${guardKey}] -> ${allPass}`);
                    scope.guards[guardKey] = allPass;
                    // Trigger object-level reactivity for Alpine
                    scope.guards = { ...scope.guards };
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
