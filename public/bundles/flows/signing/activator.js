import { FLOW_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const flowMetadata = {
      id: "signing",
      title: "Secure Verification",
      icon: "fas fa-shield-alt",
      launch: async (targetElement, params = {}) => {
        const state = Alpine.reactive({
          signee: params.signee || {},
          summaryHtml: params.summaryHtml || '<p>Awaiting signature confirmation.</p>',
          actionTitle: params.actionTitle || 'Secure Verification',
          onSuccess: params.onSuccess,
          onCancel: params.onCancel,

          parsedSCAStrategies: {},
          parsedSCAMethods: {},

          completeVerification(methodId) {
            console.log("Signing Flow: Completed verification using", methodId, "Routing to success callback.");
            if (this.onSuccess) {
                // Shell-level flows (login, real-life, etc.) must always go through the global shell
                const shellFlows = ['login', 'real-life', 'backoffice-web', 'email-client'];
                const targetFlow = this.onSuccess.flow;
                const isShellFlow = shellFlows.includes(targetFlow);

                let eventName = 'shell-launch-flow';
                if (!isShellFlow) {
                    const isBusinessPortal = !!document.getElementById('portal-root-container');
                    const isRetailPortal = !!document.getElementById('retail-root-container');
                    const isSubflow = !!document.getElementById('business-subflow-container');
                    eventName = isBusinessPortal ? 'business-portal-launch' : (isRetailPortal ? 'retail-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow'));
                }

                globalThis.dispatchEvent(new CustomEvent(eventName, { 
                    detail: { 
                        id: targetFlow, 
                        step: this.onSuccess.step, 
                        params: { ...this.onSuccess, methodId } 
                    } 
                }));
            } else {
                alert("Verification complete, but no success route defined.");
            }
          },

          cancelVerification() {
            if (this.onCancel) {
                const shellFlows = ['login', 'real-life', 'backoffice-web', 'email-client'];
                const targetFlow = this.onCancel.flow;
                const isShellFlow = shellFlows.includes(targetFlow);

                let eventName = 'shell-launch-flow';
                if (!isShellFlow) {
                    const isBusinessPortal = !!document.getElementById('portal-root-container');
                    const isRetailPortal = !!document.getElementById('retail-root-container');
                    const isSubflow = !!document.getElementById('business-subflow-container');
                    eventName = isBusinessPortal ? 'business-portal-launch' : (isRetailPortal ? 'retail-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow'));
                }

                globalThis.dispatchEvent(new CustomEvent(eventName, { 
                    detail: { 
                        id: targetFlow, 
                        step: this.onCancel.step, 
                        params: this.onCancel.params 
                    } 
                }));
            } else {
                globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: 'real-life' } }));
            }
          }
        });

        // Fetch SCA Data
        const scaDataRef = context.getServiceReference("backoffice.sca.data");
        const scaMethodsRef = context.getServiceReference("backoffice.sca.methods");

        if (scaDataRef) {
          const strats = context.getService(scaDataRef).getSCAStrategies() || [];
          state.parsedSCAStrategies = strats.reduce((acc, s) => ({ ...acc, [s.id]: s }), {});
        }
        if (scaMethodsRef) {
          const methods = context.getService(scaMethodsRef).getSCAMethods() || [];
          state.parsedSCAMethods = methods.reduce((acc, m) => ({ ...acc, [m.id]: m }), {});
        }

        targetElement._x_dataStack = [state];

        const response = await fetch(`./bundles/flows/signing/templates/sca-selection.html`);
        if (response.ok) {
            targetElement.innerHTML = await response.text();
        } else {
            console.error("Signing Flow: Could not map template.");
        }
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "signing",
      "flowType": "component"
    });
  }
}
