import { AtomicComponentBase } from "./atomic-component-base.js";

/**
 * atomic-select: A uiSpec-aligned wrapper for sl-select.
 * Kind: select-input
 */
class AtomicSelect extends AtomicComponentBase {
    render() {
        if (!this._spec) return;

        const label = this.interp(this._spec.label || "");
        const placeholder = this.interp(this._spec.placeholder || "Select...");
        const id = this._spec.id;
        const value = this._spec.value || "";
        const pill = this._spec.pill !== false;

        // Handle options: can be static or dynamic
        let optionsHtml = "";
        let options = this._spec.options || [];
        
        if (this._spec.optionSource) {
            const resolved = this.resolve(this._spec.optionSource);
            if (Array.isArray(resolved)) {
                options = resolved;
            }
        }
        
        options.forEach(opt => {
            const optValue = opt.id || opt.value || opt;
            const optLabel = this.interp(opt.displayName || opt.label || opt.name || optValue);
            const isSelected = String(value) === String(optValue);
            optionsHtml += `<sl-option value="${optValue}" ${isSelected ? 'selected' : ''}>${optLabel}</sl-option>`;
        });

        this.innerHTML = `
            <div class="mb-5">
                <sl-select 
                    label="${label}" 
                    placeholder="${placeholder}" 
                    value="${value}"
                    size="medium"
                    ${pill ? 'pill' : ''}
                >
                    ${optionsHtml}
                </sl-select>
            </div>
        `;

        const select = this.querySelector('sl-select');
        select.addEventListener('sl-change', (e) => {
            const val = e.target.value;
            this.dispatchEvent(new CustomEvent('atomic-change', {
                bubbles: true,
                composed: true,
                detail: { id, value: val }
            }));
        });
    }
}

if (!customElements.get("atomic-select")) {
    customElements.define("atomic-select", AtomicSelect);
}
