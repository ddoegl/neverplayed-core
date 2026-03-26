import { FLOW_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const flowMetadata = {
      id: "sca-migration",
      title: "SCA Migration",
      icon: "fas fa-shield-alt",
      launch: async (targetElement) => {
        const state = Alpine.reactive({
          currentStep: "intro",
          flowName: "SCA Migration",
          subflowReturnFlow: "user-home", // Default return

          async loadStep(stepId) {
            this.currentStep = stepId;
            const stepResponse = await fetch(`./bundles/flows/sca-migration/templates/${stepId}.html`);
            const stepHtml = await stepResponse.text();
            
            // Re-render the layout if it's not there, then inject content
            const contentArea = targetElement.querySelector(".flow-content-area");
            if (contentArea) {
                contentArea.innerHTML = stepHtml;
            } else {
                const layoutResponse = await fetch(`./bundles/flows/sca-migration/templates/layout.html`);
                let layoutHtml = await layoutResponse.text();
                // Replace the placeholder with a marker div
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

        // Initialize
        targetElement._x_dataStack = [state];
        await state.loadStep("intro");
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": "sca-migration" });
  }
}
