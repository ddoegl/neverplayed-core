import { 
  ATOMIC_COMPONENT_REGISTRY_SERVICE, 
  UI_FACTORY_SERVICE, 
  UI_COMPONENTS_SERVICE, 
  UI_REGISTRY_SERVICE,
  ACTION_SERVICE, 
  LOG_SERVICE,
  INTERACTOR_SERVICE
} from "core-types";

// Side effects: ensure components are loaded
import "./components/ui-factory.js";
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
    this._interactor = null;

    // Track Interactor for standardized actions (ADR-0029)
    // NOTE: shared-ui is a *consumer* of INTERACTOR_SERVICE (for ui:alert / ui:confirm actions).
    // The *provider* lives in org.neverplayed.toast.
    context.trackService(`(objectClass=${INTERACTOR_SERVICE})`, {
        addingService: (ref) => {
            this._interactor = context.getService(ref);
            if (logger.info) logger.info("Shared UI: Interactor discovered. Platform safety-nets active.");
            return this._interactor;
        },
        removedService: () => { this._interactor = null; }
    }).open();

    // Resilient Logger Tracking
    context.trackService(`(objectClass=${LOG_SERVICE})`, {
        addingService: (ref) => {
            const logAdmin = context.getService(ref);
            logger = logAdmin.getLogger("shared-ui-components");
            logger.info("Shared UI Components Bundle started.");
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
            if (logger.info) logger.info(`UI Components: Registering component [${kind}] -> <${tagName}>`);
            componentRegistry.set(kind, tagName);
        },
        get: (kind) => componentRegistry.get(kind),
        getAll: () => Object.fromEntries(componentRegistry)
    });

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

    // Ensure the global registry exists (Pattern 21: Shared State)
    globalThis.__UI_FACTORY_REGISTRY = globalThis.__UI_FACTORY_REGISTRY || {
        _map: new Map(),
        set(id, state) { this._map.set(id, state); },
        get(id) { return this._map.get(id); },
        getAll() { return Object.fromEntries(this._map); }
    };

    /**
     * UI_REGISTRY_SERVICE
     * Provides an authoritative map of all active UI Factory state objects for orchestration.
     */
    context.registerService(UI_REGISTRY_SERVICE, globalThis.__UI_FACTORY_REGISTRY);

    const existingFactories = document.querySelectorAll("ui-factory");
    if (existingFactories.length > 0) {
        existingFactories.forEach(el => {
            if (typeof el.setBundleContext === 'function') {
                el.setBundleContext(context);
            }
        });
    }

    /**
     * ACTION_SERVICE: step.navigate
     * Core orchestrator command for step navigation.
     */
    context.registerService(ACTION_SERVICE, {
        execute: (params) => {
            this.logger.info("Internal Command: step.navigate", params);
            return { success: true };
        }
    }, {
        "action.id": "step.navigate",
        "action.label": "Jump to Step",
        "action.description": "Navigates to a specific step within the current flow.",
        "action.icon": "fas fa-rocket",
        "action.params": {
            "target": "The ID of the step to navigate to."
        }
    });

    /**
     * ACTION_SERVICE: ui:alert
     * Standardized interactor-backed alert notification.
     */
    context.registerService(ACTION_SERVICE, {
        execute: async (params) => {
            const message = params.message || "Action Completed!";
            if (this._interactor) {
                await this._interactor.alert(message);
            } else {
                globalThis.alert(message);
            }
            return { success: true };
        }
    }, {
        "action.id": "ui:alert",
        "action.label": "Show Alert",
        "action.description": "Displays a notification alert via the Interactor service.",
        "action.icon": "fas fa-bell",
        "action.params": {
            "message": "The text message to display."
        }
    });

    /**
     * ACTION_SERVICE: ui:confirm
     * Standardized interactor-backed confirmation dialog.
     */
    context.registerService(ACTION_SERVICE, {
        execute: async (params) => {
            const message = params.message || "Are you sure?";
            if (this._interactor) {
                const confirmed = await this._interactor.confirm(message);
                return { success: confirmed, confirmed };
            }
            const confirmed = globalThis.confirm(message);
            return { success: confirmed, confirmed };
        }
    }, {
        "action.id": "ui:confirm",
        "action.label": "Ask Confirmation",
        "action.description": "Asks the user for confirmation before proceeding.",
        "action.icon": "fas fa-question-circle",
        "action.params": {
            "message": "The confirmation question."
        }
    });
  }

  /**
   * Performs cleanup when the bundle is stopped.
   * @param {BundleContext} _context - The OSGi bundle context.
   */
  stop(_context) {
    // No-op
  }
}
