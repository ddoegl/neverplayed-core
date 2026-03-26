import { AtomicComponentBase } from "../../../system-services/shared-ui-components/components/atomic-component-base.js";
import { YAML_SERVICE, YAML_EDITOR_SERVICE, UI_FACTORY_SERVICE, ACTION_REGISTRY_SERVICE, ATOMIC_SPEC_INGESTION_SERVICE } from "shared-types";

/**
 * atomic-visual-editor: The core WYSIWYG builder for Atomic Flows.
 * Kind: visual-editor
 */
const PART_TEMPLATES = {
    'text': { type: 'text', label: 'Text Block', value: '## New Text\nAdd your content here.' },
    'text-input': { kind: 'text-input', label: 'Text Input', placeholder: 'Enter value...' },
    'select-input': { kind: 'select-input', label: 'Select Input', options: [{label: 'Option 1', value: '1'}] },
    'checkbox-input': { kind: 'checkbox-input', label: 'Checkbox Label', id: 'check_1' },
    'radio-input': { kind: 'radio-input', label: 'Radio Group', id: 'radio_1', options: [{label: 'Option 1', value: '1'}, {label: 'Option 2', value: '2'}] },
    'command-button': { kind: 'command-button', label: 'Action Button', variant: 'primary', action: { call: 'NEXT_STEP' } },
    'row': { type: 'row', label: 'Button Row', parts: {} },
    'card': { type: 'card', label: 'Card', variant: 'plain', parts: {} }
};

/**
 * atomic-visual-editor: The core WYSIWYG builder for Atomic Flows.
 */
