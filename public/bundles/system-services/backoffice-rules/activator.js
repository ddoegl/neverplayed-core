import { YAML_SERVICE, BO_EXTENSION_SERVICE, RULES_DATA_SERVICE, RULES_PID, PLEXUS_KNOWLEDGE_PROVIDER } from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const RULES_PID_VAL = RULES_PID;
    
    // Load/Seed Data for Rules
    let strategies = null;
    try {
        strategies = pm.load(RULES_PID_VAL);
    } catch (e) {
        console.warn("BO Rules: Error loading persisted data, falling back to seed.", e);
        strategies = null;
    }

    if (!strategies || !Array.isArray(strategies)) {
      console.log("BO Rules: Seeding default strategy data...");
      const res = await fetch("./bundles/system-services/backoffice-rules/data/rule-strategies.yaml");
      const text = await res.text();
      strategies = yaml.load(text);
      pm.store(RULES_PID_VAL, strategies);
    }

    const dataService = {
      getStrategies: () => strategies,
      setStrategies: (newStrategies) => {
        strategies = newStrategies;
        pm.store(RULES_PID_VAL, strategies);
      },
      // Plexus BYOS Integration
      getKnowledge: () => strategies,
      
      // Legacy compatibility
      getRules: () => strategies,
      setRules: (s) => dataService.setStrategies(s)
    };

    // Provide data as its own service
    context.registerService(RULES_DATA_SERVICE, dataService);

    // Register as Plexus Knowledge Provider
    context.registerService(PLEXUS_KNOWLEDGE_PROVIDER, dataService, { 
        "plexus.domain": "rules" 
    });

    // Register Extension Service for Backoffice UI
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "rules",
      name: "Rule Strategies",
      icon: "fas fa-microchip",
      templateUrl: "./bundles/system-services/backoffice-rules/templates/rule-strategies.html",
      onActivate: (hostState) => {
        hostState.parsedRuleStrategies = strategies;
        hostState.saveRuleStrategies = () => {
            dataService.setStrategies(hostState.parsedRuleStrategies);
        };
        hostState.recompile?.();
      },
    });
  }

  async stop(_context) {}
}
