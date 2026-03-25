import { ACTION_REGISTRY_SERVICE } from "../../../shared-types.js";

class ActionRegistry {
    constructor() {
        this._actions = new Map();
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
        console.log(`Action Registry: Registered/Updated ${action.id}`);
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
        const registry = new ActionRegistry();
        // ... (rest of registration logic)


        context.registerService(ACTION_REGISTRY_SERVICE, registry);
        console.log("Action Registry Service started.");
    }

    stop(_context) {
        console.log("Action Registry Service stopped.");
    }
}
