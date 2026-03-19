import { FLOW_SERVICE, NAV_SERVICE, SESSION_SERVICE, BO_EXTENSION_SERVICE, SELECTION_SERVICE } from "../../../shared-types.js";

export default class Activator {
  start(context) {
    const state = globalThis.backofficeState;
    if (!state) {
        console.error("Activator: backofficeState NOT FOUND. global-state bundle missing?");
        return;
    }

    // 1. Define Robust Fresh Factory for Alpine x-data
    globalThis.getBackofficeScope = () => {
        const scope = {
            host: state,
            backoffice: state,
            loadStep: (id) => state.loadStep(id),
            onContentReady: (el) => state.onContentReady(el),
        };
        
        // Add specific legacy aliases if needed, but favor 'host' in templates
        ['currentLicense', 'activeLicense', 'persons', 'companies', 'session'].forEach(key => {
            Object.defineProperty(scope, key, {
                get() { return state[key]; },
                enumerable: true
            });
        });

        return scope;
    };

    // 2. Enhance State with Methods (aligned with Business Portal)
    if (!state.onContentReady) {
        state.onContentReady = function(el) {
            console.log("Activator: Backoffice Content ready for:", this.currentStep);
            const extension = this.steps.find((s) => s.id === this.currentStep);
            
            if (this.currentStep === 'login') {
                const loginFlow = (this.availableFlows || []).find(f => f.id === 'login');
                if (loginFlow) {
                    console.log("Activator: Launching Login into Backoffice container");
                    loginFlow.launch(el, { targetFlow: 'backoffice-web' });
                }
            } else if (extension?.launch && !extension.templateUrl) {
                console.log("Activator: Launching extension content into Backoffice container:", extension.id, "with params:", this.currentParams);
                extension.launch(el, this.currentParams || {});
            }
        };

        state.loadStep = async function(stepId, params = {}) {
            if (this._loadingStep) return;
            this._loadingStep = true;
            this.currentParams = params;
            try {
                await this._doLoadStep(stepId, params);
            } finally {
                this._loadingStep = false;
            }
        };

        state._doLoadStep = async function(stepId, _params = {}) {
            console.log("Activator: [NAVIGATE] Backoffice loadStep Request:", stepId);
            let actualId = stepId || this.currentStep || (this.steps[0]?.id);
            
            // 1. Gatekeeping: Only 'dd' can access backoffice
            const isSuperUser = this.session?.currentUser?.id === 'dd';
            console.log("Activator: [AUTH CHECK] User:", this.session?.currentUser?.id, "isSuperUser:", isSuperUser);
            
            if (!isSuperUser) {
                console.warn("Activator: Unauthorized access to Backoffice - Redirecting to Login");
                actualId = 'login';
            } else if (actualId === 'login') {
                // If already logged in as dd, go to first real step
                actualId = stepId !== 'login' ? stepId : (this.steps.find(s => s.id !== 'login')?.id || '');
            }

            // Stability check: if already loaded, don't flicker
            const contentArea = document.getElementById("backoffice-content-area");
            const isSameStep = this.currentStep === actualId;
            const isAlreadyRendered = contentArea && contentArea.dataset.activeStep === actualId;
            
            this.currentStep = actualId;

            if (isSameStep && isAlreadyRendered) {
                console.log("Activator: Backoffice step already loaded (data-check), skipping innerHTML reset:", actualId);
                const extension = this.steps.find((s) => s.id === actualId);
                if (extension?.onActivate) extension.onActivate(this);
                return;
            }

            // 2. Load Content
            try {
                const extension = this.steps.find((s) => s.id === actualId);
                let html = "";
                
                if (extension?.templateUrl) {
                    const res = await fetch(`${extension.templateUrl}?t=${Date.now()}`);
                    html = await res.text();
                }

                if (contentArea && document.getElementById("backoffice-root-container")) {
                    console.log("Activator: Partial update for Backoffice content area:", actualId);
                    if (extension?.onActivate) extension.onActivate(this);
                    contentArea.innerHTML = extension?.templateUrl ? html : `<div id="backoffice-inner-container" x-init="host.onContentReady($el)" class="h-full"></div>`;
                    contentArea.dataset.activeStep = actualId;
                    return;
                }

                console.log("Activator: Performing full shell refresh for:", actualId);
                const layoutRes = await fetch("./bundles/system-clients/backoffice-web/templates/layout.html");
                const layoutHtml = (await layoutRes.text()).replace("{{{flowContent}}}", 
                    extension?.templateUrl ? html : `<div id="backoffice-inner-container" x-init="host.onContentReady($el)" class="h-full"></div>`
                );
                
                if (extension?.onActivate) extension.onActivate(this);

                const target = document.getElementById("backoffice-root-container");
                if (target) {
                    target.innerHTML = layoutHtml;
                }
            } catch (e) {
                console.error("Activator: Backoffice Navigation failure:", actualId, e);
            }
        };
    }

    // 3. Register Flow Service
    context.registerService(FLOW_SERVICE, {
      id: "backoffice-web",
      title: "Backoffice",
      launch: (targetElement, params = {}) => {
        console.log("Activator: Launching Backoffice with Fresh Factory. Params:", params);
        
        // Handle Step and License context if provided
        if (params.step) {
            state.currentStep = params.step;
        }
        if (params.licenseId) {
            const selectionRef = context.getServiceReference(SELECTION_SERVICE);
            if (selectionRef) {
                context.getService(selectionRef).setSelection({ currentLicenseId: params.licenseId }, 'business');
            }
        }

        targetElement.innerHTML = `
          <div id="backoffice-root-container" x-data="globalThis.getBackofficeScope()" class="h-full">
          </div>
        `;
        state.loadStep(state.currentStep);
      },
    }, { 
      "flow.id": "backoffice-web",
      "flowType": "system-flow",
      "channels": ["real-life"]
    });

    // 4. Register Nav Service
    context.registerService(NAV_SERVICE, {
      flowId: "backoffice-web",
      get steps() { return state.steps; },
      currentStep: () => state.currentStep,
      loadStep: (id) => state.loadStep(id),
    });

    // 5. Track Session
    context.trackService(`(objectClass=${SESSION_SERVICE})`, {
      addingService: (ref) => {
        state.session = context.getService(ref);
        if (state.session.currentUser?.id === 'dd') {
            // Ensure superuser has DO access roles
            const user = state.session.currentUser;
            if (!user.roles) user.roles = [];
            ['ADMINISTRATOR', 'LEGALREPS', 'DOSIGNEE'].forEach(role => {
                if (!user.roles.includes(role)) user.roles.push(role);
            });
            
            // Auto-select first license
            const selectionRef = context.getServiceReference(SELECTION_SERVICE);
            const selectionSvc = selectionRef ? context.getService(selectionRef) : null;
            if (selectionSvc && !selectionSvc.getSelection('business').currentLicenseId) {
                const firstLic = state.parsedLicenses?.LICENSES?.[0]?.id;
                if (firstLic) {
                    console.log("Activator: Auto-selecting first license for superuser (business context):", firstLic);
                    selectionSvc.setSelection({ currentLicenseId: firstLic }, 'business');
                }
            }
            if (state.currentStep === 'login') {
                state.loadStep(state.steps[0]?.id || '');
            }
        }
      },
      removedService: () => {
        state.session = null;
        state.loadStep('login');
      }
    }).open();

    // 6. Track Login Flow
    context.trackService(`(objectClass=${FLOW_SERVICE})`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        const id = ref.getProperty("flow.id");
        if (id && !state.availableFlows.find(f => f.id === id)) {
            state.availableFlows.push({ ...service, id });
            if (id === 'login' && state.currentStep === 'login') {
                state.loadStep('login');
            }
        }
      }
    }).open();

    // 7. Track Extensions
    const boExtFilter = `(objectClass=${BO_EXTENSION_SERVICE})`;
    context.trackService(boExtFilter, {
      addingService: (ref) => {
        const ext = context.getService(ref);
        const idx = state.steps.findIndex(s => s.id === ext.id);
        if (idx !== -1) {
            state.steps[idx] = ext;
        } else {
            state.steps.push(ext);
        }
        if (!state.currentStep || state.currentStep === ext.id) {
            state.loadStep(ext.id);
        }
      },
      removedService: (ref) => {
        const service = context.getService(ref);
        state.steps = state.steps.filter(s => s.id !== service.id);
        context.ungetService(ref);
      }
    }).open();
  }

  stop(_context) {
    // Preserve state but stop tracking
  }
}
