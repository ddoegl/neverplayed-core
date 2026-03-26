import { FLOW_SERVICE, NAV_SERVICE, SESSION_SERVICE, SELECTION_SERVICE, LICENSE_DATA_SERVICE, CONFIG_ADMIN_SERVICE, LIMES_SERVICE, EVAL_DATA_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  async start(context) {
    console.log("Activator: Starting business-channel-web (integrated)...");

    // 1. Initialize State
    if (!globalThis.businessPortalState) {
        globalThis.businessPortalState = Alpine.reactive({});
    }
    const state = globalThis.businessPortalState;

    // Ensure all required properties exist
    if (state.currentStep === undefined || state.currentStep === "dashboard") state.currentStep = "user-home-business";
    if (state.steps === undefined) state.steps = [];
    if (state.discoveredFlows === undefined) state.discoveredFlows = []; // Raw discovered flows
    if (state.session === undefined) state.session = null;
    if (state.renderedHTML === undefined) state.renderedHTML = "";
    if (state.pluginOverlays === undefined) state.pluginOverlays = [];

    // Initialize method placeholders (will be overridden by user-management flow)
    if (!state.syncLicensesToYaml) {
        state.syncLicensesToYaml = () => {
            const svcRef = context.getServiceReference(LICENSE_DATA_SERVICE);
            const svc = svcRef ? context.getService(svcRef) : null;
            if (svc && globalThis.backofficeState?.parsedLicenses) {
                svc.setLicenses(globalThis.backofficeState.parsedLicenses);
                globalThis.backofficeState.recompile?.();
            } else {
                console.warn("Business Portal: syncLicensesToYaml failed - service or data missing");
            }
        };
    }
    if (!state.performUserAssignment) state.performUserAssignment = () => console.warn("Business Portal: performUserAssignment not ready");
    if (!state.syncAllPersonUserIds) state.syncAllPersonUserIds = () => console.warn("Business Portal: syncAllPersonUserIds not ready");

    // Add getters if missing
    if (!Object.getOwnPropertyDescriptor(state, 'currentLicense')) {
        Object.defineProperty(state, 'currentLicense', { get: () => globalThis.backofficeState?.currentLicense || null });
    }
    if (!Object.getOwnPropertyDescriptor(state, 'parsedLicenses')) {
        Object.defineProperty(state, 'parsedLicenses', { get: () => globalThis.backofficeState?.parsedLicenses || { LICENSES: [] } });
    }
    if (!Object.getOwnPropertyDescriptor(state, 'persons')) {
        Object.defineProperty(state, 'persons', { get: () => globalThis.backofficeState?.persons || [] });
    }
    if (!Object.getOwnPropertyDescriptor(state, 'parsedSCAStrategies')) {
        Object.defineProperty(state, 'parsedSCAStrategies', { get: () => globalThis.backofficeState?.parsedSCAStrategies || [] });
    }

    // 2. Navigation Logic
    state.getBundleConfig = (bundle) => {
        if (!bundle) return {};
        const headers = bundle.getHeaders();
        const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
        const configPriming = headers[configKey];
        if (!configPriming) return {};
        try {
            return typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
        } catch (_e) {
            console.warn("Activator: Failed to parse configuration for bundle:", bundle.getSymbolicName());
            return {};
        }
    };

    state.refreshSteps = () => {
        console.log("Activator: Refreshing Business Portal navigation steps...");
        const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
        const ca = caRef ? context.getService(caRef) : null;
        
        const filtered = state.discoveredFlows.filter(flow => {
            if (flow.id === "user-home-business") return true; // Always show home
            
            // Check ConfigAdmin first
            if (ca) {
                const props = ca.getConfiguration(flow.bsn)?.getProperties();
                if (props && props.channels !== undefined) {
                    return props.channels.includes("business-channel-web");
                }
            }
            
            // Fallback to manifest (important for newly installed bundles)
            return flow.manifestChannels.includes("business-channel-web");
        });

        // Maintain order (Dashboard first, then others alphabetically)
        state.steps = filtered.sort((a, b) => {
            if (a.id === "user-home-business") return -1;
            if (b.id === "user-home-business") return 1;
            return a.name.localeCompare(b.name);
        });
    };

    // 3. Enhance State with Methods
    if (!state.loadStep) {
        state.onContentReady = function(el) {
            console.log("Activator: Container ready for:", this.currentStep);
            const extension = this.steps.find((s) => s.id === this.currentStep)
                           || this.availableFlows.find(f => f.id === this.currentStep);
            const params = this.pendingParams || {};

            // Mount into a fresh child to avoid Alpine re-triggering x-init when flow mutates _x_dataStack
            el.innerHTML = '';
            const mount = document.createElement('div');
            mount.className = 'h-full';
            el.appendChild(mount);
            
            if (this.currentStep === 'login') {
                const loginFlow = (this.availableFlows || []).find(f => f.id === 'login');
                if (loginFlow) {
                    console.log("Activator: Launching Login into container (Target: business)");
                    loginFlow.launch(mount, { targetFlow: 'business', ...params });
                }
            } else if (extension?.launch && !extension.templateUrl) {
                console.log("Activator: Launching extension content into container:", extension.id, "with params", params);
                extension.launch(mount, params);
            }

            this.pendingParams = null; // consume
        };

        state.loadStep = async function(stepId, params = {}) {
            if (this._loadingStep) return;
            this._loadingStep = true;
            try {
                await this._doLoadStep(stepId, params);
            } finally {
                this._loadingStep = false;
            }
        };

        state._doLoadStep = async function(stepId, params = {}) {
            console.log("Activator: loadStep Request:", stepId, params);
            let actualId = (stepId === "dashboard" || !stepId) ? "user-home-business" : stepId;
            
            // If we are logged in, NEVER show the login step
            if (this.session?.currentUser && actualId === 'login') {
                console.log("Activator: Already authenticated, redirecting from login to dashboard");
                actualId = 'user-home-business';
            }

            const contentArea = document.getElementById("portal-content-area");
            const isSameStep = this.currentStep === actualId;
            const isAlreadyRendered = contentArea && contentArea.dataset.activeStep === actualId;

            this.currentStep = actualId;
            this.pendingParams = params;

            if (isSameStep && isAlreadyRendered) {
                console.log("Activator: Step already loaded (data-check), skipping innerHTML reset:", actualId);
                // Still call onActivate to update instance specific logic if needed
                const extension = this.steps.find((s) => s.id === actualId);
                if (extension?.onActivate) extension.onActivate(this);
                return;
            }
            if (!this.session?.currentUser && actualId !== 'login' && actualId !== 'signing') {
                console.log("Activator: Unauthenticated - forcing login view");
                this.currentStep = 'login';
                actualId = 'login';
            } else if (this.session?.currentUser?.scope === 'email-only') {
                console.log("Activator: Email-only scope - business portal access denied");
                alert("This account only has access to Web Mail. Please log in with a business account for the Portal.");
                this.currentStep = 'login';
                actualId = 'login';
            } else if (this.session?.currentUser) {
                // Limes Guard Gate
                if (this.limes) {
                    const isAllowed = this.limes.isAllowed(this.session.currentUser.id, "FLOW_VIEW:" + actualId);
                    if (!isAllowed) {
                        console.warn("Activator: Limes access denied for flow:", actualId);
                        alert("Access Denied: You do not have the required permissions or strategy clearance for this area.");
                        this.currentStep = 'user-home-business';
                        actualId = 'user-home-business';
                    }
                } else {
                    // Fallback to raw permission check if Limes is not yet available
                    const targetFlow = this.availableFlows.find(f => f.id === actualId) || this.steps.find(s => s.id === actualId);
                    const reqPermissions = targetFlow?.requiredPermissions || (targetFlow?.bundle ? state.getBundleConfig(targetFlow.bundle)?.['required-permissions'] : []);
                    
                    if (reqPermissions && reqPermissions.length > 0) {
                        if (!this.evaluatorData || !this.evaluatorData.hasPermissions(this.session.currentUser.id, reqPermissions)) {
                            console.warn("Activator: Permission denied for flow:", actualId);
                            alert("You do not have the required permissions to access this area.");
                            this.currentStep = 'user-home-business';
                            actualId = 'user-home-business';
                        }
                    }
                }
            }

            // 2. Load Content
            try {
                const extension = this.steps.find((s) => s.id === actualId);
                let html = "";
                
                if (extension?.templateUrl) {
                    const res = await fetch(extension.templateUrl);
                    html = await res.text();
                }

                if (contentArea && document.getElementById("portal-root-container")) {
                    console.log("Activator: Partial update for Portal content area:", actualId);
                    if (extension?.onActivate) {
                        console.log("Activator: Partial update calling onActivate for flow:", actualId);
                        extension.onActivate(this);
                    }
                    contentArea.innerHTML = extension?.templateUrl ? html : `<div id="portal-inner-container" x-init="globalThis.businessPortalState.onContentReady($el)" class="h-full"></div>`;
                    contentArea.dataset.activeStep = actualId;
                    return;
                }

                console.log("Activator: Performing full Portal layout refresh for:", actualId);
                const bundlePath = `./bundles/user-clients/business-channel-web`;
                const layoutRes = await fetch(`${bundlePath}/templates/layout.html`);
                const layoutHtml = (await layoutRes.text()).replace("{{{flowContent}}}", 
                    extension?.templateUrl ? html : `<div id="portal-inner-container" x-init="globalThis.businessPortalState.onContentReady($el)" class="h-full"></div>`
                );
                
                const target = document.getElementById("portal-root-container");
                if (target) {
                    target.innerHTML = layoutHtml;
                }
                
                if (extension?.onActivate) {
                    console.log("Activator: Full refresh calling onActivate for flow:", actualId);
                    extension.onActivate(this);
                }
            } catch (e) {
                console.error("Activator: Navigation failure:", actualId, e);
            }
        };

        globalThis.addEventListener('business-portal-launch', (e) => {
            state.loadStep(e.detail.id, e.detail.params);
        });
        
        // Listen for config changes to refresh navigation!
        globalThis.addEventListener('config-updated', () => state.refreshSteps());
    }

    // 4. Track flows for this portal
    context.trackService(`(objectClass=${FLOW_SERVICE})`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        const id = ref.getProperty("flow.id");
        const channels = ref.getProperty("channels") || [];
        const flowType = ref.getProperty("flowType");
        
        const bConfig = state.getBundleConfig(ref.bundle);
        const manifestChannels = bConfig.channels || [];
        const requiredPermissions = bConfig["required-permissions"] || [];

        const isTarget = id === "user-home-business" || 
                         channels.includes("business-channel-web") ||
                         manifestChannels.includes("business-channel-web");

        console.log(`Business Portal: Discovered flow ${id}. isTarget=${isTarget}, flowType=${flowType}, channels=[${channels}], manifestChannels=[${manifestChannels}]`);

        if (id && id !== "business-channel-web" && isTarget && flowType !== 'order-flow') {
            const flowEntry = {
                id,
                bsn: ref.getProperty("bundle.symbolicName") || ref.bundle.getSymbolicName(),
                name: ref.getProperty("flow.title") || service.title || id,
                icon: ref.getProperty("flow.icon") || service.icon || "fas fa-cube",
                launch: service.launch,
                onActivate: service.onActivate,
                templateUrl: ref.getProperty("templateUrl"),
                requiredPermissions,
                manifestChannels: [...new Set([...channels, ...manifestChannels])]
            };
            
            const existingIndex = state.discoveredFlows.findIndex(f => f.id === id);
            if (existingIndex !== -1) {
                state.discoveredFlows[existingIndex] = flowEntry;
            } else {
                state.discoveredFlows.push(flowEntry);
            }

            state.refreshSteps();

            if (id === 'user-home-business' && state.currentStep === 'user-home-business') {
                state.loadStep(id);
            }
        }
      },
      removedService: (ref) => {
        const id = ref.getProperty("flow.id");
        state.discoveredFlows = state.discoveredFlows.filter(f => f.id !== id);
        state.refreshSteps();
        context.ungetService(ref);
      }
    }).open();

    // 5. Track Session
    context.trackService(`(objectClass=${SESSION_SERVICE})`, {
      addingService: (ref) => {
        state.session = context.getService(ref);
        if (state.session.currentUser) {
            console.log("Activator: Session arrived, checking for redirect...");
            if (state.currentStep === 'login' || !state.currentStep) {
                state.loadStep('user-home-business');
            } else {
                state.loadStep(state.currentStep);
            }
        }
      },
      removedService: () => {
        state.session = null;
      }
    }).open();

    // 6. Track ALL flows for fallback and gate-keeping
    context.trackService(`(objectClass=${FLOW_SERVICE})`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        const id = ref.getProperty("flow.id");
        if (id && !state.availableFlows.find(f => f.id === id)) {
            state.availableFlows.push({ ...service, id });
            if (!state.session?.currentUser && id === 'login') {
                state.loadStep(state.currentStep);
            }
        }
      }
    }).open();

    // 7. Track Selection Service
    context.trackService(`(objectClass=${SELECTION_SERVICE})`, {
      addingService: (ref) => {
        state.selectionService = context.getService(ref);
      },
      removedService: () => {
        state.selectionService = null;
      }
    }).open();

    // 8. Track Evaluation Data
    context.trackService(`(objectClass=${EVAL_DATA_SERVICE})`, {
      addingService: (ref) => {
        state.evaluatorData = context.getService(ref);
        state.refreshSteps();
      },
      removedService: () => {
        state.evaluatorData = null;
        state.refreshSteps();
      }
    }).open();

    // 9. Track License Data Service
    context.trackService(`(objectClass=${LICENSE_DATA_SERVICE})`, {
      addingService: (ref) => {
        const svc = context.getService(ref);
        if (globalThis.backofficeState?.parsedLicenses) {
            const current = globalThis.backofficeState.parsedLicenses;
            if (!current.LICENSES || current.LICENSES.length === 0) {
                Object.assign(current, svc.getLicenses());
            }
        }
      }
    }).open();

    // 10. Track Config Admin for late arrival reactivity
    context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
        addingService: () => state.refreshSteps(),
        removedService: () => state.refreshSteps()
    }).open();

    // 11. Track Limes Service
    context.trackService(`(objectClass=${LIMES_SERVICE})`, {
      addingService: (ref) => {
        state.limes = context.getService(ref);
        state.refreshSteps();
      },
      removedService: () => {
        state.limes = null;
        state.refreshSteps();
      }
    }).open();

    // Initial Dashboard Step
    if (!state.discoveredFlows.find(f => f.id === "user-home-business")) {
        state.discoveredFlows.push({
            id: "user-home-business",
            name: "Dashboard",
            icon: "fas fa-th-large",
            manifestChannels: ["business-channel-web"]
        });
        state.refreshSteps();
    }

    context.registerService(FLOW_SERVICE, {
      id: "business-channel-web",
      title: "Business Portal",
      icon: "fas fa-briefcase",
      launch: (targetElement) => {
        if (state.currentStep === 'signing' || state.currentStep === 'login') {
            state.currentStep = 'user-home-business';
        }
        targetElement.innerHTML = `<div id="portal-root-container" x-data="globalThis.getBusinessPortalScope()" class="h-full"></div>`;
        state.loadStep(state.currentStep);
      },
    }, { 
      "flow.id": "business-channel-web",
      "flowType": "web-channel",
      "channels": ["web-browser"]
    });

    context.registerService(NAV_SERVICE, {
      flowId: "business-channel-web",
      get steps() {
        const currentUser = state.session?.currentUser;
        if (!currentUser) return [];
        return state.steps.filter(step => {
            if (state.limes) {
                return state.limes.isAllowed(currentUser.id, "FLOW_VIEW:" + step.id);
            }
            if (!step.requiredPermissions || step.requiredPermissions.length === 0) return true;
            if (!state.evaluatorData) return false;
            return state.evaluatorData.hasPermissions(currentUser.id, step.requiredPermissions);
        });
      },
      currentStep: () => state.currentStep,
      loadStep: (id) => state.loadStep(id),
    });

    globalThis.getBusinessPortalScope = () => {
        return {
            get currentLicense() { return globalThis.backofficeState?.currentLicense },
            get parsedLicenses() { return globalThis.backofficeState?.parsedLicenses || { LICENSES: [] } },
            get persons() { return globalThis.backofficeState?.persons || [] },
            get parsedSCAStrategies() { return globalThis.backofficeState?.parsedSCAStrategies || [] },
            get activeLicense() {
                const licenses = (this.parsedLicenses?.LICENSES || []);
                const currentId = this.currentLicense;
                if (!currentId) return null;
                return licenses.find(l => l.id === currentId);
            },
            get currentStep() { return state.currentStep },
            get steps() {
                const currentUser = state.session?.currentUser;
                if (!currentUser) return [];
                return state.steps.filter(step => {
                    if (state.limes) {
                        return state.limes.isAllowed(currentUser.id, "FLOW_VIEW:" + step.id);
                    }
                    if (!step.requiredPermissions || step.requiredPermissions.length === 0) return true;
                    if (!state.evaluatorData) return false;
                    return state.evaluatorData.hasPermissions(currentUser.id, step.requiredPermissions);
                });
            },
            get session() { return state.session },
            get selectedUserId() { return state.selectedUserId },
            set selectedUserId(val) { state.selectedUserId = val },
            loadStep(id) { return state.loadStep(id) },
            syncLicensesToYaml() { return state.syncLicensesToYaml?.() },
            performUserAssignment(userId, personId, relationType) { 
                return state.performUserAssignment?.(userId, personId, relationType);
            },
            syncAllPersonUserIds() { return state.syncAllPersonUserIds?.() },
            portal: state,
            backoffice: globalThis.backofficeState
        };
    };

    console.log("Activator: Triggering initial load for step:", state.currentStep);
    await state.loadStep(state.currentStep);
  }

  stop(_context) {}
}
