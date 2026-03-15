import { FLOW_SERVICE, LIMES_SERVICE, DOMAIN_OBJECT_REGISTRY_SERVICE, SESSION_SERVICE } from "../../../shared-types.js";

export default class Activator {
    start(context) {
        // RESILIENT PATTERN: On-demand service lookup
        const getSvc = (id) => {
            const ref = context.getServiceReference(id);
            return ref ? context.getService(ref) : null;
        };

        // FRESH FACTORY PATTERN: Expose setup function to globalThis
        globalThis.getDODashboardScope = () => {
            const doRegistry = getSvc(DOMAIN_OBJECT_REGISTRY_SERVICE);
            const limes = getSvc(LIMES_SERVICE);
            const session = getSvc(SESSION_SERVICE);
            const _bState = globalThis.backofficeState;

            return {
                get user() {
                    const u = session?.currentUser || null;
                    if (!u) console.warn("DO Dashboard: [SENSITIVE] session.currentUser is null");
                    return u;
                },
                get ready() {
                    return !!(doRegistry && limes && session && this.user?.id);
                },
                get dos() {
                    if (!this.ready) {
                        return [];
                    }

                    // Fetch directly from registry service for context independence
                    const allInstances = doRegistry.getInstances() || {};
                    const rawStrats = doRegistry.getStrategies() || {};
                    // Strategies in PM are keyed by YAML label (DO_STRATEGY_PRODUCT), 
                    // instances use the 'id' (product-strategy). We need a map.
                    const strategies = Object.values(rawStrats).reduce((acc, s) => {
                        if (s.id) acc[s.id] = s;
                        return acc;
                    }, {});

                    const userId = this.user.id;

                    return Object.values(allInstances).filter(inst => {
                        const strategy = strategies[inst.strategyId];
                        const prefix = strategy?.limesPrefix || "DO"; 
                        const viewStrategyId = `${prefix}_VIEW`;
                        
                        return limes.isAllowed(userId, viewStrategyId, inst);
                    }).map(inst => {
                        const strategy = strategies[inst.strategyId];
                        const prefix = strategy?.limesPrefix || "DO";
                        
                        const allowedActions = (strategy?.actions || []).filter(action => {
                            const actionStrategyId = `${prefix}_${action.id.toUpperCase()}`;
                            return limes.isAllowed(userId, actionStrategyId, inst);
                        });
                        return { ...inst, allowedActions, strategy };
                    });
                },
                triggerAction(actionId, doInstance) {
                    console.log(`DO Dashboard: [ACTION] Triggering ${actionId} for ${doInstance.id}`);
                    
                    if (doRegistry && doRegistry.handleAction) {
                        console.log("DO Dashboard: [DELEGATE] Passing to Registry Service");
                        const host = document.getElementById('backoffice-root-container') ? globalThis.backofficeState : globalThis.businessPortalState;
                        doRegistry.handleAction({ id: actionId }, doInstance, host);
                    } else {
                        console.warn("DO Dashboard: [FALLBACK] Registry Service handleAction not available, using legacy shell-launch-flow");
                        let flowId = "real-life";
                        if (actionId === "sign") flowId = "cases";
                        if (actionId === "view") flowId = "do-details";

                        globalThis.dispatchEvent(new CustomEvent("shell-launch-flow", {
                            detail: {
                                id: flowId,
                                params: {
                                    doId: doInstance.id,
                                    strategyId: doInstance.strategyId,
                                    action: actionId
                                }
                            }
                        }));
                    }
                }
            };
        };

        context.registerService(FLOW_SERVICE, {
            id: "do-dashboard",
            title: "Domain Objects",
            launch: async (container, _params) => {
                const res = await fetch("./bundles/flows/do-dashboard/templates/dashboard.html");
                const html = await res.text();
                container.innerHTML = html;
                // Alpine will automatically parse x-data="globalThis.getDODashboardScope()"
            }
        }, {
            "flow.id": "do-dashboard",
            "flowType": "service-flow",
            "channels": ["business-channel-web", "retail-channel-app"]
        });
    }

    async stop(_context) {}
}
