import { YAML_SERVICE, LIMES_SERVICE, SESSION_SERVICE } from "../../../../shared-types.js";

class UIFactory extends HTMLElement {
    constructor() {
        super();
        this._context = null;
        this._yamlService = null;
        this._limesService = null;
        this._sessionService = null;
        this._spec = null;
    }

    setSpec(spec) {
        this._spec = spec;
        this.render();
    }

    setBundleContext(context) {
        this._context = context;
        const yamlRef = context.getServiceReference(YAML_SERVICE);
        if (yamlRef) this._yamlService = context.getService(yamlRef);

        const limesRef = context.getServiceReference(LIMES_SERVICE);
        if (limesRef) this._limesService = context.getService(limesRef);

        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        if (sessionRef) this._sessionService = context.getService(sessionRef);
    }

    connectedCallback() {
        // Wait for Alpine and potential context injection
        setTimeout(() => this.render(), 100);
    }

    render() {
        let spec = this._spec;
        const script = this.querySelector('script[type="text/yaml"]');
        
        if (!spec && script) {
            const raw = script.textContent.trim();
            if (this._yamlService) {
                spec = this._yamlService.load(raw);
            } else if (globalThis.YAML) {
                spec = globalThis.YAML.parse(raw);
            }
        }

        if (!spec) return;

        // Base layout generation
        const html = this.generateHTML(spec);
        this.innerHTML = html;

        if (globalThis.Alpine) {
            globalThis.Alpine.initTree(this);
        }
    }

    checkGuard(strategyId) {
        if (!strategyId) return true;
        
        // 1. Get Limes Service
        let limes = this._limesService;
        if (!limes && globalThis.Services) limes = globalThis.Services.limes;
        if (!limes) return true; // Fail open if Limes is missing? Or closed? Let's stay visible for now to avoid frustration if system is half-ready

        // 2. Get Current User
        let userId = "bactor"; // Default PoC user
        let session = this._sessionService;
        if (!session && globalThis.Services) session = globalThis.Services.session;
        if (session) {
            const user = session.currentUser;
            if (user) userId = user.id || user.username || userId;
        } else if (globalThis.backofficeState?.currentUser) {
            userId = globalThis.backofficeState.currentUser;
        }

        return limes.isAllowed(userId, strategyId);
    }

    /**
     * Resolves all guards for the current spec and updates the state.
     */
    async resolveGuards(scope) {
        if (!scope || !scope.guards) return;
        
        const results = await Promise.all(
            Object.keys(scope.guards).map(async g => {
                const allowed = await this.checkGuard(g);
                return [g, allowed];
            })
        );
        
        results.forEach(([g, allowed]) => {
            scope.guards[g] = allowed;
        });
    }

    generateHTML(spec) {
        const parts = spec.parts || {};
        let partsHtml = "";

        Object.entries(parts).forEach(([_id, part]) => {
            partsHtml += this.renderPart(_id, part);
        });

        // Initialize guards state structure
        const guardMap = {};
        Object.values(parts).forEach(p => {
            if (p.guard) guardMap[p.guard] = true;
        });

        const guardsJson = JSON.stringify(guardMap).replace(/'/g, "&#39;");

        return `
            <div class="ui-factory-root" 
                 x-data='{ 
                    loading: false,
                    data: null,
                    guards: ${guardsJson},
                    init() {
                        const host = $el.closest("ui-factory");
                        if (host) {
                            setTimeout(() => host.resolveGuards(this), 0);
                        }
                    }
                 }'>
                ${partsHtml}
            </div>
        `;
    }

    async runAction(action, scope) {
        if (!action || !action.call) return;
        
        scope.loading = true;
        try {
            console.log("UIFactory: Running action", action);
            
            // 1. Resolve Action Service
            let apiService = null;
            if (this._context) {
                const refs = this._context.getServiceReferences("prototyper.action.service", `(action.id=${action.call})`);
                if (refs && refs.length > 0) {
                    const svc = this._context.getService(refs[0]);
                    apiService = svc.execute || svc; // Handle both wrapper objects and direct functions
                }
            }
            
            if (!apiService && globalThis.Services?.[action.call]) {
                apiService = globalThis.Services[action.call];
            }

            if (!apiService) {
                throw new Error(`Action service not found: ${action.call}`);
            }

            // 2. Execute
            const result = typeof apiService === "function" ? await apiService(action.params || {}) : await apiService.execute?.(action.params || {});
            scope.data = result;
            console.log("UIFactory: Action completed", result);
        } catch (error) {
            console.error("UIFactory: Action failed", error);
            // Optionally set error state in scope
        } finally {
            scope.loading = false;
        }
    }

    renderPart(_id, part) {
        let content = "";
        if (part.type === 'action' || part.onAction) {
            const label = part.label || "Execute";
            const action = part.onAction || part;
            // Escape single quotes for the Alpine @click attribute
            const actionJson = JSON.stringify(action).replace(/'/g, "&#39;");
            content = `
                <button class="btn btn-primary w-full mb-4" 
                        @click='const host = $el.closest("ui-factory"); if (host) host.runAction(${actionJson}, $data)' 
                        :disabled="loading">
                    <span x-text="loading ? 'Processing...' : '${label}'"></span>
                </button>
            `;
        } else if (part.type === 'text' || typeof part.value === 'string') {
            const value = part.value || "";
            // Handle simple interpolation ${this.foo}
            const interpolator = value.replace(/\${this\.(.+?)}/g, '<span x-text="$1"></span>');
            content = `<div class="mb-4 text-gray-700">${interpolator}</div>`;
        }

        if (part.guard) {
            // Using x-show for guards
            return `<div x-show="guards['${part.guard}']" x-cloak>${content}</div>`;
        }

        return content;
    }
}

if (!customElements.get("ui-factory")) {
    customElements.define("ui-factory", UIFactory);
}

export default UIFactory;
