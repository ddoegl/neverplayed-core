import { FLOW_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  async start(context) {
    const flowMetadata = {
      id: "modern-desktop-app",
      title: "Modern Desktop",
      icon: "fas fa-desktop",
      launch: async (targetElement) => {
        const state = Alpine.reactive({
          currentStep: "welcome",
          flowName: "Modern Desktop",
          subflowReturnFlow: "user-home",

          async loadStep(stepId) {
            this.currentStep = stepId;
            let response = await fetch(`./bundles/user-clients/modern-desktop-app/templates/${stepId}.html`);
            if (!response.ok) {
                response = await fetch(`./shared/templates/${stepId}.html`);
            }
            
            const stepHtml = response.ok ? await response.text() : `<div class="p-8 text-red-500">Step template not found: ${stepId}</div>`;
            
            const contentArea = targetElement.querySelector(".flow-content-area");
            if (contentArea) {
                contentArea.innerHTML = stepHtml;
            } else {
                const layoutResponse = await fetch(`./bundles/user-clients/modern-desktop-app/templates/layout.html`);
                let layoutHtml = await layoutResponse.text();
                layoutHtml = layoutHtml.replace("{{{flowContent}}}", '<div class="flow-content-area">' + stepHtml + '</div>');
                targetElement.innerHTML = layoutHtml;
            }
          },

          selectFlow(id) {
            targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id }, bubbles: true }));
          },

          nextStep(nextId) {
              this.loadStep(nextId);
          }
        });

        targetElement._x_dataStack = [state];
        await state.loadStep("welcome");
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": "modern-desktop-app" });
  }
}
