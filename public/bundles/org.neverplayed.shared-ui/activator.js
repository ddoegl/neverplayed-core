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

/**
 * Activator for the Shared UI Components Bundle.
 * 
 * This bundle is a foundational infrastructure layer that provides:
 * 1. The Atomic Component Registry (for mapping design tokens to tags).
 * 2. The UI Factory Service (for rendering declarative UI specs).
 * 3. Synthetic Client Actions (for shell-level UI interactions).
 * 
 * Implements patterns: ADR-0016 (Inhabitant Sovereignty), ADR-0025 (Identity Injection), ADR-0026 (Reactive Resolution).
 */
export default class Activator {
  /**
   * Initializes the shared UI services and registers atomic components.
   * 
   * @param {BundleContext} context - The OSGi bundle context.
   */
  start(context) {
    let logger = console; // Fallback
    
    // Resilient Logger Tracking
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger("shared-ui-components");
            logger.info("Shared UI Components Bundle started. Custom tags registered.");
        },
        removedService: () => { logger = console; }
    }).open();

    /**
     * Internal registry of atomic component mappings.
     * Maps 'kind' (uiSpec property) to 'tagName' (Custom Element).
     */
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

    /**
     * ATOMIC_COMPONENT_REGISTRY_SERVICE
     * Allows other bundles to extend the design system by registering new component tags.
     */
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

    /**
     * UI_FACTORY_SERVICE
     * The primary entry point for rendering declarative UI flows.
     * Manages spec parsing, variable interpolation, and Alpine.js hydration.
     */
    context.registerService(UI_FACTORY_SERVICE, {
        create: (spec, params = {}) => {
            const el = document.createElement("ui-factory");
            if (el.setBundleContext) el.setBundleContext(context);
            if (el.setParams) el.setParams(params);
            if (spec && el.setSpec) el.setSpec(spec);
            return el;
        }
    });

    /**
     * UI_COMPONENTS_SERVICE
     * A marker service to indicate that shared UI components are ready.
     */
    context.registerService(UI_COMPONENTS_SERVICE, { loaded: true });

    /**
     * ACTION_SERVICE: synthetic.client.summary-alert
     * Provides a standardized shell-level alert dialog.
     */
    context.registerService(ACTION_SERVICE, {
        execute: (params) => {
            alert(params.message || "Action Completed!");
            return { success: true };
        }
    }, {
        "action.id": "synthetic.client.summary-alert"
    });

    /**
     * Register technical metadata for decentralized action discovery.
     */
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

  /**
   * Performs cleanup when the bundle is stopped.
   * @param {BundleContext} _context - The OSGi bundle context.
   */
  stop(_context) {
    if (console.log) console.log("Shared UI Components Bundle stopped.");
  }
}
