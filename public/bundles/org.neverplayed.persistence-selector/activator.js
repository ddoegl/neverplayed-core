import { PERSISTENCE_MANAGER_SERVICE, LOG_SERVICE, PERSISTENCE_RESOLVER_SERVICE } from "../../core-types.js";

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
    _providerRefs = new Map(); // tier -> serviceReference
    _volatileStore = new Map();
    _currentMode = "normal"; // normal, stealth, privacy
    logger = console;
    _managedKeys = new Set(); // pandino.pm.managed-keys tracking
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
                const policy = env.persistencePolicy;
                if (policy && policy.tier) {
                    this._envTier = policy.tier;
                    this.logger?.info?.(`Persistence Selector: Environment policy detected. Default Tier: [${this._envTier}]`);
                } else if (env.persistence_mode) {
                    // Legacy Fallback
                    this._envTier = env.persistence_mode;
                    this.logger?.info?.(`Persistence Selector: Legacy env.persistence_mode detected: [${this._envTier}]`);
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
                const tier = ref.getProperty("persistence.tier") || "local"; // Authority Fallback
                this._providers.set(tier, svc);
                this._providerRefs.set(tier, ref);
                
                this.logger.info(`Persistence Selector: Tracked provider tier='${tier}' from ${ref.bundle.getSymbolicName()}. (Total Providers: ${this._providers.size})`);
                
                // Initial Sync Logic: Cloud wins for config, Local wins for identities
                this._performInitialSync(tier, svc);
                return svc;
            },
            removedService: (ref) => {
                const tier = ref.getProperty("persistence.tier") || "unknown";
                this._providers.delete(tier);
                this._providerRefs.delete(tier);
                this.logger.info(`Persistence Selector: Provider tier='${tier}' lost.`);
            }
        });
        this._providerTracker.open();

        // 2.1 Track the Strategic Persistence Resolver
        this._resolverTracker = context.trackService(`(objectClass=${PERSISTENCE_RESOLVER_SERVICE})`, {
            addingService: (ref) => {
                this.resolver = context.getService(ref);
                this.logger.debug(`Persistence Selector: Strategic Resolver linked [${ref.bundle.getSymbolicName()}].`);
                return this.resolver;
            },
            removedService: () => {
                this.resolver = null;
                this.logger.warn(`Persistence Selector: Strategic Resolver lost! Falling back to hardcoded defaults.`);
            }
        });
        this._resolverTracker.open();

        // 3. Register the Virtual Selector Service
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            waitReady: (key) => this._waitReady(key),
            load: (key) => this._routeAndLoad(key),
            store: (key, val) => this._routeAndStore(key, val),
            listKeys: (prefix = "") => {
                const tier = this._getPreferredTierForKey(prefix);
                const provider = this._getProvider(tier);
                
                const remoteKeys = (provider && typeof provider.listKeys === 'function') 
                    ? provider.listKeys(prefix) 
                    : [];
                
                const volatileKeys = Array.from(this._volatileStore.keys()).filter(k => k.startsWith(prefix));
                
                // Deduplicate and return
                return Array.from(new Set([...remoteKeys, ...volatileKeys]));
            },
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

        // 4. Prime Managed Keys (Rule 3: Infrastructure Handshake)
        this._loadManagedKeys();
        
        this.logger.info("Persistence Selector (Data Guardian): ACTIVE.");
    }

    _loadManagedKeys() {
        try {
            // Priority 1: Browser localStorage (immediate)
            const raw = globalThis.localStorage?.getItem('pandino.pm.managed-keys');
            if (raw) {
                const keys = JSON.parse(raw);
                if (Array.isArray(keys)) keys.forEach(k => this._managedKeys.add(k));
            }
        } catch (_e) { /* ignore */ }
    }

    async _ensureManaged(key, provider) {
        if (this._managedKeys.has('*')) return;
        if (this._managedKeys.has(key)) return;
        if (key === 'pandino.pm.managed-keys') return;

        this.logger.debug(`Persistence Selector: Registering '${key}' as a managed key in LocalStorage...`);
        this._managedKeys.add(key);
        
        try {
            const list = Array.from(this._managedKeys);
            // We use the raw provider to avoid recursion in the selector itself
            await provider.store('pandino.pm.managed-keys', list);
            // Safety: also sync to native localStorage if possible to help next boot
            globalThis.localStorage?.setItem('pandino.pm.managed-keys', JSON.stringify(list));
        } catch (e) {
            this.logger.warn(`Persistence Selector: Failed to register managed key '${key}': ${e.message}`);
        }
    }

    _performInitialSync(_newTier, _newSvc) {
        // If we are in 'normal' mode and a Cloud provider arrives, 
        // it may already have state that should supersede local config.
    }
    
    async _waitReady(key) {
        if (key) {
            const tier = this._getPreferredTierForKey(key);
            const provider = this._getProvider(tier);
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
        const provider = this._getProvider(tier);

        if (provider) {
            return provider.load(key);
        }

        return this._volatileStore.get(key) || null;
    }

    async _routeAndStore(key, val) {
        this.logger.debug(`Persistence Selector: Incoming STORE request for [${key}]`);
        if (this._currentMode === "stealth") {
            this._volatileStore.set(key, val);
            return;
        }

        const tier = this._getPreferredTierForKey(key);
        const policy = this._getPolicyForKey(key);
        const finalTier = (this._currentMode === "privacy" && tier === "cloud" && !policy?.enforce) ? "local" : tier;
        
        const provider = this._getProvider(finalTier);

        if (provider) {
            // Identity Discovery
            const ref = this._providerRefs.get(finalTier);
            const bsn = ref ? ref.bundle.getSymbolicName() : "unknown-bundle";
            
            this.logger.debug(`Persistence Selector: Routing [${key}] to tier [${finalTier}] -> Provider: [${bsn}]`);

            // 💾 Security Bridge: Ensure key is managed if using the LocalStorage PM
            if (finalTier === "local") {
                await this._ensureManaged(key, provider);
            }

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
            this.logger.warn(`Persistence Selector: NO PROVIDER for tier [${finalTier}]. Falling back to Volatile Memory.`);
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
        // 0. Fast-Path for Infrastructure Keys (Prevent Recursion Loops)
        if (key.startsWith("config.") || key.startsWith("security.") || key.startsWith("pandino.session")) {
            return (key.startsWith("security.") || key.startsWith("pandino.session")) ? "volatile" : "cloud";
        }

        // 1. Check Strategic Resolver (The Authority)
        if (this.resolver) {
            const resolution = this.resolver.resolve({ key });
            const resolvedTier = (typeof resolution === 'object' && resolution !== null) ? resolution.tier : resolution;
            
            if (resolvedTier) {
                this.logger.debug(`Persistence Selector: Resolver directed [${key}] to tier [${resolvedTier}]`);
                return resolvedTier;
            }
        }

        // 2. Check Dynamic Policies (Policy Tier) - Authority Layer
        const policy = this._getPolicyForKey(key);
        if (policy) return policy.tier;

        // 2. Mode-Based Default Tiering (Rule 4: Configuration over Code)
        if (this._envTier === "memory") return "volatile";
        if (key.startsWith("security.")) return "volatile";
        
        if (this._envTier === "local-fs" || this._envTier === "local") {
             // In Local modes, all non-volatile data is unified in the 'local' tier
             return "local";
        }
        
        if (this._envTier === "cloud") {
             // In Firebase mode, we follow the Hybrid Cloud policy
             if (key.startsWith("realm.") || key.startsWith("identities.")) return "local";
             return "cloud";
        }

        // 3. Legacy Fallback (Normal mode)
        if (key.startsWith("realm.")) return "local";
        if (key.startsWith("identities.")) return "local";
        if (key.startsWith("config.")) return "cloud";
        
        return this._envTier || "local";
    }

    /**
     * Defensive Provider Resolution (Rule 3: ADR-0021)
     */
    _getProvider(tier) {
        // Rule: Volatile Isolation
        // The 'volatile' tier is handled internally by this selector's in-memory store.
        // It MUST NEVER fall back to a persistent provider like 'local'.
        if (tier === "volatile") return null;

        // Preferred Tier
        if (this._providers.has(tier)) return this._providers.get(tier);
        
        // Tier Fallback Chain: Requested -> local
        if (this._providers.has("local")) return this._providers.get("local");

        return null;
    }


    onStop(_context) {
        if (this._logTracker) this._logTracker.close();
        if (this._providerTracker) this._providerTracker.close();
        if (this.logger) this.logger.info("Persistence Selector: Stopped.");
    }
}
