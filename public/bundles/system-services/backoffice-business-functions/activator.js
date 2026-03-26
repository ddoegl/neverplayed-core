import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, BIZ_FUNC_DATA_SERVICE, BIZ_FUNCS_PID, LOG_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    let logger = console; // Fallback
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger("backoffice-business-functions");
            logger.info("BO Business Functions: Bundle started.");
        },
        removedService: () => { logger = console; }
    }).open();
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const BIZ_FUNCS_PID_VAL = BIZ_FUNCS_PID;

    // Load/Seed Data
    let businessFunctions = pm.load(BIZ_FUNCS_PID_VAL);
    if (!businessFunctions || !Array.isArray(businessFunctions)) {
      logger.info("BO Business Functions: Seeding ...");
      const res = await fetch("./bundles/system-services/backoffice-business-functions/data/business-functions.yaml");
      const text = await res.text();
      businessFunctions = yaml.load(text) || [];
      pm.store(BIZ_FUNCS_PID_VAL, businessFunctions);
    }

    if (globalThis.backofficeState) {
        const state = globalThis.backofficeState;
        if (Array.isArray(state.parsedBusinessFunctions)) {
            state.parsedBusinessFunctions.splice(0, state.parsedBusinessFunctions.length, ...(businessFunctions || []));
        } else {
            state.parsedBusinessFunctions = businessFunctions || [];
        }
    }

    const dataService = {
      getBusinessFunctions: () => businessFunctions,
      setBusinessFunctions: (newData) => {
        businessFunctions = newData;
        pm.store(BIZ_FUNCS_PID_VAL, businessFunctions);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (Array.isArray(state.parsedBusinessFunctions)) {
            state.parsedBusinessFunctions.splice(0, state.parsedBusinessFunctions.length, ...(newData || []));
          } else {
            state.parsedBusinessFunctions = newData || [];
          }
          state.recompile?.();
        }
      }
    };

    context.registerService(BIZ_FUNC_DATA_SERVICE, dataService);

    context.registerService(BO_EXTENSION_SERVICE, {
      id: "businessFunctions",
      name: "Business Functions",
      icon: "fas fa-users-cog",
      templateUrl: "./bundles/system-services/backoffice-business-functions/templates/business-functions.html",
      onActivate: (hostState) => {
        if (Array.isArray(hostState.parsedBusinessFunctions)) {
          hostState.parsedBusinessFunctions.splice(0, hostState.parsedBusinessFunctions.length, ...(businessFunctions || []));
        } else {
          hostState.parsedBusinessFunctions = businessFunctions || [];
        }

        hostState.saveBusinessFunctions = () => {
          dataService.setBusinessFunctions(hostState.parsedBusinessFunctions);
        };

        hostState.openBusinessFunctionsEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "Business Functions Configuration",
            data: businessFunctions,
            onSave: (newData) => dataService.setBusinessFunctions(newData),
          });
        };

        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
