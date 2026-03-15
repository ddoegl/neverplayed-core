import { FLOW_SERVICE, YAML_SERVICE, BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, LIMES_SERVICE, PLEXUS_ENGINE_SERVICE as _PLEXUS_ENGINE_SERVICE } from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
    async start(context) {
        const yamlRef = context.getServiceReference(YAML_SERVICE);
        const yaml = context.getService(yamlRef);

        const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
        const pm = context.getService(pmRef);

        const STRATEGIES_PID = "prototyper.limes.strategies";
        const flowRegistry = new Map(); // flowId -> { requiredPermissions: [] }

        // 1. Manage Strategies Registry
        console.log("Limes: Loading strategies from YAML...");
        const res = await fetch("./bundles/system-services/limes/data/limes-strategies.yaml");
        const text = await res.text();
        const yamlStrategies = yaml.load(text) || [];
        
        const persistentStrategies = pm.load(STRATEGIES_PID) || [];
        // Merge: Use YAML as base, but keep persistent if it's already there? 
        // No, for this PoC task, let's just make sure YAML is always in there.
        yamlStrategies.forEach(ys => {
            const idx = persistentStrategies.findIndex(ps => ps.id === ys.id);
            if (idx === -1) {
                persistentStrategies.push(ys);
            } else {
                // If it exists, overwrite with YAML for this update phase
                persistentStrategies[idx] = ys;
            }
        });
        pm.store(STRATEGIES_PID, persistentStrategies);

        const getBundleConfig = (bundle) => {
            if (!bundle) return {};
            const headers = bundle.getHeaders();
            const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
            const configPriming = headers[configKey];
            if (!configPriming) return {};
            try {
                return typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
            } catch (_e) {
                return {};
            }
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

        const strategyRegistry = new Map();
        // Load persistent strategies
        (persistentStrategies || []).forEach(s => strategyRegistry.set(s.id, s));

        const getEvaluatedData = (userId) => {
            return (globalThis.backofficeState?.evaluatedData || []).find(d => String(d.user) === String(userId));
        };

        const limesService = {
            /**
             * Registers a new strategy.
             * Note: In this PoC, bundle-registered strategies are held in-memory 
             * and merged with persistent overrides.
             */
            registerStrategy: (id, definition) => {
                const existing = strategyRegistry.get(id);
                // Allow updates if it's new OR if it originated from a bundle (hasn't been manually overridden in management UI)
                if (!existing || existing.origin === 'bundle') {
                    strategyRegistry.set(id, { ...definition, id, origin: 'bundle' });
                }
            },

            getStrategies: () => Array.from(strategyRegistry.values()),

            updateStrategy: (id, definition) => {
                strategyRegistry.set(id, { ...definition, id });
                const all = Array.from(strategyRegistry.values());
                pm.store(STRATEGIES_PID, all);
                console.log("Limes: Strategy updated and persisted:", id);
            },

            deleteStrategy: (id) => {
                strategyRegistry.delete(id);
                const all = Array.from(strategyRegistry.values());
                pm.store(STRATEGIES_PID, all);
                console.log("Limes: Strategy deleted and persisted:", id);
            },

            isAllowed: (userOrId, strategyId, runtimeContext = {}) => {
                let userCap = null;
                if (typeof userOrId === 'object' && userOrId !== null) {
                    userCap = userOrId;
                } else {
                    userCap = getEvaluatedData(userOrId);
                }

                if (!userCap) {
                    if (typeof userOrId !== 'object') {
                        console.debug(`Limes: Unknown user evaluation for ${userOrId}`);
                    }
                    return false;
                }

                console.debug(`Limes: [isAllowed] user=${userCap.user}, strategy=${strategyId}`, runtimeContext);

                let strategy = strategyRegistry.get(strategyId);
                
                // FALLBACK for Flows: Generate on-the-fly strategy from manifest permissions
                if (!strategy && strategyId.startsWith('FLOW_VIEW:')) {
                    const flowId = strategyId.split(':')[1];
                    const flowInfo = flowRegistry.get(flowId);
                    if (flowInfo) {
                        strategy = {
                            id: strategyId,
                            operator: 'AND',
                            matchers: (flowInfo.requiredPermissions || []).map(p => ({
                                type: 'matchPermission',
                                value: p
                            }))
                        };
                        // If no permissions required, allow by default
                        if (strategy.matchers.length === 0) {
                            strategy.matchers.push({ type: 'matchAlways', value: true });
                        }
                        console.debug(`Limes: Resolved dynamic strategy for ${strategyId} (fallback)`, strategy);
                    } else {
                        console.warn(`Limes: No strategy nor flowRegistry entry for ${strategyId}`);
                    }
                }

                if (!strategy) {
                    console.debug(`Limes: Unknown strategy ${strategyId}`);
                    return false;
                }

                const matchers = strategy.matchers || [];
                const operator = strategy.operator || 'AND';

                const results = matchers.map(m => {
                    switch (m.type) {
                        case 'matchPermission':
                            return this.evaluatePermission(userCap, m.value, runtimeContext);
                        case 'matchScopeIntersection': {
                            const permKey = m.permission || m.value;
                            if (!permKey) {
                                console.warn(`Limes: matchScopeIntersection in strategy ${strategyId} missing permission key`, m);
                            }
                            return this.evaluateScopeIntersection(userCap, permKey, m.property, runtimeContext);
                        }
                        case 'matchProperty':
                            return runtimeContext[m.key] === m.value;
                        case 'matchAlways':
                            return m.value !== false;
                        case 'matchNever':
                            return false;
                        default:
                            console.warn(`Limes: Unknown matcher type ${m.type} in strategy ${strategyId}`);
                            return false;
                    }
                });

                if (operator === 'AND') {
                    const ok = results.every(r => r === true);
                    console.debug(`Limes: [isAllowed] -> result: ${ok} (AND) ids: ${results}`);
                    return ok;
                }
                if (operator === 'OR') {
                    const ok = results.some(r => r === true);
                    console.debug(`Limes: [isAllowed] -> result: ${ok} (OR) ids: ${results}`);
                    return ok;
                }
                return false;
            }
        };

        // 2. Register Limes Service
        context.registerService(LIMES_SERVICE, limesService);

        // 3. Register Management UI
        context.registerService(BO_EXTENSION_SERVICE, {
            id: "limes-management",
            name: "Limes Management",
            icon: "fas fa-shield-alt",
            templateUrl: "./bundles/system-services/limes/templates/management.html",
            onActivate: (hostState) => {
                hostState.limesStrategies = limesService.getStrategies();
                hostState.limesTestResults = null;
                
                hostState.testLimesGuard = (userId, strategyId, contextStr) => {
                    try {
                        const ctx = contextStr ? JSON.parse(contextStr) : {};
                        const allowed = limesService.isAllowed(userId, strategyId, ctx);
                        hostState.limesTestResults = { allowed, timestamp: new Date().toLocaleTimeString() };
                    } catch (e) {
                        alert("Invalid JSON context: " + e.message);
                    }
                };

                hostState.editLimesStrategy = (id) => {
                    const editorRef = context.getServiceReference(YAML_EDITOR_SERVICE);
                    const editor = editorRef ? context.getService(editorRef) : null;
                    if (!editor) return;

                    const strategy = strategyRegistry.get(id);
                    editor.edit({
                        title: `Edit Guard Strategy: ${id}`,
                        data: strategy,
                        onSave: (newData) => {
                            limesService.updateStrategy(id, newData);
                            hostState.limesStrategies = limesService.getStrategies();
                        }
                    });
                };

                hostState.createLimesStrategy = () => {
                    const id = prompt("Enter Strategy ID (e.g. FLOW_VIEW:my-flow):");
                    if (!id) return;
                    if (strategyRegistry.has(id)) {
                        alert("Strategy already exists!");
                        return;
                    }
                    const newStrat = {
                        id,
                        operator: "AND",
                        matchers: [{ type: "matchAlways", value: true }]
                    };
                    limesService.updateStrategy(id, newStrat);
                    hostState.limesStrategies = limesService.getStrategies();
                };

                hostState.deleteLimesStrategy = (id) => {
                    if (confirm(`Are you sure you want to delete strategy "${id}"?`)) {
                        limesService.deleteStrategy(id);
                        hostState.limesStrategies = limesService.getStrategies();
                    }
                };
            }
        });
    }

    /**
     * Checks if a user has a specific permission key.
     */
    evaluatePermission(userCap, key, _ctx) {
        if (!userCap.grantedKeys) return false;
        const normalized = String(key).toLowerCase().replace(/:/g, '_');
        const allowed = Object.keys(userCap.grantedKeys).some(k => k.toLowerCase().replace(/:/g, '_') === normalized);
        console.debug(`Limes: [evaluatePermission] key=${key} (${normalized}) -> allowed=${allowed}`);
        return allowed;
    }

    /**
     * Checks if the user's scope for a permission intersects with the context property.
     */
    evaluateScopeIntersection(userCap, permissionKey, contextProperty, runtimeContext) {
        if (!permissionKey) {
            console.warn("Limes: evaluateScopeIntersection called without permissionKey");
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
            console.log(`Limes: [evaluateScopeIntersection] key=${permissionKey} -> false (no perm found)`);
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

        console.debug(`Limes: [evaluateScopeIntersection] key=${permissionKey}, prop=${contextProperty}, ctxVal=${runtimeContext[contextProperty]} -> match=${match}`);
        return match;
    }

    stop(_context) {}
}
