import { FLOW_SERVICE, EMAIL_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const state = Alpine.reactive({
      currentStep: "dashboard",
      allEmails: [],
      emailService: null,
      selectedEmail: null,

      inspectEmail(email) {
          console.log("Email Monitor: Inspecting payload for:", email.id);
          this.selectedEmail = email;
      },

      closePayload() {
          this.selectedEmail = null;
      },

      async loadStep(stepId) {
        this.currentStep = stepId;
        const response = await fetch(`./bundles/system-clients/email-monitor/templates/${stepId}.html`);
        const html = await response.text();
        this.targetElement.innerHTML = `<div x-data="globalThis.getEmailMonitorScope()" class="h-full w-full">${html}</div>`;
      },

      refresh() {
          // This is a bit of a hack since we don't have a "getAll" in the service yet, 
          // but we can peek into the service if we need or just show a message.
          // Actually, let's update the service to allow peeking for admins.
          console.log("Email Provider UI: Refreshing...");
          // For now, we'll rely on the service to provide what it can.
          // In a real system, there would be a secure admin API.
          if (this.emailService?.getAllEmails) {
              this.allEmails = this.emailService.getAllEmails();
          }
      },

      formatDate(iso) {
          return new Date(iso).toLocaleString();
      }
    });

    context.trackService(`(objectClass=${EMAIL_SERVICE})`, {
      addingService: (ref) => {
        console.log("Email Monitor: Email Service discovered.");
        state.emailService = context.getService(ref);
        state.refresh();
        
        // Listen for real-time updates
        const handler = (event) => {
            console.log("Email Monitor: Received email-received event. Refreshing...", event.detail);
            state.refresh();
        };
        globalThis.addEventListener('email-received', handler);
        state._cleanup = () => globalThis.removeEventListener('email-received', handler);
      },
      removedService: () => { 
        console.log("Email Monitor: Email Service removed.");
        state.emailService = null;
        if (state._cleanup) state._cleanup();
      }
    }).open();

    const flowMetadata = {
      id: "email-provider-ui",
      title: "Email Provider Monitor",
      icon: "fas fa-mail-bulk",
      launch: async (targetElement) => {
        state.targetElement = targetElement;
        
        globalThis.getEmailMonitorScope = () => ({
            get currentStep() { return state.currentStep },
            get allEmails() { return state.allEmails },
            get selectedEmail() { return state.selectedEmail },
            inspectEmail: (e) => state.inspectEmail(e),
            closePayload: () => state.closePayload(),
            refresh: () => state.refresh(),
            formatDate: (d) => state.formatDate(d)
        });

        targetElement._x_dataStack = [state];
        await state.loadStep("dashboard");
        state.refresh();
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "email-provider-ui",
      "flowType": "admin-flow"
    });
  }
}
