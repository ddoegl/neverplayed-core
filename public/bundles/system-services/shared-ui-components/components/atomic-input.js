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

        this.innerHTML = `
            <div class="mb-5">
                <sl-input 
                    label="${label}" 
                    placeholder="${placeholder}" 
                    value="${value}"
                    size="medium"
                    pill
                ></sl-input>
            </div>
        `;

        const input = this.querySelector('sl-input');
        input.addEventListener('sl-input', (e) => {
            // Bridge to the global factory state
            this.dispatchEvent(new CustomEvent('atomic-change', {
                bubbles: true,
                composed: true,
                detail: { id, value: e.target.value }
            }));
        });
    }
}

if (!customElements.get("atomic-input")) {
    customElements.define("atomic-input", AtomicInput);
}
