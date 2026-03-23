import { ATOMIC_COMPONENT_REGISTRY_SERVICE } from "../../../shared-types.js";
import "./components/ui-factory.js";
import "./components/atomic-component-base.js";
import "./components/atomic-button.js";
import "./components/atomic-input.js";
import "./components/atomic-select.js";
import "./components/atomic-radio.js";
import "./components/atomic-checkbox.js";
import "./components/atomic-master-detail.js";
import "./components/atomic-hero.js";

export default class Activator {
  start(context) {
    console.log("Shared UI Components Bundle started. Custom tags registered.");

    const componentRegistry = new Map([
        ['command-button', 'atomic-button'],
        ['action', 'atomic-button'],
        ['text-input', 'atomic-input'],
        ['input', 'atomic-input'],
        ['select-input', 'atomic-select'],
        ['radio-input', 'atomic-radio'],
        ['checkbox-input', 'atomic-checkbox'],
        ['master-detail', 'atomic-master-detail'],
        ['hero', 'atomic-hero']
    ]);

    context.registerService(ATOMIC_COMPONENT_REGISTRY_SERVICE, {
        register: (kind, tagName) => {
            console.log(`UI Components: Registering component [${kind}] -> <${tagName}>`);
            componentRegistry.set(kind, tagName);
        },
        get: (kind) => componentRegistry.get(kind),
        getAll: () => Object.fromEntries(componentRegistry)
    });
    
    // Inject context into UI Factory if needed
    const factory = customElements.get("ui-factory");
    if (factory && factory.prototype.setBundleContext) {
        // Note: Existing instances might need a way to get context
    }

    // Provide a service for the orchestrator to interact with the factory
    context.registerService("prototyper.ui.factory", {
        create: (spec, params = {}) => {
            const el = document.createElement("ui-factory");
            // We'll need a way to pass the context/service to the element
            if (el.setBundleContext) el.setBundleContext(context);
            if (el.setParams) el.setParams(params);
            if (spec && el.setSpec) el.setSpec(spec);
            return el;
        }
    });

    context.registerService("prototyper.ui.components", { loaded: true });
  }

  stop(_context) {
    console.log("Shared UI Components Bundle stopped.");
  }
}
