import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

/**
 * Deno Native Persistence Manager (localStorage)
 * This bundle uses Deno's built-in localStorage support, which is 
 * process-isolated and stored in the Deno cache directory.
 */
export default class Activator extends BaseActivator {
    onStart(context) {
        const storage = globalThis.localStorage;
        
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            load: (key) => {
                const val = storage.getItem(key);
                if (val === null) return null;
                try {
                    return JSON.parse(val);
                } catch (_e) {
                    return val;
                }
            },
            store: (key, val) => {
                const stringVal = typeof val === 'string' ? val : JSON.stringify(val);
                storage.setItem(key, stringVal);
            },
            dump: () => {
                const result = {};
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    try {
                        result[key] = JSON.parse(storage.getItem(key));
                    } catch (_e) {
                        result[key] = storage.getItem(key);
                    }
                }
                return result;
            }
        }, {
            "capability": "sys:persistence",
            "implementation": "deno-localstorage"
        });

        this.logger.info("Deno Persistence Manager: ACTIVE (localStorage).");
    }

    onStop(_context) {
        this.logger.info("Deno Persistence Manager: STOPPED.");
    }
}
