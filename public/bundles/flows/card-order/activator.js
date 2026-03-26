import { FLOW_SERVICE, SESSION_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    context.registerService(FLOW_SERVICE, {
      id: "card-order",
      title: "Card Order",
      icon: "fas fa-credit-card",

      launch: async (targetElement, params = {}) => {
        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        const session = sessionRef ? context.getService(sessionRef) : null;

        const state = Alpine.reactive({
          currentStep: "dashboard",
          cards: [], // populated below from backoffice state

          // Data pulled from global state
          companies: globalThis.backofficeState?.companies || [],
          fellows: globalThis.backofficeState?.persons || [],

          // Application context (supplied by Store on launch)
          currentApplication: {
            productName: "Card Order",
            companyId: params.companyId || null,
            fellowId: "NONE",
          },

          async loadStep(stepId) {
            this.currentStep = stepId;
            const fileName = stepId === "dashboard" ? "dashboard-card-order" : stepId;
            let response = await fetch(`./bundles/flows/card-order/templates/${fileName}.html`);
            if (!response.ok) response = await fetch(`./shared/templates/${fileName}.html`);
            if (response.ok) {
              targetElement.innerHTML = await response.text();
            } else {
              targetElement.innerHTML = `<div class="p-8 text-red-500">Step template not found: ${fileName}</div>`;
            }
          },

          selectCard(card) {
            this.currentApplication.productName = card.title || "Card Order";
          },

          selectFlow(id) {
            globalThis.dispatchEvent(new CustomEvent("business-portal-launch", { detail: { id } }));
          },

          nextStep(nextId) { this.loadStep(nextId); },

          handleApplicationFellowChange() {
            console.log("card-order: Fellow changed to:", this.currentApplication.fellowId);
          },

          submitApplication() {
            const { companyId, fellowId, productName } = this.currentApplication;
            const currentUser = session?.currentUser;
            console.log("card-order: Submitting application", { productName, companyId, fellowId, user: currentUser?.id });
            alert(`Application submitted!\n\nProduct: ${productName}\nCompany: ${companies.find(c => c.id === companyId)?.name || companyId}\nUser: ${currentUser?.alias || currentUser?.id || 'Unknown'}`);
            this.selectFlow("store");
          },
        });

        // Populate cards from any order flows registered as card products (PoC: stub list)
        state.cards = [
          { id: "virtual-card-order", title: "Virtual Card", html: `<div class="font-bold">Virtual Card</div><div class="text-sm text-gray-500">Instant online card</div>` },
          { id: "business-credit-card-order", title: "Business Credit Card", html: `<div class="font-bold">Business Credit Card</div><div class="text-sm text-gray-500">Flexible limit card</div>` },
        ];

        state.targetElement = targetElement;
        globalThis.cardOrderState = state;
        targetElement._x_dataStack = [state];

        // If launched from Store with a companyId, skip the dashboard
        if (params.companyId) {
          await state.loadStep("order-init");
        } else {
          await state.loadStep("dashboard");
        }
      },
    }, {
      "flow.id": "card-order",
      "flowType": "order-flow",
      "orderFlow": true,
      "description": "Order a new physical or virtual debit card for your business account.",
      "category": "Cards",
      "icon": "fas fa-credit-card"
    });
  }
}
