class AuthorizationSelector extends HTMLElement {
    constructor() {
        super();
        this._authorizations = [];
        this._value = 'NONE';
    }

    connectedCallback() {
        this.render();
    }

    get authorizations() {
        return this._authorizations;
    }

    set authorizations(val) {
        if (JSON.stringify(this._authorizations) === JSON.stringify(val)) return;
        this._authorizations = val || [];
        this.render();
    }
    
    get value() {
        return this._value;
    }

    set value(val) {
        if (this._value === val) return;
        this._value = val;
        const select = this.querySelector('sl-select');
        if (select) {
            select.value = val;
        }
    }

    render() {
        let select = this.querySelector('sl-select');
        if (!select) {
            this.innerHTML = `
                <sl-select size="medium" pill placeholder="Add Authorization">
                </sl-select>
            `;
            select = this.querySelector('sl-select');
            
            select.addEventListener('sl-change', (e) => {
                this._value = e.target.value;
                // Bridge to standard events for x-model
                this.dispatchEvent(new Event('input', { bubbles: true }));
                this.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        const optionsHtml = this._authorizations.map(auth => `
            <sl-option value="${auth.id}">\u2714 ${auth.name}</sl-option>
        `).join('');

        const finalHtml = `<sl-option value="NONE">Add Authorization</sl-option>${optionsHtml}`;

        if (select.innerHTML !== finalHtml) {
            select.innerHTML = finalHtml;
        }

        if (select.value !== this._value) {
            select.value = this._value;
        }
    }
}

if (!customElements.get('authorization-selector')) {
    customElements.define('authorization-selector', AuthorizationSelector);
}

