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
        const value = (id && this.resolve(id) !== undefined) ? this.resolve(id) : (this._spec.value || "");
        const pill = this._spec.pill !== false;

        let select = this.querySelector('sl-select');
        if (!select) {
            this.innerHTML = `
                <div class="mb-5">
                    <sl-select size="medium" ${pill ? 'pill' : ''}></sl-select>
                </div>
            `;
            select = this.querySelector('sl-select');
            select.addEventListener('sl-change', (e) => {
                const val = e.target.value;
                this.dispatchEvent(new CustomEvent('atomic-change', {
                    bubbles: true,
                    composed: true,
                    detail: { id, value: val }
                }));
            });
        }

        // Non-destructive updates
        if (select.label !== label) select.label = label;
        if (select.placeholder !== placeholder) select.placeholder = placeholder;
        if (select.value !== value) select.value = value;

        // Efficiently update options
        let options = this._spec.options || [];
        if (this._spec.optionSource) {
            const resolved = this.resolve(this._spec.optionSource);
            if (Array.isArray(resolved)) options = resolved;
        }

        const newOptionsHtml = options.map(opt => {
            const optValue = opt.id || opt.value || opt;
            const optLabel = this.interp(opt.displayName || opt.label || opt.name || optValue);
            return `<sl-option value="${optValue}">${optLabel}</sl-option>`;
        }).join('');

        if (select.innerHTML !== newOptionsHtml) {
            select.innerHTML = newOptionsHtml;
            // Restore selection after innerHTML change if needed
            select.value = value;
        }
    }
}

if (!customElements.get("atomic-select")) {
    customElements.define("atomic-select", AtomicSelect);
}
