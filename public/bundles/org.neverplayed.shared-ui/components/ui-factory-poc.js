
import { 
    LOG_SERVICE as _LOG_SERVICE,
    DOMAIN_OBJECT_INSTANCE_SERVICE,
    ATOMIC_COMPONENT_REGISTRY_SERVICE as _ATOMIC_COMPONENT_REGISTRY_SERVICE
} from "core-types";

class UIFactoryPOC extends HTMLElement {
    constructor() {
        super();
        this._id = "uif-poc-" + Math.random().toString(36).substring(7);
        this._state = null;
        this._context = null;
        this._spec = null;
        this._instanceId = null;
        this._tracker = null;
        console.log(`UIFactoryPOC [${this._id}]: Created`);
    }

    setBundleContext(ctx) {
        this._context = ctx;
        console.log(`UIFactoryPOC [${this._id}]: Context set`);
        this._setupTracker();
    }

    setParams(params) {
        this._instanceId = params?.instanceId;
        console.log(`UIFactoryPOC [${this._id}]: Params set (instanceId: ${this._instanceId})`);
        this._checkHydration();
    }

    setSpec(spec) {
        this._spec = spec;
        console.log(`UIFactoryPOC [${this._id}]: Spec set`);
        this.render();
    }

    connectedCallback() {
        console.log(`UIFactoryPOC [${this._id}]: Connected`);
        this.render();
    }

    _setupTracker() {
        if (!this._context || this._tracker) return;
        
        this._tracker = this._context.trackService(`(objectClass=${DOMAIN_OBJECT_INSTANCE_SERVICE})`, {
            addingService: (ref) => {
                const id = ref.getProperty("instance.id");
                console.log(`UIFactoryPOC [${this._id}]: Service added: ${id}`);
                if (id === this._instanceId) {
                    this._hydrate(this._context.getService(ref));
                }
            },
            modifiedService: (ref) => {
                const id = ref.getProperty("instance.id");
                if (id === this._instanceId) {
                    this._hydrate(this._context.getService(ref));
                }
            }
        });
        this._tracker.open();
    }

    _checkHydration() {
        if (!this._context || !this._instanceId) return;
        const refs = this._context.getServiceReferences(DOMAIN_OBJECT_INSTANCE_SERVICE, `(instance.id=${this._instanceId})`);
        if (refs && refs.length > 0) {
            console.log(`UIFactoryPOC [${this._id}]: Found existing service for ${this._instanceId}`);
            this._hydrate(this._context.getService(refs[0]));
        }
    }

    _hydrate(instance) {
        if (!instance || !this._state) return;
        console.log(`UIFactoryPOC [${this._id}]: Hydrating with properties:`, instance.properties);
        Object.entries(instance.properties || {}).forEach(([k, v]) => {
            this._state.uifValues[k] = v;
        });
        if (instance.currentStep) this._state.uifStep = instance.currentStep;
    }

    render() {
        if (!this._spec || !this.isConnected) return;
        
        if (!this._state) {
            console.log(`UIFactoryPOC [${this._id}]: Initializing state`);
            const ui = this._spec.ui || this._spec;
            const stepKeys = Object.keys(ui.steps || {});
            const initialStep = ui.initialStep || stepKeys[0];
            
            this._state = globalThis.Alpine.reactive({
                uifValues: {},
                uifStep: initialStep,
                uifId: this._id,
                performAction: (action) => {
                    console.log("POC Action Execution:", action);
                    if (action.call === "synthetic.client.summary-alert") {
                        alert(action.params?.message || "Hello from POC!");
                    } else {
                        // Fallback to Shell global action handler if available
                        globalThis.dispatchEvent(new CustomEvent('atomic-action', { 
                            detail: { action, uifId: this._id },
                            bubbles: true,
                            composed: true
                        }));
                    }
                }
            });
            
            globalThis.__UI_POC_REGISTRY = globalThis.__UI_POC_REGISTRY || new Map();
            globalThis.__UI_POC_REGISTRY.set(this._id, this._state);
            
            // Note: We no longer set x-data on 'this' (the Custom Element)
            // Instead, we put it on the root wrapper in the HTML below.
            this._checkHydration();
        }

        if (this._rendered) {
            console.log(`UIFactoryPOC [${this._id}]: Already rendered, update skipped (Alpine handles reactivity)`);
            return;
        }

        const ui = this._spec.ui || this._spec;
        const steps = ui.steps || {};
        
        // 💎 The "GEM" Wrapper Pattern: Move x-data inside the inner root.
        let html = `<div x-data="globalThis.__UI_POC_REGISTRY.get('${this._id}')" class="p-4 bg-white rounded-xl shadow-lg border border-gray-100 uif-poc-root">`;
        html += `<h2 class="text-xl font-bold mb-4 text-indigo-900">${ui.label || 'POC Factory'}</h2>`;
        
        Object.entries(steps).forEach(([sid, step]) => {
            const sidLower = sid.toLowerCase();
            html += `<div x-show="uifStep && uifStep.toLowerCase() === '${sidLower}'" class="step-content">`;
            html += `<h3 class="text-lg font-semibold mb-2 text-gray-700">${step.title || sid}</h3>`;
            
            if (step.parts) {
                Object.entries(step.parts).forEach(([_pid, part]) => {
                    if (part.type === 'text' || part.kind === 'text') {
                        // Handle multiline text and simple interpolation
                        const val = (part.value || '').replace(/\n/g, '<br>');
                        html += `<div class="mb-4 text-gray-600 leading-relaxed">${val}</div>`;
                    } else if (part.kind === 'command-button') {
                        const actionStr = JSON.stringify(part.action).replace(/"/g, '&quot;');
                        html += `<button @click="performAction(${actionStr})" class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-2">
                            ${part.icon ? `<i class="${part.icon}"></i>` : ''} 
                            <span>${part.label}</span>
                        </button>`;
                    }
                });
            }
            html += `</div>`;
        });
        
        html += `</div>`;
        this.innerHTML = html;
        this._rendered = true;
        
        console.log(`UIFactoryPOC [${this._id}]: Render complete. Waiting for Alpine auto-discovery...`);
    }
}

if (!customElements.get("ui-factory-poc")) {
    customElements.define("ui-factory-poc", UIFactoryPOC);
}
