/**
 * Base class for all Atomic UI Components.
 * Aligns with W3C uiSpec and OpenUI principles.
 */
export class AtomicComponentBase extends HTMLElement {
    constructor() {
        super();
        this._spec = null;
        this._context = null;
        this._interpolator = (s) => s; // Default no-op
    }

    /**
     * Standardized Hydration Lifecycle.
     */
    hydrate(spec, context, interpolator, resolver) {
        this._spec = spec;
        this._context = context;
        this._interpolator = interpolator || ((s) => s);
        this._resolver = resolver || ((s) => s);

        // Auto-render when state changes
        if (globalThis.Alpine?.effect) {
            this._effectCleanup = globalThis.Alpine.effect(() => {
                this.render();
            });
        } else {
            this.render();
        }
    }

    disconnectedCallback() {
        if (this._effectCleanup) {
            this._effectCleanup();
        }
    }

    /**
     * Resolves variables to their underlying value (string, array, object).
     */
    resolve(path) {
        return this._resolver ? this._resolver(path) : path;
    }

    /**
     * Resolves variables in a string or object.
     */
    interp(val) {
        if (typeof val === 'string') return this._interpolator(val);
        if (typeof val === 'object' && val !== null) {
            const result = Array.isArray(val) ? [] : {};
            for (const k in val) {
                result[k] = this.interp(val[k]);
            }
            return result;
        }
        return val;
    }

    /**
     * Bridges an action event to the orchestrator.
     */
    triggerAction(actionId, params = {}) {
        // Support for both legacy 'call' property and new 'action' object
        const action = this._spec.action ? { ...this._spec.action } : {
            call: actionId || this._spec.call || "default",
            params: { ...this._spec.params, ...params }
        };
        
        this.dispatchEvent(new CustomEvent('atomic-action', {
            bubbles: true,
            composed: true,
            detail: { action }
        }));
    }

    render() {
        // To be implemented by subclasses
    }
}
