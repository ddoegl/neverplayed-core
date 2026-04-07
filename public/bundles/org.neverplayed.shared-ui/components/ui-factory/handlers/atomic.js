/**
 * AtomicPartHandler: Proxy for rendering custom atomic components
 * discovered via the AtomicComponentRegistryService.
 */
export const AtomicPartHandler = {
    // This handler will be matched as a fallback if no specific type handler exists
    isAtomic: true,
    
    render(id, p, context, resolver, factory, existingEl) {
        const kind = p.kind || p.type;
        const tagName = factory._registryService ? factory._registryService.get(kind) : null;
        
        if (!tagName) {
            factory.logger.warn(`AtomicPartHandler: No tag found for kind [${kind}]`);
            return null;
        }

        let el = existingEl;
        // If it's a wrapper (from guards), get the child
        if (el && el.getAttribute('data-part-id') !== id) {
            el = el.querySelector(`[data-part-id="${id}"]`);
        }

        if (!el || el.tagName.toLowerCase() !== tagName.toLowerCase()) {
            el = document.createElement(tagName);
            el.setAttribute('data-part-id', id);
        }

        if (el.hydrate) {
            el.hydrate(
                { id, ...p }, 
                context, 
                (s) => resolver.interpolate(s, factory._state),
                (path) => resolver.resolveValue(path, factory._state)
            );
        }
        
        return el;
    }
};
