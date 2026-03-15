import { FLOW_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const flowMetadata = {
      id: "redeem-invite",
      title: "Redeem Invitation",
      icon: "fas fa-envelope-open-text",
      launch: async (targetElement, params = {}) => {
        const state = Alpine.reactive({
          currentStep: params.step || "redeem-code",
          flowName: "Redeem Invitation",
          subflowReturnFlow: "user-home-retail",
          session: null,
          invitationService: null,
          invitation: {
            code: params.code || "VZY9I0",
            otp: "123456",
            firstname: "July",
            lastname: "Wiser",
            companyName: "Bike Value Logistics GmbH",
            birthdate: "31.08.1984"
          },
          
          get currentFellow() {
            return { firstname: "Rob", lastname: "Richter" };
          },
          get currentAdmin() {
            return this.currentFellow;
          },
          get selectedPerson() {
            return this.session?.currentUser || this.invitation;
          },

          getInitials(p) {
            if (!p) return "?";
            return ((p.firstname?.[0] || "") + (p.lastname?.[0] || "")).toUpperCase();
          },

          acceptInvitation() {
            console.log("Activator: acceptInvitation() called for code:", this.invitation.code);
            
            if (this.invitationService && !this.invitationData) {
                this.invitationData = this.invitationService.getInvitationByCode(this.invitation.code);
            }

            if (this.invitationService) {
                this.invitationService.redeemInvitation(this.invitation.code, this.selectedPerson);
            }

            this.loadStep('success');
          },

          async loadStep(stepId) {
            this.currentStep = stepId;
            let response = await fetch(`./bundles/flows/redeem-invite/templates/${stepId}.html`);
            if (!response.ok) {
                response = await fetch(`./shared/templates/${stepId}.html`);
            }
            
            const stepHtml = response.ok ? await response.text() : `<div class="p-8 text-red-500">Step template not found: ${stepId}</div>`;
            
            const contentArea = targetElement.querySelector(".flow-content-area");
            if (contentArea) {
                contentArea.innerHTML = stepHtml;
            } else {
                const layoutResponse = await fetch(`./bundles/flows/redeem-invite/templates/layout.html`);
                let layoutHtml = await layoutResponse.text();
                layoutHtml = layoutHtml.replace("{{{flowContent}}}", '<div class="flow-content-area">' + stepHtml + '</div>');
                targetElement.innerHTML = layoutHtml;
            }
          },

          selectFlow(id) {
            console.log("Activator: selectFlow() called for:", id);
            targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id }, bubbles: true }));
          }
        });

        // Track Services
        const { SESSION_SERVICE, INVITATION_SERVICE: INV_SVC, CASE_SERVICE: CASE_SVC } = await import("../../../shared-types.js");
        
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => { state.session = context.getService(ref); },
            removedService: () => { state.session = null; }
        }).open();

        context.trackService(`(objectClass=${INV_SVC})`, {
            addingService: (ref) => { state.invitationService = context.getService(ref); },
            removedService: () => { state.invitationService = null; }
        }).open();

        context.trackService(`(objectClass=${CASE_SVC})`, {
            addingService: (ref) => { state.caseService = context.getService(ref); },
            removedService: () => { state.caseService = null; }
        }).open();

        targetElement._x_dataStack = [state];
        await state.loadStep(state.currentStep);
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "redeem-invite",
      "flow.title": "Redeem Invitation",
      "flow.icon": "fas fa-envelope-open-text",
      "flowType": "service-flow",
      "channels": ["retail-channel-app"]
    });
  }
}
