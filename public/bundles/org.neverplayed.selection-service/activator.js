import { SELECTION_SERVICE, SESSION_SERVICE, CONTRIBUTION_SERVICE, PERSONS_SERVICE, COMPANIES_SERVICE } from "core-types";
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

    // --- Coordination Pattern: Watch Session Service ---
    context.trackService(`(objectClass=${SESSION_SERVICE})`, {
      addingService: (ref) => {
        const session = context.getService(ref);
        // Watch for logout (currentUser becomes null or guest)
        Alpine.effect(() => {
          const user = session.currentUser;
          if (!user || user.id === 'guest') {
            state.clearAllSelections();
          }
        });
        return session;
      }
    }).open();

    context.registerService(SELECTION_SERVICE, state);
    console.log("SelectionService: Registered 🌌✨");

    // --- State Contribution Pattern ---
    context.trackService(`(objectClass=${CONTRIBUTION_SERVICE})`, {
      addingService: (ref) => {
        const contributionSvc = context.getService(ref);
        
        const licenseGetters = {
          currentLicense: {
            get: function() {
              if (typeof context.isValid === 'function' && !context.isValid()) return null;
              const sel = context.getService(context.getServiceReference(SELECTION_SERVICE));
              return sel?.getSelection('business')?.currentLicenseId || null;
            },
            configurable: true,
            enumerable: true
          },
          activeLicense: {
            get: function() {
              if (typeof context.isValid === 'function' && !context.isValid()) return null;
              const licenses = (this.parsedLicenses?.LICENSES || []);
              const currentId = this.currentLicense;
              if (!currentId) return null;
              return licenses.find(l => String(l.id) === String(currentId));
            },
            configurable: true,
            enumerable: true
          },
          persons: {
            get: function() {
              if (typeof context.isValid === 'function' && !context.isValid()) return [];
              const ref = context.getServiceReference(PERSONS_SERVICE);
              return ref ? context.getService(ref).getPersons() || [] : [];
            },
            configurable: true, enumerable: true
          },
          companies: {
            get: function() {
              if (typeof context.isValid === 'function' && !context.isValid()) return [];
              const ref = context.getServiceReference(COMPANIES_SERVICE);
              return ref ? context.getService(ref).getCompanies() || [] : [];
            },
            configurable: true, enumerable: true
          },
          allAvailableCustomers: {
            get: function() {
              return [
                ...this.companies.map(c => ({ id: c.id, name: c.name, type: "Company" })),
                ...this.persons.map(p => ({ id: p.id, name: `${p.firstname || ''} ${p.lastname || ''}`.trim(), type: "Person" }))
              ];
            },
            configurable: true, enumerable: true
          }
        };

        console.log("SelectionService: Contributing domain getters to platform stores...");
        contributionSvc.contribute('backoffice', licenseGetters);
        
        // --- Business Portal Handshake ---
        contributionSvc.contribute('business', {
          ...licenseGetters,
          parsedLicenses: {
            get: function() {
              return globalThis.backofficeState?.parsedLicenses || { LICENSES: [] };
            },
            configurable: true, enumerable: true
          }
        });
        
        return contributionSvc;
      }
    }).open();
  }

  async stop(_context) {}
}
