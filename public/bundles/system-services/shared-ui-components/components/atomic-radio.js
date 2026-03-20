import { AtomicComponentBase } from "./atomic-component-base.js";

/**
 * atomic-radio: A uiSpec-aligned wrapper for sl-radio-group.
 * Kind: radio-input
 */
class AtomicRadio extends AtomicComponentBase {
    render() {
        if (!this._spec) return;

        const label = this.interp(this._spec.label || "");
        const id = this._spec.id;
        const options = this._spec.options || [];
        const currentValue = (id && this.resolve(id) !== undefined) ? this.resolve(id) : (this._spec.value || "");

        let group = this.querySelector('sl-radio-group');
        if (!group) {
            this.innerHTML = `
                <div class="mb-5">
                    <sl-radio-group></sl-radio-group>
                </div>
            `;
            group = this.querySelector('sl-radio-group');
            group.addEventListener('sl-change', (e) => {
                this.dispatchEvent(new CustomEvent('atomic-change', {
                    bubbles: true,
                    composed: true,
                    detail: { id, value: e.target.value }
                }));
            });
        }

        // Non-destructive updates
        if (group.label !== label) group.label = label;
        if (group.value !== currentValue) group.value = currentValue;

        const newOptionsHtml = options.map(opt => `
            <sl-radio value="${opt.value}">${this.interp(opt.label)}</sl-radio>
        `).join('');

        if (group.innerHTML !== newOptionsHtml) {
            group.innerHTML = newOptionsHtml;
            group.value = currentValue; // Restore selection
        }
    }
}

if (!customElements.get("atomic-radio")) {
    customElements.define("atomic-radio", AtomicRadio);
}
