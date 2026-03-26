import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, SCA_METHODS_PID, SCA_METHODS_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    // Load/Seed Data for SCA Methods
    let scaMethods = pm.load(SCA_METHODS_PID);
    if (!scaMethods || !Array.isArray(scaMethods)) {
      console.log("BO SCA Methods: Seeding ...");
      const res = await fetch("./bundles/system-services/backoffice-sca-methods/data/sca-methods.yaml");
      const text = await res.text();
      scaMethods = yaml.load(text) || [];
      pm.store(SCA_METHODS_PID, scaMethods);
    }

    if (globalThis.backofficeState) {
        const state = globalThis.backofficeState;
        if (Array.isArray(state.parsedSCAMethods)) {
            state.parsedSCAMethods.splice(0, state.parsedSCAMethods.length, ...scaMethods);
        } else {
            state.parsedSCAMethods = scaMethods;
        }
    }

    const dataService = {
      getSCAMethods: () => scaMethods,
      setSCAMethods: (newData) => {
        scaMethods = newData;
        pm.store(SCA_METHODS_PID, scaMethods);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (Array.isArray(state.parsedSCAMethods)) {
            state.parsedSCAMethods.splice(0, state.parsedSCAMethods.length, ...scaMethods);
          } else {
            state.parsedSCAMethods = scaMethods;
          }
          state.recompile?.();
        }
      }
    };

    context.registerService(SCA_METHODS_SERVICE, dataService);

    context.registerService(BO_EXTENSION_SERVICE, {
      id: "scaMethods",
      name: "SCA Methods",
      icon: "fas fa-fingerprint",
      templateUrl: "./bundles/system-services/backoffice-sca-methods/templates/sca-methods.html",
      onActivate: (hostState) => {
        if (Array.isArray(hostState.parsedSCAMethods)) {
            hostState.parsedSCAMethods.splice(0, hostState.parsedSCAMethods.length, ...(scaMethods || []));
        } else {
            hostState.parsedSCAMethods = scaMethods || [];
        }

        hostState.saveSCAMethods = () => {
          dataService.setSCAMethods(hostState.parsedSCAMethods);
        };

        hostState.addSCAMethod = () => {
          hostState.parsedSCAMethods.push({
            id: `new_method_${hostState.parsedSCAMethods.length + 1}`,
            label: "New Method",
            icon: "fas fa-key",
            color: "gray",
          });
          hostState.saveSCAMethods();
        };

        Object.defineProperty(hostState, "yamlSCAMethods", {
          get: () => yaml.dump(hostState.parsedSCAMethods),
          set: (val) => {
            try {
              const parsed = yaml.load(val);
              dataService.setSCAMethods(parsed);
            } catch (e) {
              console.error(e);
            }
          },
          configurable: true,
        });

        hostState.openSCAMethodsEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "SCA Methods Configuration",
            data: hostState.parsedSCAMethods,
            onSave: (newData) => dataService.setSCAMethods(newData),
          });
        };

        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
