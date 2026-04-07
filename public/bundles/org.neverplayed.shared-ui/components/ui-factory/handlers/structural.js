/**
 * StructuralPartHandler: Handles rendering of 'row' and 'card' parts.
 * Manages children and recursive rendering via the factory.
 */
export const StructuralPartHandler = {
    types: ['row', 'card'],
    
    render(id, p, _context, _resolver, factory, existingEl) {
        let container = existingEl;
        
        // RECONCILE: If existingEl is actually our guard wrapper, peel it off
        if (container && container.classList.contains('uif-guard-wrapper')) {
            container = container.querySelector(':scope > .uif-structural-container');
        }

        if (!container || !container.classList.contains('uif-structural-container')) {
            container = document.createElement('div');
            container.setAttribute('data-part-id', id);
            container.classList.add('uif-structural-container');
        }
        
        container.className = "uif-structural-container mb-4";

        if (p.type === 'row') {
            container.classList.add("flex", "space-x-3");
            this.reconcileChildren(id, p, container, factory);
            return container;
        } else if (p.type === 'card') {
            const variant = p.variant || 'plain';
            const styles = {
                plain: "bg-white border-gray-200 shadow-sm",
                info: "bg-blue-50 border-blue-200 text-blue-800 shadow-blue-100",
                success: "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100",
                error: "bg-red-50 border-red-200 text-red-800 shadow-red-100",
                warning: "bg-amber-50 border-amber-200 text-amber-800 shadow-amber-100"
            };
            container.className = `uif-structural-container p-6 rounded-3xl border-2 border-solid mb-6 block transition-all ${styles[variant] || styles.plain}`;
            
            // Reconcile label (h4)
            let h4 = container.querySelector('h4.uif-card-label');
            if (p.label) {
                if (!h4) {
                    h4 = document.createElement('h4');
                    h4.className = "uif-card-label text-xs uppercase font-black tracking-widest mb-4 opacity-50";
                    container.prepend(h4);
                }
                // Segmented Variable Resolution: Capture All + Reactive magic $uifResolve
                const labelHtml = p.label.replace(/(?:\${(.*?)}|\{\{\s*(.*?)\s*\}\})/g, (_, k1, k2) => {
                    const expr = k1 || k2;
                    // Properly escape single quotes for the magic helper string
                    const escaped = expr.replace(/'/g, "\\'");
                    return `<span x-text="$uifResolve('${escaped}')"></span>`;
                });
                h4.innerHTML = labelHtml;
                // Force Alpine to discover the new reactive elements
                if (globalThis.Alpine && typeof globalThis.Alpine.initTree === 'function') {
                    globalThis.Alpine.initTree(h4);
                }
            } else if (h4) {
                h4.remove();
            }

            this.reconcileChildren(id, p, container, factory);
            return container;
        }
        return container;
    },

    reconcileChildren(_id, p, container, factory) {
        const currentChildren = Array.from(container.querySelectorAll(':scope > [data-part-id]'));
        const newChildIds = Object.keys(p.parts || {});
        
        currentChildren.forEach(el => {
            if (!newChildIds.includes(el.getAttribute('data-part-id'))) el.remove();
        });

        Object.entries(p.parts || {}).forEach(([cid, cp]) => {
            const existing = container.querySelector(`:scope > [data-part-id="${cid}"]`);
            const childEl = factory.renderPart(cid, cp, existing);
            if (childEl && !container.contains(childEl)) container.appendChild(childEl);
            // Ensure order is maintained if child count changes
            if (childEl && container.contains(childEl)) {
                // move to end (stable append)
                container.appendChild(childEl);
            }
        });
    }
};
