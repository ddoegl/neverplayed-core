import { YAML_SERVICE, BO_EXTENSION_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const RULES_PID = "pandino.backoffice.rule.strategies";
    // Load/Seed Data for Rules
    let strategies = null;
    try {
        strategies = pm.load(RULES_PID);
    } catch (e) {
        console.warn("BO Rules: Error loading persisted data, falling back to seed.", e);
        strategies = null;
    }

    if (!strategies || !Array.isArray(strategies)) {
      console.log("BO Rules: Seeding default strategy data...");
      const res = await fetch("./bundles/system-services/backoffice-rules/data/rule-strategies.yaml");
      const text = await res.text();
      strategies = yaml.load(text);
      pm.store(RULES_PID, strategies);
    }

    const dataService = {
      getStrategies: () => strategies,
      setStrategies: (newStrategies) => {
        strategies = newStrategies;
        pm.store(RULES_PID, strategies);
      },
      // Legacy compatibility
      getRules: () => strategies,
      setRules: (s) => dataService.setStrategies(s)
    };

    // Provide data as its own service (in case others need it before Host injects it)
    context.registerService("backoffice.rules.data", dataService);

    // Register Extension Service
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "rules",
      name: "Rule Strategies",
      icon: "fas fa-microchip", // Better icon for primitives
      templateUrl: "./bundles/system-services/backoffice-rules/templates/rule-strategies.html",
      onActivate: (hostState) => {
        hostState.parsedRuleStrategies = strategies;
        
        hostState.saveRuleStrategies = () => {
            dataService.setStrategies(hostState.parsedRuleStrategies);
        };

        // Trigger Recompile
        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
