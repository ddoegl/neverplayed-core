import { 
    YAML_SERVICE, 
    BO_EXTENSION_SERVICE, 
    YAML_EDITOR_SERVICE, 
    PLEXUS_ENGINE_SERVICE, 
    CAMPAIGNS_SERVICE, 
    EVALUATOR_SERVICE, 
    BIZ_FUNC_DATA_SERVICE, 
    COMPANIES_SERVICE, 
    FEATURE_DATA_SERVICE,
    CAMPAIGNS_PID,
    CAMPAIGN_STRATEGIES_PID,
    LOG_SERVICE
} from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    let logger = console; // Fallback
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger("backoffice-campaigns");
            logger.info("BO Campaigns: Bundle started.");
        },
        removedService: () => { logger = console; }
    }).open();
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const CAMPAIGNS_PID_VAL = CAMPAIGNS_PID;
    const STRATEGIES_PID_VAL = CAMPAIGN_STRATEGIES_PID;

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

    // Load/Seed Data for Campaigns
    let campaigns = pm.load(CAMPAIGNS_PID_VAL);
    if (!campaigns) {
      logger.info("BO Campaigns: Seeding ...");
      const res = await fetch("./bundles/system-services/backoffice-campaigns/data/campaigns.yaml");
      const text = await res.text();
      campaigns = yaml.load(text);
      pm.store(CAMPAIGNS_PID_VAL, campaigns);
    }
    campaigns = toArray(campaigns);
    
    // Load/Seed Data for Strategies
    let strategies = pm.load(STRATEGIES_PID_VAL);
    if (!strategies) {
      logger.info("BO Strategies: Seeding ...");
      const res = await fetch("./bundles/system-services/backoffice-campaigns/data/strategies.yaml");
      const text = await res.text();
      strategies = yaml.load(text);
      pm.store(STRATEGIES_PID_VAL, strategies);
    }
    strategies = toArray(strategies);

    const dataService = {
      getCampaigns: () => campaigns,
      setCampaigns: (newData) => {
        campaigns = toArray(newData);
        pm.store(CAMPAIGNS_PID_VAL, campaigns);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (Array.isArray(state.parsedCampaigns)) state.parsedCampaigns.splice(0, state.parsedCampaigns.length, ...campaigns);
          else state.parsedCampaigns = campaigns;
          state.recompile?.();
        }
      },
      getStrategies: () => strategies,
      setStrategies: (newData) => {
        strategies = toArray(newData);
        pm.store(STRATEGIES_PID_VAL, strategies);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (Array.isArray(state.parsedStrategies)) state.parsedStrategies.splice(0, state.parsedStrategies.length, ...strategies);
          else state.parsedStrategies = strategies;
          state.recompile?.();
        }
      }
    };

    context.registerService(CAMPAIGNS_SERVICE, dataService);

    // Register Evaluator Plugin
    context.registerService(EVALUATOR_SERVICE, {
      order: 20,
      evaluate: (userCapabilities, _parsedLicenses, hostState) => {
        const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
        const engine = engineRef ? context.getService(engineRef) : null;
        const matcherEngine = engine ? engine.getMatcherEngine() : null;
        
        const runtimeStrategies = hostState.parsedStrategies || [];
        const runtimeCampaigns = hostState.parsedCampaigns || [];
        
        if (!matcherEngine || !runtimeStrategies || !runtimeCampaigns || !userCapabilities) {
          return userCapabilities;
        }

        return userCapabilities.map(entry => {
          const { campaigns } = matcherEngine.evaluateDynamic({
              campaigns: runtimeCampaigns,
              rules: { campaigns: runtimeStrategies }
          }, entry.rawUser);

          return {
            ...entry,
            campaigns: [...(entry.campaigns || []), ...(campaigns || [])]
          };
        });
      }
    });

    const bizFuncRef = context.getServiceReference(BIZ_FUNC_DATA_SERVICE);
    const _bizFuncSvc = context.getService(bizFuncRef);

    // Common activation logic for both extensions
    const injectData = (hostState) => {
      if (Array.isArray(hostState.parsedCampaigns)) hostState.parsedCampaigns.splice(0, hostState.parsedCampaigns.length, ...campaigns);
      else hostState.parsedCampaigns = campaigns;

      if (Array.isArray(hostState.parsedStrategies)) hostState.parsedStrategies.splice(0, hostState.parsedStrategies.length, ...strategies);
      else hostState.parsedStrategies = strategies;

      // Track and inject live data for the Matcher Engine UI (populating source data for getters)
      const bfRef = context.getServiceReference(BIZ_FUNC_DATA_SERVICE);
      if (bfRef) hostState.parsedBusinessFunctions = context.getService(bfRef).getBusinessFunctions() || [];
      
      const compRef = context.getServiceReference(COMPANIES_SERVICE);
      if (compRef) hostState.registry = context.getService(compRef).getCompanies() || [];
      
      const featRef = context.getServiceReference(FEATURE_DATA_SERVICE);
      if (featRef) hostState.parsedFeatures = context.getService(featRef).getFeatures() || {};

      hostState.saveCampaigns = () =>
        dataService.setCampaigns(hostState.parsedCampaigns);
      hostState.saveStrategies = () =>
        dataService.setStrategies(hostState.parsedStrategies);

      hostState.addCampaign = () => {
        hostState.parsedCampaigns.push({
          id: `CAMP_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: "New Campaign",
          status: "draft",
          targets: { audience: "all", tags: [] },
          budget: 0,
          features_granted: [],
        });
        hostState.saveCampaigns();
      };


      hostState.addCampaignStrategy = () => {
        hostState.parsedStrategies.push({
          id: `NEW_STRATEGY_${Date.now()}`,
          operator: "AND",
          matchers: [
            { type: "matchAlways" }
          ]
        });
        hostState.saveStrategies();
      };

      hostState.recompile?.();
    };

    // Extension 1: Campaign Strategies
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "strategies",
      name: "Campaign Strategies",
      icon: "fas fa-chess-knight",
      templateUrl: "./bundles/system-services/backoffice-campaigns/templates/strategies.html",
      onActivate: (hostState) => {
        injectData(hostState);

        Object.defineProperty(hostState, "yamlStrategies", {
          get: () => yaml.dump(hostState.parsedStrategies),
          set: (val) => {
            try {
              const newData = yaml.load(val);
              dataService.setStrategies(newData);
            } catch (e) {
              console.error(e);
            }
          },
          configurable: true,
        });

        hostState.openStrategiesEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "Campaign Strategies Configuration",
            data: strategies,
            onSave: (newData) => dataService.setStrategies(newData),
          });
        };
      },
    });

    // Extension 2: Campaign Studio
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "campaigns",
      name: "Campaign Studio",
      icon: "fas fa-bullhorn",
      templateUrl: "./bundles/system-services/backoffice-campaigns/templates/campaigns.html",
      onActivate: (hostState) => {
        injectData(hostState);

        Object.defineProperty(hostState, "yamlCampaigns", {
          get: () => yaml.dump(hostState.parsedCampaigns),
          set: (val) => {
            try {
              const newData = yaml.load(val);
              dataService.setCampaigns(newData);
            } catch (e) {
              console.error(e);
            }
          },
          configurable: true,
        });

        hostState.openCampaignsEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "Campaigns Configuration",
            data: campaigns,
            onSave: (newData) => dataService.setCampaigns(newData),
          });
        };
      },
    });
  }

  async stop(_context) {}
}
