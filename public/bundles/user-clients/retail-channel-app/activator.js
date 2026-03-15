import { FLOW_SERVICE, SESSION_SERVICE, SELECTION_SERVICE, LICENSE_DATA_SERVICE, CONFIG_ADMIN_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    console.log("Activator: Starting retail-channel-app...");

    // 0. Extract Config from Manifest
    const headers = context.bundle.getHeaders();
    const configHeader = headers['Configuration'] || headers['configuration'];
    const bundleConfig = typeof configHeader === 'string' ? JSON.parse(configHeader) : (configHeader || {});
    const clientConfig = bundleConfig['client-config'] || {};
    
    const security = clientConfig.security || { requireAuth: true, provisioning: 'license', licenseChannel: 'retail' };
    const navigation = clientConfig.navigation || { defaultFlow: "user-home-retail", defaultStep: "dashboard" };

    // 1. Initialize State
    if (!globalThis.retailPortalState) {
        globalThis.retailPortalState = Alpine.reactive({});
    }
    const state = globalThis.retailPortalState;
    
    // Ensure all required properties exist
    if (state.currentStep === undefined) state.currentStep = navigation.defaultFlow;
    if (state.currentSubStep === undefined) state.currentSubStep = navigation.defaultStep || null;
    if (state.steps === undefined) state.steps = [];
    if (state.discoveredFlows === undefined) state.discoveredFlows = [];
    if (state.availableFlows === undefined) state.availableFlows = [];
    if (state.session === undefined) state.session = null;
    if (state.promoShownThisSession === undefined) state.promoShownThisSession = false;
    if (state.isMenuOpen === undefined) state.isMenuOpen = false;
    if (state.mountPoint === undefined) state.mountPoint = null;

    state.toggleMenu = function() {
        this.isMenuOpen = !this.isMenuOpen;
        console.log("Activator: Retail Menu toggled:", this.isMenuOpen);
    };

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
    state.refreshSteps = () => {
        console.log("Activator: Refreshing Retail App navigation steps...");
        const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
        const ca = caRef ? context.getService(caRef) : null;
        const channelId = context.bundle.getSymbolicName();
        
        const filtered = state.discoveredFlows.filter(flow => {
            if (flow.id === navigation.defaultFlow) return true;
            
            if (ca) {
                const props = ca.getConfiguration(flow.bsn)?.getProperties();
                if (props && props.channels !== undefined) {
                    return props.channels.includes(channelId);
                }
            }
            return flow.manifestChannels.includes(channelId);
        });

        state.steps = filtered.sort((a, b) => {
            if (a.id === navigation.defaultFlow) return -1;
            if (b.id === navigation.defaultFlow) return 1;
            return a.name.localeCompare(b.name);
        });
    };

    // 2. Enhance State with Methods
    if (!state.loadStep) {
        state.onContentReady = function(el) {
            console.log("Activator: Retail Container ready for flow:", this.currentStep, "sub-step:", this.currentSubStep);
            const extension = this.steps.find((s) => s.id === this.currentStep)
                           || this.availableFlows.find(f => f.id === this.currentStep);

            // Mount into a fresh child to avoid Alpine re-triggering x-init when flow mutates _x_dataStack
            el.innerHTML = '';
            const mount = document.createElement('div');
            mount.className = 'h-full';
            el.appendChild(mount);
            
            if (this.currentStep === 'login') {
                const loginFlow = (this.availableFlows || []).find(f => f.id === 'login');
                if (loginFlow) {
                    console.log("Activator: Launching Login gate");
                    const handover = typeof this.currentSubStep === 'object' ? this.currentSubStep : {};
                    loginFlow.launch(mount, { 
                        targetFlow: context.bundle.getSymbolicName(),
                        targetStep: handover.targetStep || null,
                        targetParams: handover.targetParams || {}
                    });
                }
            } else if (extension?.launch && !extension.templateUrl) {
                console.log("Activator: Launching extension flow:", extension.id, "with sub-step:", this.currentSubStep);
                
                // If currentSubStep is an object (e.g. signing params), spread directly; 
                // otherwise resolve it to a 'step' param and merge with other pending params (like 'code')
                const baseParams = (typeof this.currentSubStep === 'object' && this.currentSubStep !== null)
                    ? this.currentSubStep
                    : { step: this.currentSubStep || navigation.defaultStep };
                
                const extParams = { ...this.pendingParams, ...baseParams };
                extension.launch(mount, extParams);
            } else {
                console.warn("Activator: No launchable extension found for step:", this.currentStep);
            }

            this.pendingParams = null; // consume
        };

        state.loadStep = async function(stepId, subStepId = null, params = {}) {
            console.log("Activator: Retail loadStep Request:", stepId, "subStep:", subStepId, "params:", params);
            let actualId = stepId || navigation.defaultFlow;
            this.currentSubStep = subStepId || (actualId === navigation.defaultFlow ? navigation.defaultStep : null);
            this.pendingParams = params;
            
            // Redirect from login if authenticated
            if (this.session?.currentUser && actualId === 'login') {
                actualId = navigation.defaultFlow;
                this.currentSubStep = navigation.defaultStep;
            }

            this.currentStep = actualId;
            
            // 1. Guard check (Auth) — signing is part of the auth process and must bypass the gate
            if (security.requireAuth && !this.session?.currentUser && actualId !== 'login' && actualId !== 'signing') {
                console.log("Activator: Auth required, redirecting to login. Intended:", actualId, subStepId);
                const intendedStep = actualId;
                const intendedSubStep = subStepId || (actualId === navigation.defaultFlow ? navigation.defaultStep : null);
                
                this.currentStep = 'login';
                actualId = 'login';
                this.currentSubStep = { targetStep: intendedStep, targetParams: { subStep: intendedSubStep } };
            }

            // 2. Guard check (Provisioning/License)
            if (security.provisioning === 'license' && this.session?.currentUser && actualId !== 'login') {
                const licenses = (this.parsedLicenses?.LICENSES || []);
                const userIdent = this.session.currentUser.id || this.session.currentUser.alias || this.session.currentUser;
                const channel = security.licenseChannel || 'retail';
                const hasRetailLicense = licenses.some(l => 
                    l.channel === channel && 
                    l.USERS?.some(u => String(u.id) === String(userIdent) || u.alias === userIdent)
                );

                if (!hasRetailLicense) {
                    console.log(`Activator: No ${channel} license found for user - access denied`);
                    alert(`This account does not have an active ${channel} license. Access denied.`);
                    this.currentStep = 'login';
                    actualId = 'login';
                }
            }

            // 2. Load Content
            try {
                const extension = this.steps.find((s) => s.id === actualId);
                let html = "";
                
                if (extension?.templateUrl) {
                    const res = await fetch(extension.templateUrl);
                    html = res.ok ? await res.text() : `<div class="p-4 text-red-500">Template not found: ${extension.templateUrl}</div>`;
                }

                // Path robustness: Use a relative path from the bundle's base
                const bundlePath = `./bundles/user-clients/retail-channel-app`;
                const layoutRes = await fetch(`${bundlePath}/templates/layout.html`);
                
                let layoutHtml = "";
                if (layoutRes.ok) {
                    layoutHtml = (await layoutRes.text()).replace("{{{flowContent}}}", 
                        extension?.templateUrl ? html : `<div id="retail-inner-container" x-init="globalThis.retailPortalState.onContentReady($el)" class="h-full"></div>`
                    );
                } else {
                    layoutHtml = `<div class="p-8 text-red-500">Retail Layout not found at: ${bundlePath}/templates/layout.html</div>`;
                }
                
                // Mount to mobile or desktop target based on shell
                const rootTarget = state.mountPoint?.querySelector("#retail-root-container");
                if (rootTarget) {
                    rootTarget.innerHTML = layoutHtml;
                } else {
                    console.log("Activator: Retail Root Container not found in mount point - skipping DOM update");
                }
                
                if (extension?.onActivate) extension.onActivate(this);
            } catch (e) {
                console.error("Activator: Retail Navigation failure:", actualId, e);
            }
        };

        globalThis.addEventListener('retail-portal-launch', (e) => {
            state.loadStep(e.detail.id, e.detail.params);
        });
        
        globalThis.addEventListener('config-updated', () => state.refreshSteps());
    }

    // 3. Define Scope for Alpine
    globalThis.getRetailPortalScope = () => {
        return {
            get currentLicense() { return globalThis.backofficeState?.currentLicense },
            get parsedLicenses() { return globalThis.backofficeState?.parsedLicenses || { LICENSES: [] } },
            get persons() { return globalThis.backofficeState?.persons || [] },
            
            get activeLicense() {
                const licenses = (this.parsedLicenses?.LICENSES || []);
                const currentId = this.currentLicense;
                if (!currentId) return null;
                return licenses.find(l => l.id === currentId);
            },

            get currentStep() { return state.currentStep },
            get steps() { return state.steps },
            get session() { return state.session },
            get isMenuOpen() { return state.isMenuOpen },
            
            toggleMenu() { state.toggleMenu() },
            loadStep(id) { 
                state.isMenuOpen = false; // Auto-close menu on nav
                return state.loadStep(id);
            },
            portal: state,
            backoffice: globalThis.backofficeState
        };
    };

    // 4. Register Flow
    context.registerService(FLOW_SERVICE, {
      id: context.bundle.getSymbolicName(),
      title: clientConfig.title || "User Client",
      icon: clientConfig.icon || "fas fa-cube",
      launch: (targetElement, params = {}) => {
        console.log(`Activator: Launching ${context.bundle.getSymbolicName()} with params:`, params);
        
        // Auto-select license for the current user in 'retail' context if none selected
        if (state.session?.currentUser) {
            const userIdent = state.session.currentUser.id || state.session.currentUser.alias || state.session.currentUser;
            const selectionRef = context.getServiceReference(SELECTION_SERVICE);
            const selectionSvc = selectionRef ? context.getService(selectionRef) : null;
            
            if (selectionSvc && !selectionSvc.getSelection('retail').currentLicenseId) {
                const licRef = context.getServiceReference(LICENSE_DATA_SERVICE);
                const licSvc = licRef ? context.getService(licRef) : null;
                if (licSvc) {
                    const licenses = licSvc.getLicenses()?.LICENSES || [];
                    const myLicense = licenses.find(l => 
                        l.channel === 'retail' && 
                        l.USERS?.some(u => String(u.id) === String(userIdent) || u.alias === userIdent)
                    );
                    if (myLicense) {
                        console.log("Activator: Auto-selecting retail license for user:", myLicense.id);
                        selectionSvc.setSelection({ currentLicenseId: myLicense.id }, 'retail');
                    }
                }
            }
        }
        
        // Deep-link handling
        if (params.step) {
            state.currentStep = params.step;
            state.currentSubStep = params.subStep || (params.params && params.params.subStep) || null;
            console.log(`Activator: Deep-link detected. Target: ${state.currentStep}, Sub-step: ${state.currentSubStep}`);
        } else {
            // Revert to defaults if no specific step requested
            state.currentStep = navigation.defaultFlow;
            state.currentSubStep = navigation.defaultStep;
        }

        targetElement.innerHTML = `
            <div id="retail-root-container" 
                 x-data="globalThis.getRetailPortalScope()" 
                 class="h-full bg-slate-50">
            </div>`;
        state.mountPoint = targetElement;
        state.loadStep(state.currentStep, state.currentSubStep, params);
      },
    }, { 
      "flow.id": context.bundle.getSymbolicName(),
      "flowType": bundleConfig.flowType || "web-channel",
      "channels": bundleConfig.channels || ["web-browser"]
    });

    // 5. Track Services
    context.trackService(`(objectClass=${FLOW_SERVICE})`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        const id = ref.getProperty("flow.id");
        const myChannel = context.bundle.getSymbolicName();
        
        // Resolve channels from service properties OR bundle configuration
        let channels = ref.getProperty("channels") || [];
        const bundle = ref.getBundle();
        const config = bundle.getHeaders()?.['Configuration'] || bundle.getHeaders()?.['configuration'];
        const parsedConfig = typeof config === 'string' ? JSON.parse(config) : (config || {});
        const manifestChannels = parsedConfig.channels || [];
        
        const isTarget = id === navigation.defaultFlow || 
                         channels.includes(myChannel) || 
                         manifestChannels.includes(myChannel);

        if (id && id !== myChannel && isTarget) {
            const flowEntry = {
                id,
                bsn: bundle.getSymbolicName(),
                name: ref.getProperty("flow.title") || service.title || id,
                icon: ref.getProperty("flow.icon") || service.icon || "fas fa-cube",
                launch: service.launch,
                templateUrl: ref.getProperty("templateUrl"),
                manifestChannels: [...new Set([...channels, ...manifestChannels])]
            };
            
            const existingIndex = state.discoveredFlows.findIndex(f => f.id === id);
            if (existingIndex !== -1) {
                state.discoveredFlows[existingIndex] = flowEntry;
            } else {
                state.discoveredFlows.push(flowEntry);
            }
            
            state.refreshSteps();
            if (id === navigation.defaultFlow && state.currentStep === navigation.defaultFlow) state.loadStep(id);
        }
        
        if (id === 'login' && !state.availableFlows.find(f => f.id === 'login')) {
            state.availableFlows.push({ ...service, id });
        }
        if (id === 'signing' && !state.availableFlows.find(f => f.id === 'signing')) {
            state.availableFlows.push({ ...service, id });
        }
      },
      removedService: (ref) => {
        const id = ref.getProperty("flow.id");
        state.discoveredFlows = state.discoveredFlows.filter(f => f.id !== id);
        state.refreshSteps();
      }
    }).open();

    context.trackService(`(objectClass=${SESSION_SERVICE})`, {
      addingService: (ref) => {
        state.session = context.getService(ref);
        if (state.session.currentUser && (state.currentStep === 'login' || !state.currentStep)) {
            state.loadStep(navigation.defaultFlow);
        }
      },
      removedService: () => { state.session = null; }
    }).open();

    context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
        addingService: () => state.refreshSteps(),
        removedService: () => state.refreshSteps()
    }).open();

    // Initial Dashboard Step
    if (!state.discoveredFlows.find(f => f.id === navigation.defaultFlow)) {
        state.discoveredFlows.push({ 
            id: navigation.defaultFlow, 
            name: "Home", 
            icon: "fas fa-home", 
            bsn: context.bundle.getSymbolicName(),
            manifestChannels: [context.bundle.getSymbolicName()] 
        });
        state.refreshSteps();
    }
  }

  stop(_context) {}
}
