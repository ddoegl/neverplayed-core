import { BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, LIMES_SERVICE } from "core-types";

export default class Activator {
    start(context) {
        let limes = null;
        let yamlEditor = null;

        context.trackService(`(objectClass=${LIMES_SERVICE})`, {
            addingService: (ref) => { limes = context.getService(ref); },
            removedService: () => { limes = null; }
        }).open();

        context.trackService(`(objectClass=${YAML_EDITOR_SERVICE})`, {
            addingService: (ref) => { yamlEditor = context.getService(ref); },
            removedService: () => { yamlEditor = null; }
        }).open();

        context.registerService(BO_EXTENSION_SERVICE, {
            id: "limes-management",
            name: "Limes Management",
            icon: "fas fa-shield-alt",
            templateUrl: "./bundles/org.neverplayed.limes-ui/templates/management.html",
            onActivate: (hostState) => {
                if (!limes) return;
                hostState.limesStrategies = limes.getStrategies();
                hostState.limesTestResults = null;
                
                hostState.testLimesGuard = (userId, strategyId, contextStr) => {
                    if (!limes) return;
                    try {
                        const ctx = contextStr ? JSON.parse(contextStr) : {};
                        const allowed = limes.isAllowed(userId, strategyId, ctx);
                        hostState.limesTestResults = { allowed, timestamp: new Date().toLocaleTimeString() };
                    } catch (e) {
                        alert("Invalid JSON context: " + e.message);
                    }
                };

                hostState.editLimesStrategy = (id) => {
                    if (!yamlEditor) {
                        alert("YAML Editor not available.");
                        return;
                    }
                    yamlEditor.edit({
                        title: `Edit Guard Strategy: ${id}`,
                        data: limes.getStrategies().find(s => s.id === id),
                        onSave: (newData) => {
                            limes.updateStrategy(id, newData);
                            hostState.limesStrategies = limes.getStrategies();
                        }
                    });
                };

                hostState.createLimesStrategy = () => {
                    const id = prompt("Enter Strategy ID (e.g. FLOW_VIEW:my-flow):");
                    if (!id) return;
                    const existing = limes.getStrategies().find(s => s.id === id);
                    if (existing) {
                        alert("Strategy already exists!");
                        return;
                    }
                    limes.updateStrategy(id, {
                        id,
                        operator: "AND",
                        matchers: [{ type: "matchAlways", value: true }]
                    });
                    hostState.limesStrategies = limes.getStrategies();
                };

                hostState.deleteLimesStrategy = (id) => {
                    if (confirm(`Are you sure you want to delete strategy "${id}"?`)) {
                        limes.deleteStrategy(id);
                        hostState.limesStrategies = limes.getStrategies();
                    }
                };
            }
        });
    }

    stop(_context) {}
}
