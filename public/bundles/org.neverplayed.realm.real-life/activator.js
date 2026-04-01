import { 
  FLOW_SERVICE, 
  CONFIG_ADMIN_SERVICE, 
  ENV_SERVICE, 
  SESSION_SERVICE, 
  PERSONS_SERVICE, 
  COMPANIES_SERVICE, 
  TENANT_DATA_SERVICE, 
  LICENSE_DATA_SERVICE, 
  FELLOWS_SERVICE, 
  REALLIFE_FLOW, 
  MOBILE_LAUNCHER_FLOW,
  CONFIG_ADMIN_UI_FLOW,
  COMPANY_REGISTRY_FLOW,
  PERSON_REGISTRY_FLOW,
  BACKOFFICE_WEB_FLOW,
  EMAIL_MONITOR_FLOW,
  CASE_MONITOR_FLOW
} from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    
    const state = Alpine.reactive({
      persons: [],
      companies: [],
      parsedTenants: { TENANTS: [] },
      parsedLicenses: { LICENSES: [] },
      
      selectedPerson: null,
      selectedCompany: null,
      fellows: [],

      // Flow constants for template usage
      CONFIG_ADMIN_UI_FLOW,
      COMPANY_REGISTRY_FLOW,
      PERSON_REGISTRY_FLOW,
      BACKOFFICE_WEB_FLOW,
      EMAIL_MONITOR_FLOW,
      CASE_MONITOR_FLOW,
      REALLIFE_FLOW,
      
      // Settings (Persisted via ConfigAdmin)
      showSidebar: true,
      enabledFlows: { business: {}, retail: {} },
      availableFlows: [], // Dynamically tracked

      isFlowEnabled(id) {
        const flow = this.availableFlows.find(f => f.id === id);
        if (!flow) return false;
        
        const caRef = context.getServiceReference(CONFIG_ADMIN_SERVICE);
        const ca = caRef ? context.getService(caRef) : null;
        const props = ca?.getConfiguration(flow.bsn)?.getProperties();
        
        const manifestChannels = this.getManifestChannels(flow.manifestChannelsHeader);
        const storedChannels = props?.channels;

        // Enable by default if no channels are restricted anywhere
        if (storedChannels === undefined && manifestChannels === undefined) return id === REALLIFE_FLOW;
        
        const channels = (storedChannels !== undefined) ? storedChannels : (manifestChannels !== undefined ? manifestChannels : []);
        return channels.includes(REALLIFE_FLOW);
      },

      async loadStep(step) {
        const path = `./bundles/org.neverplayed.realm.real-life/templates/${step}.html`;
        const response = await fetch(path);
        const html = response.ok ? await response.text() : `<div class="p-8 text-red-500">Real-Life Dashboard Template not found: ${path}</div>`;
        const target = this._targetElement;
        if (target) {
            target.innerHTML = html;
        }
      },
      
      selectFlow(id, step = null, params = {}) {
         if (this._targetElement) {
            this._targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { 
                detail: { id, step, params }, 
                bubbles: true 
            }));
         }
      },

      getTenantInfo(id) {
         const tenants = this.parsedTenants.TENANTS || [];
         const tenant = tenants.find(t => (t.customers || []).some(c => String(c.id) === String(id)));
         return tenant ? { customerId: id, tenantId: tenant.id } : null;
      },

      getPersonPossessions(_id) {
         return []; 
      },

      selectPerson(person) {
        console.log("Selected person:", person);
        this.selectedPerson = person;
        this.loadStep("persona");
      },

      clearStorage() {
         localStorage.clear();
         globalThis.location.reload();
      },

      get personUsers() {
         if (!this.selectedPerson || !this.parsedLicenses) return [];
         const users = [];
         (this.parsedLicenses.LICENSES || []).forEach(lic => {
             if (!lic) return;
             (lic.USERS || []).forEach(u => {
                 if (!u) return;
                 if (String(u.owner) === String(this.selectedPerson.id) || String(u.holder) === String(this.selectedPerson.id) || String(u.id) === String(this.selectedPerson.id)) {
                     users.push({ ...u, licenseId: lic.id });
                 }
             });
         });
         return users;
      },

      get linkedTenants() {
         if (!this.selectedPerson || !this.parsedTenants) return [];
         const tenantsList = [];
         (this.parsedTenants.TENANTS || []).forEach(t => {
             if (!t) return;
             if ((t.customers || []).some(c => c && String(c.id) === String(this.selectedPerson.id))) {
                  tenantsList.push(t);
             }
         });
         return tenantsList;
      },

      getManifestChannels(manifestChannelsHeader) {
        if (!manifestChannelsHeader) return undefined;
        try {
            const primingData = typeof manifestChannelsHeader === 'string' ? JSON.parse(manifestChannelsHeader) : manifestChannelsHeader;
            return primingData.channels;
        } catch (_e) {
            return undefined;
        }
      },

      selectCompany(company) {
        console.log("Selected company:", company);
        this.selectedCompany = company;
        this.loadStep("company-home");
      },

      selectTenant(tenantId) {
         console.log("Selected tenant:", tenantId);
      },

      switchEnvironment(envId) {
        console.log("Switching environment to:", envId);
        
        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        const sessionSvc = context.getService(sessionRef);
        
        const envRefs = context.getServiceReferences(ENV_SERVICE, `(env.id=${envId})`);
        const envSvc = envRefs.length > 0 ? context.getService(envRefs[0]) : null;
        
        if (envSvc) {
          envSvc.onActivate(sessionSvc);
          let portalFlow = "web-springboard"; // Default for web-browser
          if (envId === "business-channel-web") portalFlow = "web-portal"; // Legacy
          if (envId === "mobile-device") portalFlow = MOBILE_LAUNCHER_FLOW;
          
          this.selectFlow(portalFlow);
        } else {
          console.error("Environment service not found for:", envId);
        }
      }
    });

    // Track All Flows
    context.trackService(`(objectClass=${FLOW_SERVICE})`, {
        addingService: (ref) => {
            const service = context.getService(ref);
            const id = ref.getProperty("flow.id");
            if (id && !state.availableFlows.find(f => f.id === id)) {
                const headers = ref.bundle ? ref.bundle.getHeaders() : {};
                const configKey = Object.keys(headers || {}).find(k => k.toLowerCase() === 'configuration');
                
                state.availableFlows.push({
                    title: service.title || id,
                    icon: service.icon || "fas fa-cube",
                    id,
                    bsn: (ref.bundle && typeof ref.bundle.getSymbolicName === 'function' ? ref.bundle.getSymbolicName() : null) || id,
                    manifestChannelsHeader: headers ? headers[configKey] : undefined,
                    orderFlow: !!ref.getProperty("orderFlow")
                });
            }
        },
        removedService: (ref) => {
            const id = ref.getProperty("flow.id");
            state.availableFlows = state.availableFlows.filter(f => f.id !== id);
            context.ungetService(ref);
        }
    }).open();
    
    // OSGi Reactive Service Trackers (Data)
    context.trackService(`(objectClass=${PERSONS_SERVICE})`, {
        addingService: (ref) => { state.persons = context.getService(ref).getPersons() || []; }
    }).open();
    
    context.trackService(`(objectClass=${COMPANIES_SERVICE})`, {
        addingService: (ref) => { state.companies = context.getService(ref).getCompanies() || []; }
    }).open();
    
    context.trackService(`(objectClass=${TENANT_DATA_SERVICE})`, {
        addingService: (ref) => { state.parsedTenants = context.getService(ref).getTenants() || { TENANTS: [] }; }
    }).open();
    
    context.trackService(`(objectClass=${LICENSE_DATA_SERVICE})`, {
        addingService: (ref) => { state.parsedLicenses = context.getService(ref).getLicenses() || { LICENSES: [] }; }
    }).open();

    context.trackService(`(objectClass=${FELLOWS_SERVICE})`, {
        addingService: (ref) => { state.fellows = context.getService(ref).getFellows() || []; }
    }).open();

    // OSGi Reactive Service Tracker (Config)
    context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
        addingService: () => {
            // Listen for updates
            globalThis.addEventListener('config-updated', () => {
                // Refresh workflows visibility
                state.availableFlows = [...state.availableFlows];
            });
        }
    }).open();

    const flowMetadata = {
      id: REALLIFE_FLOW,
      title: "Real Life",
      launch: async (targetElement) => {
        state._targetElement = targetElement;
        targetElement._x_dataStack = [state];
        await state.loadStep("dashboard");
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": REALLIFE_FLOW,
      "flowType": "admin-flow",
      "sidebar": true,
      "icon": "fas fa-home",
      "title": "Dashboard"
    });
  }

  async stop(_context) {}
}
