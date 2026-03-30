import { FLOW_SERVICE, YAML_SERVICE, LIMES_SERVICE, LOG_SERVICE, LIMES_STRATEGIES_PID } from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
    start(context) {
        this.logger = console; // Fallback to console initially
        
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("neverplayed.limes");
                this.logger.info("Limes: Connected to System Logger.");
            },
            removedService: () => {
                this.logger = { 
                    info: console.log, 
                    log: console.log, 
                    debug: console.debug, 
                    warn: console.warn, 
                    error: console.error 
                };
            }
        }).open();

        const flowRegistry = new Map();
        const strategyRegistry = new Map();
        let pmInstance = null;
        let yamlInstance = null;

        // 1. Manage Strategies Registry (via YAML + PM)
        const loadStrategies = async (yaml, pm) => {
            if (!yaml || !pm) return;
            this.logger.info("Limes: Loading strategies from YAML & PM...");
            const res = await fetch("./bundles/org.neverplayed.limes/data/limes-strategies.yaml");
            const text = await res.text();
            const yamlStrategies = yaml.load(text) || [];
            
            const persistentStrategies = pm.load(LIMES_STRATEGIES_PID) || [];
            yamlStrategies.forEach(ys => {
                const idx = persistentStrategies.findIndex(ps => ps.id === ys.id);
                if (idx === -1) {
                    persistentStrategies.push(ys);
                } else {
                    persistentStrategies[idx] = ys;
                }
            });
            pm.store(LIMES_STRATEGIES_PID, persistentStrategies);
            (persistentStrategies || []).forEach(s => strategyRegistry.set(s.id, s));
        };

        context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: (ref) => {
                pmInstance = context.getService(ref);
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
            try {
                return typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
            } catch (_e) { return {}; }
        };

        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
            addingService: (ref) => {
                const id = ref.getProperty("flow.id");
                if (id) {
                    const bConfig = getBundleConfig(ref.bundle);
                    flowRegistry.set(id, {
                        requiredPermissions: bConfig["required-permissions"] || []
                    });
                }
            },
            removedService: (ref) => {
                const id = ref.getProperty("flow.id");
                flowRegistry.delete(id);
            }
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
            isAllowed: (userOrId, strategyId, runtimeContext = {}) => {
                const userCap = (typeof userOrId === 'object' && userOrId !== null) ? userOrId : getEvaluatedData(userOrId);
                if (!userCap) return false;

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

                const matchers = strategy.matchers || [];
                const operator = strategy.operator || 'AND';
                const results = matchers.map(m => {
                    let res = false;
                    switch (m.type) {
                        case 'matchPermission': res = this.evaluatePermission(userCap, m.value, runtimeContext); break;
                        case 'matchScopeIntersection': res = this.evaluateScopeIntersection(userCap, m.permission || m.value, m.property, runtimeContext); break;
                        case 'matchProperty': res = runtimeContext[m.key] === m.value; break;
                        case 'matchPropertyEmpty': res = !runtimeContext[m.key]; break;
                        case 'matchPropertyNotEmpty': res = !!runtimeContext[m.key]; break;
                        case 'matchAttribute': {
                            const val = userCap[m.key] !== undefined ? userCap[m.key] : userCap.attributes?.[m.key];
                            res = val === m.value; 
                            break;
                        }
                        case 'matchAlways': res = m.value !== false; break;
                        case 'matchNever': res = false; break;
                        default: res = false;
                    }
                    return res;
                });

                return operator === 'AND' ? results.every(r => r === true) : results.some(r => r === true);
            }
        };

        context.registerService(LIMES_SERVICE, limesService);
    }

    /**
     * Checks if a user has a specific permission key.
     */
    evaluatePermission(userCap, key, _ctx) {
        if (!userCap.grantedKeys) return false;
        const normalized = String(key).toLowerCase().replace(/:/g, '_');
        const allowed = Object.keys(userCap.grantedKeys).some(k => k.toLowerCase().replace(/:/g, '_') === normalized);
        this.logger.debug(`Limes: [evaluatePermission] key=${key} (${normalized}) -> allowed=${allowed}`);
        return allowed;
    }

    /**
     * Checks if the user's scope for a permission intersects with the context property.
     */
    evaluateScopeIntersection(userCap, permissionKey, contextProperty, runtimeContext) {
        if (!permissionKey) {
            this.logger.warn("Limes: evaluateScopeIntersection called without permissionKey");
            return false;
        }
        const normalizedKey = String(permissionKey).toLowerCase();
        
        // Find ALL instances of the permission in the capability AST (categories)
        // SHADOWING FIX: Check all categories, if any allows, it's allowed.
        const permissionsFound = [];
        for (const cat of (userCap.capabilities || [])) {
            const p = (cat.permissions || []).find(p => p.key.toLowerCase() === normalizedKey);
            if (p) {
                permissionsFound.push(p);
            }
        }

        if (permissionsFound.length === 0) {
            this.logger.debug(`Limes: [evaluateScopeIntersection] key=${permissionKey} -> false (no perm found)`);
            return false;
        }

        const match = permissionsFound.some(foundPerm => {
            // Wildcard / ALL scope
            if (!foundPerm.customers || foundPerm.customers.length === 0) return true;

            // Scoped match
            let requiredScope = runtimeContext[contextProperty];
            // FALLBACK: If top-level property missing, check metadata for common patterns
            if (!requiredScope && contextProperty === 'customers') {
                requiredScope = runtimeContext.metadata?.companyId || runtimeContext.metadata?.customerId || runtimeContext.metadata?.targetPersonId;
            }

            if (!requiredScope) return false;

            if (Array.isArray(requiredScope)) {
                return requiredScope.some(id => foundPerm.customers.includes(id));
            }
            return foundPerm.customers.includes(requiredScope);
        });

        this.logger.debug(`Limes: [evaluateScopeIntersection] key=${permissionKey}, prop=${contextProperty}, ctxVal=${runtimeContext[contextProperty]} -> match=${match}`);
        return match;
    }

    stop(_context) {}
}
