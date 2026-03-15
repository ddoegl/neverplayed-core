class AuthorizationSelector extends HTMLElement {
    constructor() {
        super();
        this._authorizations = [];
        this._value = 'NONE';
        
        // Shadow DOM? No, styling is easier in Light DOM with Tailwind.
        // But true web components often use Shadow DOM. 
        // Let's use Light DOM to inherit global styles easily.
    }

    connectedCallback() {
        this.render();
    }

    static get observedAttributes() {
        return ['value'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'value' && oldValue !== newValue) {
            this._value = newValue;
            this.updateSelect();
        }
    }

    get authorizations() {
        return this._authorizations;
    }

    set authorizations(val) {
        this._authorizations = val;
        this.render();
    }
    
    get value() {
        return this._value;
    }

    set value(val) {
        this._value = val;
        // Do NOT set attribute to avoid loop if framework does it
        // this.setAttribute('value', val);
        const select = this.querySelector('select');
        if (select) {
            select.value = val;
        }
    }

    render() {
        // Simple diff: if select exists, just update options? 
        // For now, full re-render is safer for valid options
        this.innerHTML = `
            <select class="bg-white text-black p-2 rounded border w-full">
                <option value="NONE">Add Authorization</option>
                ${this._authorizations.map(authorization => `
                    <option value="${authorization.id}">\u2714 ${authorization.name}</option>
                `).join('')}
            </select>
        `;

        const select = this.querySelector('select');
        if (select) {
            select.value = this._value;
            
            select.addEventListener('change', (e) => {
                this._value = e.target.value;
                this.dispatchEvent(new Event('input', { bubbles: true }));
                this.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
    }
}

customElements.define('authorization-selector', AuthorizationSelector);
