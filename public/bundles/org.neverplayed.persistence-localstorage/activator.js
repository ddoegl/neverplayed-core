import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

/**
 * Institutional LocalStorage Persistence Manager
 * Provides standard-compliant persistence with listKeys support.
 */
export default class Activator extends BaseActivator {
    onStart(context) {
        const storage = globalThis.localStorage;
        
        if (!storage) {
            this.logger.error("LocalStorage Persistence: Environment does not support localStorage!");
            return;
        }

        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            /**
             * waitReady
             * Standard compliance for async boot sequences.
             */
            waitReady: () => {
                return Promise.resolve();
            },

            /**
             * load
             * Hydrates a single key from storage.
             */
            load: (key) => {
                const val = storage.getItem(key);
                if (val === null) return null;
                try {
                    return JSON.parse(val);
                } catch (_e) {
                    return val;
                }
            },

            /**
             * store
             * Persists a value to storage.
             */
            store: (key, val) => {
                try {
                    const stringVal = typeof val === 'string' ? val : JSON.stringify(val);
                    storage.setItem(key, stringVal);
                    this.logger.debug(`LocalStorage: Stored [${key}] (${stringVal.length} chars)`);
                } catch (e) {
                    this.logger.error(`LocalStorage: Failed to store [${key}]`, e);
                    throw e;
                }
            },

            /**
             * listKeys
             * CRITICAL: Supports cross-tier discovery aggregation.
             */
            listKeys: (prefix = "") => {
                const keys = [];
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keys.push(key);
                    }
                }
                return keys;
            },

            /**
             * dump
             * Full tier export for forensic recovery.
             */
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
            },

            /**
             * clear
             * Strategic tier purging.
             */
            clear: () => {
                storage.clear();
                this.logger.info("LocalStorage Persistence: Cleared all entries.");
            }
        }, {
            "capability": "sys:persistence",
            "implementation": "browser-localstorage",
            "persistence.type": "provider",
            "persistence.tier": "local",
            "persistence.scope": "browser",
            "service.ranking": 25
        });

        this.logger.info("LocalStorage Persistence Manager: ACTIVE.");
    }

    onStop(_context) {
        this.logger.info("LocalStorage Persistence Manager: STOPPED.");
    }
}
