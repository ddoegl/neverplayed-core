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
            select.addEventListener('sl-change', (e) => this._handleSelectChange(e));
        }

        // Non-destructive updates
        if (select.label !== label) select.label = label;
        if (select.placeholder !== placeholder) select.placeholder = placeholder;
        if (select.value !== value) select.value = value;

        // Efficiently update options
        const staticOptions = this._spec.options || [];
        let dynamicOptions = [];
        
        if (this._spec.optionSource) {
            const resolved = this.resolve(this._spec.optionSource);
            if (Array.isArray(resolved)) dynamicOptions = resolved;
            else if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
                // If it's an object (like a map), convert to array of {id, label}
                dynamicOptions = Object.entries(resolved).map(([k, v]) => ({ id: k, label: v }));
            }
        }

        // UNIFIED SOURCE: Concatenate static (headers) with dynamic (data)
        const options = [...staticOptions, ...dynamicOptions];
        this._lastOptions = options; // Store for lookup in event listener

        const newOptionsHtml = options.map(opt => {
            const optValue = String(opt?.id ?? opt?.value ?? opt ?? "");
            const optLabel = this.interp(String(opt?.displayName ?? opt?.label ?? opt?.name ?? optValue));
            return `<sl-option value="${optValue}">${optLabel}</sl-option>`;
        }).join('');

        if (select.innerHTML !== newOptionsHtml) {
            // Shoelace-safe update
            select.innerHTML = newOptionsHtml;
            select.value = String(value ?? "");
        } else if (select.value !== String(value ?? "")) {
            select.value = String(value ?? "");
        }
    }

    _handleSelectChange(e) {
        const val = e.target.value;
        const id = this._spec.id;

        this.dispatchEvent(new CustomEvent('atomic-change', {
            bubbles: true,
            composed: true,
            detail: { id, value: val }
        }));

        // Lookup the selected option object
        const selectedOption = this._lastOptions?.find(opt => {
            const optValue = String(opt?.id ?? opt?.value ?? opt ?? "");
            return optValue === val;
        });

        // 1. OPTION-SPECIFIC ACTION (Highest priority)
        if (selectedOption?.action?.call) {
            console.log(`[AtomicSelect] Triggering OPTION action: ${selectedOption.action.call}`, selectedOption.action.params);
            this.triggerAction(selectedOption.action.call, { ...selectedOption.action.params, value: val });
        } 
        // 2. COMPONENT-LEVEL ACTION (Fallback)
        else if (this._spec.action?.call) {
            console.log(`[AtomicSelect] Triggering COMPONENT action: ${this._spec.action.call}`);
            this.triggerAction(this._spec.action.call, { value: val });
        }
    }
}

if (!customElements.get("atomic-select")) {
    customElements.define("atomic-select", AtomicSelect);
}
