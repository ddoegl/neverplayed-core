import { marked } from "https://esm.sh/marked@12.0.1";

/**
 * TextPartHandler: Handles rendering of 'text' parts.
 * Supports Markdown, interpolation, and reactive spans.
 */
export const TextPartHandler = {
    type: 'text',
    
    render(id, p, _context, _resolver, _factory, existingEl) {
        let container = existingEl;
        if (!container || !container.classList.contains('uif-structural-container')) {
            container = document.createElement('div');
            container.setAttribute('data-part-id', id);
            container.classList.add('uif-structural-container', 'mb-4');
        }

        let inner = container.querySelector('.uif-text-content');
        if (!inner) {
            inner = document.createElement('div');
            inner.className = "uif-text-content text-gray-500 leading-relaxed font-semibold prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 prose-strong:text-gray-700";
            container.appendChild(inner);
        }
        
        // 1. Identify and mask reactive segments BEFORE marked processes them (to avoid escaping entities inside JS)
        const reactiveSegments = [];
        const rawValue = p.value || "";
        const maskedValue = rawValue.replace(/(?:\${(.*?)}|\{\{\s*(.*?)\s*\}\})/g, (_, k1, k2) => {
            const expr = k1 || k2;
            const rid = `uif-r-${Math.random().toString(36).slice(2, 9)}`;
            reactiveSegments.push({ id: rid, expr });
            return `<span id="${rid}" class="uif-reactive-placeholder"></span>`;
        });

        let html = "";
        try {
            html = marked.parse(maskedValue);
        } catch (_e) {
            html = maskedValue;
        }

        inner.innerHTML = html;

        // 2. Hydrate placeholders with x-text bindings
        reactiveSegments.forEach(seg => {
            const span = inner.querySelector(`#${seg.id}`);
            if (span) {
                span.removeAttribute('id');
                span.className = "uif-reactive text-blue-600 font-bold whitespace-pre-wrap font-mono";
                
                // Escape single quotes for the x-text attribute
                const escapedExpr = seg.expr.replace(/'/g, "\\'"); 
                
                // Use magic '$uifResolve' to ensure Alpine correctly finds the helper in any scope
                span.setAttribute('x-text', `((v) => (typeof v === 'object' && v !== null) ? JSON.stringify(v, null, 2) : (v ?? ''))($uifResolve('${escapedExpr}'))`);
            }
        });

        // 3. Force Alpine to discover the new reactive elements
        if (globalThis.Alpine && typeof globalThis.Alpine.initTree === 'function') {
            globalThis.Alpine.initTree(inner);
        }

        return container;
    }
};
