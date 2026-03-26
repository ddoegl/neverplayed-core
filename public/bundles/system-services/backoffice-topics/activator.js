import { 
    YAML_SERVICE, 
    BO_EXTENSION_SERVICE, 
    YAML_EDITOR_SERVICE, 
    PLEXUS_ENGINE_SERVICE, 
    TOPICS_DATA_SERVICE, 
    EVALUATOR_SERVICE,
    BIZ_FUNC_DATA_SERVICE,
    COMPANIES_SERVICE,
    FEATURE_DATA_SERVICE
} from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const TOPICS_PID = "pandino.backoffice.topics";
    const TOPIC_STRATEGIES_PID = "pandino.backoffice.topic-strategies";

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

    // Load/Seed Data for Topics
    let topics = pm.load(TOPICS_PID);
    if (!topics) {
      console.log("BO Topics: Seeding ...")
      const res = await fetch("./bundles/system-services/backoffice-topics/data/topics.yaml");
      const text = await res.text();
      topics = yaml.load(text);
      pm.store(TOPICS_PID, topics);
    }
    topics = toArray(topics);
    
    // Load/Seed Data for Topic Strategies
    let topicStrategies = pm.load(TOPIC_STRATEGIES_PID);
    if (!topicStrategies) {
      console.log("BO Topic Strategies: Seeding ...")
      const res = await fetch("./bundles/system-services/backoffice-topics/data/topic-strategies.yaml");
      const text = await res.text();
      topicStrategies = yaml.load(text);
      pm.store(TOPIC_STRATEGIES_PID, topicStrategies);
    }
    topicStrategies = toArray(topicStrategies);

    const dataService = {
      getTopics: () => topics,
      setTopics: (newData) => {
        topics = toArray(newData);
        pm.store(TOPICS_PID, topics);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (Array.isArray(state.parsedTopics)) state.parsedTopics.splice(0, state.parsedTopics.length, ...topics);
          else state.parsedTopics = topics;
          state.recompile?.();
        }
      },
      getTopicStrategies: () => topicStrategies,
      setTopicStrategies: (newData) => {
        topicStrategies = toArray(newData);
        pm.store(TOPIC_STRATEGIES_PID, topicStrategies);
        if (globalThis.backofficeState) {
          const state = globalThis.backofficeState;
          if (Array.isArray(state.parsedTopicStrategies)) state.parsedTopicStrategies.splice(0, state.parsedTopicStrategies.length, ...topicStrategies);
          else state.parsedTopicStrategies = topicStrategies;
          state.recompile?.();
        }
      }
    };

    context.registerService(TOPICS_DATA_SERVICE, dataService);

    // Register Evaluator Plugin
    context.registerService(EVALUATOR_SERVICE, {
      order: 30,
      evaluate: (userCapabilities, _parsedLicenses, hostState) => {
        const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
        const engine = engineRef ? context.getService(engineRef) : null;
        const matcherEngine = engine ? engine.getMatcherEngine() : null;
        
        const runtimeStrategies = hostState.parsedTopicStrategies || [];
        const runtimeTopics = hostState.parsedTopics || [];

        if (!matcherEngine || !runtimeStrategies || !runtimeTopics || !userCapabilities) {
          return userCapabilities;
        }

        const strategyList = Array.isArray(runtimeStrategies) ? runtimeStrategies : Object.values(runtimeStrategies);

        return userCapabilities.map(entry => {
          const { topics } = matcherEngine.evaluateDynamic({
              topics: runtimeTopics,
              rules: { topics: strategyList }
          }, entry.rawUser);

          return {
            ...entry,
            topics: [...(entry.topics || []), ...(topics || [])]
          };
        });
      }
    });

    const bizFuncRef = context.getServiceReference(BIZ_FUNC_DATA_SERVICE);
    const _bizFuncSvc = context.getService(bizFuncRef);

    const injectData = (hostState) => {
      if (Array.isArray(hostState.parsedTopics)) hostState.parsedTopics.splice(0, hostState.parsedTopics.length, ...topics);
      else hostState.parsedTopics = topics;

      if (Array.isArray(hostState.parsedTopicStrategies)) hostState.parsedTopicStrategies.splice(0, hostState.parsedTopicStrategies.length, ...topicStrategies);
      else hostState.parsedTopicStrategies = topicStrategies;

      // Track and inject live data for the Matcher Engine UI (populating source data for getters)
      const bfRef = context.getServiceReference(BIZ_FUNC_DATA_SERVICE);
      if (bfRef) hostState.parsedBusinessFunctions = context.getService(bfRef).getBusinessFunctions() || [];
      
      const compRef = context.getServiceReference(COMPANIES_SERVICE);
      if (compRef) hostState.registry = context.getService(compRef).getCompanies() || [];
      
      const featRef = context.getServiceReference(FEATURE_DATA_SERVICE);
      if (featRef) hostState.parsedFeatures = context.getService(featRef).getFeatures() || {};

      hostState.saveTopics = () => dataService.setTopics(hostState.parsedTopics);
      hostState.saveTopicStrategies = () =>
        dataService.setTopicStrategies(hostState.parsedTopicStrategies);


      hostState.addTopicStrategy = () => {
        hostState.parsedTopicStrategies.push({
          id: `NEW_TOPIC_STRAT_${Date.now()}`,
          operator: "AND",
          matchers: [
            { type: "matchAlways" }
          ]
        });
        hostState.saveTopicStrategies();
      };

      hostState.addTopic = () => {
        const tId = prompt(
          "Enter Topic ID:",
          `TOPIC_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        );
        if (tId) {
          hostState.parsedTopics.push({ id: tId, name: tId });
          hostState.saveTopics();
        }
      };

      hostState.recompile?.();
    };

    // Extension 1: Topic Strategies
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "topicStrategies",
      name: "Topic Strategies",
      icon: "fas fa-tags",
      templateUrl: "./bundles/system-services/backoffice-topics/templates/topic-strategies.html",
      onActivate: (hostState) => {
        injectData(hostState);

        Object.defineProperty(hostState, "yamlTopicStrategies", {
          get: () => yaml.dump(hostState.parsedTopicStrategies),
          set: (val) => {
            try {
              const newData = yaml.load(val);
              dataService.setTopicStrategies(newData);
            } catch (e) {
              console.error(e);
            }
          },
          configurable: true,
        });

        hostState.openTopicStrategiesEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "Topic Strategies Configuration",
            data: topicStrategies,
            onSave: (newData) => dataService.setTopicStrategies(newData),
          });
        };
      },
    });

    // Extension 2: Topic Studio
    context.registerService(BO_EXTENSION_SERVICE, {
      id: "topics",
      name: "Topic Studio",
      icon: "fas fa-photo-video",
      templateUrl: "./bundles/system-services/backoffice-topics/templates/topics.html",
      onActivate: (hostState) => {
        injectData(hostState);

        Object.defineProperty(hostState, "yamlTopics", {
          get: () => yaml.dump(hostState.parsedTopics),
          set: (val) => {
            try {
              const newData = yaml.load(val);
              dataService.setTopics(newData);
            } catch (e) {
              console.error(e);
            }
          },
          configurable: true,
        });

        hostState.openTopicsEditor = () => {
          const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
          const editor = editorRef ? context.getService(editorRef) : null;
          if (!editor) {
            alert("YAML Editor service not available yet.");
            return;
          }
          editor.edit({
            title: "Topic Configuration",
            data: topics,
            onSave: (newData) => dataService.setTopics(newData),
          });
        };
      },
    });
  }

  async stop(_context) {}
}
