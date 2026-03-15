import { FLOW_SERVICE, YAML_SERVICE, YAML_EDITOR_SERVICE } from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);
    const COMPANIES_PID = "pandino.companies.data";
    const PERSONS_PID = "pandino.persons.data";

    let companiesData = pm.load(COMPANIES_PID);
    if (!companiesData) {
      console.log("Company Registry: Seeding default companies data...");
      const res = await fetch("./bundles/system-clients/company-registry/data/companies.yaml");
      const text = await res.text();
      companiesData = yaml.load(text) || [];
      pm.store(COMPANIES_PID, companiesData);
    }

    const dataService = {
      getCompanies: () => companiesData,
      setCompanies: (newCompanies) => {
        companiesData = newCompanies;
        pm.store(COMPANIES_PID, companiesData);
        if (globalThis.backofficeState) {
            globalThis.backofficeState.companies = companiesData;
            globalThis.backofficeState.recompile?.();
        }
        // Emit EventAdmin event for reactive synchronization
        const eventAdminRef = context.getServiceReference('@pandino/event-admin/EventAdmin');
        if (eventAdminRef) {
            const eventAdmin = context.getService(eventAdminRef);
            eventAdmin.postEvent('infrastructure/companies/updated', { companies: companiesData });
        }
      }
    };
    
    // Provide data as its own service
    context.registerService("infrastructure.companies.data", dataService);

    const flowMetadata = {
      id: "company-registry",
      title: "Company Registry",
      icon: "fas fa-city",
      launch: async (targetElement) => {
        const companyFlowData = Alpine.reactive({
          companies: companiesData,
          persons: pm.load(PERSONS_PID) || [],
          editingCompany: null,
          currentStep: "dashboard",

          async loadStep(step) {
            this.currentStep = step;
            const response = await fetch(`./bundles/system-clients/company-registry/templates/${step}.html`);
            targetElement.innerHTML = await response.text();
          },

          editCompany(company) {
            this.editingCompany = company ? { ...company } : {
              name: "",
              regNr: "",
              address: "",
              description: "",
              legalRepresentatives: [],
            };
            this.loadStep("form");
          },

          openYamlEditor() {
            const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
            if (!editorRef) return alert("YAML Editor Service unavailable!");
            const editor = context.getService(editorRef);
            editor.edit({
              title: "Company Registry Configuration",
              data: this.companies,
              onSave: (newData) => {
                dataService.setCompanies(newData);
                this.companies = newData;
              },
            });
          },

          async saveCompany() {
            if (!this.editingCompany.id) {
              this.editingCompany.id = "c-" + Math.random().toString(36).substr(2, 9);
              this.companies.push(this.editingCompany);
            } else {
              const index = this.companies.findIndex(c => c.id === this.editingCompany.id);
              if (index > -1) this.companies[index] = this.editingCompany;
            }

            dataService.setCompanies([...this.companies]);
            this.loadStep("dashboard");
          },

          deleteCompany(id) {
            if (confirm("Are you sure you want to delete this company?")) {
              this.companies = this.companies.filter(c => c.id !== id);
              dataService.setCompanies([...this.companies]);
            }
          }
        });

        targetElement._x_dataStack = [companyFlowData, { host: globalThis.backofficeState }];
        await companyFlowData.loadStep("dashboard");
      },
    };

    const headers = context.bundle.getHeaders();
    const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
    const config = headers[configKey] ? (typeof headers[configKey] === 'string' ? JSON.parse(headers[configKey]) : headers[configKey]) : {};

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "company-registry",
      "flow.title": flowMetadata.title,
      "flow.icon": flowMetadata.icon,
      ...config
    });
  }
}
