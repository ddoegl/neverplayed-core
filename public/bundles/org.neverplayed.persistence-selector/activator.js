import { PERSISTENCE_MANAGER_SERVICE, LOG_SERVICE } from "../../core-types.js";

/**
 * Strategic Persistence Selector (Data Guardian)
 * Orchestrates data shunting between Memory, Local, and Cloud providers.
 * 
 * LEAN ACTIVATOR: 
 * Does not extend BaseActivator to avoid boot deadlocks when tracking 
 * underlying providers that may be waiting for AuthShield.
 */
export default class Activator {
    _providers = new Map(); // tier -> service
    _volatileStore = new Map();
    _currentMode = "normal"; // normal, stealth, privacy
    logger = console;
    _policies = new Map(); // keyPattern -> { tier, enforce }
    _envTier = "cloud"; // Default

    async start(context) {
        this.context = context;
        const bsn = context.getBundle().getSymbolicName();

        // 0. Load Environment Configurations (Authority for Tiering)
        try {
            const root = globalThis.NEVERPLAYED_BASE_URL || globalThis.location?.href || './';
            const envResp = await fetch(new URL("./env.json", root).href);
            if (envResp.ok) {
                const env = await envResp.json();
                if (env.persistence_mode) {
                    this._envTier = env.persistence_mode;
                }
            }
        } catch (e) {
            console.warn("Persistence Selector: Failed to load env.json", e);
        }

        // 1. Setup Logger (Reactive)
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                this.logger = context.getService(ref).getLogger(bsn);
                this.logger.info("Persistence Selector: Connected to System Logger.");
                return this.logger;
            }
        });
        this._logTracker.open();
 
        // 2. Track all other Persistence Providers
        // We exclude ourselves specifically via implementation property
        this._providerTracker = context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(!(implementation=selector-proxy)))`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                const tier = ref.getProperty("persistence.tier") || "unknown";
                this._providers.set(tier, svc);
                this.logger.info(`Persistence Selector: Tracked provider tier='${tier}' from ${ref.bundle.getSymbolicName()}`);
                
                // Initial Sync Logic: Cloud wins for config, Local wins for identities
                this._performInitialSync(tier, svc);
                return svc;
            },
            removedService: (ref) => {
                const tier = ref.getProperty("persistence.tier") || "unknown";
                this._providers.delete(tier);
                this.logger.info(`Persistence Selector: Provider tier='${tier}' lost.`);
            }
        });
        this._providerTracker.open();

        // 3. Register the Virtual Selector Service
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            waitReady: (key) => this._waitReady(key),
            load: (key) => this._routeAndLoad(key),
            store: (key, val) => this._routeAndStore(key, val),
            clear: async () => {
                this.logger.warn("Persistence Selector: Global CLEAR requested. Broadcasting to all providers in parallel...");
                const clearTasks = Array.from(this._providers.values()).map(async (svc) => {
                    if (typeof svc.clear === 'function') {
                        try {
                            await svc.clear();
                        } catch (err) {
                            this.logger.error(`Persistence Selector: Clear failed on a provider: ${err.message}`);
                        }
                    }
                });

                await Promise.allSettled(clearTasks);
                this._volatileStore.clear();
                
                // Final Safety: Explicitly target literal localStorage regardless of providers
                try {
                    globalThis.localStorage?.clear();
                } catch (_e) { /* ignore */ }
                
                this.logger.info("Persistence Selector: Global clear complete.");
            },
            setMode: (mode) => {
                this._currentMode = mode;
                this.logger.info(`Persistence Selector: Mode set to '${mode}'`);
            },
            setRoutingPolicy: (keyPattern, tier, enforce = false) => {
                this._policies.set(keyPattern, { tier, enforce });
                this.logger.info(`Persistence Selector: Registered policy for '${keyPattern}' -> Tier: ${tier} (Enforce: ${enforce})`);
            }
        }, {
            "capability": "sys:persistence",
            "implementation": "selector-proxy",
            "service.ranking": 1000
        });

        this.logger.info("Persistence Selector (Data Guardian): ACTIVE.");
    }

    _performInitialSync(_newTier, _newSvc) {
        // If we are in 'normal' mode and a Cloud provider arrives, 
        // it may already have state that should supersede local config.
    }
    
    async _waitReady(key) {
        if (key) {
            const tier = this._getPreferredTierForKey(key);
            const provider = this._providers.get(tier) || this._providers.get("local");
            if (provider && typeof provider.waitReady === 'function') {
                this.logger.info(`Persistence Selector: Waiting for '${tier}' provider to be ready for key '${key}'...`);
                return await provider.waitReady();
            }
        } else {
            const tasks = Array.from(this._providers.values())
                .filter(p => typeof p.waitReady === 'function')
                .map(p => p.waitReady());
            if (tasks.length > 0) {
                 this.logger.info(`Persistence Selector: Waiting for ${tasks.length} providers to be ready...`);
                 await Promise.allSettled(tasks);
            }
        }
    }

    _routeAndLoad(key) {
        if (this._currentMode === "stealth") return this._volatileStore.get(key) || null;

        const tier = this._getPreferredTierForKey(key);
        const provider = this._providers.get(tier) || this._providers.get("local"); // fallback to local

        if (provider) {
            return provider.load(key);
        }

        return this._volatileStore.get(key) || null;
    }

    async _routeAndStore(key, val) {
        if (this._currentMode === "stealth") {
            this._volatileStore.set(key, val);
            return;
        }

        const tier = this._getPreferredTierForKey(key);
        const policy = this._getPolicyForKey(key);
        const finalTier = (this._currentMode === "privacy" && tier === "cloud" && !policy?.enforce) ? "local" : tier;
        
        this.logger?.debug(`Persistence Selector: [${key}] -> Tier: ${finalTier}. Tracked providers: ${Array.from(this._providers.keys()).join(',')}`);
        
        const provider = this._providers.get(finalTier) || this._providers.get("local");

        if (provider) {
            let timer;
            try {
                // Set a timeout to prevent absolute hang during tests/headless mode
                const timeoutPromise = new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error("Timeout")), 5000);
                });
                await Promise.race([provider.store(key, val), timeoutPromise]);
            } catch (err) {
                const msg = err?.message || String(err);
                this.logger?.error?.(`Persistence Selector: Store failed for key='${key}' on tier='${finalTier}': ${msg}`);
                // Fallback to memory on failure to prevent data loss within session
                this._volatileStore.set(key, val);
            } finally {
                if (timer) clearTimeout(timer);
            }
        } else {
            this._volatileStore.set(key, val);
        }
    }

    _getPolicyForKey(key) {
        // Simple pattern matching for now: key starts with pattern
        for (const [pattern, policy] of this._policies.entries()) {
            if (key.includes(pattern)) return policy;
        }
        return null;
    }

    _getPreferredTierForKey(key) {
        // 1. Check Dynamic Policies (Policy Tier)
        const policy = this._getPolicyForKey(key);
        if (policy) return policy.tier;

        // 2. Default Prefix-based Routing (System Tier)
        if (key.startsWith("realm.")) return "local";
        if (key.startsWith("security.")) return "volatile";
        if (key.startsWith("identities.")) return "local";
        if (key.startsWith("config.")) return "cloud";
        
        return this._envTier; // Respect env.json (Rule 4: Configuration over Code)
    }


    onStop(_context) {
        if (this._logTracker) this._logTracker.close();
        if (this._providerTracker) this._providerTracker.close();
        if (this.logger) this.logger.info("Persistence Selector: Stopped.");
    }
}
