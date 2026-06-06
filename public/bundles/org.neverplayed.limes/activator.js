import { 
    FLOW_SERVICE, 
    YAML_SERVICE, 
    LIMES_SERVICE, 
    LOG_SERVICE, 
    LIMES_STRATEGIES_PID,
    PLEXUS_EVALUATOR_SERVICE,
    PERCEIVER_SERVICE,
    PLEXUS_ENRICHER_SERVICE,
    REALM_CORE
} from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

/**
 * Limes Guarding Service
 * v2.6.5 - Refactored to use PLEXUS_EVALUATOR_SERVICE (OSGi Modularity Compliance).
 */
export default class Activator {
    start(context) {
        this.logger = console;
        this.perceiver = null;
        this.enricher = null;
        this.evaluator = null;
        
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger(context.getBundle().getSymbolicName());
                this.logger.info("Limes: Connected to System Logger.");
            }
        }).open();

        // Track the Evaluator Service (SDN-0206 - Modularity Compliance)
        context.trackService(`(objectClass=${PLEXUS_EVALUATOR_SERVICE})`, {
            addingService: (ref) => {
                this.evaluator = context.getService(ref);
                this.logger.info("Limes: Bound to Plexus Evaluator Service.");
                return this.evaluator;
            },
            removedService: () => { this.evaluator = null; }
        }).open();

        // Track the Perceiver Service for cognitive context
        context.trackService(`(objectClass=${PERCEIVER_SERVICE})`, {
            addingService: (ref) => {
                this.perceiver = context.getService(ref);
                this.logger.info("Limes: Bound to Perceiver Service.");
                return this.perceiver;
            },
            removedService: () => { this.perceiver = null; }
        }).open();

        // Track the Enricher Service for stigmergic context
        context.trackService(`(objectClass=${PLEXUS_ENRICHER_SERVICE})`, {
            addingService: (ref) => {
                this.enricher = context.getService(ref);
                this.logger.info("Limes: Bound to Plexus Enricher Service.");
                return this.enricher;
            },
            removedService: () => { this.enricher = null; }
        }).open();

        const flowRegistry = new Map();
        const strategyRegistry = new Map();
        let pmInstance = null;
        let yamlInstance = null;

        const loadStrategies = async (yaml, pm) => {
            if (!yaml || !pm) return;
            this.logger.info("Limes: Loading strategies from YAML & PM...");
            const url = globalThis.NEVERPLAYED_BASE_URL 
                ? new URL("bundles/org.neverplayed.limes/data/limes-strategies.yaml", globalThis.NEVERPLAYED_BASE_URL) 
                : "./bundles/org.neverplayed.limes/data/limes-strategies.yaml";
            const res = await fetch(url);
            const text = await res.text();
            const yamlStrategies = yaml.load(text) || [];
            
            const persistentStrategies = await pm.load(LIMES_STRATEGIES_PID) || [];
            yamlStrategies.forEach(ys => {
                const idx = persistentStrategies.findIndex(ps => ps.id === ys.id);
                if (idx === -1) persistentStrategies.push(ys);
                else persistentStrategies[idx] = ys;
            });
            await pm.store(LIMES_STRATEGIES_PID, persistentStrategies);
            (persistentStrategies || []).forEach(s => strategyRegistry.set(s.id, s));
        };

        context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: async (ref) => {
                pmInstance = context.getService(ref);
                if (typeof pmInstance.waitReady === 'function') await pmInstance.waitReady();
                loadStrategies(yamlInstance, pmInstance);
            }
        }).open();

        context.trackService(`(objectClass=${YAML_SERVICE})`, {
            addingService: (ref) => {
                yamlInstance = context.getService(ref);
                loadStrategies(yamlInstance, pmInstance);
            }
        }).open();

        const getBundleConfig = (bundle) => {
            if (!bundle) return {};
            const headers = bundle.getHeaders();
            const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
            const configPriming = headers[configKey];
            if (!configPriming) return {};
            try { return typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming; } catch (_e) { return {}; }
        };

        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
            addingService: (ref) => {
                const id = ref.getProperty("flow.id");
                if (id) {
                    const bConfig = getBundleConfig(ref.bundle);
                    flowRegistry.set(id, { requiredPermissions: bConfig["required-permissions"] || [] });
                }
            },
            removedService: (ref) => { flowRegistry.delete(ref.getProperty("flow.id")); }
        }).open();

        const getEvaluatedData = (userId) => {
            return (globalThis.backofficeState?.evaluatedData || []).find(d => String(d.user) === String(userId));
        };

        const limesService = {
            registerStrategy: (id, definition) => {
                const existing = strategyRegistry.get(id);
                if (!existing || existing.origin === 'bundle') {
                    strategyRegistry.set(id, { ...definition, id, origin: 'bundle' });
                }
            },
            getStrategies: () => Array.from(strategyRegistry.values()),
            updateStrategy: (id, definition) => {
                strategyRegistry.set(id, { ...definition, id });
                const all = Array.from(strategyRegistry.values());
                pmInstance?.store(LIMES_STRATEGIES_PID, all);
                this.logger.info(`Limes: Strategy updated and persisted: ${id}`);
            },
            deleteStrategy: (id) => {
                strategyRegistry.delete(id);
                const all = Array.from(strategyRegistry.values());
                pmInstance?.store(LIMES_STRATEGIES_PID, all);
                this.logger.info(`Limes: Strategy deleted and persisted: ${id}`);
            },
            isAllowed: (arg1, arg2, arg3) => {
                if (!this.evaluator) return false;

                let strategyId, runtimeContext, userOverride;

                // Polymorphic Detection: (strategyId, context) vs (userOrId, strategyId, context)
                if (typeof arg1 === 'string' && (arg2 === undefined || typeof arg2 === 'object')) {
                    strategyId = arg1;
                    runtimeContext = arg2 || {};
                } else {
                    userOverride = arg1;
                    strategyId = arg2;
                    runtimeContext = arg3 || {};
                }

                if (!strategyId || typeof strategyId !== 'string') {
                    this.logger?.warn("Limes: isAllowed called with invalid strategyId:", strategyId);
                    return false;
                }

                const userCap = (typeof userOverride === 'object' && userOverride !== null) ? userOverride : getEvaluatedData(userOverride);
                const perceiverContext = this.perceiver?.getContext() || { 
                    being: userCap || { id: userOverride }, 
                    realm: REALM_CORE 
                };

                let strategy = strategyRegistry.get(strategyId);
                
                if (!strategy && strategyId.startsWith('FLOW_VIEW:')) {
                    const flowId = strategyId.split(':')[1];
                    const flowInfo = flowRegistry.get(flowId);
                    if (flowInfo) {
                        strategy = {
                            id: strategyId,
                            operator: 'AND',
                            matchers: (flowInfo.requiredPermissions || []).map(p => ({ type: 'matchPermission', value: p }))
                        };
                        if (strategy.matchers.length === 0) strategy.matchers.push({ type: 'matchAlways', value: true });
                    }
                }

                if (!strategy) return false;

                // Normalize evaluation context
                const evaluationContext = {
                    ...(userCap || perceiverContext.being),
                    surrogate: perceiverContext.surrogate,
                    realm: perceiverContext.realm,
                    ...runtimeContext
                };

                const config = {
                    enricher: this.enricher,
                    logger: this.logger
                };

                const result = this.evaluator.evaluateMatchers(strategy.matchers, strategy.operator || 'AND', evaluationContext, config);
                return result !== false;
            }
        };

        context.registerService(LIMES_SERVICE, limesService);
    }

    stop(_context) {}
}
