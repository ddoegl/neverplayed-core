import { TextPartHandler } from "./handlers/text.js";
import { StructuralPartHandler } from "./handlers/structural.js";
import { ResultPartHandler } from "./handlers/result.js";
import { AtomicPartHandler } from "./handlers/atomic.js";

/**
 * PartRegistry: Maps 'type' or 'kind' to specific rendering handlers.
 * Decouples the central UIFactory from specific rendering logic.
 */
export const PartRegistry = {
    _handlers: new Map(),

    init() {
        this.register(TextPartHandler.type, TextPartHandler);
        this.register(ResultPartHandler.type, ResultPartHandler);
        
        StructuralPartHandler.types.forEach(type => {
            this.register(type, StructuralPartHandler);
        });
    },

    register(type, handler) {
        this._handlers.set(type, handler);
    },

    /**
     * Resolves the appropriate handler for a part definition.
     * Fallback: AtomicPartHandler if no specific type handler is found.
     * 
     * @param {Object} p - The part definition.
     * @returns {Object} The handler.
     */
    getHandler(p) {
        const type = p.type;
        const _kind = p.kind;
        
        // 1. Explicit type match
        if (this._handlers.has(type)) return this._handlers.get(type);
        
        // 2. Fallback to Atomic Registry if it's a known atomic kind or has no special handler
        return AtomicPartHandler;
    },

    /**
     * Orchestrates the rendering of a part, including guard wrappers.
     * 
     * @param {string} id - The part ID.
     * @param {Object} p - The part definition.
     * @param {Object} context - The Bundle Context.
     * @param {Object} resolver - The PathResolver.
     * @param {Object} factory - The UIFactory instance.
     * @param {HTMLElement} existingEl - Existing element for reconciliation.
     * @returns {HTMLElement} The rendered part element (or wrapper).
     */
    render(id, p, context, resolver, factory, existingEl) {
        const handler = this.getHandler(p);
        const el = handler.render(id, p, context, resolver, factory, existingEl);
        
        if (!el) return null;

        // Apply Guards (Standardized Wrapper)
        if (p.guard) {
            const escapedGuard = p.guard.replace(/'/g, "\\\\'");
            let guardWrap = (existingEl && existingEl.classList.contains('uif-guard-wrapper')) ? existingEl : null;
            
            if (!guardWrap && existingEl?.parentElement?.classList.contains('uif-guard-wrapper')) {
                guardWrap = existingEl.parentElement;
            }

            if (!guardWrap) {
                guardWrap = document.createElement('div');
                guardWrap.className = 'uif-guard-wrapper';
                guardWrap.appendChild(el);
            } else if (!guardWrap.contains(el)) {
                guardWrap.innerHTML = '';
                guardWrap.appendChild(el);
            }
            
            guardWrap.setAttribute('x-show', `uifGuards['${escapedGuard}'] === true`);
            guardWrap.setAttribute(':style', `{ display: uifGuards['${escapedGuard}'] ? '' : 'none !important' }`);
            guardWrap.setAttribute('x-cloak', '');
            return guardWrap;
        }

        return el;
    }
};

// Initialize once
PartRegistry.init();
