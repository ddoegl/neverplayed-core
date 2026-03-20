import { AtomicComponentBase } from "../../../system-services/shared-ui-components/components/atomic-component-base.js";
import { YAML_SERVICE } from "../../../../shared-types.js";

/**
 * atomic-visual-editor: The core WYSIWYG builder for Atomic Flows.
 * Kind: visual-editor
 */
const PART_TEMPLATES = {
    'text': { type: 'text', label: 'Text Block', value: '## New Text\nAdd your content here.' },
    'text-input': { kind: 'text-input', label: 'Text Input', placeholder: 'Enter value...' },
    'select-input': { kind: 'select-input', label: 'Select Input', optionSource: '${this.items}' },
    'command-button': { kind: 'command-button', label: 'Action Button', variant: 'primary', action: { call: 'NEXT_STEP' } },
    'row': { type: 'row', label: 'Button Row', parts: {} }
};

export default class AtomicVisualEditor extends AtomicComponentBase {
    constructor() {
        super();
        this._yamlService = null;
        this._handleDefaultAction = this.handleDefaultAction.bind(this);
        this._initialized = false;
        this._activeStepId = null;
        this._activePartId = null;
    }

    connectedCallback() {
        globalThis.addEventListener('atomic-default-action', this._handleDefaultAction);
    }

    disconnectedCallback() {
        globalThis.removeEventListener('atomic-default-action', this._handleDefaultAction);
    }

    handleDefaultAction(event) {
        const { action, _params, values } = event.detail;
        if (action === 'blueprint.save') {
           if (!this._draftSpec) {
               console.warn("Visual Editor: Cannot save. _draftSpec is still undefined.");
               return;
           }
           console.log("Visual Editor: Saving blueprint...", this._draftSpec);
           
           const ingestionRef = this._context.getServiceReference("prototyper.atomic.ingestion");
           const ingestionSvc = ingestionRef ? this._context.getService(ingestionRef) : null;
           
           if (ingestionSvc) {
               // Update ID/Label if provided in values from the metadata form
               if (values && values.symbolic_name) this._draftSpec.id = values.symbolic_name;
               if (values && values.name) this._draftSpec.label = values.name;

               ingestionSvc.ingest(this._draftSpec, { persist: true, source: 'visual-editor' });
               alert(`Blueprint [${this._draftSpec.id}] saved and registered! Check your Dashboard.`);
           } else {
               alert("Ingestion Service not found. Cannot save.");
           }
        }
    }

    render() {
        if (!this._spec) return;

        // 1. REHYDRATION (Load from shared state if we don't have a spec yet)
        if (!this._draftSpec) {
            const stored = this.resolve('draft_spec');
            const isHydrated = this.resolve('_hydrated');
            
            if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
                this._draftSpec = stored;
                console.log("Visual Editor: Resumed from state.", this._draftSpec);
            } else if (!isHydrated) {
                // Truly new instance (no hydration data expected)
                console.log("Visual Editor: Initializing new draft placeholder.");
                this._draftSpec = JSON.parse(JSON.stringify(this._spec.initialDraft || {
                    id: "new-flow",
                    label: "My New Flow",
                    ui: { steps: { start: { title: "Welcome", parts: {} } } }
                }));
                this.saveToState();
            } else {
                // If we are hydrated but stored is empty, this means it's a new instance 
                // of the Visual-DO-Editor itself.
                console.log("Visual Editor: Hydrated instance found, but 'draft_spec' is empty. Starting fresh.");
                this._draftSpec = JSON.parse(JSON.stringify(this._spec.initialDraft || {
                    id: "new-flow",
                    label: "My New Flow",
                    ui: { steps: { start: { title: "Welcome", parts: {} } } }
                }));
            }
        }

        // 3. SYNC METADATA (Cross-Component Binding)
        const name = this.resolve('name');
        const symbolicName = this.resolve('symbolic_name');
        
        let metaChanged = false;
        if (name && name !== this._draftSpec.label) {
            this._draftSpec.label = name;
            metaChanged = true;
        }
        if (symbolicName && symbolicName !== this._draftSpec.id) {
            this._draftSpec.id = symbolicName;
            metaChanged = true;
        }
        if (metaChanged) this.saveToState();

        if (!this._yamlService) {
            const ref = this._context.getServiceReference(YAML_SERVICE);
            this._yamlService = ref ? this._context.getService(ref) : null;
        }

