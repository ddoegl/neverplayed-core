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
        const options = this._spec.options || [];
        
        // If options is a string, it might be an expression like ${this.companies}
        // But our current interpolate handles strings, not array results.
        // For now, let's support static options and simple string-based dynamic lists if needed.
        
        options.forEach(opt => {
            const optValue = opt.value ?? opt;
            const optLabel = this.interp(opt.label ?? optValue);
            optionsHtml += `<sl-option value="${optValue}">${optLabel}</sl-option>`;
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
