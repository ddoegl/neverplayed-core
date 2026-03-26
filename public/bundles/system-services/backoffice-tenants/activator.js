import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, TENANT_DATA_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const compRef = context.getServiceReference("infrastructure.companies.data");
    const _compSvc = context.getService(compRef);

    const persRef = context.getServiceReference("infrastructure.persons.data");
    const _persSvc = context.getService(persRef);

    const TENANTS_PID = "pandino.backoffice.tenants";

    // Load/Seed Data
    let tenants = pm.load(TENANTS_PID);
    if (!tenants) {
      console.log("BO Tenants: Seeding default data...");
      const res = await fetch("./bundles/system-services/backoffice-tenants/data/tenants.yaml");
      const text = await res.text();
      const loaded = yaml.load(text);
      tenants = { TENANTS: Array.isArray(loaded) ? loaded : [] };
      pm.store(TENANTS_PID, tenants);
    }
    // Final check for robust structure
    if (tenants && !tenants.TENANTS) tenants.TENANTS = [];
    
    if (globalThis.backofficeState) {
        const state = globalThis.backofficeState;
        if (state.parsedTenants && typeof state.parsedTenants === 'object') {
            Object.assign(state.parsedTenants, tenants);
        } else {
            state.parsedTenants = tenants;
        }
    }

    const dataService = {
      getTenants: () => tenants,
      setTenants: (newData) => {
        tenants = newData;
        pm.store(TENANTS_PID, tenants);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (state.parsedTenants && typeof state.parsedTenants === 'object') {
            Object.assign(state.parsedTenants, newData);
          } else {
            state.parsedTenants = newData;
          }
          state.recompile?.();
        }
      },
      getMappedCustomers: () => {
         return (tenants?.TENANTS || []).flatMap(t => t.customers || []);
      }
    };

    context.registerService(TENANT_DATA_SERVICE, dataService);

    // Register Extension Service
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "tenants",
      name: "Tenant Management",
      icon: "fas fa-building",
      templateUrl: "./bundles/system-services/backoffice-tenants/templates/tenants.html",
      onActivate: (hostState) => {
        // Sync companies (via service) into host state
        if (hostState.parsedTenants && typeof hostState.parsedTenants === 'object') {
            Object.assign(hostState.parsedTenants, tenants || {});
        } else {
            hostState.parsedTenants = tenants || { TENANTS: [] };
        }

        hostState.saveTenants = () => dataService.setTenants(tenants);

        hostState.openTenantsEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "Tenant Configuration",
            data: tenants,
            onSave: (newData) => {
              dataService.setTenants(newData);
            },
          });
        };

        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
