import { FLOW_SERVICE, SESSION_SERVICE, CONFIG_ADMIN_SERVICE, SELECTION_SERVICE, YAML_EDITOR_SERVICE as _YAML_EDITOR_SERVICE, ENV_SERVICE, INVITATION_SERVICE, LIMES_SERVICE, EVAL_DATA_SERVICE, EVENT_HANDLER_INTERFACE, EVENT_TOPIC } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    console.log("Activator: Starting user-home-business...");

    const state = Alpine.reactive({
      session: null,
      availableFlows: [],
      currentUser: null,
      get currentUserCap() {
        if (!this.currentUser) return null;
        const allStates = [globalThis.businessPortalState, globalThis.backofficeState].filter(Boolean);
        const evalData = allStates.flatMap(s => s.evaluatedData || []);
        const cap = evalData.find(e => String(e.user) === String(this.currentUser.id));
        return cap;
      },
      selectionService: null,
      configAdmin: null,
      envServices: [],
      detailTab: "promotions",
      currentSubFlowId: null,
      updateTrigger: 1, // Reactive trigger for external service state
      invitationService: null,
      get invitations() {
        this.updateTrigger; // Depend on trigger
        const companyId = this.selectionService?.getSelection('business')?.selectedCompanyId;
        const licenseId = this.activeLicense?.id;
        return this.invitationService?.getInvitations(companyId, licenseId) || [];
      },

      get activeLicense() {
        return globalThis.backofficeState?.activeLicense || null;
      },
 
      getBundleConfig(bundle) {
        if (!bundle) return {};
        const headers = bundle.getHeaders();
        const configKey = Object.keys(headers || {}).find(k => k.toLowerCase() === 'configuration');
        const configPriming = headers[configKey];
        if (!configPriming) return {};

        try {
            return typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
        } catch (_e) {
            return {};
        }
      },

      getManifestChannels(bundle) {
        const config = this.getBundleConfig(bundle);
        return config?.channels;
      },

      isFlowEnabled(id) {
        const flow = this.availableFlows.find(f => f.id === id);
        if (!flow) return false;
        
        const bsn = flow.bsn;
        if (!bsn) return true;

        const props = this.configAdmin?.getConfiguration(bsn)?.getProperties();
        const manifestChannels = flow.channels || this.getManifestChannels(flow.bundle);
        const storedChannels = props?.channels;

        // CRITICAL FIX: Empty array means "turned off", so we MUST check for undefined
        const channels = (storedChannels !== undefined) ? storedChannels : (manifestChannels !== undefined ? manifestChannels : []);
        
        const envId = this.session?.environment || "business-channel-web";
        const env = this.envServices.find(e => e.id === envId);
        const envType = env?.type || "desktop";
        const channelFlavor = envType === "mobile" ? "channel-app" : "channel-web";
        const channelId = `business-${channelFlavor}`;
        
        return channels.includes(channelId);
      },

      get businessFlows() {
        const flows = this.availableFlows.filter(f => {
            const isEnabled = this.isFlowEnabled(f.id);
            if (!isEnabled) return false;

            // Limes Guard Gate
            if (this.limes) {
                const isAllowed = this.limes.isAllowed(this.currentUser?.id, "FLOW_VIEW:" + f.id);
                if (!isAllowed) return false;
            } else {
                // Fallback: Permission Gating
                const bConfig = this.getBundleConfig(f.bundle);
                const requiredPermissions = bConfig["required-permissions"] || [];
                if (requiredPermissions.length > 0) {
                    if (!this.evaluatorData) return false; // wait for evaluator
                    const hasAll = this.evaluatorData.hasPermissions(this.currentUser?.id, requiredPermissions);
                    if (!hasAll) return false;
                }
            }

            // Strict Filter: Only show relevant business or admin flows
            const type = f.flowType;
            if (f.id === "config-admin-ui") return true;
            if (f.id === "user-home-business") return false; 
            
            return type === "service-flow" || type === "admin-flow" || type === "atomic-flow";
        });
        console.log("user-home-business: Categorized Business Flows", flows.map(f => f.id));
        return flows;
      },

      launchFlow(id, step = null, params = {}) {
        console.log(`user-home-business: Launching flow ${id} with step ${step}`);

        // If user selects the dashboard itself, just close any active sub-flow (return home)
        if (id === 'user-home-business') {
            this.closeSubFlow();
            return;
        }

        // If it's one of our sub-flows, handle it internally to keep the sidebar
        const subTarget = document.getElementById('business-subflow-container');
        if (subTarget && id !== 'settings' && id !== 'real-life' && id !== 'login') {
            const flow = this.availableFlows.find(f => f.id === id);
            if (flow && flow.launch) {
                this.currentSubFlowId = id;
                subTarget.innerHTML = "";
                flow.launch(subTarget, { step, onClose: () => this.closeSubFlow(), ...params });
                return;
            }
        }
        globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id, step, params } }));
      },

      closeSubFlow() {
        this.currentSubFlowId = null;
      },

      viewPromo(camp) {
        const promoFlowEntry = this.availableFlows.find(f => f.id === 'promo-flow');
        if (!promoFlowEntry?.launch) {
          console.warn("user-home-business: promo-flow service not available.");
          return;
        }
        // Append to document.body so position:fixed is not clipped by a hidden parent
        // (#business-subflow-container has x-show="currentSubFlowId" which may be null)
        const overlayEl = document.createElement('div');
        document.body.appendChild(overlayEl);
        promoFlowEntry.launch(overlayEl, {
          selectedPromo: camp,
          promos: [camp],
          channel: 'business',
          onDismiss: () => overlayEl.remove(),
        });
      }
    });

    // 1. Track Selection Service
    context.trackService(`(objectClass=${SELECTION_SERVICE})`, {
      addingService: (ref) => {
        state.selectionService = context.getService(ref);
        console.log("user-home-business: SelectionService arrived.");
        this.syncSelection(state);
      },
      removedService: () => {
        state.selectionService = null;
      }
    }).open();

    // 2. Track Session
    context.trackService(`(objectClass=${SESSION_SERVICE})`, {
      addingService: (ref) => {
        const session = context.getService(ref);
        state.session = session;
        Alpine.effect(() => {
          state.currentUser = session.currentUser;
          // Trigger re-render of flows when user or capabilities change
          if (state.currentUser) {
              state.availableFlows = [...state.availableFlows];
          }
          if (state.currentUserCap) {
             this.syncSelection(state);
          }
        });
      },
      removedService: () => {
        state.session = null;
        state.currentUser = null;
      }
    }).open();

    // 3. Track Config Admin
    context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
      addingService: (ref) => {
        state.configAdmin = context.getService(ref);
        
        // Listen for configuration updates to refresh businessFlows
        globalThis.addEventListener('config-updated', () => {
            state.availableFlows = [...state.availableFlows];
        });
      },
      removedService: () => {
        state.configAdmin = null;
      }
    }).open();

    // 4. Track Flows (Exclude order flows from the main sidebar menu)
    context.trackService(`(&(objectClass=${FLOW_SERVICE})(!(orderFlow=true)))`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        const id = service.id || ref.getProperty("flow.id");
        if (id && !state.availableFlows.find(f => f.id === id)) {
          // Ensure ID is available on the object for sorting/filtering
          if (!service.id) service.id = id;
          service.bsn = ref.getProperty("bundle.symbolicName") || ref.bundle.getSymbolicName();
          service.bundle = ref.bundle;
          service.flowType = ref.getProperty("flowType") || "component";
          service.channels = ref.getProperty("channels");
          state.availableFlows = [...state.availableFlows, service];
        }
      },
      removedService: (ref) => {
        const id = ref.getProperty("flow.id");
        state.availableFlows = state.availableFlows.filter(f => (f.id || f.getProperty?.("flow.id")) !== id);
        context.ungetService(ref);
      }
    }).open();

    // Register the flow
    const flowMetadata = {
      id: "user-home-business",
      title: "Business Dashboard",
      icon: "fas fa-building",
      launch: async (targetElement, _params = {}) => {
        state.currentSubFlowId = null; // Clean up any previous state
        const res = await fetch("./bundles/flows/user-home-business/templates/dashboard.html");
        const html = await res.text();
        
        globalThis.getUserHomeScope = () => ({
            get session() { return state.session },
            get availableFlows() { return state.availableFlows },
            get currentUser() { return state.currentUser },
            get currentUserCap() { return state.currentUserCap },
            get detailTab() { return state.detailTab },
            set detailTab(val) { state.detailTab = val },
            get currentSubFlowId() { return state.currentSubFlowId },
            set currentSubFlowId(val) { state.currentSubFlowId = val },
            get activeLicense() { return state.activeLicense },
            get businessFlows() { return state.businessFlows },
            get invitations() { return state.invitations },
            get updateTrigger() { return state.updateTrigger },
            
            getBundleConfig: (...args) => state.getBundleConfig(...args),
            getManifestChannels: (...args) => state.getManifestChannels(...args),
            isFlowEnabled: (...args) => state.isFlowEnabled(...args),
            launchFlow: (...args) => state.launchFlow(...args),
            closeSubFlow: (...args) => state.closeSubFlow(...args),
            viewPromo: (...args) => state.viewPromo(...args)
        });

        targetElement.innerHTML = `<div x-data="globalThis.getUserHomeScope()" class="h-full w-full">${html}</div>`;

        // Trigger evaluation recompile on launch
        if (globalThis.backofficeState?.recompile) {
          console.log("user-home-business: Triggering evaluation recompile...");
          globalThis.backofficeState.recompile();
        }

        // Listen for internal routing requests
        globalThis.addEventListener('business-launch-flow', (e) => {
            state.launchFlow(e.detail.id, e.detail.step, e.detail.params);
        });

        // Auto-trigger promo overlay — once per session only
        Alpine.effect(() => {
          if (globalThis.businessPortalState?.promoShownThisSession) return;
          
          const _userId = state.currentUser?.id;
          const cap = state.currentUserCap; // Reactive getter
          const modalPromos = (cap?.campaigns || []).filter(c => c.mode === 'modal');

          if (modalPromos.length > 0) {
            const promoFlowEntry = state.availableFlows.find(f => f.id === 'promo-flow');
            if (promoFlowEntry?.launch) {
              console.log("user-home-business: Showing promo overlay for", modalPromos.length, "modal campaign(s).");
              if (globalThis.businessPortalState) globalThis.businessPortalState.promoShownThisSession = true;
              const overlayEl = document.createElement('div');
              document.body.appendChild(overlayEl); // Full-screen overlay for desktop
              promoFlowEntry.launch(overlayEl, {
                promos: modalPromos,
                channel: 'business',
                onDismiss: () => overlayEl.remove(),
              });
            }
          }
        });
      }
    };

    // 5. Track Evaluation Data for gating
    context.trackService(`(objectClass=${EVAL_DATA_SERVICE})`, {
      addingService: (ref) => {
        state.evaluatorData = context.getService(ref);
        state.availableFlows = [...state.availableFlows];
      },
      removedService: () => {
        state.evaluatorData = null;
      }
    }).open();

    // 6. Track Envs
    context.trackService(`(objectClass=${ENV_SERVICE})`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        state.envServices = [...state.envServices, { ...service, id: ref.getProperty("env.id") || service.id }];
      }
    }).open();
    // 7. Track Invitations
    context.trackService(`(objectClass=${INVITATION_SERVICE})`, {
      addingService: (ref) => {
        state.invitationService = context.getService(ref);
      },
      removedService: () => {
        state.invitationService = null;
      }
    }).open();
    
    // 8. Listen for invitation updates via EventAdmin
    context.registerService(EVENT_HANDLER_INTERFACE, {
        handleEvent: (_event) => {
            state.updateTrigger++;
        }
    }, { [EVENT_TOPIC]: ['backoffice/invitations/*'] });

    // 9. Track Limes
    context.trackService(`(objectClass=${LIMES_SERVICE})`, {
      addingService: (ref) => {
        state.limes = context.getService(ref);
        state.updateTrigger++; // Force re-evaluation of getters
      },
      removedService: () => {
        state.limes = null;
        state.updateTrigger++;
      }
    }).open();

    context.registerService(FLOW_SERVICE, flowMetadata, { 
"flow.id": "user-home-business" });
  }

  syncSelection(state) {
    if (state.selectionService && state.currentUserCap?.license) {
      // ONLY sync if we are NOT in a retail environment
      const envId = state.session?.environment || "";
      if (envId.includes('mobile') || envId.includes('retail')) {
        console.log("user-home-business: Skipping syncSelection because environment is Retail:", envId);
        return;
      }

      const licenseId = typeof state.currentUserCap.license === 'object' ? state.currentUserCap.license.id : state.currentUserCap.license;
      state.selectionService.setSelection({ currentLicenseId: licenseId }, 'business');
    }
  }
}
