/**
 * @file Activator for org.neverplayed.limes-ui
 * @module platform/bundles/org.neverplayed.limes-ui
 */

import { BO_EXTENSION_SERVICE, YAML_EDITOR_SERVICE, LIMES_SERVICE } from "core-types";
import { AlpineActivator } from "alpine-base";

export default class Activator extends AlpineActivator {
  onStart(context) {
    const state = this.initStore('limes_ui', {
        strategies: [],
        testResults: null,
        
        refresh() {
            const limes = context.getService(context.getServiceReference(LIMES_SERVICE));
            if (limes) this.strategies = limes.getStrategies();
        },
        
        testGuard(userId, strategyId, contextStr) {
            const limes = context.getService(context.getServiceReference(LIMES_SERVICE));
            if (!limes) return;
            try {
                const allowed = limes.isAllowed(userId, strategyId, contextStr ? JSON.parse(contextStr) : {});
                this.testResults = { allowed, timestamp: new Date().toLocaleTimeString() };
            } catch (e) { alert("Invalid JSON: " + e.message); }
        }
    });

    this.track(`(objectClass=${LIMES_SERVICE})`, { 
        addingService: () => state.refresh(),
        removedService: () => state.strategies = []
    });

    context.registerService(BO_EXTENSION_SERVICE, {
        id: "limes-management",
        name: "Limes Management",
        icon: "fas fa-shield-alt",
        templateUrl: this.resolveResource("templates/management.html"),
        onActivate: (hostState) => {
            state.refresh();
            Object.assign(hostState, {
                get limesState() { return state; },
                editLimesStrategy: (id) => {
                    const editor = context.getService(context.getServiceReference(YAML_EDITOR_SERVICE));
                    const limes = context.getService(context.getServiceReference(LIMES_SERVICE));
                    if (editor && limes) {
                        editor.edit({
                            title: `Edit Guard: ${id}`,
                            data: limes.getStrategies().find(s => s.id === id),
                            onSave: (data) => { limes.updateStrategy(id, data); state.refresh(); }
                        });
                    }
                }
            });
        }
    });
  }
}
