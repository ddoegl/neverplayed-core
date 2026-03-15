import { FLOW_SERVICE, SESSION_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    console.log("Activator: Starting user-home-retail...");

    const globalState = Alpine.reactive({
      availableFlows: []
    });

    // Track Flows to find promo-flow
    context.trackService(`(objectClass=${FLOW_SERVICE})`, {
      addingService: (ref) => {
        const service = context.getService(ref);
        const id = service.id || ref.getProperty("flow.id");
        if (id && !globalState.availableFlows.find(f => f.id === id)) {
          if (!service.id) service.id = id;
          service.launch = service.launch || ref.getProperty("launch");
          globalState.availableFlows = [...globalState.availableFlows, service];
        }
      },
      removedService: (ref) => {
        const id = ref.getProperty("flow.id");
        globalState.availableFlows = globalState.availableFlows.filter(f => f.id !== id);
      }
    }).open();

    const flowMetadata = {
      id: "user-home-retail",
      title: "Retail Home",
      launch: async (targetElement, params = {}) => {
        // Lazy lookup of services
        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        const sessionSvc = sessionRef ? context.getService(sessionRef) : { currentUser: null };

        const state = Alpine.reactive({
          session: sessionSvc,
          detailTab: "promotions",
          targetElement: targetElement,
          dashboardReady: false, // New readiness flag
          get currentUser() { return this.session.currentUser; },
          get availableFlows() { return globalState.availableFlows; },
          get currentUserCap() {
            const user = this.currentUser;
            if (!user) return null;
            const evalData = (globalThis.backofficeState?.evaluatedData) || [];
            const userId = user.id || user.alias || user;
            return evalData.find(c => String(c.user) === String(userId) || (c.rawUser && c.rawUser.alias === user.alias)) || null;
          },
          viewPromo(camp) {
            const promoFlowEntry = this.availableFlows.find(f => f.id === 'promo-flow');
            if (promoFlowEntry?.launch) {
              const overlayEl = document.createElement('div');
              this.targetElement.appendChild(overlayEl); // Mount inside phone frame
              promoFlowEntry.launch(overlayEl, {
                selectedPromo: camp,
                promos: [camp],
                channel: 'retail',
                onDismiss: () => overlayEl.remove(),
              });
            }
          },
          
          async loadStep(step) {
            const path = `./bundles/flows/user-home-retail/templates/${step}.html`;
            const response = await fetch(path);
            const html = response.ok ? await response.text() : `<div class="p-8 text-red-500">Retail Template not found: ${path}</div>`;
            
            globalThis.getRetailHomeScope = () => ({
                get isMobile() { 
                  const env = state.session?.environment || "";
                  return env.includes('mobile') || env.includes('retail');
                },
                get session() { return state.session },
                get currentUser() { return state.currentUser },
                get currentUserCap() { return state.currentUserCap },
                get detailTab() { return state.detailTab },
                set detailTab(val) { state.detailTab = val },
                get availableFlows() { return state.availableFlows },
                viewPromo: (...args) => state.viewPromo(...args),
                loadStep: (...args) => state.loadStep(...args)
            });

            state.targetElement.innerHTML = `<div x-data="globalThis.getRetailHomeScope()" class="h-full w-full">${html}</div>`;
            state.dashboardReady = true; // Mark as rendered
          }
        });

        // Initialize portal state if missing
        globalThis.retailPortalState = globalThis.retailPortalState || { promoShownThisSession: false };

        // Auto-trigger promo overlay
        Alpine.effect(() => {
          // Explicitly track flows, user capabilities, AND rendering readiness
          const flows = state.availableFlows;
          const cap = state.currentUserCap;
          const isReady = state.dashboardReady;
          
          if (!isReady) return; // Wait for dashboard to finish innerHTML injection
          
          if (globalThis.retailPortalState?.promoShownThisSession) return;

          if (!cap) return;

          const modalPromos = (cap?.campaigns || []).filter(c => c.mode === 'modal');

          if (modalPromos.length > 0) {
            const promoFlowEntry = flows.find(f => f.id === 'promo-flow');
            
            if (promoFlowEntry?.launch) {
              console.log("user-home-retail: Launching auto-promo modal...");
              globalThis.retailPortalState.promoShownThisSession = true;
              const overlayEl = document.createElement('div');
              overlayEl.className = 'absolute inset-0 z-[100]'; // Ensure it's above cards
              state.targetElement.appendChild(overlayEl); // Mount inside phone frame
              promoFlowEntry.launch(overlayEl, { promos: modalPromos, channel: 'retail', onDismiss: () => overlayEl.remove() });
            }
          }
        });

        const initialStep = params.step || "dashboard";
        await state.loadStep(initialStep);
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "user-home-retail",
      "flow.title": "Retail Home",
      "flow.icon": "fas fa-home",
      "flowType": "web-channel",
      "channels": ["retail-channel-app"]
    });
  }
}
