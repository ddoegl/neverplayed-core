import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    onStart(context) {
        // Deno natively supports localStorage on a per-location basis
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
