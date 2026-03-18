/**
 * Component to render UI from YAML spec
 * 
 * VERSION: 1.6.0 (Robust Registry Edition)
 */
import { marked } from "https://esm.sh/marked@12.0.1";

if (!globalThis.__UI_FACTORY_REGISTRY) {
    globalThis.__UI_FACTORY_REGISTRY = new Map();
}

class UIFactory extends HTMLElement {
    constructor() {
        super();
        this._spec = null;
        this._context = null;
        this._yamlService = null;
        this._rendered = false;
        this._state = null;
        this._id = "uif-" + Math.random().toString(36).substring(7);
    }

    set context(ctx) { this.setBundleContext(ctx); }
    setBundleContext(ctx) {
        this._context = ctx;
        if (ctx) {
            this._yamlService = this._getService("prototyper.yaml.service");
        }
    }

    _getService(id) {
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

    connectedCallback() {
        console.log(`UIFactory [${this._id}]: connected to DOM`);
        
        // Listen for standard Atomic Component events
        this.addEventListener('atomic-action', (e) => {
            console.log(`UIFactory [${this._id}]: atomic-action received`, e.detail.action);
            this.runAction(e.detail.action, this._state);
        });

        this.addEventListener('atomic-change', (e) => {
            const { id, value } = e.detail;
            console.log(`UIFactory [${this._id}]: atomic-change received`, id, value);
            this._state.values[id] = value;
            this._state.data = null; // Clear results on input change
        });

        // If we already have a spec, render now
        if (this._spec) this.render();
        else setTimeout(() => this.render(), 200);
    }

    render() {
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

        if (this._rendered && this._spec === spec && this.querySelector('.ui-f-root')) return;

        this._spec = spec;
        if (!this._state) {
            this._state = this._createState(spec);
            globalThis.__UI_FACTORY_REGISTRY.set(this._id, this._state);
        }

        this.setAttribute('data-uif-id', this._id);
        
        // --- HYDRATION ENGINE START ---
        // Build the root element first
        const root = document.createElement('div');
        root.className = 'ui-f-root';
        root.setAttribute('x-data', `globalThis.__UI_FACTORY_REGISTRY.get('${this._id}')`);
        
        const body = document.createElement('div');
        body.id = 'uif-body';
        root.appendChild(body);
        
        // Hydrate body BEFORE appending to DOM to ensure Alpine sees all children
        this.hydrateBody(body, spec);

        this.innerHTML = `
            <style>
                ui-factory { display: block !important; visibility: visible !important; min-height: 50px; }
                [x-cloak] { display: none !important; }
                .ui-f-root { opacity: 0; animation: ui-fade 0.4s forwards; }
                @keyframes ui-fade { to { opacity: 1; } }
            </style>
        `;
        this.appendChild(root);
        
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
            fallback.setAttribute('x-show', "!currentStep || !stepKeys.includes(currentStep)");
            fallback.className = "p-6 bg-amber-50 rounded-3xl border border-amber-100 text-amber-900 text-sm italic";
            fallback.setAttribute('x-cloak', '');
            fallback.innerHTML = `State sync requested... <button @click="currentStep = initialStep" class="font-bold underline ml-1">Restart</button>`;
            container.appendChild(fallback);
        } else {
            Object.entries(parts).forEach(([pid, p]) => {
                const partEl = this.renderPart(pid, p);
                if (partEl) container.appendChild(partEl);
            });
        }
    }

