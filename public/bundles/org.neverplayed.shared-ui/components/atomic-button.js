import { AtomicComponentBase } from "./atomic-component-base.js";

/**
 * atomic-button: A uiSpec-aligned wrapper for sl-button.
 * Kind: command-button
 */
class AtomicButton extends AtomicComponentBase {
    render() {
        if (!this._spec) return;

        const variant = this._spec.variant || "default";
        const label = this.interp(this._spec.label || "Continue");
        const pulse = this._spec.pulse ? "pulse" : "";
        const size = this._spec.size || "medium";

        this.innerHTML = `
            <sl-button variant="${variant}" size="${size}" class="w-full mb-4 ${pulse}">
                ${label}
            </sl-button>
        `;

        this.querySelector('sl-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.triggerAction();
        });
    }
}

if (!customElements.get("atomic-button")) {
    customElements.define("atomic-button", AtomicButton);
}
