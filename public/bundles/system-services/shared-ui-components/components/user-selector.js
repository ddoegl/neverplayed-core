class UserSelector extends HTMLElement {
    constructor() {
        super();
        this._users = [];
        this._value = 'NONE';
    }

    connectedCallback() {
        this.render();
    }

    get users() {
        return this._users;
    }

    set users(val) {
        if (JSON.stringify(this._users) === JSON.stringify(val)) return;
        this._users = val || [];
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
                <sl-select size="medium" pill placeholder="Choose User">
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

        const optionsHtml = this._users.map(user => `
            <sl-option value="${user.id}">\u2714 ${user.id}${user.alias ? ` (${user.alias})` : ''}</sl-option>
        `).join('');

        const finalHtml = `
            <sl-option value="NONE">Choose User</sl-option>
            ${optionsHtml}
            <sl-option value="NEW">&#x2b; Order new User</sl-option>
        `;

        if (select.innerHTML !== finalHtml) {
            select.innerHTML = finalHtml;
        }

        if (select.value !== this._value) {
            select.value = this._value;
        }
    }
}

if (!customElements.get('user-selector')) {
    customElements.define('user-selector', UserSelector);
}

