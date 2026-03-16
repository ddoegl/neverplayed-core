import { YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, SIGNING_DATA_SERVICE } from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const STRATEGIES_PID = "pandino.backoffice.signing.strategies";
    const CASE_TYPES_PID = "pandino.backoffice.signing.case-types";

    const toArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (typeof data === "object") {
        return Object.entries(data).map(([id, val]) => ({
          id,
          ...val,
        }));
      }
      return [];
    };

    // Load/Seed Data for Strategies
    let strategies = pm.load(STRATEGIES_PID);
    if (!strategies) {
      console.log("BO Signing: Seeding Strategies...");
      const res = await fetch("./bundles/system-services/backoffice-signing/data/signing-strategies.yaml");
      const text = await res.text();
      strategies = yaml.load(text);
      pm.store(STRATEGIES_PID, strategies);
    }
    strategies = toArray(strategies);

    // Load/Seed Data for Case Types
    let caseTypes = pm.load(CASE_TYPES_PID);
    if (!caseTypes) {
      console.log("BO Signing: Seeding Case Types...");
      const res = await fetch("./bundles/system-services/backoffice-signing/data/case-types.yaml");
      const text = await res.text();
      caseTypes = yaml.load(text);
      pm.store(CASE_TYPES_PID, caseTypes);
    }
    caseTypes = toArray(caseTypes);

    const dataService = {
      getStrategies: () => strategies,
      setStrategies: (newData) => {
        strategies = toArray(newData);
        pm.store(STRATEGIES_PID, strategies);
        if (globalThis.backofficeState?.parsedSigningStrategies) {
          globalThis.backofficeState.parsedSigningStrategies.splice(0, globalThis.backofficeState.parsedSigningStrategies.length, ...strategies);
        }
      },
      getCaseTypes: () => caseTypes,
      setCaseTypes: (newData) => {
        caseTypes = toArray(newData);
        pm.store(CASE_TYPES_PID, caseTypes);
        if (globalThis.backofficeState?.parsedCaseTypes) {
          globalThis.backofficeState.parsedCaseTypes.splice(0, globalThis.backofficeState.parsedCaseTypes.length, ...caseTypes);
        }
      },
      resolveStrategy: (caseTypeId) => {
        console.log(`BO Signing: Resolving strategy for type [${caseTypeId}]. Known types:`, caseTypes.map(t => t.id));
        const type = caseTypes.find(t => t.id === caseTypeId);
        if (!type) {
            console.warn(`BO Signing: Case type [${caseTypeId}] not found!`);
            return null;
        }
        const strat = strategies.find(s => s.id === type.strategyId);
        if (!strat) console.warn(`BO Signing: Strategy [${type.strategyId}] not found for type [${caseTypeId}]!`);
        return strat;
      }
    };

    context.registerService(SIGNING_DATA_SERVICE, dataService);

    this.updateHostState = () => {
      if (globalThis.backofficeState) {
        const state = globalThis.backofficeState;
        if (Array.isArray(state.parsedSigningStrategies)) {
          state.parsedSigningStrategies.splice(0, state.parsedSigningStrategies.length, ...strategies);
        } else {
          state.parsedSigningStrategies = strategies;
        }
        if (Array.isArray(state.parsedCaseTypes)) {
          state.parsedCaseTypes.splice(0, state.parsedCaseTypes.length, ...caseTypes);
        } else {
          state.parsedCaseTypes = caseTypes;
        }
      }
    };

    const injectData = (hostState) => {
      if (Array.isArray(hostState.parsedSigningStrategies)) {
        hostState.parsedSigningStrategies.splice(0, hostState.parsedSigningStrategies.length, ...strategies);
      } else {
        hostState.parsedSigningStrategies = strategies;
      }

      if (Array.isArray(hostState.parsedCaseTypes)) {
        hostState.parsedCaseTypes.splice(0, hostState.parsedCaseTypes.length, ...caseTypes);
      } else {
        hostState.parsedCaseTypes = caseTypes;
      }

      hostState.saveSigningStrategies = () => dataService.setStrategies(hostState.parsedSigningStrategies);
      hostState.saveCaseTypes = () => dataService.setCaseTypes(hostState.parsedCaseTypes);

      hostState.addSigningStrategy = () => {
        hostState.parsedSigningStrategies.push({
          id: `STRAT_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: "New Strategy",
          type: "business",
          selector: "company-lrs"
        });
        hostState.saveSigningStrategies();
      };

      hostState.addCaseType = () => {
        hostState.parsedCaseTypes.push({
          id: `TYPE_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: "New Case Type",
          strategyId: "COMPANY_LRS"
        });
        hostState.saveCaseTypes();
      };
    };

    // Extension: Signing Strategies
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "signing-strategies",
      name: "Signing Strategies",
      icon: "fas fa-file-signature",
      templateUrl: "./bundles/system-services/backoffice-signing/templates/strategies.html",
      onActivate: (hostState) => {
        injectData(hostState);
        hostState.openSigningStrategiesEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = context.getService(editorRef);
          editor.edit({
            title: "Signing Strategies",
            data: strategies,
            onSave: (newData) => dataService.setStrategies(newData)
          });
        };
      }
    });

    // Extension: Case Types
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "case-types",
      name: "Case Types",
      icon: "fas fa-folder-tree",
      templateUrl: "./bundles/system-services/backoffice-signing/templates/case-types.html",
      onActivate: (hostState) => {
        injectData(hostState);
        hostState.openCaseTypesEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = context.getService(editorRef);
          editor.edit({
            title: "Case Types",
            data: caseTypes,
            onSave: (newData) => dataService.setCaseTypes(newData)
          });
        };
      }
    });

    console.log("BO Signing: Service and extensions registered.");
  }

  stop(_context) {}
}
