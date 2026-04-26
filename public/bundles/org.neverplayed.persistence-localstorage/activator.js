import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

/**
 * Institutional LocalStorage Persistence Manager
 * Provides standard-compliant persistence with listKeys support.
 */
export default class Activator extends BaseActivator {
    _context = { tenantId: "guest", realmId: "unknown", identityId: "guest" };

    onStart(context) {
        const storage = globalThis.localStorage;
        
        if (!storage) {
            this.logger.error("LocalStorage Persistence: Environment does not support localStorage!");
            return;
        }

        const getPhysicalKey = (key) => {
            // Rule: Bootstrap Anchor (SDN-0165)
            // The session state defines the identity, so it must be discoverable 
            // at boot before any identity is resolved.
            if (key.startsWith("pandino.session")) {
                return `np:v1:guest:unknown:guest:${key}`;
            }
            return `np:v1:${this._context.tenantId}:${this._context.realmId}:${this._context.identityId}:${key}`;
        };

        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            setContext: (ctx) => {
                this.logger.debug(`LocalStorage: Context Shift -> [${ctx.tenantId}][${ctx.identityId}]`);
                this._context = ctx;
            },

            waitReady: () => Promise.resolve(),

            load: (key) => {
                const physicalKey = getPhysicalKey(key);
                const val = storage.getItem(physicalKey);
                if (val === null) return null;
                try {
                    return JSON.parse(val);
                } catch (_e) {
                    return val;
                }
            },

            store: (key, val) => {
                try {
                    const physicalKey = getPhysicalKey(key);
                    const stringVal = typeof val === 'string' ? val : JSON.stringify(val);
                    storage.setItem(physicalKey, stringVal);
                    this.logger.debug(`LocalStorage: Stored [${key}] -> [${physicalKey}]`);
                } catch (e) {
                    this.logger.error(`LocalStorage: Failed to store [${key}]`, e);
                    throw e;
                }
            },

            listKeys: (prefix = "") => {
                const results = [];
                const realmPrefix = `np:v1:${this._context.tenantId}:${this._context.realmId}:`;
                const identityPrefix = `${realmPrefix}${this._context.identityId}:`;

                for (let i = 0; i < storage.length; i++) {
                    const k = storage.key(i);
                    if (!k) continue;

                    if (this._context.showAll && k.startsWith(realmPrefix)) {
                         if (k.includes(`:${prefix}`)) {
                             const parts = k.split(':');
                             const logicalKey = parts.slice(5).join(':'); // Adjusted for realm dimension
                             if (logicalKey.startsWith(prefix)) results.push(logicalKey);
                         }
                    } else if (k.startsWith(identityPrefix)) {
                         const logicalKey = k.substring(identityPrefix.length);
                         if (logicalKey.startsWith(prefix)) {
                             results.push(logicalKey);
                         }
                    }
                }
                return Array.from(new Set(results));
            },

            clear: () => {
                const physicalPrefix = getPhysicalKey("");
                const keys = Object.keys(storage);
                let count = 0;
                keys.forEach(k => {
                    if (k.startsWith(physicalPrefix)) {
                        storage.removeItem(k);
                        count++;
                    }
                });
                this.logger.debug(`LocalStorage Persistence: Cleared ${count} entries for identity ${this._context.identityId}`);
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
