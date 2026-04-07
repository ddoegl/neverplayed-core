/**
 * ResultPartHandler: Handles rendering of 'result' parts.
 * Uses a JSON inspector for data visualization.
 */
export const ResultPartHandler = {
    type: 'result',
    
    render(id, _p, _context, _resolver, _factory, existingEl) {
        let container = existingEl;
        if (!container || !container.classList.contains('uif-structural-container')) {
            container = document.createElement('div');
            container.setAttribute('data-part-id', id);
        }
        
        container.setAttribute('x-show', "$uifResolve('data')");
        container.setAttribute('x-transition', '');
        container.className = "uif-structural-container mb-4 p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-auto max-h-80";
        container.innerHTML = `<pre x-text="JSON.stringify($uifResolve('data'), null, 2)" class="text-[10px] text-gray-400 font-mono leading-relaxed"></pre>`;
        
        return container;
    }
};
