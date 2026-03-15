import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE } from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const SCA_STRATEGIES_PID = "pandino.backoffice.sca-strategies";

    // Load/Seed Data for SCA Strategies
    let scaStrategies = null;
    try {
        scaStrategies = pm.load(SCA_STRATEGIES_PID);
    } catch (e) {
        console.warn("BO SCA Strategies: Error loading persisted data, falling back to seed.", e);
        scaStrategies = null;
    }

    if (!scaStrategies || !Array.isArray(scaStrategies)) {
      console.log("BO SCA Strategies: Seeding ...");
      const res = await fetch("./bundles/system-services/backoffice-sca/data/sca-strategies.yaml");
      const text = await res.text();
      scaStrategies = yaml.load(text) || [];
      pm.store(SCA_STRATEGIES_PID, scaStrategies);
    }
    
    if (globalThis.backofficeState) {
        const state = globalThis.backofficeState;
        if (Array.isArray(state.parsedSCAStrategies)) {
            state.parsedSCAStrategies.splice(0, state.parsedSCAStrategies.length, ...scaStrategies);
        } else {
            state.parsedSCAStrategies = scaStrategies;
        }
    }

    const dataService = {
      getSCAStrategies: () => scaStrategies,
      setSCAData: (strategiesData) => {
        scaStrategies = strategiesData;
        pm.store(SCA_STRATEGIES_PID, scaStrategies);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (Array.isArray(state.parsedSCAStrategies)) {
            state.parsedSCAStrategies.splice(0, state.parsedSCAStrategies.length, ...scaStrategies);
          } else {
            state.parsedSCAStrategies = scaStrategies;
          }
          state.recompile?.();
        }
      }
    };

    context.registerService("backoffice.sca.data", dataService);

    context.registerService(BO_EXTENSION_SERVICE, {
      id: "scaStrategies",
      name: "SCA Strategies",
      icon: "fas fa-tags",
      templateUrl: "./bundles/system-services/backoffice-sca/templates/sca-strategies.html",
      onActivate: (hostState) => {
        if (Array.isArray(hostState.parsedSCAStrategies)) {
            hostState.parsedSCAStrategies.splice(0, hostState.parsedSCAStrategies.length, ...(scaStrategies || []));
        } else {
            hostState.parsedSCAStrategies = scaStrategies || [];
        }

        hostState.saveSCAStrategies = () => {
          dataService.setSCAData(hostState.parsedSCAStrategies);
        };

        hostState.addSCAStrategy = () => {
          hostState.parsedSCAStrategies.push({
            id: `NEW_SCA_STRATEGY_${hostState.parsedSCAStrategies.length + 1}`,
          });
          hostState.saveSCAStrategies();
        };

        Object.defineProperty(hostState, "yamlSCAStrategies", {
          get: () => yaml.dump(hostState.parsedSCAStrategies),
          set: (val) => {
            try {
              const parsed = yaml.load(val);
              hostState.parsedSCAStrategies = parsed;
              hostState.saveSCAStrategies();
            } catch (e) {
              console.error(e);
            }
          },
          configurable: true,
        });

        hostState.openSCAStrategiesEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "SCA Strategies Configuration",
            data: hostState.parsedSCAStrategies,
            onSave: (newData) => {
              hostState.parsedSCAStrategies = newData;
              hostState.saveSCAStrategies();
            },
          });
        };

        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
