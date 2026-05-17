console.log("Persistence Selector: Evaluating Activator File...");

import { 
    PERSISTENCE_MANAGER_SERVICE, 
    LOG_SERVICE, 
    PERSISTENCE_RESOLVER_SERVICE, 
    SHELL_COMMAND_SERVICE,
    PERCEIVER_SERVICE,
    PLEXUS_SENSOR_SERVICE
} from "../../core-types.js";

/**
 * Strategic Persistence Selector (Data Guardian)
 * Orchestrates data shunting between Memory, Local, and Cloud providers.
 * v2.6.5 - Diagnostic Edition
 */
export default class Activator {
    _providers = []; 
    _volatileStore = new Map();
    _deferredWrites = new Map();
    _currentMode = "normal";
    logger = console;
    _policies = new Map();
    _envTier = "cloud";
    _context = { tenantId: "guest", realmId: "unknown", identityId: "guest" };
    _lastRealmId = "unknown";

    async start(context) {
        console.log("Persistence Selector: start() called.");
        this.context = context;
        const bsn = context.getBundle().getSymbolicName();
        this.plexusSensor = null;

        // 1. Logger
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                this.logger = context.getService(ref).getLogger(bsn);
                this.logger.info("Persistence Selector: Connected to System Logger.");
                return this.logger;
            }
        }).open();

        // 2. Providers Tracker
        this._providerTracker = context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(!(implementation=selector-proxy)))`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                const tier = ref.getProperty("persistence.tier") || "local";
                const ranking = ref.getProperty("service.ranking") || 0;
                const impl = ref.getProperty("implementation") || "unknown";
                const entry = { tier, svc, ref, ranking, impl };
                this._providers.push(entry);
                this._providers.sort((a, b) => b.ranking - a.ranking);
                
                const logMsg = `Selector: Connected Provider [${impl}] Tier [${tier}] Rank [${ranking}]`;
                console.info(logMsg);
                if (this.logger && this.logger.info) this.logger.info(logMsg);

                if (typeof svc.setContext === 'function' && this._context.tenantId !== "guest") {
                    svc.setContext(this._context).catch(() => {});
                }
                return svc;
            },
            removedService: (ref) => {
                const idx = this._providers.findIndex(p => p.ref === ref);
                if (idx !== -1) this._providers.splice(idx, 1);
            }
        }).open();

        // 3. Sensor Tracker (Perceptual Bridge)
        context.trackService(`(objectClass=${PLEXUS_SENSOR_SERVICE})`, {
            addingService: (ref) => {
                this.plexusSensor = context.getService(ref);
                console.info("Persistence Selector: Bound to Plexus Sensor.");
                if (this.logger && this.logger.info) this.logger.info("Persistence Selector: Bound to Plexus Sensor (Perceptual Filtering Enabled).");
            },
            removedService: () => { this.plexusSensor = null; }
        }).open();

        // 4. Register Proxy Service
        context.registerService(PERSISTENCE_MANAGER_SERVICE, this, {
            "capability": "sys:persistence",
            "implementation": "selector-proxy",
            "service.ranking": 1000
        });
        console.log("Persistence Selector: Service Registered (Rank 1000).");
    }

    async waitReady(keyOrPrefix) {
        const tasks = this._providers
            .filter(p => typeof p.svc.waitReady === 'function')
            .map(p => p.svc.waitReady(keyOrPrefix));
        await Promise.allSettled(tasks);
    }

    load(key, options = {}) {
        const preferredTier = this._getPreferredTierForKey(key);
        const preferredProvider = this._getProvider(preferredTier);
        if (preferredProvider) {
            try {
                const data = preferredProvider.load(key, options);
                if (data !== null && data !== undefined) return data;
            } catch (_e) {}
        }
        for (const p of this._providers) {
            if (p.svc === preferredProvider) continue; 
            try {
                const data = p.svc.load(key, options);
                if (data !== null && data !== undefined) return data;
            } catch (_e) {}
        }
        return this._volatileStore.get(key) || null;
    }

    async store(key, val, options = {}) {
        const tier = this._getPreferredTierForKey(key);
        const providerEntry = this._providers.find(p => p.tier === tier) || this._providers.find(p => p.tier === "local");
        
        const logMsg = `Selector: Routing [${key}] to Tier [${providerEntry?.tier || 'NONE'}] via Provider [${providerEntry?.impl || 'VOLATILE'}]`;
        console.info(logMsg);
        if (this.logger && this.logger.info) this.logger.info(logMsg);

        if (providerEntry) {
            return await providerEntry.svc.store(key, val, options);
        }
        
        this._volatileStore.set(key, val);
    }

    async listKeys(prefix = "") {
        const scanTasks = this._providers.map(async (p) => {
            if (typeof p.svc.listKeys === 'function') {
                try {
                    return await p.svc.listKeys(prefix) || [];
                } catch (err) { return []; }
            }
            return [];
        });

        const settledResults = await Promise.allSettled(scanTasks);
        const rawKeys = settledResults
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);
        
        const volatileKeys = Array.from(this._volatileStore.keys()).filter(k => k.startsWith(prefix));
        const allKeys = Array.from(new Set([...rawKeys, ...volatileKeys]));

        if (this.plexusSensor) {
            const visibleKeys = [];
            for (const key of allKeys) {
                const isSensible = this.plexusSensor.sense({
                    id: key,
                    mark: this._deriveMarkForKey(key)
                });
                if (isSensible) visibleKeys.push(key);
            }
            return visibleKeys;
        }

        return allKeys;
    }

    async clear(options = {}) {
        console.info("Persistence Selector: Global Clear initiated.");
        const tasks = this._providers.map(p => {
            if (typeof p.svc.clear === 'function') return p.svc.clear(options);
            return Promise.resolve();
        });
        this._volatileStore.clear();
        await Promise.allSettled(tasks);
    }

    /**
     * Strategic Probe: Returns rich metadata for the specified key.
     * Required for forensic dashboards like Stratographer.
     */
    async probe(key) {
        // 1. Check Volatile Store
        if (this._volatileStore.has(key)) {
            return {
                physicalTier: "volatile",
                effectiveContext: this._context,
                implementation: "memory"
            };
        }

        // 2. Scan Providers
        for (const p of this._providers) {
            let found = false;
            try {
                if (typeof p.svc.probe === 'function') {
                    found = await p.svc.probe(key);
                } else {
                    const val = await p.svc.load(key);
                    found = (val !== null && val !== undefined);
                }

                if (found) {
                    return {
                        physicalTier: p.tier,
                        effectiveContext: this._context, // Providers share the selector's context
                        implementation: p.impl
                    };
                }
            } catch (_e) {}
        }
        return null;
    }

    _deriveMarkForKey(key) {
        if (key.startsWith("forensics.log.")) {
            return { matchers: [{ type: "matchSense", value: "ForensicVision" }] };
        }
        if (key.startsWith("universe.config.")) {
            return { matchers: [{ type: "matchSense", value: "ArchitectControl" }] };
        }
        return null;
    }

    async setContext(ctx) {
        this._context = { ...this._context, ...ctx };
        console.info(`Selector: Context Shift -> [${ctx.tenantId}][${ctx.realmId}]`);
        for (const p of this._providers) {
            if (typeof p.svc.setContext === 'function') {
                try { await p.svc.setContext(this._context); } catch (e) {}
            }
        }
    }

    getContext() {
        return this._context;
    }

    _getProvider(tier) {
        const match = this._providers.find(p => p.tier === tier);
        return match ? match.svc : this._providers.find(p => p.tier === "local")?.svc;
    }

    _getPreferredTierForKey(key) {
        if (key.startsWith("security.") || key.startsWith("identity.") || key.startsWith("pandino.session.")) {
            return "local"; 
        }
        return this._context.tier || this._envTier || "local";
    }

    stop() {
        if (this._providerTracker) this._providerTracker.close();
        if (this._logTracker) this._logTracker.close();
    }
}
