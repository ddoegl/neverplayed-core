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

    start(context) {
        this.context = context;
        const bsn = context.getBundle().getSymbolicName();

        // 1. Setup Logger (Reactive)
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                this.logger = context.getService(ref).getLogger(bsn);
                this.logger.info("Persistence Selector: Connected to System Logger.");
                return this.logger;
            }
        }).open();

        // 2. Track all other Persistence Providers
        // We exclude ourselves specifically via implementation property
        context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(!(implementation=selector-proxy)))`, {
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
        }).open();

        // 3. Register the Virtual Selector Service
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            load: (key) => this._routeAndLoad(key),
            store: (key, val) => this._routeAndStore(key, val),
            clear: async () => {
                this.logger.warn("Persistence Selector: Global CLEAR requested. Broadcasting to all providers...");
                for (const svc of this._providers.values()) {
                    if (typeof svc.clear === 'function') {
                        try {
                            await svc.clear();
                        } catch (err) {
                            this.logger.error(`Persistence Selector: Clear failed on provider: ${err.message}`);
                        }
                    }
                }
                this._volatileStore.clear();
                this.logger.info("Persistence Selector: Global clear complete.");
            },
            setMode: (mode) => {
                this._currentMode = mode;
                this.logger.info(`Persistence Selector: Mode set to '${mode}'`);
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
        
        // If privacy mode is on, we force 'local' even if 'cloud' was preferred
        const finalTier = (this._currentMode === "privacy" && tier === "cloud") ? "local" : tier;
        
        const provider = this._providers.get(finalTier) || this._providers.get("local");

        if (provider) {
            try {
                await provider.store(key, val);
            } catch (err) {
                this.logger.error(`Persistence Selector: Store failed for key='${key}' on tier='${finalTier}': ${err.message}`);
                // Fallback to memory on failure to prevent data loss within session
                this._volatileStore.set(key, val);
            }
        } else {
            this._volatileStore.set(key, val);
        }
    }

    _getPreferredTierForKey(key) {
        if (key.startsWith("realm.")) return "local";
        if (key.startsWith("security.")) return "volatile";
        if (key.startsWith("identities.")) return "local";
        if (key.startsWith("config.")) return "cloud";
        return "cloud"; // Default to cloud for global persistence
    }

    stop(_context) {
        this.logger.info("Persistence Selector: STOPPED.");
    }
}

