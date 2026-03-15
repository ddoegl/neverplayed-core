import { FLOW_SERVICE, SESSION_SERVICE, SELECTION_SERVICE, LICENSE_DATA_SERVICE, CONFIG_ADMIN_SERVICE, ENV_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const state = Alpine.reactive({
      currentStep: "dashboard",
      _rawOrderableFlows: [], // All registered order flows
      orderFlowsConfig: null, // From ConfigAdmin
      selectedProduct: null,
      currentUser: null,
      currentLicenseId: null,
      filteredLicenseMembers: [],
      form: {
        selectedCompany: "NONE"
      },
      envServices: [],
      session: null,

      getManifestChannels(bundle) {
        if (!bundle) return undefined;
        const headers = bundle.getHeaders();
        const configKey = Object.keys(headers || {}).find(k => k.toLowerCase() === 'configuration');
        const configPriming = headers[configKey];
        if (!configPriming) return undefined;

        try {
            const primingData = typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
            return primingData.channels;
        } catch (_e) {
            return undefined;
        }
      },

      get orderableFlows() {
        const envId = this.session?.environment || "business-channel-web";
        const env = this.envServices.find(e => e.id === envId);
        const envType = env?.type || "desktop";
        const channelFlavor = envType === "mobile" ? "channel-app" : "channel-web";
        const channelId = `business-${channelFlavor}`;
        
        return this._rawOrderableFlows.filter(f => {
            const isEnabled = (() => {
                if (!f.bsn) return false; // Fail closed if no BSN
                if (!this.configAdmin) return true; // Fail open ONLY if service is missing (resilience)
                const props = this.configAdmin.getConfiguration(f.bsn).getProperties();
                const manifestChannels = this.getManifestChannels(f.bundle);
                const storedChannels = props.channels;

                // CRITICAL FIX: Empty array means "turned off", so we MUST check for undefined
                const channels = (storedChannels !== undefined) ? storedChannels : (manifestChannels !== undefined ? manifestChannels : []);
                
                return channels.includes(channelId);
            })();

            if (!isEnabled) return false;

            // Strict Filter: Only show legitimate order-flows
            return f.flowType === "order-flow";
        });
      },

      async loadStep(stepId) {
        this.currentStep = stepId;
        const stepName = stepId === "dashboard" ? "store-dashboard" : stepId;
        const response = await fetch(`./bundles/flows/store/templates/${stepName}.html`);
        const html = await response.text();
        this.targetElement.innerHTML = html;
      },

      viewProduct(product) {
        this.selectedProduct = product;
        this.form.selectedCompany = "NONE";
        this.loadStep("product-detail");
      },

      handleCompanyChange() {
        console.log("Store: Company changed to:", this.form.selectedCompany);
      },

      createApplication(product, companyId) {
        console.log(`Store: Creating application for ${product.id} (Company: ${companyId})`);
        
        // Use business-portal-launch so the order flow opens inside the business-channel-web
        // container rather than tearing out to the shell.
        globalThis.dispatchEvent(new CustomEvent('business-portal-launch', { 
            detail: { 
                id: product.id,
                params: {
                    companyId: companyId,
                    origin: "store"
                }
            } 
        }));
      }
    });

    // Track Order Flows
    context.trackService(`(&(objectClass=${FLOW_SERVICE})(orderFlow=true))`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        const id = ref.getProperty("flow.id");
        const metadata = {
          id,
          bsn: ref.bundle.getSymbolicName(), // Correctly resolve BSN
          title: service.title || id,
          icon: ref.getProperty("icon") || service.icon || "fas fa-box",
          description: ref.getProperty("description") || "No description available.",
          category: ref.getProperty("category") || "General",
          launch: service.launch,
          bundle: ref.bundle,
          flowType: ref.getProperty("flowType") || "component"
        };
        if (!state._rawOrderableFlows.find(f => f.id === id)) {
          state._rawOrderableFlows.push(metadata);
        }
      },
      removedService: (ref) => {
        const id = ref.getProperty("flow.id");
        state._rawOrderableFlows = state._rawOrderableFlows.filter(f => f.id !== id);
      }
    }).open();

    // Track Config Admin
    context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
      addingService: (ref) => {
        state.configAdmin = context.getService(ref);
      },
      removedService: () => {
        state.configAdmin = null;
      }
    }).open();

    // Track Session
    context.trackService(`(objectClass=${SESSION_SERVICE})`, {
      addingService: (ref) => {
        const session = context.getService(ref);
        state.session = session;
        Alpine.effect(() => {
          state.currentUser = session.currentUser;
        });
      },
      removedService: () => {
        state.session = null;
        state.currentUser = null;
      }
    }).open();

    // Track Selection
    context.trackService(`(objectClass=${SELECTION_SERVICE})`, {
      addingService: (ref) => {
        const selection = context.getService(ref);
        Alpine.effect(() => {
          state.currentLicenseId = selection.getSelection()?.currentLicenseId;
        });
      }
    }).open();

    context.trackService(`(objectClass=${LICENSE_DATA_SERVICE})`, {
      addingService: (ref) => {
        const licenseData = context.getService(ref);
        Alpine.effect(() => {
          if (state.currentLicenseId) {
            state.filteredLicenseMembers = licenseData.getFilteredMembers(state.currentLicenseId)
                .filter(m => m.type === 'company');
          } else {
            state.filteredLicenseMembers = [];
          }
        });
      }
    }).open();

    // Listen for configuration updates to refresh orderableFlows
    globalThis.addEventListener('config-updated', () => {
        // Trigger Alpine reactivity by bumping the raw array or just relying on the getter
        state._rawOrderableFlows = [...state._rawOrderableFlows];
    });

    context.trackService(`(objectClass=${ENV_SERVICE})`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        state.envServices = [...state.envServices, { ...service, id: ref.getProperty("env.id") || service.id }];
      }
    }).open();

    const flowMetadata = {
      id: "store",
      title: "Store",
      icon: "fas fa-shopping-cart",
      launch: async (targetElement) => {
        state.targetElement = targetElement;
        targetElement._x_dataStack = [state];
        await state.loadStep("dashboard");
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "store",
      "flowType": "service-flow"
    });
  }
}
