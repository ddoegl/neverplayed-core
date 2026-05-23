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

        const getPhysicalKey = (key, options = {}) => {
            // Rule: Bootstrap Anchor (SDN-0165)
            if (
                key.startsWith("pandino.session") || 
                key.includes("config.admin") || 
                key.startsWith("config.") || 
                key === "org.neverplayed.shell.ui.context"
            ) {
                return `np:v1:global:__global__:__shared__:${key}`;
            }
            if (options.scope === "shared") {
                return `np:v1:${this._context.tenantId}:${this._context.realmId}:__shared__:${key}`;
            }
            if (options.scope === "global") {
                return `np:v1:${this._context.tenantId}:__global__:__shared__:${key}`;
            }
            const identityId = options.identityId || this._context.identityId;
            return `np:v1:${this._context.tenantId}:${this._context.realmId}:${identityId}:${key}`;
        };

        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            setContext: (ctx) => {
                console.log(`[LocalStorage] Context Shift -> [${ctx.tenantId}][${ctx.identityId}]`);
                this._context = ctx;
            },

            waitReady: () => Promise.resolve(),

            load: (key, options = {}) => {
                const physicalKey = getPhysicalKey(key, options);
                const val = storage.getItem(physicalKey);
                if (val === null) return null;
                try {
                    return JSON.parse(val);
                } catch (_e) {
                    return val;
                }
            },

            store: (key, val, options = {}) => {
                try {
                    const physicalKey = getPhysicalKey(key, options);
                    const stringVal = typeof val === 'string' ? val : JSON.stringify(val);
                    
                    console.info(`[LocalStorage] EXECUTING SETITEM: ${physicalKey}`);
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
                const globalSharedPrefix = "np:v1:global:__global__:__shared__:";

                for (let i = 0; i < storage.length; i++) {
                    const k = storage.key(i);
                    if (!k) continue;

                    if (k.startsWith(globalSharedPrefix)) {
                        const logicalKey = k.substring(globalSharedPrefix.length);
                        if (logicalKey.startsWith(prefix)) {
                            results.push(logicalKey);
                        }
                    }

                    if (this._context.showAll && k.startsWith(realmPrefix)) {
                         if (k.includes(`:${prefix}`)) {
                             const parts = k.split(':');
                             const logicalKey = parts.slice(5).join(':'); 
                             if (logicalKey.startsWith(prefix)) results.push(logicalKey);
                         }
                    } else {
                         if (k.startsWith(identityPrefix)) {
                             const logicalKey = k.substring(identityPrefix.length);
                             if (logicalKey.startsWith(prefix)) {
                                 results.push(logicalKey);
                             }
                         } else if (k.startsWith(realmPrefix)) {
                             const parts = k.split(':');
                             const logicalKey = parts.slice(5).join(':');
                             if (logicalKey.startsWith("identity.personhood:") && logicalKey.startsWith(prefix)) {
                                 results.push(logicalKey);
                             }
                         }
                    }
                }
                return Array.from(new Set(results));
            },

            clear: (options = {}) => {
                const physicalPrefix = options.global ? "np:v1:" : getPhysicalKey("");
                const protectedKeys = (options.except || []).map(k => getPhysicalKey(k));
                const victims = [];
                const globalSharedPrefix = "np:v1:global:__global__:__shared__:";
                
                for (let i = 0; i < storage.length; i++) {
                    const k = storage.key(i);
                    if (k && k.startsWith(physicalPrefix) && !protectedKeys.includes(k)) {
                        if (k.startsWith(globalSharedPrefix)) {
                            continue;
                        }
                        victims.push(k);
                    }
                }
                
                victims.forEach(k => {
                    console.info(`[LocalStorage] EXECUTING REMOVEITEM: ${k}`);
                    storage.removeItem(k);
                });
                this.logger.debug(`LocalStorage Persistence: Cleared ${victims.length} entries (Global: ${!!options.global}).`);
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
