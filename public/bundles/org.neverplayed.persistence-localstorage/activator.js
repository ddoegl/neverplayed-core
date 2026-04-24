import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

/**
 * Institutional LocalStorage Persistence Manager
 * Provides standard-compliant persistence with listKeys support.
 */
export default class Activator extends BaseActivator {
    _context = { tenantId: "guest", identityId: "guest" };

    onStart(context) {
        const storage = globalThis.localStorage;
        const self = this;
        
        if (!storage) {
            this.logger.error("LocalStorage Persistence: Environment does not support localStorage!");
            return;
        }

        const getPhysicalKey = (key) => {
            // Rule: Bootstrap Anchor (SDN-0165)
            // The session state defines the identity, so it must be discoverable 
            // at boot before any identity is resolved.
            if (key.startsWith("pandino.session")) {
                return `np:v1:guest:guest:${key}`;
            }
            return `np:v1:${self._context.tenantId}:${self._context.identityId}:${key}`;
        };

        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            setContext: (ctx) => {
                self.logger.debug(`LocalStorage: Context Shift -> [${ctx.tenantId}][${ctx.identityId}]`);
                self._context = ctx;
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
                    self.logger.debug(`LocalStorage: Stored [${key}] -> [${physicalKey}]`);
                } catch (e) {
                    self.logger.error(`LocalStorage: Failed to store [${key}]`, e);
                    throw e;
                }
            },

            listKeys: (prefix = "") => {
                const results = [];
                
                // Case A: Strict Identity Isolation (Standard)
                // Case B: Tenant-Wide Peering (Discovery Bypass)
                const tenantPrefix = `np:v1:${self._context.tenantId}:`;
                const identityPrefix = `${tenantPrefix}${self._context.identityId}:`;

                for (let i = 0; i < storage.length; i++) {
                    const k = storage.key(i);
                    if (!k) continue;

                    // Rule: Discovery Peering (SDN-0165)
                    // If showAll is enabled (implied by context or registry state), 
                    // we want to see keys from any identity in THIS tenant.
                    if (self._context.showAll && k.startsWith(tenantPrefix)) {
                         if (k.includes(`:${prefix}`)) {
                             // Extract logical key: np:v1:uid:sid:key -> key
                             const parts = k.split(':');
                             const logicalKey = parts.slice(4).join(':');
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
                self.logger.debug(`LocalStorage Persistence: Cleared ${count} entries for identity ${self._context.identityId}`);
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
