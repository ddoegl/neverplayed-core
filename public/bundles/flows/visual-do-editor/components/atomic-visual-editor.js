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

/**
 * atomic-visual-editor: The core WYSIWYG builder for Atomic Flows.
 */
export default class AtomicVisualEditor extends AtomicComponentBase {
    hydrate(spec, context, interpolator, resolver) {
        console.log(`Visual Editor: Hydrating with context [${context ? 'OK' : 'MISSING'}]`);
        super.hydrate(spec, context, interpolator, resolver);
        this.render();
    }
    constructor() {
        super();
        this._yamlService = null;
        this._handleDefaultAction = this.handleDefaultAction.bind(this);
        this._initialized = false;
        this._activeStepId = null;
        this._activePartId = null;

        // Sync with Preview navigation
        globalThis.addEventListener('atomic-step-changed', (e) => {
            if (this._previewEl && (e.detail.uifId === this._previewEl.dataset?.uifId || e.detail.instanceId === this._previewEl.getAttribute('instance-id'))) {
                const newStep = e.detail.stepId;
                if (newStep && newStep !== this._activeStepId) {
                    console.log(`AtomicVisualEditor: Syncing step from Preview -> ${newStep}`);
                    this._activeStepId = newStep;
                    this.setupVisualEditor();
                    this.editStep(newStep);
                }
            }
        });
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

    render(newSpec = null) {
        if (newSpec) this._spec = newSpec;
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

        if (!this._yamlService && this._context) {
            const ref = this._context.getServiceReference(YAML_SERVICE);
            this._yamlService = ref ? this._context.getService(ref) : null;
        }

        // --- 4. IDEMPOTENT SHELL RENDERING ---
        if (!this._initialized) {
            this.innerHTML = `
                <atomic-master-detail sidebar-title="Flow Structure" class="h-[750px] shadow-2xl">
                    <!-- Sidebar Actions (Add Step) -->
                    <div slot="sidebar-actions">
                        <sl-button size="small" circle variant="neutral" id="add-step-btn" title="Add Step">
                            <i class="fas fa-plus"></i>
                        </sl-button>
                    </div>

                    <!-- Sidebar Content (Steps List) -->
                    <div id="steps-list" class="space-y-2" slot="sidebar-content"></div>

                    <!-- Header Context (Flow Info) -->
                    <div slot="header-context" class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                            <i class="fas fa-project-diagram text-xs"></i>
                        </div>
                        <div>
                            <h2 class="text-sm font-black text-slate-800 m-0 uppercase tracking-tight">${this._draftSpec.label || 'Untitled Flow'}</h2>
                            <p class="text-[9px] font-bold text-slate-400 m-0 font-mono italic opacity-60">${this._draftSpec.id}</p>
                        </div>
                    </div>

                    <!-- Header Actions (YAML Source) -->
                    <div slot="header-actions">
                        <sl-button size="small" variant="neutral" id="view-source-btn" class="font-black text-[10px] uppercase tracking-widest">
                            <i class="fas fa-code mr-2"></i> Source
                        </sl-button>
                    </div>

                    <!-- Main Content (Dual Pane) -->
                    <div id="builder-container" class="grid grid-cols-12 gap-8 h-full overflow-hidden" slot="main-content">
                        <!-- 1. Left: Property Editor -->
                        <div class="col-span-12 xl:col-span-5 flex flex-col space-y-4 overflow-hidden">
                            <div id="property-panel" class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex-1 overflow-y-auto hidden animate-in fade-in slide-in-from-bottom-2 custom-scroll">
                               <header class="flex justify-between items-center mb-6 border-b border-dashed border-gray-100 pb-4">
                                    <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400">Step Properties</h3>
                                    <div id="step-id-badge" class="px-2 py-0.5 rounded bg-slate-100 text-[9px] font-mono text-slate-400"></div>
                               </header>
                               <div id="prop-fields" class="space-y-6"></div>
                            </div>
                            
                            <!-- Placeholder when no step selected -->
                            <div id="no-selection-placeholder" class="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40">
                                <i class="fas fa-hand-pointer text-4xl"></i>
                                <p class="text-[10px] font-black uppercase tracking-widest">Select a step to begin editing</p>
                            </div>
                        </div>

                        <!-- 2. Right: Live Preview -->
                        <div class="col-span-12 xl:col-span-7 flex flex-col space-y-4 overflow-hidden">
                            <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl flex-1 flex flex-col overflow-hidden relative group/preview">
                                <header class="bg-gray-50/50 border-b border-gray-100 p-4 flex justify-between items-center px-6">
                                    <div class="flex items-center space-x-2">
                                        <div class="w-2.5 h-2.5 rounded-full bg-red-400/80 shadow-sm"></div>
                                        <div class="w-2.5 h-2.5 rounded-full bg-amber-400/80 shadow-sm"></div>
                                        <div class="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shadow-sm"></div>
                                    </div>
                                    <span class="text-[9px] font-black uppercase tracking-[0.2em] text-gray-300">Live Preview</span>
                                    <div class="w-12"></div>
                                </header>
                                <div id="preview-container" class="flex-1 overflow-y-auto p-10 scroll-smooth bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"></div>
                           </div>
                        </div>
                    </div>
                </atomic-master-detail>
            `;
            this._initialized = true;
        }

        // --- 5. INITIAL SELECTION ---
        if (!this._activeStepId && this._draftSpec.ui?.steps) {
            const sids = Object.keys(this._draftSpec.ui.steps);
            if (sids.length > 0) {
                this._activeStepId = this._draftSpec.ui.initialStep || sids[0];
                // Use a small delay to ensure Master-Detail is inflated and ready for querySelection
                setTimeout(() => this.editStep(this._activeStepId), 100);
            }
        }

        this.setupVisualEditor();
        this.updatePreview();
    }

    setupVisualEditor() {
        const list = this.querySelector('#steps-list');
        if (!list) return;

        list.innerHTML = "";

        const steps = this._draftSpec.ui?.steps || {};
        const sids = Object.keys(steps);

        sids.forEach((sid, idx) => {
            const step = steps[sid];
            const btn = document.createElement('div');
            btn.className = `p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${this._activeStepId === sid ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-gray-50 hover:bg-white border-gray-100'}`;
            btn.innerHTML = `
                <div class="flex-1">
                    <div class="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">${sid}</div>
                    <div class="text-xs font-bold ${this._activeStepId === sid ? 'text-indigo-700' : 'text-gray-600'}">${step.title || 'Untitled'}</div>
                </div>
                <div class="flex items-center gap-1">
                    <div class="flex flex-col gap-0.5 mr-2">
                        <sl-button size="extra-small" variant="neutral" class="reorder-up" circle ${idx === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up text-[8px]"></i></sl-button>
                        <sl-button size="extra-small" variant="neutral" class="reorder-down" circle ${idx === sids.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down text-[8px]"></i></sl-button>
                    </div>
                    <sl-button size="extra-small" variant="text" class="delete-step text-red-500 hover:text-red-700 mr-2" circle title="Delete Step">
                        <i class="fas fa-trash text-[10px]"></i>
                    </sl-button>
                    <i class="fas fa-chevron-right text-[10px] ${this._activeStepId === sid ? 'text-indigo-400' : 'text-gray-300'}"></i>
                </div>
            `;
            
            btn.onclick = (e) => {
                if (e.target.closest('sl-button')) return;
                this._activeStepId = sid;
                this.setupVisualEditor();
                this.editStep(sid);
                this.updatePreview();
            };

            btn.querySelector('.reorder-up').onclick = (e) => {
                e.stopPropagation();
                this.moveStep(sid, -1);
            };
            btn.querySelector('.reorder-down').onclick = (e) => {
                e.stopPropagation();
                this.moveStep(sid, 1);
            };

            const delBtn = btn.querySelector('.delete-step');
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteStep(sid);
                };
            }

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

        // View Source Button
        const viewSourceBtn = this.querySelector('#view-source-btn');
        if (viewSourceBtn) {
            viewSourceBtn.onclick = () => this.openYamlEditor();
        }
    }

    openYamlEditor() {
        // Corrected service ID from shared-types.js
        const yamlEditorRef = this._context.getServiceReference("prototyper.backoffice.yaml.editor");
        const yamlEditorSvc = yamlEditorRef ? this._context.getService(yamlEditorRef) : null;

        if (yamlEditorSvc) {
            yamlEditorSvc.edit({
                title: `Edit Blueprint: ${this._draftSpec.id}`,
                data: this._draftSpec,
                onSave: (updated) => {
                    this._draftSpec = updated;
                    this.saveToState();
                    this.setupVisualEditor();
                    if (this._activeStepId) this.editStep(this._activeStepId);
                    this.updatePreview();
                }
            });
        } else {
            alert("YAML Editor Service not found.");
        }
    }

    deleteStep(sid) {
        if (Object.keys(this._draftSpec.ui.steps).length <= 1) {
            alert("Cannot delete the last remaining step.");
            return;
        }

        if (confirm(`Are you sure you want to delete step '${sid}'?`)) {
            delete this._draftSpec.ui.steps[sid];
            
            // If we deleted the active step, select another one
            if (this._activeStepId === sid) {
                this._activeStepId = Object.keys(this._draftSpec.ui.steps)[0];
            }
            
            this.saveToState();
            this.setupVisualEditor();
            if (this._activeStepId) this.editStep(this._activeStepId);
            this.updatePreview();
        }
    }

    moveStep(sid, offset) {
        this._draftSpec.ui.steps = this.reorderKeys(this._draftSpec.ui.steps, sid, offset);
        this.saveToState();
        this.setupVisualEditor();
        this.updatePreview();
    }

    reorderKeys(obj, key, offset) {
        const keys = Object.keys(obj);
        const index = keys.indexOf(key);
        const newIdx = index + offset;
        if (newIdx < 0 || newIdx >= keys.length) return obj;
        
        keys.splice(index, 1);
        keys.splice(newIdx, 0, key);
        
        const newObj = {};
        keys.forEach(k => { newObj[k] = obj[k]; });
        return newObj;
    }

    editStep(sid) {
        const step = this._draftSpec.ui.steps[sid];
        const panel = this.querySelector('#property-panel');
        const fields = this.querySelector('#prop-fields');
        const placeholder = this.querySelector('#no-selection-placeholder');
        
        // Update Step ID Badge
        const badge = this.querySelector('#step-id-badge');
        if (badge) badge.textContent = sid;

        // Toggle visibility
        if (panel) panel.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        
        const _currentId = fields.getAttribute('data-active-sid');
        
        if (_currentId !== sid || fields.innerHTML === "") {
            fields.setAttribute('data-active-sid', sid);
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

        const pids = Object.keys(step.parts || {});

        partsList.innerHTML = pids.map((pid, idx) => {
            const part = step.parts[pid];
            return `
                <div class="flex justify-between items-center p-2 rounded-lg text-[10px] font-mono border cursor-pointer transition-all ${this._activePartId === pid ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-gray-50 border-gray-100 text-gray-400'}"
                     data-part-id="${pid}">
                    <div class="flex items-center">
                        <i class="fas ${part.type ? 'fa-square' : 'fa-puzzle-piece'} mr-2 opacity-50"></i>
                        <span>${pid}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <sl-button size="extra-small" variant="neutral" class="part-up" circle outline ${idx === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up text-[7px]"></i></sl-button>
                        <sl-button size="extra-small" variant="neutral" class="part-down" circle outline ${idx === pids.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down text-[7px]"></i></sl-button>
                    </div>
                </div>
            `;
        }).join('');

        partsList.querySelectorAll('[data-part-id]').forEach(el => {
            const pid = el.getAttribute('data-part-id');
            el.onclick = (e) => {
                if (e.target.closest('sl-button')) return;
                this._activePartId = pid;
                this.editStep(sid);
            };

            el.querySelector('.part-up').onclick = (e) => {
                e.stopPropagation();
                this.movePart(sid, pid, -1);
            };
            el.querySelector('.part-down').onclick = (e) => {
                e.stopPropagation();
                this.movePart(sid, pid, 1);
            };
        });
    }

    movePart(sid, pid, offset) {
        const step = this._draftSpec.ui.steps[sid];
        step.parts = this.reorderKeys(step.parts, pid, offset);
        this.saveToState();
        this.updatePreview();
        this.editStep(sid);
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
            const standardActions = [
                { id: 'NEXT_STEP', label: '🚶 Next Step', group: 'Navigation' },
                { id: 'PREV_STEP', label: '🔙 Previous Step', group: 'Navigation' },
                { id: 'step.navigate', label: '🚀 Jump to Step...', group: 'Navigation' },
                { id: 'default', label: '⚡ Trigger Default Action', group: 'Logic' },
                { id: 'synthetic.case.create', label: '📁 Create Case', group: 'Side Effects' },
                { id: 'synthetic.client.summary-alert', label: '🔔 Show Alert', group: 'Side Effects' },
                { id: 'apiService', label: '🧩 Call API Service', group: 'Side Effects' }
            ];

            const currentCall = part.action?.call || '';
            const isCustom = currentCall && !standardActions.some(a => a.id === currentCall);

            html += `
                <sl-input label="Label" value="${part.label || ''}" id="part-label-input" size="small"></sl-input>
                
                <sl-select label="Action Call" value="${isCustom ? 'CUSTOM' : currentCall}" id="part-call-select" size="small" help-text="Select a standard action or enter custom.">
                    <sl-menu-label>Navigation</sl-menu-label>
                    <sl-option value="NEXT_STEP">🚶 Next Step</sl-option>
                    <sl-option value="PREV_STEP">🔙 Previous Step</sl-option>
                    <sl-option value="step.navigate">🚀 Jump to Step...</sl-option>
                    
                    <sl-menu-label>Logic</sl-menu-label>
                    <sl-option value="default">⚡ Trigger Default Action</sl-option>
                    <sl-option value="synthetic.case.create">📁 Create Case</sl-option>
                    <sl-option value="synthetic.client.summary-alert">🔔 Show Alert</sl-option>
                    <sl-option value="apiService">🧩 Call API Service</sl-option>

                    <sl-divider></sl-divider>
                    <sl-option value="CUSTOM">🛠️ Custom Action ID...</sl-option>
                </sl-select>

                <div id="custom-action-container" class="${isCustom ? '' : 'hidden'} mt-1">
                    <sl-input placeholder="Enter Action ID (e.g. myService.do)" value="${isCustom ? currentCall : ''}" id="part-call-input-custom" size="small"></sl-input>
                </div>

                <sl-select label="Variant" value="${part.variant || 'default'}" id="part-variant-input" size="small">
                    <sl-option value="default">Default</sl-option>
                    <sl-option value="primary">Primary</sl-option>
                    <sl-option value="success">Success</sl-option>
                    <sl-option value="danger">Danger</sl-option>
                </sl-select>
                <div class="mt-2 space-y-2">
                    <div class="flex justify-between items-center">
                        <label class="text-[10px] font-bold uppercase text-gray-400">Parameters</label>
                        <sl-button size="extra-small" variant="neutral" id="add-param-btn" outline circle><i class="fas fa-plus"></i></sl-button>
                    </div>
                    <div id="params-list" class="space-y-2"></div>
                </div>
            `;
        }

        partFields.innerHTML = html;

        // Render Parameters if it's a command button
        if (part.kind === 'command-button') {
            const paramsList = partFields.querySelector('#params-list');
            const addParamBtn = partFields.querySelector('#add-param-btn');
            const params = part.action?.params || {};
            if (!part.action) part.action = { call: '' };
            if (!part.action.params) part.action.params = params;

            const renderParams = () => {
                const sids = Object.keys(this._draftSpec.ui?.steps || {});

                paramsList.innerHTML = Object.entries(part.action.params).map(([pk, pv]) => {
                    const isNavTarget = (pk === 'target' || pk === 'step') && part.action.call === 'step.navigate';
                    
                    let valInput = `<sl-input value="${pv}" class="param-val flex-1" size="small" placeholder="Value"></sl-input>`;
                    if (isNavTarget) {
                        valInput = `
                            <sl-select value="${pv}" class="param-val flex-1" size="small" placeholder="Select Step">
                                ${sids.map(sid => `<sl-option value="${sid}">${sid}</sl-option>`).join('')}
                            </sl-select>
                        `;
                    }

                    return `
                        <div class="flex gap-1 items-center bg-gray-50 p-1 rounded-lg border border-gray-100">
                            <sl-input value="${pk}" class="param-key w-24" size="small" placeholder="Key" data-old-key="${pk}"></sl-input>
                            ${valInput}
                            <sl-button size="extra-small" variant="danger" class="del-param-btn" circle outline data-key="${pk}"><i class="fas fa-times text-[8px]"></i></sl-button>
                        </div>
                    `;
                }).join('');

                paramsList.querySelectorAll('.param-key').forEach(el => {
                    el.addEventListener('sl-change', (e) => {
                        const oldKey = el.getAttribute('data-old-key');
                        const newKey = e.target.value;
                        if (newKey && newKey !== oldKey) {
                            part.action.params[newKey] = part.action.params[oldKey];
                            delete part.action.params[oldKey];
                            this.saveToState();
                            this.setupVisualEditor();
                            renderParams();
                        }
                    });
                });

                paramsList.querySelectorAll('.param-val').forEach(el => {
                    const update = (e) => {
                        const key = el.closest('div').querySelector('.param-key').value;
                        part.action.params[key] = e.target.value;
                        this.saveToState();
                        this.updatePreview();
                        this.setupVisualEditor();
                    };
                    el.addEventListener('sl-input', update);
                    el.addEventListener('sl-change', update);
                });

                paramsList.querySelectorAll('.del-param-btn').forEach(el => {
                    el.onclick = () => {
                        delete part.action.params[el.getAttribute('data-key')];
                        this.saveToState();
                        this.updatePreview();
                        this.setupVisualEditor();
                        renderParams();
                    };
                });
            };

            addParamBtn.onclick = () => {
                const newKey = `param_${Object.keys(part.action.params).length + 1}`;
                part.action.params[newKey] = "";
                this.saveToState();
                renderParams();
            };

            renderParams();
        }

        // Specialized binding for Action Call Discovery
        if (part.kind === 'command-button') {
            const callSelect = partFields.querySelector('#part-call-select');
            const customContainer = partFields.querySelector('#custom-action-container');
            const customInput = partFields.querySelector('#part-call-input-custom');

            if (callSelect) {
                callSelect.addEventListener('sl-change', (e) => {
                    const val = e.target.value;
                    if (val === 'CUSTOM') {
                        customContainer.classList.remove('hidden');
                        part.action.call = customInput.value;
                    } else {
                        customContainer.classList.add('hidden');
                        part.action.call = val;
                    }
                    this.saveToState();
                    this.updatePreview();
                    this.setupVisualEditor();
                    // Re-render to update parameter picker (e.g. if we switched to step.navigate)
                    this.renderPartProperties(sid, step);
                });
            }

            if (customInput) {
                customInput.addEventListener('sl-input', (e) => {
                    part.action.call = e.target.value;
                    this.saveToState();
                    this.updatePreview();
                    this.setupVisualEditor();
                });
            }
        }

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
        // Debounce shell updates to avoid heavy re-renders of the editor itself
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this.dispatchEvent(new CustomEvent('atomic-change', {
                bubbles: true,
                composed: true,
                detail: { 
                    id: 'draft_spec', 
                    value: this._draftSpec 
                }
            }));
        }, 500); // 500ms for shell sync
    }

    updatePreview() {
        // Debounce preview updates (very expensive)
        if (this._previewTimer) clearTimeout(this._previewTimer);
        this._previewTimer = setTimeout(() => {
            const container = this.querySelector('#preview-container');
            if (!container) return; 

            const factoryRef = this._context.getServiceReference("prototyper.ui.factory");
            const factory = factoryRef ? this._context.getService(factoryRef) : null;
            
            if (factory) {
                const previewSpec = JSON.parse(JSON.stringify(this._draftSpec));
                if (this._activeStepId) {
                    if (!previewSpec.ui) previewSpec.ui = {};
                    previewSpec.ui.initialStep = this._activeStepId;
                }
                
                if (!this._previewEl) {
                    container.innerHTML = "";
                    this._previewEl = factory.create(previewSpec, {});
                    container.appendChild(this._previewEl);
                } else {
                    if (!container.contains(this._previewEl)) {
                        container.innerHTML = "";
                        container.appendChild(this._previewEl);
                    }
                    if (this._previewEl.render) {
                        this._previewEl.render(previewSpec);
                    }
                }
            }
        }, 300); // 300ms for live preview refresh
    }
}

if (!customElements.get("atomic-visual-editor")) {
    customElements.define("atomic-visual-editor", AtomicVisualEditor);
}