    _createState(spec) {
        // Bridge existing host data if available
        const host = globalThis.backofficeState || globalThis.businessPortalState || {};
        const baseValues = {
            activeLicense: host.activeLicense || {},
            companies: host.companies || [],
            persons: host.persons || [],
            currentUser: host.currentUser || this._getService("prototyper.session.service")?.currentUser || {},
            fellowsData: host.fellowsData || { FELLOWS: [] },
            parsedLicenses: host.parsedLicenses || { LICENSES: [] },
            ...host.currentApplication
        };

        const initialStep = spec.initialStep || (Object.keys(spec.steps || {}).length > 0 ? Object.keys(spec.steps)[0] : null);

        const s = {
            loading: false,
            data: null,
            guards: {},
            values: baseValues,
            currentStep: initialStep,
            history: [],
            initialStep: initialStep,
            stepKeys: Object.keys(spec.steps || {}),
            
            init() {
                console.log(`UIFactory connected to Alpine Data`);
            },

            async performAction(action) {
                const host = document.querySelector(`[data-uif-id="${this.instanceId}"]`) || 
                             this.$el?.closest('ui-factory');
                if (host && host.runAction) {
                    await host.runAction(action, this);
                }
            }
        };
        s.instanceId = this._id;

        const collect = (parts) => {
            Object.values(parts).forEach(p => {
                if (p.guard) s.guards[p.guard] = true;
                if ((p.kind === 'text-input' || p.type === 'input') && p.id) s.values[p.id] = p.value || "";
                if (p.parts) collect(p.parts);
            });
        };
        Object.values(spec.steps || {}).forEach(step => collect(step.parts || {}));

        this._state = globalThis.Alpine.reactive(s);

        // Add dynamic filtering logic and reactive host bridge
        globalThis.Alpine.effect(() => {
            const state = this._state.values;
            const bo = globalThis.backofficeState || {};
            const bp = globalThis.businessPortalState || {};
            
            // --- Live Portals Sync (Dual-Portal Aware) ---
            const hActive = bp.activeLicense || bo.activeLicense || null;
            const hFellows = bp.fellowsData || bo.fellowsData || null;
            const hCompanies = bp.companies || bo.companies || [];
            const hPersons = bp.persons || bo.persons || [];
            const rCurrentUser = bp.currentUser || bo.currentUser || this._getService("prototyper.session.service")?.currentUser || {};

            if (hActive && hActive.id) {
                console.log(`UIFactory [${this._id}]: Received Active License -> ${hActive.id}`);
                state.activeLicense = hActive;
            }
            if (hFellows) state.fellowsData = hFellows;
            if (hCompanies.length) state.companies = hCompanies;
            if (hPersons.length) state.persons = hPersons;
            if (rCurrentUser) state.currentUser = rCurrentUser;

            // 1. Derive Members from current License Customers (Reactive)
            const customers = (state.activeLicense?.customers || []);
            state.currentMembers = customers.map(id => {
                const entity = (state.companies || []).find(c => String(c.id) === String(id)) || 
                               (state.persons || []).find(p => String(p.id) === String(id));
                return {
                    id: String(id),
                    displayName: entity ? (entity.name || `${entity.firstname || ''} ${entity.lastname || ''}`.trim()) : id
                };
            });

            // 2. Derive Fellows from selected Member (Reactive)
            const selectedMemberId = state.selectedMemberId;
            if (selectedMemberId) {
                const allFellows = state.fellowsData?.FELLOWS || [];
                const filteredFellows = allFellows.filter(f => String(f.fellowOf) === String(selectedMemberId));
                
                // Resolve Fellow names from persons
                state.currentFellows = filteredFellows.map(f => {
                    const person = (state.persons || []).find(p => String(p.id) === String(f.personId));
                    return {
                        id: f.personId,
                        displayName: person ? `${person.firstname || ''} ${person.lastname || ''}`.trim() : f.personId
                    };
                });
            } else {
                state.currentFellows = [];
            }
        });

        return this._state;
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
            if (action.call === 'synthetic.client.summary-alert') {
                alert(finalParams.message || "Action Completed!");
                scope.loading = false;
                return;
            }

            if (action.call === 'synthetic.case.create') {
                const caseSvc = this._getService("backoffice.cases.data");
                if (!caseSvc) throw new Error("Case Service not available.");

                console.log(`UIFactory: Creating case of type ${finalParams.caseTypeId}`, finalParams);
                const newCase = await caseSvc.createCase(
                    finalParams.caseTypeId, 
                    {
                        companyId: finalParams.companyId,
                        targetPersonId: finalParams.targetPersonId,
                        title: finalParams.title || `Order for ${finalParams.companyId}`,
                        description: finalParams.description || `Business Account Order via Atomic Flow`
                    },
                    finalParams.html
                );

                if (newCase) {
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
        const match = expr.match(/^(?:\${(this\.)?(.+?)}$|\{\{\s*(this\.)?(.+?)\s*\}\})$/);
        if (match) {
            const path = match[2] || match[4];
            const resolvePath = (obj, p) => p.split('.').reduce((acc, part) => acc && acc[part], obj);
            const result = resolvePath(scope.values, path) ?? resolvePath(scope, path);
            
            if (path.includes('activeLicense')) {
                console.log(`UIFactory Resolve Debug: ${path} ->`, result);
            }
            return result;
        }
        return this.interpolate(expr, scope);
    }

    renderPart(_id, p) {
        const kind = p.kind || p.type;
        const registry = {
            'command-button': 'atomic-button',
            'action': 'atomic-button',
            'text-input': 'atomic-input',
            'input': 'atomic-input',
            'select-input': 'atomic-select'
        };

        const tagName = registry[kind];
        if (tagName) {
            const el = document.createElement(tagName);
            if (el.hydrate) {
                el.hydrate(
                    p, 
                    this._context, 
                    (s) => this.interpolate(s, this._state),
                    (path) => this.resolveValue(path, this._state)
                );
            }
            if (p.guard) {
                const wrapper = document.createElement('div');
                wrapper.setAttribute('x-show', `guards['${p.guard}']`);
                wrapper.setAttribute('x-cloak', '');
                wrapper.appendChild(el);
                return wrapper;
            }
            return el;
        }

        // Logic for legacy types or structural elements
        const container = document.createElement('div');
        container.className = "mb-4";

        if (p.parts) {
            if (p.type === 'row') container.className += " flex space-x-3";
            Object.entries(p.parts).forEach(([sid, sp]) => {
                const child = this.renderPart(sid, sp);
                if (child) container.appendChild(child);
            });
        } else if (p.type === 'text' || typeof p.value === 'string') {
            container.className = "mb-5 text-gray-500 leading-relaxed font-semibold prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 prose-strong:text-gray-700";
            let html = "";
            try {
                html = marked.parse(p.value || "");
            } catch (_e) {
                html = p.value || "";
            }
            // Support deep paths reactively - IMPORTANT: use values.path
            container.innerHTML = html.replace(/(?:\${this\.(.+?)}|\{\{\s*(?:this\.)?(.+?)\s*\}\})/g, (_, k1, k2) => {
                const key = k1 || k2;
                return `<span x-text="typeof values.${key} === 'object' ? JSON.stringify(values.${key}, null, 2) : (values.${key} || '')" class="text-blue-600 font-bold whitespace-pre-wrap font-mono"></span>`;
            });
        } else if (p.type === 'result') {
            container.setAttribute('x-show', 'data');
            container.setAttribute('x-transition', '');
            container.className = "mb-4 p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-auto max-h-80";
            container.innerHTML = `<pre x-text="JSON.stringify(data, null, 2)" class="text-[10px] text-gray-400 font-mono leading-relaxed"></pre>`;
        } else {
            return null;
        }

        if (p.guard) {
            const guardWrap = document.createElement('div');
            guardWrap.setAttribute('x-show', `guards['${p.guard}']`);
            guardWrap.setAttribute('x-cloak', '');
            guardWrap.appendChild(container);
            return guardWrap;
        }
        return container;
    }

    async resolveGuards(scope) {
        if (!this._context) return;
        const lime = this._getService("prototyper.limes.service");
        if (!lime) return;
        for (const g of Object.keys(scope.guards)) {
            try {
                const ok = typeof lime === "function" ? await lime(g) : await lime.check(g);
                scope.guards[g] = !!ok;
            } catch (_e) { scope.guards[g] = false; }
        }
    }
}

if (!customElements.get("ui-factory")) {
    customElements.define("ui-factory", UIFactory);
}

export default UIFactory;
