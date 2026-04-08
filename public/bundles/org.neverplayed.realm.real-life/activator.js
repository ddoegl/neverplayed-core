/**
 * @file Activator for org.neverplayed.realm.real-life
 * @module platform/bundles/org.neverplayed.realm.real-life
 */

import { 
  FLOW_SERVICE, 
  CONFIG_ADMIN_SERVICE as _CONFIG_ADMIN_SERVICE, 
  ENV_SERVICE, 
  SESSION_SERVICE, 
  PERSONS_SERVICE, 
  COMPANIES_SERVICE, 
  TENANT_DATA_SERVICE, 
  LICENSE_DATA_SERVICE, 
  FELLOWS_SERVICE as _FELLOWS_SERVICE, 
  REALLIFE_FLOW, 
  MOBILE_LAUNCHER_FLOW,
  CONFIG_ADMIN_UI_FLOW,
  COMPANY_REGISTRY_FLOW,
  PERSON_REGISTRY_FLOW,
  BACKOFFICE_WEB_FLOW,
  EMAIL_MONITOR_FLOW,
  CASE_MONITOR_FLOW
} from "core-types";
import { AlpineActivator } from "alpine-base";
import _Alpine from "alpinejs";

export default class Activator extends AlpineActivator {
  onStart(context) {
    // 1. Initialize reactive store
    const state = this.initStore('real_life', {
      persons: [],
      companies: [],
      parsedTenants: { TENANTS: [] },
      parsedLicenses: { LICENSES: [] },
      fellows: [],
      selectedPerson: null,
      selectedCompany: null,
      availableFlows: [],
      
      // Constants
      CONFIG_ADMIN_UI_FLOW, COMPANY_REGISTRY_FLOW, PERSON_REGISTRY_FLOW, BACKOFFICE_WEB_FLOW,
      EMAIL_MONITOR_FLOW, CASE_MONITOR_FLOW, REALLIFE_FLOW,
      
      get personUsers() {
         if (!this.selectedPerson || !this.parsedLicenses) return [];
         return (this.parsedLicenses.LICENSES || []).flatMap(lic => 
            (lic.USERS || []).filter(u => String(u.owner) === String(this.selectedPerson.id) || String(u.holder) === String(this.selectedPerson.id))
            .map(u => ({ ...u, licenseId: lic.id }))
         );
      },
      get linkedTenants() {
         if (!this.selectedPerson || !this.parsedTenants) return [];
         return (this.parsedTenants.TENANTS || []).filter(t => (t.customers || []).some(c => String(c.id) === String(this.selectedPerson.id)));
      }
    });

    // 2. Define Dashboard logic
    const controllerFactory = () => ({
      get state() { return state; },
      selectPerson(p) { state.selectedPerson = p; this.loadStep('persona'); },
      selectCompany(c) { state.selectedCompany = c; this.loadStep('company-home'); },
      async loadStep(step) {
          await this.$activator.render('#real-life-host', `templates/${step}.html`, controllerFactory);
      },
      switchEnvironment(id) {
          const envSvc = context.getService(context.getServiceReferences(ENV_SERVICE, `(env.id=${id})`)[0]);
          if (envSvc) {
              envSvc.onActivate(context.getService(context.getServiceReference(SESSION_SERVICE)));
              const flowId = (id === "mobile-device") ? MOBILE_LAUNCHER_FLOW : WEB_SPRINGBOARD_FLOW;
              globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: flowId } }));
          }
      }
    });

    // 3. Track Resources
    this.track(`(objectClass=${PERSONS_SERVICE})`, { addingService: (ref) => state.persons = context.getService(ref).getPersons() || [] });
    this.track(`(objectClass=${COMPANIES_SERVICE})`, { addingService: (ref) => state.companies = context.getService(ref).getCompanies() || [] });
    this.track(`(objectClass=${TENANT_DATA_SERVICE})`, { addingService: (ref) => state.parsedTenants = context.getService(ref).getTenants() || { TENANTS: [] } });
    this.track(`(objectClass=${LICENSE_DATA_SERVICE})`, { addingService: (ref) => state.parsedLicenses = context.getService(ref).getLicenses() || { LICENSES: [] } });
    
    // 4. Register Flow
    context.registerService(FLOW_SERVICE, {
      id: REALLIFE_FLOW,
      title: "Real Life",
      launch: async (target) => {
        target.id = "real-life-host";
        await this.render("#real-life-host", "templates/dashboard.html", controllerFactory);
      }
    }, { "flow.id": REALLIFE_FLOW, "sidebar": true, "icon": "fas fa-home" });
  }
}
