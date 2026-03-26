import { FLOW_SERVICE, SESSION_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    context.registerService(FLOW_SERVICE, {
      id: "business-credit-card-order",
      title: "Business Credit Card Order",
      icon: "fas fa-credit-card",

      launch: async (targetElement, params = {}) => {
        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        const session = sessionRef ? context.getService(sessionRef) : null;

        const state = Alpine.reactive({
          currentStep: "order-init",
          companies: globalThis.backofficeState?.companies || [],
          fellows: globalThis.backofficeState?.persons || [],
          currentApplication: {
            productName: "Business Credit Card Order",
            companyId: params.companyId || null,
            fellowId: "NONE",
          },

          async loadStep(stepId) {
            this.currentStep = stepId;
            let response = await fetch(`./bundles/flows/business-credit-card-order/templates/${stepId}.html`);
            if (!response.ok) response = await fetch(`./shared/templates/${stepId}.html`);
            if (response.ok) {
              targetElement.innerHTML = await response.text();
            } else {
              targetElement.innerHTML = `<div class="p-8 text-red-500">Step template not found: ${stepId}</div>`;
            }
          },

          selectFlow(id) {
            globalThis.dispatchEvent(new CustomEvent("business-portal-launch", { detail: { id } }));
          },

          nextStep(nextId) { this.loadStep(nextId); },

          handleApplicationFellowChange() {
            console.log("business-credit-card-order: Fellow changed to:", this.currentApplication.fellowId);
          },

          submitApplication() {
            const { companyId, fellowId, productName } = this.currentApplication;
            console.log("business-credit-card-order: Submitting application", { productName, companyId, fellowId, user: session?.currentUser?.id });
            alert(`Order submitted!\n\nProduct: ${productName}\nCompany: ${this.companies.find(c => c.id === companyId)?.name || companyId}`);
            this.selectFlow("store");
          },
        });

        targetElement._x_dataStack = [state];
        await state.loadStep("order-init");
      },
    }, {
      "flow.id": "business-credit-card-order",
      "flowType": "order-flow",
      "orderFlow": true,
      "description": "Apply for a business credit card with flexible limits and rewards.",
      "category": "Cards",
      "icon": "fas fa-credit-card"
    });
  }
}