export default class AtomicVisualEditor extends AtomicComponentBase {
    hydrate(spec, context, interpolator, resolver) {
        console.log(`Visual Editor: Hydrating with context [${context ? 'OK' : 'MISSING'}]`);
        super.hydrate(spec, context, interpolator, resolver);
        
        // Ensure ActionRegistry is tracked for live updates in the editor
        if (this._context) {
            this._registry = null;
            this._context.trackService(`(objectClass=${ACTION_REGISTRY_SERVICE})`, {
                addingService: (ref) => { 
                    this._registry = this._context.getService(ref);
                    // Re-render if property panel is open
                    if (this._activePartId) this.editPart(this._activeStepId, this._activePartId);
                },
                removedService: () => { this._registry = null; }
            }).open();
        }

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
           
           // Use centralized constants
           const ingestionRef = this._context.getServiceReference(ATOMIC_SPEC_INGESTION_SERVICE);
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
        const yamlEditorRef = this._context.getServiceReference(YAML_EDITOR_SERVICE);
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
                                <sl-menu-item value="checkbox-input"><i class="fas fa-check-square mr-2 text-blue-400"></i> Checkbox</sl-menu-item>
                                <sl-menu-item value="radio-input"><i class="fas fa-dot-circle mr-2 text-orange-400"></i> Radio Group</sl-menu-item>
                                <sl-menu-item value="command-button"><i class="fas fa-toggle-on mr-2 text-pink-500"></i> Action Button</sl-menu-item>
                                <sl-divider></sl-divider>
                                <sl-menu-item value="row"><i class="fas fa-columns mr-2 text-gray-500"></i> Button Row</sl-menu-item>
                                <sl-menu-item value="card"><i class="fas fa-window-maximize mr-2 text-amber-500"></i> Semantic Card</sl-menu-item>
                            </sl-menu>
                        </sl-dropdown>
                    </div>
                    <div id="parts-list" class="space-y-1"></div>
                </div>

                <div id="part-properties" class="mt-4 pt-4 border-t border-gray-100 hidden">
                    <div id="breadcrumb-container"></div>
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
            const isActive = this._activePartId === pid || (this._activePartId && this._activePartId.startsWith(pid + '.'));
            return `
                <div class="flex justify-between items-center p-2 rounded-lg text-[10px] font-mono border cursor-pointer transition-all ${isActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-gray-50 border-gray-100 text-gray-400'}"
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
        
        const rootPid = (this._activePartId || "").split('.')[0];
        if (!this._activePartId || !step.parts[rootPid]) {
            partPanel.classList.add('hidden');
            return;
        }

        const path = this._activePartId || "";
        const pathParts = path.split('.');
        
        let part = { parts: step.parts };
        for (const p of pathParts) {
            if (!part.parts || !part.parts[p]) {
                this._activePartId = null; // Reset if invalid
                partPanel.classList.add('hidden');
                return;
            }
            part = part.parts[p];
        }

        partPanel.classList.remove('hidden');

        // Breadcrumbs
        let breadcrumbs = `<div class="flex items-center gap-1 mb-2 text-[8px] font-bold uppercase text-gray-400">
            <span class="hover:text-indigo-500 cursor-pointer" id="bc-root">Step</span> <i class="fas fa-chevron-right text-[6px]"></i>`;
        
        let currentPath = "";
        pathParts.forEach((p, idx) => {
            currentPath += (currentPath ? "." : "") + p;
            const isLast = idx === pathParts.length - 1;
            breadcrumbs += `
                <span class="${isLast ? 'text-indigo-500' : 'hover:text-indigo-400 cursor-pointer'} bc-node" data-path="${currentPath}">${p}</span>
                ${isLast ? '' : '<i class="fas fa-chevron-right text-[6px]"></i>'}
            `;
        });
        breadcrumbs += `</div>`;

        const bcContainer = this.querySelector('#breadcrumb-container');
        if (bcContainer) bcContainer.innerHTML = breadcrumbs;

        // Render fields based on type/kind
        let html = `
            <sl-input label="Part ID" value="${pathParts[pathParts.length-1]}" id="part-id-input" size="small"></sl-input>
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
                <sl-input label="Dynamic Source" value="${part.optionSource || ''}" id="part-source-input" size="small" help-text="e.g. \${this.items}"></sl-input>
                <div class="flex gap-1 mt-1 flex-wrap">
                    <sl-button size="extra-small" variant="neutral" outline class="quick-bind-btn" data-val="\${this.authorizations}">Auths</sl-button>
                    <sl-button size="extra-small" variant="neutral" outline class="quick-bind-btn" data-val="\${this.users}">Users</sl-button>
                    <sl-button size="extra-small" variant="neutral" outline class="quick-bind-btn" data-val="\${this.companies}">Companies</sl-button>
                </div>

                <div class="mt-4 space-y-2">
                    <div class="flex justify-between items-center">
                        <label class="text-[10px] font-bold uppercase text-gray-400">Static Header/Options</label>
                        <sl-button size="extra-small" variant="neutral" id="add-select-opt-btn" outline circle><i class="fas fa-plus"></i></sl-button>
                    </div>
                    <div id="select-opts-list" class="space-y-2"></div>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-100">
                    <label class="text-[10px] font-bold uppercase text-indigo-500 mb-2 block">Action on Change</label>
                    ${this.renderActionProperties(part)}
                </div>
            `;
        } else if (part.kind === 'checkbox-input') {
            html += `
                <sl-input label="Label" value="${part.label || ''}" id="part-label-input" size="small"></sl-input>
            `;
        } else if (part.kind === 'radio-input') {
            html += `
                <sl-input label="Label" value="${part.label || ''}" id="part-label-input" size="small"></sl-input>
                <div class="mt-2 space-y-2">
                    <div class="flex justify-between items-center">
                        <label class="text-[10px] font-bold uppercase text-gray-400">Options</label>
                        <sl-button size="extra-small" variant="neutral" id="add-radio-opt-btn" outline circle><i class="fas fa-plus"></i></sl-button>
                    </div>
                    <div id="radio-opts-list" class="space-y-2"></div>
                </div>
            `;
        } else if (part.type === 'card') {
            html += `
                <sl-input label="Label" value="${part.label || ''}" id="part-label-input" size="small"></sl-input>
                <sl-select label="Variant" value="${part.variant || 'plain'}" id="part-variant-input" size="small">
                    <sl-option value="plain">Plain (White)</sl-option>
                    <sl-option value="info">Info (Blue)</sl-option>
                    <sl-option value="success">Success (Green)</sl-option>
                    <sl-option value="warning">Warning (Amber)</sl-option>
                    <sl-option value="error">Error (Red)</sl-option>
                </sl-select>
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

        // Common Nested Parts Block for structural components
        if (part.parts) {
            html += `
                <div class="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <div class="flex justify-between items-center">
                        <label class="text-[10px] font-bold uppercase text-indigo-500">Nested Parts</label>
                        <sl-dropdown id="add-nested-part-dropdown" placement="bottom-end">
                            <sl-button slot="trigger" size="extra-small" caret variant="neutral" outline>
                                <i class="fas fa-plus mr-1"></i> Add
                            </sl-button>
                            <sl-menu id="add-nested-part-menu">
                                <sl-menu-item value="text">Text Block</sl-menu-item>
                                <sl-menu-item value="text-input">Text Input</sl-menu-item>
                                <sl-menu-item value="command-button">Action Button</sl-menu-item>
                                <sl-menu-item value="checkbox-input">Checkbox</sl-menu-item>
                                <sl-menu-item value="radio-input">Radio Group</sl-menu-item>
                                <sl-divider></sl-divider>
                                <sl-menu-item value="row">Button Row</sl-menu-item>
                                <sl-menu-item value="card">Semantic Card</sl-menu-item>
                            </sl-menu>
                        </sl-dropdown>
                    </div>
                    <div id="nested-parts-list" class="space-y-1"></div>
                </div>
            `;
        }

        partFields.innerHTML = html;


        // Bind Breadcrumbs
        const bcRoot = partFields.parentElement.querySelector('#bc-root');
        if (bcRoot) bcRoot.onclick = () => { this._activePartId = null; this.editStep(sid); };
        partFields.parentElement.querySelectorAll('.bc-node').forEach(node => {
            node.onclick = () => { this._activePartId = node.dataset.path; this.editStep(sid); };
        });

        // Logic for Nested Parts List
        if (part.parts) {
            const nestedList = partFields.querySelector('#nested-parts-list');
            const addMenu = partFields.querySelector('#add-nested-part-menu');

            const renderNested = () => {
                const subPids = Object.keys(part.parts);
                nestedList.innerHTML = subPids.length ? subPids.map((subId, idx) => {
                    const subPart = part.parts[subId];
                    return `
                        <div class="flex justify-between items-center p-1 px-2 rounded bg-indigo-50/30 border border-indigo-100/50 text-[9px] font-mono group cursor-pointer hover:bg-indigo-100/50 transition-all" data-sub-id="${subId}">
                            <div class="flex items-center gap-1 overflow-hidden truncate pointer-events-none">
                                <i class="fas ${subPart.type ? 'fa-square' : 'fa-puzzle-piece'} opacity-30"></i>
                                <span class="truncate font-bold text-indigo-700/70">${subId}</span>
                                <span class="text-gray-300">(${subPart.kind || subPart.type})</span>
                            </div>
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <sl-button size="extra-small" variant="neutral" class="nested-up" circle outline data-id="${subId}" ${idx === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up text-[6px]"></i></sl-button>
                                <sl-button size="extra-small" variant="neutral" class="nested-down" circle outline data-id="${subId}" ${idx === subPids.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down text-[6px]"></i></sl-button>
                                <sl-button size="extra-small" variant="danger" class="nested-del" circle outline data-id="${subId}"><i class="fas fa-times text-[6px]"></i></sl-button>
                            </div>
                        </div>
                    `;
                }).join('') : `<div class="text-[9px] text-gray-300 italic p-2 text-center border border-dashed rounded">Empty. Add parts below.</div>`;

                nestedList.querySelectorAll('[data-sub-id]').forEach(el => {
                    el.onclick = (e) => {
                        if (e.target.closest('sl-button')) return;
                        this._activePartId = (this._activePartId ? this._activePartId + "." : "") + el.dataset.subId;
                        this.editStep(sid);
                    };
                });

                nestedList.querySelectorAll('.nested-up').forEach(btn => btn.onclick = (e) => {
                   e.stopPropagation();
                   part.parts = this.reorderKeys(part.parts, btn.dataset.id, -1);
                   this.saveToState(); this.updatePreview(); renderNested();
                });
                nestedList.querySelectorAll('.nested-down').forEach(btn => btn.onclick = (e) => {
                   e.stopPropagation();
                   part.parts = this.reorderKeys(part.parts, btn.dataset.id, 1);
                   this.saveToState(); this.updatePreview(); renderNested();
                });
                nestedList.querySelectorAll('.nested-del').forEach(btn => btn.onclick = (e) => {
                   e.stopPropagation();
                   if (confirm(`Delete nested part ${btn.dataset.id}?`)) {
                       delete part.parts[btn.dataset.id];
                       this.saveToState(); this.updatePreview(); renderNested();
                   }
                });
            };

            addMenu.addEventListener('sl-select', (e) => {
                const type = e.detail.item.value;
                const template = PART_TEMPLATES[type];
                const baseId = type.replace('-', '_');
                let idCount = 1;
                let subId = `${baseId}_${idCount}`;
                while (part.parts[subId]) { idCount++; subId = `${baseId}_${idCount}`; }
                
                part.parts[subId] = JSON.parse(JSON.stringify(template));
                this.saveToState(); this.updatePreview(); renderNested();
            });

            renderNested();
        }

        if (part.kind === 'select-input') {
            const sourceInput = partFields.querySelector('#part-source-input');
            const quickBtns = partFields.querySelectorAll('.quick-bind-btn');
            
            if (sourceInput) {
                sourceInput.addEventListener('sl-input', (e) => {
                    part.optionSource = e.target.value;
                    this.saveToState();
                    this.updatePreview();
                });
            }

            quickBtns.forEach(btn => {
                btn.onclick = () => {
                    part.optionSource = btn.dataset.val;
                    if (sourceInput) sourceInput.value = part.optionSource;
                    this.saveToState();
                    this.updatePreview();
                };
            });

            const optsList = partFields.querySelector('#select-opts-list');
            const addOptBtn = partFields.querySelector('#add-select-opt-btn');
            
            const renderOpts = () => {
                if (!part.options) part.options = [];
                optsList.innerHTML = part.options.map((opt, idx) => {
                    const isEditingAction = this._editingOptIdx === idx;
                    return `
                        <div class="space-y-1 bg-indigo-50/50 p-1 rounded-lg border border-indigo-100 mb-2">
                            <div class="flex gap-1 items-center">
                                <sl-input value="${opt.label}" class="opt-label flex-1" size="small" placeholder="Label" data-idx="${idx}"></sl-input>
                                <sl-input value="${opt.value}" class="opt-val w-16" size="small" placeholder="Val" data-idx="${idx}"></sl-input>
                                <sl-button size="extra-small" variant="${opt.action?.call ? 'primary' : 'neutral'}" class="opt-action-btn" outline circle data-idx="${idx}"><i class="fas fa-bolt"></i></sl-button>
                                <sl-button size="extra-small" variant="neutral" class="del-opt-btn" outline circle data-idx="${idx}"><i class="fas fa-times"></i></sl-button>
                            </div>
                            <div class="opt-action-panel ${isEditingAction ? '' : 'hidden'} mt-2 pt-2 border-t border-indigo-200/50">
                                <label class="text-[9px] font-bold uppercase text-indigo-400 mb-1 block">Option Action</label>
                                ${isEditingAction ? this.renderActionProperties(opt, `opt-${idx}`) : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                optsList.querySelectorAll('.opt-label').forEach(el => {
                    el.addEventListener('sl-input', (e) => {
                        part.options[el.dataset.idx].label = e.target.value;
                        this.saveToState();
                        this.updatePreview();
                    });
                });
                optsList.querySelectorAll('.opt-val').forEach(el => {
                    el.addEventListener('sl-input', (e) => {
                        part.options[el.dataset.idx].value = e.target.value;
                        this.saveToState();
                        this.updatePreview();
                    });
                });
                optsList.querySelectorAll('.opt-action-btn').forEach(el => {
                    el.onclick = () => {
                        const idx = parseInt(el.dataset.idx);
                        this._editingOptIdx = (this._editingOptIdx === idx) ? null : idx;
                        renderOpts();
                    };
                });
                optsList.querySelectorAll('.del-opt-btn').forEach(el => {
                    el.onclick = () => {
                        part.options.splice(el.dataset.idx, 1);
                        this.saveToState();
                        this.updatePreview();
                        renderOpts();
                    };
                });

                if (this._editingOptIdx !== null && part.options[this._editingOptIdx]) {
                    this.bindActionProperties(part.options[this._editingOptIdx], optsList, `opt-${this._editingOptIdx}`);
                }
            };

            if (addOptBtn) {
                addOptBtn.onclick = () => {
                    if (!part.options) part.options = [];
                    part.options.push({ label: `Option ${part.options.length + 1}`, value: `${part.options.length + 1}` });
                    this.saveToState();
                    renderOpts();
                };
            }
            renderOpts();
            this.bindActionProperties(part, partFields);
        }

        if (part.kind === 'command-button') {
            const variantInput = partFields.querySelector('#part-variant-input');
            if (variantInput) {
                variantInput.addEventListener('sl-change', (e) => {
                    part.variant = e.target.value;
                    this.saveToState();
                    this.updatePreview();
                });
            }
            this.bindActionProperties(part, partFields);
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
            if (el.tagName === 'SL-SELECT' || el.tagName === 'SL-CHECKBOX' || el.tagName === 'SL-RADIO-GROUP') {
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

        // ID Change (Special handling for nested paths)
        const idInput = partFields.querySelector('#part-id-input');
        idInput.addEventListener('sl-change', (e) => {
            const newPid = e.target.value;
            const oldPid = pathParts[pathParts.length - 1];
            if (newPid && newPid !== oldPid) {
                // Find parent container
                let parent = step;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    parent = parent.parts[pathParts[i]];
                }
                
                parent.parts[newPid] = parent.parts[oldPid];
                delete parent.parts[oldPid];
                
                // Update active path
                pathParts[pathParts.length - 1] = newPid;
                this._activePartId = pathParts.join('.');
                
                this.saveToState();
                this.updatePreview();
                this.setupVisualEditor();
                this.editStep(sid);
            }
        });

        // Delete handling (Special handling for nested paths)
        deleteBtn.onclick = () => {
            if (confirm(`Delete part ${pathParts[pathParts.length - 1]}?`)) {
                let parent = step;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    parent = parent.parts[pathParts[i]];
                }
                delete parent.parts[pathParts[pathParts.length - 1]];
                
                // Go back to parent or step
                pathParts.pop();
                this._activePartId = pathParts.length ? pathParts.join('.') : null;
                
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

            const factoryRef = this._context.getServiceReference(UI_FACTORY_SERVICE);
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

    renderActionProperties(target, prefix = 'part') {
        const builtInActions = [
            { id: 'NEXT_STEP', label: '🚶 Next Step', group: 'Navigation' },
            { id: 'PREV_STEP', label: '🔙 Previous Step', group: 'Navigation' }
        ];

        // Fetch actions from Registry
        const registeredActions = this._registry ? this._registry.getActions() : [];
        const allActions = [...builtInActions, ...registeredActions];

        const currentCall = target.action?.call || '';
        const isCustom = currentCall && !allActions.some(a => a.id === currentCall);
        const selectedAction = allActions.find(a => a.id === currentCall);

        // Group actions
        const groups = {
            'Navigation': allActions.filter(a => a.group === 'Navigation' || a.id.includes('step.navigate') || a.id.includes('STEP')),
            'Side Effects': allActions.filter(a => !a.group && (a.id.includes('synthetic') || a.id.includes('Service') || a.id.includes('case'))),
            'Other': allActions.filter(a => !a.group && !a.id.includes('synthetic') && !a.id.includes('Service') && !a.id.includes('STEP') && !a.id.includes('navigate'))
        };

        const renderOptions = () => {
            let html = '';
            for (const [group, actions] of Object.entries(groups)) {
                if (actions.length === 0) continue;
                html += `<sl-menu-label>${group}</sl-menu-label>`;
                actions.forEach(a => {
                    html += `<sl-option value="${a.id}">${a.label || a.id}</sl-option>`;
                });
            }
            return html;
        };

        const renderDocs = () => {
            if (!selectedAction || !selectedAction.description) return '';
            
            let paramList = '';
            if (selectedAction.params) {
                paramList = `
                    <div class="mt-2 space-y-1">
                        <div class="text-[9px] font-black uppercase text-slate-400 opacity-70">Expected Parameters:</div>
                        ${Object.entries(selectedAction.params).map(([k, v]) => `
                            <div class="flex gap-2 text-[10px]">
                                <span class="text-indigo-400 font-mono font-bold">${k}:</span>
                                <span class="text-slate-500 italic">${v}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            return `
                <div class="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 animate-in fade-in slide-in-from-top-1">
                    <div class="text-[10px] text-indigo-700 leading-relaxed font-medium">${selectedAction.description}</div>
                    ${paramList}
                </div>
            `;
        };

        return `
            <sl-select label="Action Call" value="${isCustom ? 'CUSTOM' : currentCall}" id="${prefix}-call-select" size="small" help-text="Action triggered on selection change or click.">
                ${renderOptions()}
                <sl-divider></sl-divider>
                <sl-option value="CUSTOM">🛠️ Custom Action ID...</sl-option>
                <sl-option value="">🚫 No Action</sl-option>
            </sl-select>

            <div id="${prefix}-action-docs-container">
                ${renderDocs()}
            </div>

            <div id="${prefix}-custom-action-container" class="${isCustom ? '' : 'hidden'} mt-1">
                <sl-input placeholder="Enter Action ID (e.g. myService.do)" value="${isCustom ? currentCall : ''}" id="${prefix}-call-input-custom" size="small"></sl-input>
            </div>

            <div class="mt-2 space-y-2">
                <div class="flex justify-between items-center">
                    <label class="text-[10px] font-bold uppercase text-gray-400">Action Parameters</label>
                    <sl-button size="extra-small" variant="neutral" id="${prefix}-add-param-btn" outline circle><i class="fas fa-plus"></i></sl-button>
                </div>
                <div id="${prefix}-params-list" class="space-y-2"></div>
            </div>
        `;
    }

    bindActionProperties(target, container, prefix = 'part') {
        const callSelect = container.querySelector(`#${prefix}-call-select`);
        const customInput = container.querySelector(`#${prefix}-call-input-custom`);
        const customContainer = container.querySelector(`#${prefix}-custom-action-container`);
        const paramsList = container.querySelector(`#${prefix}-params-list`);
        const addParamBtn = container.querySelector(`#${prefix}-add-param-btn`);

        const renderParams = () => {
            if (!target.action) target.action = { call: '', params: {} };
            const params = target.action.params || {};
            const sids = Object.keys(this._draftSpec.ui?.steps || {});

            paramsList.innerHTML = Object.entries(params).map(([key, val], _idx) => {
                const isNavTarget = (key === 'target' || key === 'step') && target.action.call === 'step.navigate';
                let valInput = `<sl-input value="${val}" class="param-val flex-1" size="small" placeholder="Value" data-key="${key}"></sl-input>`;
                if (isNavTarget) {
                    valInput = `
                        <sl-select value="${val}" class="param-val flex-1" size="small" placeholder="Select Step" data-key="${key}">
                            ${sids.map(sid => `<sl-option value="${sid}">${sid}</sl-option>`).join('')}
                        </sl-select>
                    `;
                }

                return `
                    <div class="flex gap-1 items-center bg-gray-50 p-1 rounded border border-gray-100">
                        <sl-input value="${key}" class="param-key w-20" size="small" placeholder="Key" data-old-key="${key}"></sl-input>
                        ${valInput}
                        <sl-button size="extra-small" variant="neutral" class="del-param-btn" outline circle data-key="${key}"><i class="fas fa-times"></i></sl-button>
                    </div>
                `;
            }).join('');

            paramsList.querySelectorAll('.param-key').forEach(el => {
                el.addEventListener('sl-change', (e) => {
                    const oldKey = el.dataset.oldKey;
                    const newKey = e.target.value;
                    const val = target.action.params[oldKey];
                    delete target.action.params[oldKey];
                    target.action.params[newKey] = val;
                    this.saveToState();
                    renderParams();
                });
            });
            paramsList.querySelectorAll('.param-val').forEach(el => {
                const update = (e) => {
                    target.action.params[el.dataset.key] = e.target.value;
                    this.saveToState();
                    this.updatePreview();
                };
                el.addEventListener('sl-input', update);
                el.addEventListener('sl-change', update);
            });
            paramsList.querySelectorAll('.del-param-btn').forEach(el => {
                el.onclick = () => {
                    delete target.action.params[el.dataset.key];
                    this.saveToState();
                    renderParams();
                };
            });
        };

        if (callSelect) {
            callSelect.addEventListener('sl-change', (e) => {
                const val = e.target.value;
                if (!target.action) target.action = { call: '', params: {} };
                
                if (val === 'CUSTOM') {
                    customContainer.classList.remove('hidden');
                } else {
                    customContainer.classList.add('hidden');
                    target.action.call = val;
                }

                // Update Documentation Live
                const docsContainer = container.querySelector(`#${prefix}-action-docs-container`);
                if (docsContainer) {
                    const builtIn = [{ id: 'NEXT_STEP', label: '🚶 Next Step', description: 'Moves to the next step.' }, { id: 'PREV_STEP', label: '🔙 Previous Step' }];
                    const allActions = [...builtIn, ...(this._registry ? this._registry.getActions() : [])];
                    const selected = allActions.find(a => a.id === (val === 'CUSTOM' ? customInput?.value : val));
                    
                    if (selected && selected.description) {
                        docsContainer.innerHTML = `
                            <div class="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 animate-in fade-in slide-in-from-top-1">
                                <div class="text-[10px] text-indigo-700 leading-relaxed font-medium">${selected.description}</div>
                                ${selected.params ? `
                                    <div class="mt-2 space-y-1">
                                        <div class="text-[9px] font-black uppercase text-slate-400 opacity-70">Expected Parameters:</div>
                                        ${Object.entries(selected.params).map(([k, v]) => `
                                            <div class="flex gap-2 text-[10px]">
                                                <span class="text-indigo-400 font-mono font-bold">${k}:</span>
                                                <span class="text-slate-500 italic">${v}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    } else {
                        docsContainer.innerHTML = '';
                    }
                }

                this.saveToState();
                this.updatePreview();
                renderParams();
            });
        }
        if (customInput) {
            customInput.addEventListener('sl-input', (e) => {
                if (!target.action) target.action = { call: '', params: {} };
                target.action.call = e.target.value;
                this.saveToState();
                this.updatePreview();
            });
        }
        if (addParamBtn) {
            addParamBtn.onclick = () => {
                if (!target.action) target.action = { call: '', params: {} };
                if (!target.action.params) target.action.params = {};
                target.action.params['key_' + Object.keys(target.action.params).length] = '';
                this.saveToState();
                renderParams();
            };
        }
        renderParams();
    }
}

if (!customElements.get("atomic-visual-editor")) {
    customElements.define("atomic-visual-editor", AtomicVisualEditor);
}
