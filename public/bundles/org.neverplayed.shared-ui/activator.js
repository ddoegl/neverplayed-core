import { 
    ATOMIC_COMPONENT_REGISTRY_SERVICE, 
    ACTION_REGISTRY_SERVICE,
    UI_FACTORY_SERVICE,
    UI_COMPONENTS_SERVICE,
    ACTION_SERVICE,
    LOG_SERVICE
} from "core-types";
import "./components/ui-factory.js";
import "./components/ui-factory-poc.js";
import "./components/atomic-component-base.js";
import "./components/atomic-button.js";
import "./components/atomic-input.js";
import "./components/atomic-select.js";
import "./components/atomic-radio.js";
import "./components/atomic-checkbox.js";
import "./components/atomic-master-detail.js";
import "./components/atomic-hero.js";
import "./components/authorization-selector.js";
import "./components/user-selector.js";

export default class Activator {
  start(context) {
    let logger = console; // Fallback
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger("shared-ui-components");
            logger.info("Shared UI Components Bundle started. Custom tags registered.");
        },
        removedService: () => { logger = console; }
    }).open();

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
    context.registerService(UI_FACTORY_SERVICE, {
        create: (spec, params = {}) => {
            const el = document.createElement("ui-factory");
            // We'll need a way to pass the context/service to the element
            if (el.setBundleContext) el.setBundleContext(context);
            if (el.setParams) el.setParams(params);
            if (spec && el.setSpec) el.setSpec(spec);
            return el;
        }
    });

    context.registerService(UI_COMPONENTS_SERVICE, { loaded: true });

    // Register generic Action Services for internal shell functions
    context.registerService(ACTION_SERVICE, {
        execute: (params) => {
            alert(params.message || "Action Completed!");
            return { success: true };
        }
    }, {
        "action.id": "synthetic.client.summary-alert"
    });

    // Register built-in actions in the registry for documentation
    context.trackService(`(objectClass=${ACTION_REGISTRY_SERVICE})`, {
        addingService: (ref) => {
            const registry = context.getService(ref);
            
            registry.register({
                id: 'step.navigate',
                label: '🚀 Jump to Step',
                description: 'Navigates to a specific step within the current flow.',
                params: {
                    target: 'The ID of the step to navigate to (e.g. "step2").',
                    step: 'Alias for target.'
                }
            });

            registry.register({
                id: 'synthetic.client.summary-alert',
                label: '🔔 Show Alert',
                description: 'Displays a notification alert to the user.',
                params: {
                    message: 'The text message to display.',
                    title: 'The title of the alert box.'
                }
            });
        }
    }).open();
  }

  stop(_context) {
    console.log("Shared UI Components Bundle stopped.");
  }
}
