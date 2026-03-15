import { FLOW_SERVICE, CASE_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const state = Alpine.reactive({
      currentStep: "dashboard",
      allCases: [],
      caseService: null,
      selectedCase: null,

      get casesByType() {
        const groups = {};
        this.allCases.forEach(c => {
          const type = c.type || "unknown";
          if (!groups[type]) groups[type] = [];
          groups[type].push(c);
        });
        return groups;
      },

      inspectCase(caseItem) {
        console.log("Case Monitor: Inspecting case:", caseItem.id);
        this.selectedCase = caseItem;
      },

      closeCase() {
        this.selectedCase = null;
      },

      async loadStep(stepId) {
        this.currentStep = stepId;
        const response = await fetch(`./bundles/system-clients/case-monitor/templates/${stepId}.html`);
        const html = await response.text();
        this.targetElement.innerHTML = `<div x-data="globalThis.getCaseMonitorScope()" class="h-full w-full">${html}</div>`;
      },

      refresh() {
        console.log("Case Monitor: Refreshing...");
        if (this.caseService?.getCases) {
          this.allCases = [...this.caseService.getCases()];
        }
      },

      formatDate(iso) {
        if (!iso) return "N/A";
        return new Date(iso).toLocaleString();
      }
    });

    context.trackService(`(objectClass=${CASE_SERVICE})`, {
      addingService: (ref) => {
        console.log("Case Monitor: Case Service discovered.");
        state.caseService = context.getService(ref);
        state.refresh();
        
        // Listen for real-time updates via EventAdmin if possible, 
        // but for now we'll just refresh when service is added
      },
      removedService: () => { 
        console.log("Case Monitor: Case Service removed.");
        state.caseService = null;
      }
    }).open();

    const flowMetadata = {
      id: "case-monitor",
      title: "Case System Monitor",
      icon: "fas fa-bars",
      launch: async (targetElement) => {
        state.targetElement = targetElement;
        
        globalThis.getCaseMonitorScope = () => ({
            get currentStep() { return state.currentStep },
            get allCases() { return state.allCases },
            get casesByType() { return state.casesByType },
            get selectedCase() { return state.selectedCase },
            inspectCase: (c) => state.inspectCase(c),
            closeCase: () => state.closeCase(),
            refresh: () => state.refresh(),
            formatDate: (d) => state.formatDate(d)
        });

        targetElement._x_dataStack = [state];
        await state.loadStep("dashboard");
        state.refresh();
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "case-monitor",
      "flowType": "admin-flow",
      "channels": ["real-life"]
    });
  }
}
