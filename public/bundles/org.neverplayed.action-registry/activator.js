import { ACTION_REGISTRY_SERVICE, LOG_SERVICE } from "core-types";

class ActionRegistry {
    constructor(logger) {
        this._actions = new Map();
        this._logger = logger;
    }

    /**
     * Register or update an action in the registry.
     * @param {Object} action 
     */
    register(action) {
        if (!action.id) return;
        this._actions.set(action.id, {
            ...action,
            registeredAt: new Date().toISOString()
        });
        if (this._logger) this._logger.info(`Registered/Updated action: ${action.id}`);
    }

    getActions() {
        return Array.from(this._actions.values());
    }

    getAction(id) {
        return this._actions.get(id);
    }
}

export default class Activator {
    start(context) {
        let logger = null;
        let registry = null;

        // Track LogService for standardized logging
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                logger = logAdmin.getLogger("action-registry");
                logger.info("Log Service connected");
                
                // Initialize/Update registry with logger
                if (!registry) {
                    registry = new ActionRegistry(logger);
                    context.registerService(ACTION_REGISTRY_SERVICE, registry);
                } else {
                    registry._logger = logger;
                }
            },
            removedService: () => { 
                logger = null; 
                if (registry) registry._logger = null;
            }
        }).open();

        // Fallback if no logger joins quickly (unlikely but safe)
        if (!registry) {
            registry = new ActionRegistry(null);
            context.registerService(ACTION_REGISTRY_SERVICE, registry);
        }
    }

    stop(_context) {
    }
}
