import "./components/ui-factory.js";
import "./components/atomic-component-base.js";
import "./components/atomic-button.js";
import "./components/atomic-input.js";
import "./components/atomic-select.js";

export default class Activator {
  start(context) {
    console.log("Shared UI Components Bundle started. Custom tags registered.");
    
    // Inject context into UI Factory if needed
    const factory = customElements.get("ui-factory");
    if (factory && factory.prototype.setBundleContext) {
        // Note: Existing instances might need a way to get context
    }

    // Provide a service for the orchestrator to interact with the factory
    context.registerService("prototyper.ui.factory", {
        create: (spec) => {
            const el = document.createElement("ui-factory");
            // We'll need a way to pass the context/service to the element
            if (el.setBundleContext) el.setBundleContext(context);
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