        // --- 4. IDEMPOTENT SHELL RENDERING ---
        if (!this._initialized) {
            this.innerHTML = `
                <div class="grid grid-cols-12 gap-6 h-[700px] bg-gray-50/50 p-4 rounded-3xl border border-gray-100 shadow-inner overflow-hidden">
                    
                    <!-- 1. LEFT: Visual Property Editor -->
                    <div class="col-span-4 flex flex-col space-y-4 overflow-hidden">
                        <div class="bg-white rounded-2xl border shadow-sm p-5 flex-1 overflow-y-auto">
                            <header class="flex justify-between items-center mb-6">
                                <h3 class="text-sm font-black uppercase tracking-widest text-gray-400">Structure</h3>
                                <sl-button size="small" circle variant="neutral" id="add-step-btn">
                                    <i class="fas fa-plus"></i>
                                </sl-button>
                            </header>
                            
                            <div id="steps-list" class="space-y-3"></div>

                            <div id="property-panel" class="mt-8 pt-8 border-t border-dashed hidden animate-in fade-in slide-in-from-bottom-2">
                               <h3 class="text-xs font-black uppercase tracking-widest text-gray-300 mb-4">Properties</h3>
                               <div id="prop-fields" class="space-y-4"></div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. MIDDLE: Live Preview -->
                    <div class="col-span-4 flex flex-col space-y-4 overflow-hidden">
                        <div class="bg-white rounded-2xl border shadow-sm flex-1 flex flex-col overflow-hidden relative">
                            <header class="bg-gray-50 border-b p-3 flex justify-between items-center px-5">
                                <div class="flex items-center space-x-2">
                                    <div class="w-2 h-2 rounded-full bg-red-400"></div>
                                    <div class="w-2 h-2 rounded-full bg-amber-400"></div>
                                    <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
                                </div>
                                <span class="text-[10px] font-mono text-gray-400">Live Preview</span>
                                <div class="w-12"></div>
                            </header>
                            <div id="preview-container" class="flex-1 overflow-y-auto p-6 scroll-smooth"></div>
                        </div>
                    </div>

                    <!-- 3. RIGHT: YAML Source -->
                    <div class="col-span-4 flex flex-col space-y-4 overflow-hidden">
                        <div class="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex-1 flex flex-col overflow-hidden">
                            <header class="bg-slate-800/50 border-b border-slate-700 p-3 px-5 flex justify-between items-center">
                                <span class="text-[10px] font-mono text-slate-400 uppercase tracking-widest">spec.yaml</span>
                                <i class="fas fa-code text-slate-500 text-xs text-emerald-400"></i>
                            </header>
                            <div class="flex-1 p-5 overflow-auto custom-scroll">
                                <pre id="yaml-view" class="text-[11px] text-emerald-400/80 font-mono leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/20"></pre>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this._initialized = true;
        }

        this.setupVisualEditor();
        this.updatePreview();
    }

    setupVisualEditor() {
        const list = this.querySelector('#steps-list');
        const yaml = this.querySelector('#yaml-view');
        if (!list || !yaml) return;

        list.innerHTML = "";
        yaml.textContent = this._yamlService ? this._yamlService.dump(this._draftSpec) : JSON.stringify(this._draftSpec, null, 2);

        Object.entries(this._draftSpec.ui?.steps || {}).forEach(([sid, step]) => {
            const btn = document.createElement('div');
            btn.className = `p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${this._activeStepId === sid ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-gray-50 hover:bg-white border-gray-100'}`;
            btn.innerHTML = `
                <div>
                    <div class="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">${sid}</div>
                    <div class="text-xs font-bold ${this._activeStepId === sid ? 'text-indigo-700' : 'text-gray-600'}">${step.title || 'Untitled'}</div>
                </div>
                <i class="fas fa-chevron-right text-[10px] ${this._activeStepId === sid ? 'text-indigo-400' : 'text-gray-300'}"></i>
            `;
            btn.onclick = () => {
                this._activeStepId = sid;
                this.setupVisualEditor(); // Refresh selection
                this.editStep(sid);
                this.updatePreview(); // Sync preview to this step
            };
            list.appendChild(btn);
        });

