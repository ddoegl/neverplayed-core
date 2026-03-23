import { AtomicComponentBase } from "./atomic-component-base.js";

/**
 * atomic-input: A uiSpec-aligned wrapper for sl-input.
 * Kind: text-input
 */
class AtomicInput extends AtomicComponentBase {
    render() {
        if (!this._spec) return;

        const label = this.interp(this._spec.label || "");
        const placeholder = this.interp(this._spec.placeholder || "");
        const id = this._spec.id;
        const value = (id && this.resolve(id) !== undefined) ? this.resolve(id) : (this._spec.value || "");

        let input = this.querySelector('sl-input');
        if (!input) {
            this.innerHTML = `
                <div class="mb-5">
                    <sl-input size="medium" pill></sl-input>
                </div>
            `;
            input = this.querySelector('sl-input');
            input.addEventListener('sl-input', (e) => {
                this.dispatchEvent(new CustomEvent('atomic-change', {
                    bubbles: true,
                    composed: true,
                    detail: { id: this._spec.id, value: e.target.value }
                }));
            });
        }

        // Non-destructive updates to preserve focus
        if (input.label !== label) input.label = label;
        if (input.placeholder !== placeholder) input.placeholder = placeholder;
        if (input.value !== value) input.value = value;
    }
}

if (!customElements.get("atomic-input")) {
    customElements.define("atomic-input", AtomicInput);
}
