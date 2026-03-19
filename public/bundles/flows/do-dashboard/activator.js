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
                get host() {
                    return document.getElementById('backoffice-root-container') ? globalThis.backofficeState : globalThis.businessPortalState;
                },
                get user() {
                    const u = session?.currentUser || null;
                    if (!u) console.warn("DO Dashboard: [SENSITIVE] session.currentUser is null");
                    return u;
                },
                get ready() {
                    return !!(doRegistry && limes && session && this.user?.id);
                },
                get blueprints() {
                    return this.host?.domainObjectSpecs || [];
                },
                get dos() {
                    if (!this.ready) return [];

                    const allInstances = this.host?.domainObjectInstances || {};
                    const strategiesMap = this.host?.domainObjectStrategies || {};
                    const userId = this.user.id;

                    return Object.values(allInstances).filter(inst => {
                        const strategy = strategiesMap[inst.strategyId];
                        const prefix = strategy?.limesPrefix || "DO"; 
                        const viewStrategyId = `${prefix}_VIEW`;
                        return limes.isAllowed(userId, viewStrategyId, inst);
                    }).map(inst => {
                        const strategy = strategiesMap[inst.strategyId];
                        const prefix = strategy?.limesPrefix || "DO";
                        const allowedActions = (strategy?.actions || []).filter(action => {
                            const actionStrategyId = `${prefix}_${action.id.toUpperCase()}`;
                            return limes.isAllowed(userId, actionStrategyId, inst);
                        });
                        return { ...inst, allowedActions, strategy };
                    });
                },
                instantiate(blueprintId) {
                    console.log(`DO Dashboard: [CREATE] Instantiating blueprint ${blueprintId}`);
                    if (this.host?.instantiateDO) {
                        const inst = this.host.instantiateDO(blueprintId);
                        if (inst) {
                            console.log("DO Dashboard: Auto-navigating to new instance", inst.id);
                            this.triggerAction('view', inst);
                        }
                    } else {
                        console.error("DO Dashboard: Host instantiateDO method not found.");
                    }
                },
                triggerAction(actionId, doInstance) {
                    console.log(`DO Dashboard: [ACTION] Triggering ${actionId} for ${doInstance.id}`);
                    if (doRegistry && doRegistry.handleAction) {
                        doRegistry.handleAction({ id: actionId }, doInstance, this.host);
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
