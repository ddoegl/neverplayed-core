/**
 * Component to render UI from YAML spec
 * 
 * VERSION: 1.5.0 (Forensic & Fallback Edition)
 */

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
            this._yamlService = ctx.getService("prototyper.yaml.service") || globalThis.Services?.["prototyper.yaml.service"];
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
        // If we already have a spec, render now
        if (this._spec) this.render();
        else setTimeout(() => this.render(), 200);
    }

    render() {
        // Find spec
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

        // Avoid re-rendering if spec is same and already rendered
        if (this._rendered && this._spec === spec && this.querySelector('.ui-f-root')) return;

        this._spec = spec;

        // Ensure persistent state
        if (!this._state) {
            this._state = this._createState(spec);
            globalThis.__UI_FACTORY_REGISTRY.set(this._id, this._state);
        }

        this.setAttribute('data-uif-id', this._id);
        console.log(`UIFactory [${this._id}]: Structural Render`);

        const html = this.generateHTML(spec);
        this.innerHTML = `
            <style>
                ui-factory { display: block !important; visibility: visible !important; min-height: 50px; }
                [x-cloak] { display: none !important; }
                .ui-f-root { opacity: 0; animation: ui-fade 0.4s forwards; }
                @keyframes ui-fade { to { opacity: 1; } }
            </style>
            <div class="ui-f-root" x-data="globalThis.__UI_FACTORY_REGISTRY.get('${this._id}')">
                ${html}
            </div>
        `;
        
        this._rendered = true;
        setTimeout(() => this.resolveGuards(this._state), 200);
    }

    _createState(spec) {
        const steps = spec.steps || {};
        const initialStep = spec.initialStep || (Object.keys(steps).length > 0 ? Object.keys(steps)[0] : null);

        const s = {
            loading: false,
            data: null,
            guards: {},
            values: {},
            currentStep: initialStep,
            history: [],
            initialStep: initialStep,
            stepKeys: Object.keys(steps),
            
            init() {
                console.log(`UIFactory connected to Alpine Data`);
            },

            async performAction(action) {
                // Bridge to the host element
                const host = document.querySelector(`[data-uif-id="${this.instanceId}"]`) || 
                             this.$el?.closest('ui-factory');
                if (host && host.runAction) {
                    await host.runAction(action, this);
                }
            }
        };
        s.instanceId = this._id;

        // Initialize defaults
        const collect = (parts) => {
            Object.values(parts).forEach(p => {
                if (p.guard) s.guards[p.guard] = true;
                if (p.type === 'input' && p.id) s.values[p.id] = p.value || "";
                if (p.parts) collect(p.parts);
            });
        };
        collect(spec.parts || {});
        Object.values(steps).forEach(step => collect(step.parts || {}));

        return s;
    }

    generateHTML(spec) {
        const steps = spec.steps || {};
        const parts = spec.parts || {};
        let body = "";

        if (Object.keys(steps).length > 0) {
            Object.entries(steps).forEach(([sid, s]) => {
                const phtml = Object.entries(s.parts || {}).map(([pid, p]) => this.renderPart(pid, p)).join("");
                body += `
                    <template x-if="currentStep === '${sid}'">
                        <div x-cloak class="p-1">
                            ${s.title ? `<h3 class="text-lg font-black mb-6 text-gray-800 tracking-tight">${s.title}</h3>` : ""}
                            ${phtml}
                        </div>
                    </template>
                `;
            });
            body += `
                <div x-show="!currentStep || !stepKeys.includes(currentStep)" class="p-6 bg-amber-50 rounded-3xl border border-amber-100 text-amber-900 text-sm italic" x-cloak>
                    State sync requested... <button @click="currentStep = initialStep" class="font-bold underline ml-1">Restart</button>
                </div>
            `;
        } else {
            body = Object.entries(parts).map(([pid, p]) => this.renderPart(pid, p)).join("");
        }

        return body;
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
            const params = JSON.parse(JSON.stringify(action.params || {}));
            const interp = (o) => {
                for (const k in o) {
                    if (typeof o[k] === "string") {
                        o[k] = o[k].replace(/\${this\.(.+?)}/g, (_, m) => scope.values[m] ?? scope[m] ?? "");
                    } else if (typeof o[k] === "object" && o[k] !== null) interp(o[k]);
                }
            };
            interp(params);

            let svc = null;
            if (this._context) {
                const refs = this._context.getServiceReferences("prototyper.action.service", `(action.id=${action.call})`);
                if (refs?.[0]) {
                    svc = this._context.getService(refs[0]);
                    if (svc.execute) svc = svc.execute.bind(svc);
                }
            }
            if (!svc && globalThis.Services?.[action.call]) svc = globalThis.Services[action.call];
            if (!svc) throw new Error(`Action ${action.call} not found`);

            const res = await (typeof svc === "function" ? svc(params) : svc.execute(params));
            scope.data = res;
        } catch (e) {
            console.error(e);
            scope.data = { error: e.message };
        } finally {
            scope.loading = false;
        }
    }

    renderPart(_id, p) {
        let h = "";
        const act = p.onAction || (p.call ? p : null);
        
        if (act) {
            const json = JSON.stringify(act).replace(/'/g, "&#39;");
            h = `
                <button class="${p.class || 'w-full mb-4 px-6 py-4 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all'}" 
                        @click.stop.prevent='performAction(${json})' :disabled="loading">
                    <span x-text="loading ? 'Processing...' : '${p.label || 'Continue'}'"></span>
                </button>
            `;
        } else if (p.parts) {
            const inner = Object.entries(p.parts).map(([id, sub]) => this.renderPart(id, sub)).join("");
            h = `<div class="${p.type === 'row' ? 'flex space-x-3' : ''} mb-4">${inner}</div>`;
        } else if (p.type === 'input') {
            const id = p.id || _id;
            h = `
                <div class="mb-5">
                    ${p.label ? `<label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">${p.label}</label>` : ""}
                    <input type="${p.inputType || 'text'}" x-model="values['${id}']" @input="data = null"
                           placeholder="${p.placeholder || ''}"
                           class="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-semibold text-gray-700">
                </div>
            `;
        } else if (p.type === 'text' || typeof p.value === 'string') {
            const text = (p.value || "").replace(/\${this\.(.+?)}/g, '<span x-text="values[\'$1\'] || $1" class="text-blue-600 font-bold"></span>');
            h = `<div class="mb-5 text-gray-500 leading-relaxed font-semibold">${text}</div>`;
        } else if (p.type === 'result') {
            h = `
                <div x-show="data" class="mb-4 p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-auto max-h-80" x-transition>
                    <pre x-text="JSON.stringify(data, null, 2)" class="text-[10px] text-gray-400 font-mono leading-relaxed"></pre>
                </div>
            `;
        }

        return p.guard ? `<div x-show="guards['${p.guard}']" x-cloak>${h}</div>` : h;
    }

    async resolveGuards(scope) {
        if (!this._context) return;
        const lime = this._context.getService("prototyper.limes.service") || globalThis.Services?.["prototyper.limes.service"];
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