        // Add Step Button
        const addBtn = this.querySelector('#add-step-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                const sid = `step_${Object.keys(this._draftSpec.ui.steps).length + 1}`;
                this._draftSpec.ui.steps[sid] = { title: "New Step", parts: {} };
                this._activeStepId = sid;
                this.saveToState();
                this.setupVisualEditor();
                this.editStep(sid);
                this.updatePreview();
            };
        }
    }

    editStep(sid) {
        const step = this._draftSpec.ui.steps[sid];
        const panel = this.querySelector('#property-panel');
        const fields = this.querySelector('#prop-fields');
        
        // Use a more robust check to ensure we regenerate when the step identity changes
        const currentId = fields.getAttribute('data-active-sid');
        
        if (currentId !== sid || fields.innerHTML === "") {
            fields.setAttribute('data-active-sid', sid);
            panel.classList.remove('hidden');
            this.renderStepProperties(sid, step, fields);
        }

        this.renderPartsList(sid, step);
        this.renderPartProperties(sid, step);
    }

    renderStepProperties(sid, step, container) {
        container.innerHTML = `
            <div class="space-y-4">
                <sl-input label="Step Title" value="${step.title || ''}" id="step-title-input" size="small"></sl-input>
                
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <label class="text-[10px] font-bold uppercase text-gray-400">Parts</label>
                        <sl-dropdown id="add-part-dropdown" placement="bottom-end">
                            <sl-button slot="trigger" size="small" caret variant="neutral">
                                <i class="fas fa-plus mr-2"></i> Add Part
                            </sl-button>
                            <sl-menu id="add-part-menu">
                                <sl-menu-item value="text"><i class="fas fa-font mr-2 text-blue-500"></i> Text Block</sl-menu-item>
                                <sl-menu-item value="text-input"><i class="fas fa-keyboard mr-2 text-emerald-500"></i> Text Input</sl-menu-item>
                                <sl-menu-item value="select-input"><i class="fas fa-list mr-2 text-indigo-500"></i> Select Input</sl-menu-item>
                                <sl-menu-item value="command-button"><i class="fas fa-toggle-on mr-2 text-pink-500"></i> Action Button</sl-menu-item>
                                <sl-divider></sl-divider>
                                <sl-menu-item value="row"><i class="fas fa-columns mr-2 text-gray-500"></i> Button Row</sl-menu-item>
                            </sl-menu>
                        </sl-dropdown>
                    </div>
                    <div id="parts-list" class="space-y-1"></div>
                </div>

                <div id="part-properties" class="mt-4 pt-4 border-t border-gray-100 hidden">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="text-[10px] font-bold uppercase text-indigo-500" id="part-prop-title">Part Properties</h4>
                        <sl-button size="extra-small" variant="danger" id="delete-part-btn" circle outline>
                            <i class="fas fa-trash"></i>
                        </sl-button>
                    </div>
                    <div id="part-fields" class="space-y-3"></div>
                </div>
            </div>
        `;

        const titleInput = container.querySelector('#step-title-input');
        titleInput.addEventListener('sl-input', (e) => {
            step.title = e.target.value;
            this.saveToState();
            this.updatePreview();
            this.setupVisualEditor();
        });

        const addMenu = container.querySelector('#add-part-menu');
        addMenu.addEventListener('sl-select', (e) => {
            this.addPart(sid, e.detail.item.value);
        });
    }

    renderPartsList(sid, step) {
        const partsList = this.querySelector('#parts-list');
        if (!partsList) return;

        partsList.innerHTML = Object.entries(step.parts || {}).map(([pid, part]) => `
            <div class="flex justify-between items-center p-2 rounded-lg text-[10px] font-mono border cursor-pointer transition-all ${this._activePartId === pid ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-gray-50 border-gray-100 text-gray-400'}"
                 data-part-id="${pid}">
                <div class="flex items-center">
                    <i class="fas ${part.type ? 'fa-square' : 'fa-puzzle-piece'} mr-2 opacity-50"></i>
                    <span>${pid}</span>
                </div>
                <i class="fas fa-chevron-right text-[8px] opacity-30"></i>
            </div>
        `).join('');

        partsList.querySelectorAll('[data-part-id]').forEach(el => {
            el.onclick = () => {
                this._activePartId = el.getAttribute('data-part-id');
                this.editStep(sid);
            };
        });
    }

    renderPartProperties(sid, step) {
        const partPanel = this.querySelector('#part-properties');
        const partFields = this.querySelector('#part-fields');
        const deleteBtn = this.querySelector('#delete-part-btn');
        
        if (!this._activePartId || !step.parts[this._activePartId]) {
            partPanel.classList.add('hidden');
            return;
        }

        const pid = this._activePartId;
        const part = step.parts[pid];
        partPanel.classList.remove('hidden');
        this.querySelector('#part-prop-title').textContent = `${pid} properties`;

        // Render fields based on type/kind
        let html = `
            <sl-input label="Part ID" value="${pid}" id="part-id-input" size="small"></sl-input>
        `;

        if (part.type === 'text') {
            html += `<sl-textarea label="Content (Markdown)" value="${part.value || ''}" id="part-value-input" size="small" resize="auto"></sl-textarea>`;
        } else if (part.kind === 'text-input') {
            html += `
                <sl-input label="Label" value="${part.label || ''}" id="part-label-input" size="small"></sl-input>
                <sl-input label="Placeholder" value="${part.placeholder || ''}" id="part-placeholder-input" size="small"></sl-input>
            `;
        } else if (part.kind === 'select-input') {
            html += `
                <sl-input label="Label" value="${part.label || ''}" id="part-label-input" size="small"></sl-input>
                <sl-input label="Option Source" value="${part.optionSource || ''}" id="part-source-input" size="small" help-text="e.g. \${this.items}"></sl-input>
            `;
        } else if (part.kind === 'command-button') {
            html += `
                <sl-input label="Label" value="${part.label || ''}" id="part-label-input" size="small"></sl-input>
                <sl-input label="Action Call" value="${part.action?.call || ''}" id="part-call-input" size="small"></sl-input>
                <sl-select label="Variant" value="${part.variant || 'default'}" id="part-variant-input" size="small">
                    <sl-option value="default">Default</sl-option>
                    <sl-option value="primary">Primary</sl-option>
                    <sl-option value="success">Success</sl-option>
                    <sl-option value="danger">Danger</sl-option>
                </sl-select>
            `;
        }

        partFields.innerHTML = html;

        // Bind events
        const bind = (selector, key, path = null) => {
            const el = partFields.querySelector(selector);
            if (!el) return;
            el.addEventListener('sl-input', (e) => {
                if (path) {
                    if (!part[path]) part[path] = {};
                    part[path][key] = e.target.value;
                }
                else part[key] = e.target.value;
                this.saveToState();
                this.updatePreview();
                this.setupVisualEditor();
            });
            if (el.tagName === 'SL-SELECT') {
                 el.addEventListener('sl-change', (e) => {
                    if (path) {
                        if (!part[path]) part[path] = {};
                        part[path][key] = e.target.value;
                    }
                    else part[key] = e.target.value;
                    this.saveToState();
                    this.updatePreview();
                    this.setupVisualEditor();
                });
            }
        };

        bind('#part-label-input', 'label');
        bind('#part-value-input', 'value');
        bind('#part-placeholder-input', 'placeholder');
        bind('#part-source-input', 'optionSource');
        bind('#part-call-input', 'call', 'action');
        bind('#part-variant-input', 'variant');

        // ID Change (Special handling)
        const idInput = partFields.querySelector('#part-id-input');
        idInput.addEventListener('sl-change', (e) => {
            const newId = e.target.value;
            if (newId && newId !== pid) {
                step.parts[newId] = step.parts[pid];
                delete step.parts[pid];
                this._activePartId = newId;
                this.saveToState();
                this.updatePreview();
                this.setupVisualEditor();
                this.editStep(sid);
            }
        });

        // Delete handling
        deleteBtn.onclick = () => {
            if (confirm(`Delete part ${pid}?`)) {
                delete step.parts[pid];
                this._activePartId = null;
                this.saveToState();
                this.updatePreview();
                this.setupVisualEditor();
                this.editStep(sid);
            }
        };
    }

    addPart(sid, type) {
        const step = this._draftSpec.ui.steps[sid];
        const template = PART_TEMPLATES[type];
        if (!template) return;

        const baseId = type.replace('-', '_');
        let idCount = 1;
        let pid = `${baseId}_${idCount}`;
        while (step.parts[pid]) {
            idCount++;
            pid = `${baseId}_${idCount}`;
        }

        step.parts[pid] = JSON.parse(JSON.stringify(template));
        if (step.parts[pid].id) delete step.parts[pid].id; // We use map keys for ID
        
        this._activePartId = pid;
        this.saveToState();
        this.updatePreview();
        this.setupVisualEditor();
        this.editStep(sid);
    }

    saveToState() {
        this.dispatchEvent(new CustomEvent('atomic-change', {
            bubbles: true,
            composed: true,
            detail: { 
                id: 'draft_spec', 
                value: this._draftSpec 
            }
        }));
    }

    updatePreview() {
        const container = this.querySelector('#preview-container');
        const factoryRef = this._context.getServiceReference("prototyper.ui.factory");
        const factory = factoryRef ? this._context.getService(factoryRef) : null;
        
        if (factory) {
            // Force the preview to the current active step
            const previewSpec = JSON.parse(JSON.stringify(this._draftSpec));
            if (this._activeStepId) {
                if (!previewSpec.ui) previewSpec.ui = {};
                previewSpec.ui.initialStep = this._activeStepId;
            }
            
            if (!this._previewEl) {
                this._previewEl = factory.create(previewSpec, {});
                container.appendChild(this._previewEl);
            } else {
                // Reactive update via our new render(spec) support
                if (this._previewEl.render) this._previewEl.render(previewSpec);
            }
        }
    }
}

if (!customElements.get("atomic-visual-editor")) {
    customElements.define("atomic-visual-editor", AtomicVisualEditor);
}
