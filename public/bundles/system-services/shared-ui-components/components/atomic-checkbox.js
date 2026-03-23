import { AtomicComponentBase } from "./atomic-component-base.js";

/**
 * atomic-checkbox: A uiSpec-aligned wrapper for sl-checkbox.
 * Kind: checkbox-input
 */
class AtomicCheckbox extends AtomicComponentBase {
    render() {
        if (!this._spec) return;

        const label = this.interp(this._spec.label || "");
        const id = this._spec.id;
        const isChecked = (id && this.resolve(id) === true);

        let cb = this.querySelector('sl-checkbox');
        if (!cb) {
            this.innerHTML = `
                <div class="mb-5">
                    <sl-checkbox></sl-checkbox>
                </div>
            `;
            cb = this.querySelector('sl-checkbox');
            cb.addEventListener('sl-change', (e) => {
                this.dispatchEvent(new CustomEvent('atomic-change', {
                    bubbles: true,
                    composed: true,
                    detail: { id: this._spec.id, value: e.target.checked }
                }));
            });
        }

        // Non-destructive updates
        if (cb.innerText !== label) cb.innerText = label;
        if (cb.checked !== isChecked) cb.checked = isChecked;
    }
}

if (!customElements.get("atomic-checkbox")) {
    customElements.define("atomic-checkbox", AtomicCheckbox);
}
