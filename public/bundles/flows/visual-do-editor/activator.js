//import { ATOMIC_ORCHESTRATOR_SERVICE } from "../../../shared-types.js";

export default class Activator {

    start(_context) {
        console.log("Visual DO Editor: Bundle started (declarative mode)");
    }
    stop() {
        console.log("Visual DO Editor: Bundle stopped");
    }
}
/**
 * Activator for the Visual DO Editor.
 * This bundle registers the meta-flow blueprint with the orchestrator.
 */
/*export default (context) => {
    console.log("Visual DO Editor [BUNDLE]: Activating...");

    const orchestrator = context.getService(ATOMIC_ORCHESTRATOR_SERVICE);
    if (orchestrator) {
        // Load the spec and register
        fetch(new URL('./spec.yaml', import.meta.url))
            .then(r => r.text())
            .then(yaml => {
                orchestrator.registerBlueprint("visual-do-editor", yaml);
                console.log("Visual DO Editor [BUNDLE]: Meta-flow registered.");
            })
            .catch(e => console.error("Visual DO Editor [BUNDLE]: Failed to load spec", e));
    } else {
        console.error("Visual DO Editor [BUNDLE]: Orchestrator not found.");
    }
};
*/