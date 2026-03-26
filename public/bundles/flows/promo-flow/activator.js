import { FLOW_SERVICE, SESSION_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    context.registerService(FLOW_SERVICE, {
      id: "promo-flow",
      title: "Promotion Flow",
      icon: "fas fa-bullhorn",

      launch: async (targetElement, params = {}) => {
        // Resolve promos: prefer passed-in list, else query current user's modal campaigns
        let { promos, channel = "business", onDismiss } = params;

        if (!promos || promos.length === 0) {
          const sessionRef = context.getServiceReference(SESSION_SERVICE);
          const session = sessionRef ? context.getService(sessionRef) : null;
          const userId = session?.currentUser?.id;
          const allStates = [globalThis.backofficeState, globalThis.businessPortalState, globalThis.retailPortalState].filter(Boolean);
          const cap = userId
            ? allStates.flatMap(s => s.evaluatedData || []).find(e => String(e.user) === String(userId))
            : null;
          promos = (cap?.campaigns || []).filter(c => c.mode === 'modal');
          console.log("promo-flow: Resolved", promos.length, "modal campaign(s) from evaluated data.");
        }

        // ── Dismiss logic ─────────────────────────────────────────────────────
        // Extracted as a plain closure so both @click="dismiss()" in templates AND
        // nextPromo()'s internal call use the same function without relying on `this` binding.
        const doDismiss = () => {
          if (typeof onDismiss === "function") {
            onDismiss(); // auto-triggered path: remove the overlay element
          } else {
            // Sidebar / portal path: business-portal-launch → business-channel-web's state.loadStep()
            globalThis.dispatchEvent(new CustomEvent("business-portal-launch", {
              detail: { id: "user-home-business" }
            }));
          }
        };

        // ── Reactive state ────────────────────────────────────────────────────
        const state = Alpine.reactive({
          promoFlow: {
            promos: [...promos],
            currentIndex: 0,
            selectedPromo: null,
          },
          currentChannel: channel,
          isContained: channel === 'retail', // Contained for retail simulator

          dismiss: doDismiss, // ← direct closure, no `this` needed

          nextPromo() {
            const pf = this.promoFlow;
            if (pf.currentIndex < pf.promos.length - 1) {
              pf.currentIndex++;
            } else {
              doDismiss(); // ← call closure directly, avoids nested-scope `this` issue
            }
          },

          redeemPromo(promo) {
            this.promoFlow.selectedPromo = promo;
            this._loadStep("promo-viewer");
          },

          async _loadStep(stepId) {
            const res = await fetch(`./bundles/flows/promo-flow/templates/${stepId}.html`);
            if (!res.ok) return;
            const contentArea = document.getElementById("promo-flow-content-area");
            if (contentArea) contentArea.innerHTML = await res.text();
          },
        });

        // Load layout template
        const layoutRes = await fetch("./bundles/flows/promo-flow/templates/layout.html");
        if (!layoutRes.ok) { targetElement.innerHTML = ""; return; }
        const layoutHtml = await layoutRes.text();

        // Expose via globalThis — layout.html uses x-data="globalThis.promoFlowState"
        // This avoids _x_dataStack + Alpine.initTree double-bind issues
        globalThis.promoFlowState = state;

        // Set innerHTML AFTER globalThis is ready — Alpine MutationObserver picks up x-data
        targetElement.innerHTML = layoutHtml.replace(
          "{{{flowContent}}}",
          `<div id="promo-flow-content-area"></div>`
        );

        // Load initial step — jump to viewer if a specific promo was requested
        if (params.selectedPromo) {
          state.promoFlow.selectedPromo = params.selectedPromo;
          await state._loadStep("promo-viewer");
        } else {
          await state._loadStep("promo-stepper");
        }
      },
    }, {
      "flow.id": "promo-flow",
      "flowType": "service-flow", // Visible in sidebar; channel visibility controlled by configAdmin
      "channels": ["business-channel-web", "retail-channel-app"]
    });
  }
}
