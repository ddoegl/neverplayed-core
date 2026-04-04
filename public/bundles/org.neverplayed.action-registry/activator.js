import { ACTION_REGISTRY_SERVICE, ACTION_SERVICE, LOG_SERVICE } from "core-types";

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
        
        // Initialize/Update registry with logger
        const initRegistry = (logSvc) => {
            if (!registry) {
                registry = new ActionRegistry(logSvc);
                context.registerService(ACTION_REGISTRY_SERVICE, registry);
                
                // Track all ACTION_SERVICE registrations
                context.trackService(`(objectClass=${ACTION_SERVICE})`, {
                    addingService: (ref) => {
                        const id = ref.getProperty("action.id");
                        if (id) {
                            registry.register({
                                id,
                                label: ref.getProperty("action.label") || id,
                                description: ref.getProperty("action.description") || "",
                                icon: ref.getProperty("action.icon") || "fas fa-play",
                                metadata: ref.getProperty("action.metadata") || {}
                            });
                        }
                    }
                }).open();
            } else {
                registry._logger = logSvc;
            }
        };

        // Track LogService for standardized logging
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                logger = logAdmin.getLogger("action-registry");
                logger.info("Log Service connected");
                initRegistry(logger);
            },
            removedService: () => { 
                logger = null; 
                if (registry) registry._logger = null;
            }
        }).open();

        // Fallback if no logger joins quickly
        setTimeout(() => { if (!registry) initRegistry(null); }, 500);
    }

    stop(_context) {
    }
}
