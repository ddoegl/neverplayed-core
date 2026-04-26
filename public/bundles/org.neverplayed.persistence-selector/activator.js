import { PERSISTENCE_MANAGER_SERVICE, LOG_SERVICE, PERSISTENCE_RESOLVER_SERVICE, SHELL_COMMAND_SERVICE } from "../../core-types.js";

/**
 * Strategic Persistence Selector (Data Guardian)
 * Orchestrates data shunting between Memory, Local, and Cloud providers.
 * Supports multiple providers per tier with ranking-based preference.
 */
export default class Activator {
    _providers = []; // Array of { tier, svc, ref, ranking }
    _volatileStore = new Map();
    _currentMode = "normal";
    logger = console;
    _policies = new Map();
    _envTier = "cloud";
    _context = { tenantId: "guest", realmId: "unknown", identityId: "guest" };

    async start(context) {
        this.context = context;
        const bsn = context.getBundle().getSymbolicName();

        // 0. Environment Policy
        try {
            const root = globalThis.NEVERPLAYED_BASE_URL || globalThis.location?.href || './';
            const envResp = await fetch(new URL("./env.json", root).href);
            if (envResp.ok) {
                const env = await envResp.json();
                const policy = env.persistencePolicy;
                if (policy?.tier) this._envTier = policy.tier;
            }
        } catch (_e) { /* Optional environment policy might be missing */ }

        // 1. Logger
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                this.logger = context.getService(ref).getLogger(bsn);
                return this.logger;
            }
        });
        this._logTracker.open();
  
        // 2. Providers Tracker
        this._providerTracker = context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(!(implementation=selector-proxy)))`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                const tier = ref.getProperty("persistence.tier") || "local";
                const ranking = ref.getProperty("service.ranking") || 0;
                
                const entry = { tier, svc, ref, ranking };
                this._providers.push(entry);
                this._providers.sort((a, b) => b.ranking - a.ranking); // Keep sorted by preference
                
                this.logger.info(`Persistence Selector: Tracked provider tier='${tier}' (Ranking: ${ranking}) from ${ref.bundle.getSymbolicName()}. (Total Providers: ${this._providers.length})`);
                
                return svc;
            },
            removedService: (ref) => {
                const idx = this._providers.findIndex(p => p.ref === ref);
                if (idx !== -1) {
                    const entry = this._providers.splice(idx, 1)[0];
                    this.logger.info(`Persistence Selector: Provider tier='${entry.tier}' lost.`);
                }
            }
        });
        this._providerTracker.open();

        // 2.1 Resolver Tracker
        this._resolverTracker = context.trackService(`(objectClass=${PERSISTENCE_RESOLVER_SERVICE})`, {
            addingService: (ref) => {
                this.resolver = context.getService(ref);
                return this.resolver;
            },
            removedService: () => { this.resolver = null; }
        });
        this._resolverTracker.open();

        // 3. Register Virtual Service
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            waitReady: (key) => this.waitReady(key),
            load: (key) => this.load(key),
            store: (key, val) => this.store(key, val),
            listKeys: (prefix) => this.listKeys(prefix),
            clear: () => this.clear(),
            setMode: (mode) => this.setMode(mode),
            setContext: (ctx) => this.setContext(ctx),
            getContext: () => this._context,
            probe: (key) => this.probe(key),
            setRoutingPolicy: (pattern, tier, enforce) => this.setRoutingPolicy(pattern, tier, enforce)
        }, {
            "capability": "sys:persistence",
            "implementation": "selector-proxy",
            "service.ranking": 1000
        });

        // 4. Shell Commands (Protocol: uses log callback for output)
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "pm:status",
            description: "Show tracking status of persistence providers",
            execute: (_args, _ctx, log) => {
                const results = ["--- Persistence Selector Status ---"];
                results.push(`Active Mode: ${this._currentMode}`);
                results.push(`Registration: Tier [${this._envTier}]`);
                results.push(`Providers: ${this._providers.length}`);
                this._providers.forEach(p => {
                    const bsn = p.ref.bundle.getSymbolicName();
                    const impl = p.ref.getProperty("implementation") || "unknown";
                    const hasListKeys = typeof p.svc.listKeys === 'function';
                    results.push(`  - [${p.tier}]: ${bsn} (${impl}) [rk:${p.ranking}] [listKeys:${hasListKeys}]`);
                });
                log(results.join("\n"));
            }
        });

        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "pm:list",
            description: "Deep scan all providers for a prefix",
            execute: async (args, _ctx, log) => {
                const prefix = args[0] || "";
                const keys = await this.listKeys(prefix);
                log(`--- PM Scan Result (Prefix: "${prefix}") ---\nTotal Keys: ${keys.length}\n${keys.join("\n")}`);
            }
        });
    }

    async waitReady(keyOrPrefix) {
        if (keyOrPrefix) {
            const tier = this._getPreferredTierForKey(keyOrPrefix);
            const provider = this._getProvider(tier);
            if (provider && typeof provider.waitReady === 'function') return await provider.waitReady(keyOrPrefix);
        } else {
            const tasks = this._providers
                .filter(p => typeof p.svc.waitReady === 'function')
                .map(p => p.svc.waitReady());
            if (tasks.length > 0) await Promise.allSettled(tasks);
        }
    }

    load(key) {
        if (this._currentMode === "stealth") return this._volatileStore.get(key) || null;

        const preferredTier = this._getPreferredTierForKey(key);
        const preferredProvider = this._getProvider(preferredTier);

        // 1. Primary Attempt (Synchronous)
        if (preferredProvider) {
            try {
                const data = preferredProvider.load(key);
                if (data !== null && data !== undefined) return data;
            } catch (_e) { /* Failover to recovery scan */ }
        }

        // 2. Opportunistic Fallback (Recovery Scan across all providers)
        for (const p of this._providers) {
            if (p.svc === preferredProvider) continue; 
            try {
                const data = p.svc.load(key);
                if (data !== null && data !== undefined) {
                    return data;
                }
            } catch (_e) { /* Skip failed provider */ }
        }

        return this._volatileStore.get(key) || null;
    }

    async store(key, val) {
        if (this._currentMode === "stealth") {
            this._volatileStore.set(key, val);
            return;
        }

        const tier = this._getPreferredTierForKey(key);
        const provider = this._getProvider(tier);

        this.logger.debug(`PM Selector: Store Request [${key}] -> Tier: ${tier} | Provider: ${provider ? 'found' : 'missing'}`);

        if (provider) return await provider.store(key, val);
        this._volatileStore.set(key, val);
    }

    async listKeys(prefix = "") {
        this.logger.info(`Persistence Selector: Aggregating listKeys for [${prefix}] across ${this._providers.length} providers.`);
        
        const scanTasks = this._providers.map(async (p) => {
            if (typeof p.svc.listKeys === 'function') {
                try {
                    const keys = await p.svc.listKeys(prefix);
                    this.logger.info(`Persistence Selector: Tier [${p.tier}] (${p.ref.bundle.getSymbolicName()}) returned ${keys?.length || 0} keys.`);
                    return keys || [];
                } catch (err) {
                    this.logger.error(`Persistence Selector: listKeys failed on tier [${p.tier}]: ${err.message}`);
                    return [];
                }
            }
            this.logger.debug(`Persistence Selector: Tier [${p.tier}] does not support listKeys.`);
            return [];
        });

        const settledResults = await Promise.allSettled(scanTasks);
        const remoteKeys = settledResults
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);
        
        const volatileKeys = Array.from(this._volatileStore.keys()).filter(k => k.startsWith(prefix));
        return Array.from(new Set([...remoteKeys, ...volatileKeys]));
    }

    async clear() {
        this.logger.warn("Persistence Selector: Global CLEAR.");
        const clearTasks = this._providers.map(async (p) => {
            if (typeof p.svc.clear === 'function') {
                try { await p.svc.clear(); } catch (_err) { /* SILENT: Best effort clear */ }
            }
        });
        await Promise.allSettled(clearTasks);
        this._volatileStore.clear();
        try { globalThis.localStorage?.clear(); } catch (_e) { /* LocalStorage might be restricted */ }
    }

    setMode(mode) {
        this._currentMode = mode;
        this.logger.info(`Persistence Selector: Mode set to '${mode}'`);
    }

    setRoutingPolicy(keyPattern, tier, enforce = false) {
        this._policies.set(keyPattern, { tier, enforce });
        this.logger.info(`Persistence Selector: Policy: '${keyPattern}' -> ${tier}`);
    }

    async setContext(ctx) {
        const oldUid = this._context.tenantId;
        this._context = { ...this._context, ...ctx };
        
        // Rule: Tier Mobility (SDN-0165)
        // If a tier is explicitly provided in the context shift, 
        // we pivot the environment's baseline tier.
        if (ctx.tier) {
            this.logger.info(`PM Selector: Tier Pivot -> ${ctx.tier}`);
            this._envTier = ctx.tier;
        }

        this.logger.info(`PM Selector: Identity Context Shift -> [${this._context.tenantId}][${this._context.realmId}][${this._context.identityId}]`);

        // Rule: Tenant Handover Wipe (SDN-0165)
        if (oldUid !== "guest" && ctx.tenantId && ctx.tenantId !== oldUid) {
            this.logger.warn(`PM Selector: Handover [${oldUid} -> ${ctx.tenantId}]. Purging...`);
            this._purgeTenantVault(oldUid);
        }

        // Propagate context to all providers
        for (const p of this._providers) {
            if (typeof p.svc.setContext === 'function') {
                this.logger.debug(`PM Selector: Propagating context to ${p.tier} provider...`);
                await p.svc.setContext(this._context);
            }
        }
        this.logger.info(`PM Selector: Context Shift Complete.`);
        globalThis.dispatchEvent(new CustomEvent("pm-context-shifted", { detail: this._context }));
    }

    _purgeTenantVault(uid) {
        const prefix = `np:v1:${uid}:`;
        try {
            const keys = Object.keys(globalThis.localStorage || {});
            const victims = keys.filter(k => k.startsWith(prefix));
            victims.forEach(k => globalThis.localStorage.removeItem(k));
            this.logger.info(`Persistence Selector: Purged ${victims.length} keys for tenant ${uid}`);
        } catch (err) {
            this.logger.error(`Persistence Selector: Vault purge failed:`, err);
        }
    }

    probe(key) {
        const tier = this._getPreferredTierForKey(key);
        // Find match to get implementation details
        const match = this._providers.find(p => p.tier === tier) || this._providers.find(p => p.tier === "local");
        
        return {
            key,
            tier: match?.tier || "unknown",
            implementation: match?.ref.getProperty("implementation") || "none",
            bsn: match?.ref.bundle.getSymbolicName() || "none",
            context: { ...this._context }
        };
    }

    _getProvider(tier) {
        // Find the highest ranking provider for this tier (already sorted in start)
        const match = this._providers.find(p => p.tier === tier);
        if (match) return match.svc;
        
        // Fallback to highest ranking local if specific tier not found
        const local = this._providers.find(p => p.tier === "local");
        if (local) return local.svc;
        
        return null;
    }

    _getPreferredTierForKey(key) {
        // High-Priority Direct Routing (Canonical Sharding)
        // Rule: Baseline Sovereignty (SDN-0150)
        // Only force cloud if we are not in a strict local environment
        // Rule: Infosec Affinity Boundary (SDN-0165)
        if (key.startsWith("security.") || key.startsWith("config.") || key.startsWith("pandino.session") || 
            key.startsWith("identity.") || key.startsWith("identity:")) {
            return "local"; 
        }
        
        if (this._envTier !== "local") {
            if (key.startsWith("realm.do.") || key.startsWith("blueprint.")) {
                return "cloud";
            }
        }

        // Oracle Fallback
        if (this.resolver) {
            try {
                const resolution = this.resolver.resolve({ key });
                const resolvedTier = (typeof resolution === 'object' && resolution !== null) ? resolution.tier : resolution;
                if (resolvedTier) return resolvedTier;
            } catch (_e) { /* Oracle failed; proceed to default */ }
        }
        return this._envTier || "local";
    }

    onStop() {
        if (this._providerTracker) this._providerTracker.close();
        if (this._resolverTracker) this._resolverTracker.close();
        if (this._logTracker) this._logTracker.close();
    }
}
