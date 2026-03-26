import { ATOMIC_COMPONENT_REGISTRY_SERVICE } from "shared-types";
import "./components/atomic-visual-editor.js";

export default class Activator {
    start(context) {
        console.log("Visual DO Editor: Bundle started.");
        
        // Register the specialized builder component with the UIFactory via the Registry Service
        const registryRef = context.getServiceReference(ATOMIC_COMPONENT_REGISTRY_SERVICE);
        const registry = registryRef ? context.getService(registryRef) : null;
        
        if (registry) {
            registry.register('visual-editor', 'atomic-visual-editor');
            console.log("Visual DO Editor: Registered 'visual-editor' component strategy via Service.");
        } else {
            console.error("Visual DO Editor: Component Registry Service not found!");
        }
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