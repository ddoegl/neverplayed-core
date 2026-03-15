import { SELECTION_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    console.log("SelectionService: Starting...");

    const state = Alpine.reactive({
      contexts: {
        default: { currentLicenseId: null, selectedCompanyId: null, selectedPersonId: null },
        business: { currentLicenseId: null, selectedCompanyId: null, selectedPersonId: null },
        retail: { currentLicenseId: null, selectedCompanyId: null, selectedPersonId: null }
      },
      
      setSelection(patch, contextId = 'default') {
        if (!this.contexts[contextId]) {
          this.contexts[contextId] = {
            currentLicenseId: null,
            selectedCompanyId: null,
            selectedPersonId: null,
          };
        }
        console.log(`SelectionService: Updating selection for context [${contextId}]`, patch);
        Object.assign(this.contexts[contextId], patch);
        globalThis.dispatchEvent(new CustomEvent('selection-changed', { 
          detail: { ...patch, contextId } 
        }));
      },
      
      getSelection(contextId = 'default') {
        return this.contexts[contextId] || this.contexts.default;
      },

      clearAllSelections() {
        console.log("SelectionService: Clearing all selections...");
        this.contexts.default = { currentLicenseId: null, selectedCompanyId: null, selectedPersonId: null };
        this.contexts.business = { currentLicenseId: null, selectedCompanyId: null, selectedPersonId: null };
        this.contexts.retail = { currentLicenseId: null, selectedCompanyId: null, selectedPersonId: null };
        globalThis.dispatchEvent(new CustomEvent('selection-changed', { detail: { contextId: 'all', cleared: true } }));
      },
      
      // Backward compatibility getters for 'default' context
      get currentLicenseId() { return this.contexts.default.currentLicenseId; },
      get selectedCompanyId() { return this.contexts.default.selectedCompanyId; },
      get selectedPersonId() { return this.contexts.default.selectedPersonId; }
    });

    context.registerService(SELECTION_SERVICE, state);
    console.log("SelectionService: Registered.");
  }

  async stop(_context) {}
}
