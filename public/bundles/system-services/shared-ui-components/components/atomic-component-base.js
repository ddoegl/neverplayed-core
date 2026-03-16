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
     * @param {Object} spec The uiSpec compliant specification.
     * @param {Object} context The OSGi / Bundle context.
     * @param {Function} interpolator String interpolation utility from the factory.
     */
    hydrate(spec, context, interpolator) {
        this._spec = spec;
        this._context = context;
        this._interpolator = interpolator || ((s) => s);
        this.render();
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
        const action = {
            call: actionId,
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
