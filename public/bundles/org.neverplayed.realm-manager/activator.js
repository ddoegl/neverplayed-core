import { REALM_MANAGER_SERVICE, LOG_SERVICE, SESSION_SERVICE, DOMAIN_OBJECT_REGISTRY_SERVICE, REALM_STORAGE_PID, SHELL_COMMAND_SERVICE } from "../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    _realms = new Map();
    _activeRealmId = null;
    _isTransitioning = false;
    _persistence = null;
    _registry = null;
    _realmCommandReg = null;
    _bsnCache = new Map(); // url -> bsn
    _manualBSNs = new Set();
    _pendingTransition = null; 

    onStart(context) {
        // 1. Initialize Logger
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("neverplayed.realm-manager");
                this.logger.info("Realm Manager: Connected to System Logger. Orchestration Bridge ready.");
                return svc;
            }
        }).open();
        
        // 1.2 Track Session Service
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this.session = context.getService(ref);
                this.logger?.info("Realm Manager: Connected to Session Service. Privilege Injection active.");
                return this.session;
            }
        }).open();

        // 1.3 Track Persistence for State Recovery
        context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: (ref) => {
                this._persistence = context.getService(ref);
                this._recoverState(context);
                return this._persistence;
            },
            removedService: () => { this._persistence = null; }
        }).open();

        // 1.4 Track Registry for Ontological Intersection
        context.trackService(`(objectClass=${DOMAIN_OBJECT_REGISTRY_SERVICE})`, {
            addingService: (ref) => { this._registry = context.getService(ref); return this._registry; },
            removedService: () => { this._registry = null; }
        }).open();

        // 2. Register Foundation Service
        this.context.registerService(REALM_MANAGER_SERVICE, {
            registerRealm: (manifest) => this._registerRealm(manifest),
            switchRealm: (id, interactive = false) => this._switchRealm(this.context, id, interactive),
            nextStep: () => this._nextStep(),
            installManualBundle: (url) => this._installManualBundle(url),
            uninstallManualBundle: (target) => this._uninstallManualBundle(target),
            getTransitionStatus: () => this._pendingTransition ? { ...this._pendingTransition, context: undefined } : null,
            getActiveRealm: () => this._activeRealmId,
            getRealms: () => Array.from(this._realms.values())
        });
        this._registerCLI(context);

        this.logger?.info("Realm Manager: Registered Core Service and CLI Engine.");
    }

    _registerCLI(_context) {
        const ctx = _context || this.context;
        if (this._realmCommandReg) {
            try { this._realmCommandReg.unregister(); } catch (_e) { /* ignore */ }
        }

        this._realmCommandReg = ctx.registerService(SHELL_COMMAND_SERVICE, {
            name: "realm",
            description: "Manage universes and context transitions",
            execute: async (args, _ctx, log) => {
                const sub = args[0];
                const activeId = this._activeRealmId;

                if (sub === 'list') {
                    const realms = Array.from(this._realms.values());
                    log({ text: `Available Realms (${realms.length}):`, color: 'blue', bold: true });
                    realms.forEach(r => {
                        const marker = r.id === activeId ? ' (ACTIVE) 🌌' : '';
                        log(` - ${r.id.padEnd(30)} | ${r.title}${marker}`);
                    });
                } else if (sub === 'switch' && args[1]) {
                    const targetId = args[1];
                    const interactive = args.includes('--step');
                    try {
                        const result = await this._switchRealm(ctx, targetId, interactive);
                        if (interactive) {
                            log({ text: "🌌 INTERACTIVE TRANSITION INITIATED", color: "blue", bold: true });
                            log({ text: `Milestone: ${result.status}`, color: "cyan" });
                            log(result.message);
                            
                            if (result.plan) {
                                log({ text: " -- Surge Plan Details --", color: "gray", bold: true });
                                if (result.plan.toKeep.length > 0) {
                                    log({ text: " Sticky (Will stay active):", color: "green" });
                                    result.plan.toKeep.forEach(i => log(`   - ${i.bsn.padEnd(30)} | ${i.reason}`));
                                }
                                if (result.plan.toInstall.length > 0) {
                                    log({ text: " Action Required (Will re-install/update):", color: "yellow" });
                                    result.plan.toInstall.forEach(i => log(`   - ${i.bsn.padEnd(30)} | ${i.reason}`));
                                }
                                if (result.plan.toPurge && result.plan.toPurge.length > 0) {
                                    log({ text: " Purge Required (Will uninstall):", color: "red" });
                                    result.plan.toPurge.forEach(i => log(`   - ${i.bsn.padEnd(30)} | ${i.reason}`));
                                }
                            }
                            log({ text: "Type '/realm next' to progress to the next phase.", color: "yellow" });
                        } else {
                            log({ text: result.message, color: "green", bold: true });
                        }
                    } catch (e) {
                        log({ text: `Switch Failed: ${e.message}`, color: "red" });
                    }
                } else if (sub === 'next') {
                    try {
                        const result = await this._nextStep();
                        if (result.status === 'COMPLETE') {
                            log({ text: `🌌 ${result.message}`, color: "green", bold: true });
                        } else {
                            log({ text: `Milestone: ${result.status}`, color: "cyan" });
                            log(result.message);
                            log({ text: "Type '/realm next' to move to the next milestone.", color: "yellow" });
                        }
                    } catch (e) {
                        log({ text: `Step Failed: ${e.message}`, color: "red" });
                    }
                } else if (sub === 'abort') {
                    if (!this._pendingTransition) return log("No pending transition to abort.");
                    this._pendingTransition = null;
                    log({ text: "Transition aborted. Framework remains in previous state.", color: "orange" });
                } else if (sub === 'info') {
                    const manifest = this._realms.get(this._activeRealmId);
                    if (!manifest) return log("No universe currently occupies this context.", 'error');
                    
                    log({ text: `Context: ${manifest.title}`, color: 'blue', bold: true });
                    log(` ID: ${manifest.id}`);
                    
                    if (this._manualBSNs.size > 0) {
                        log({ text: ` --- Inhabitant Layer (User Managed) ---`, color: 'magenta' });
                        this._manualBSNs.forEach(bsn => log(` - ${bsn}`));
                    }
                    
                    if (this._pendingTransition) {
                        log({ text: ` --- PENDING TRANSITION ---`, color: 'yellow' });
                        log(` Target: ${this._pendingTransition.id}`);
                        log(` Phase: ${this._pendingTransition.currentPhase}`);
                        log(` Delta: ${this._pendingTransition.surgePlan.toInstall.length} installs.`);
                    }
                } else {
                    log("Usage: /realm <list|switch [id] [--step]|next|abort|info>");
                }
            }
        });
    }

    async _recoverState(context) {
        if (!this._persistence) return;
        
        // 1. Recover Manual Bundles (Inhabitant Layer)
        const manualUrls = await this._persistence.load("realm-manager.manual-bundles") || [];
        for (const url of manualUrls) {
            try { 
                await this._installManualBundle(url); 
            } catch (_e) { /* ignore */ }
        }

        // 2. Recover Active Realm
        const lastRealmId = await this._persistence.load(REALM_STORAGE_PID);
        if (lastRealmId && this._realms.has(lastRealmId)) {
            this.logger.info(`Realm Manager: Recovering Context -> '${lastRealmId}'...`);
            await this._switchRealm(context, lastRealmId);
        }
    }

    _registerRealm(manifest) {
        if (!manifest.id) throw new Error("Realm manifest must have a unique ID.");
        this._realms.set(manifest.id, manifest);
        this.logger?.info(`Realm Manager: Registered universe '${manifest.id}' (${manifest.title})`);
    }

    async _switchRealm(context, id, interactive = false) {
        if (this._pendingTransition) {
            throw new Error("A transition is already in progress. Type '/realm next' to proceed or '/realm abort' to cancel.");
        }

        try {
            this.logger?.info(`Realm Manager: Initiating Context Transition to universe '${id}'...`);
            
            // 1. Resolve Hierarchy
            const hierarchy = await this._resolveHierarchy(id);
            if (hierarchy.length === 0) throw new Error(`Realm '${id}' not found.`);

            const manifest = this._realms.get(id);

            // 2. Prepare Surge Plan (Reconciliation)
            const surgePlan = await this._prepareSurgePlan(context, hierarchy);

            this._pendingTransition = {
                id,
                manifest,
                hierarchy,
                surgePlan,
                currentPhase: 'PLAN_READY',
                milestone: 'RESOLVED',
                auto: !interactive
            };

            if (interactive) {
                return { 
                    status: 'RESOLVED', 
                    message: `Hierarchy resolved for '${id}'. Delta: ${surgePlan.toInstall.length} to install, ${surgePlan.toKeep.length} sticky.`,
                    plan: surgePlan 
                };
            }

            return this._executeTransitionPhase('ONTOLOGY');
        } catch (err) {
            this._pendingTransition = null;
            this.logger?.error(`Realm Manager: Switch failed for '${id}':`, err.message);
            throw err;
        }
    }

    async _prepareSurgePlan(context, hierarchy) {
        const toInstall = [];
        const toKeep = [];
        const toPurge = [];
        const seenBsn = new Set();
        const activeBundles = context.getBundles();

        // 1. Identify Target Set (Hierarchy)
        for (const layer of hierarchy) {
            if (!layer.bundles) continue;
            for (const bundleUrl of layer.bundles) {
                const bsn = await this._getBsn(bundleUrl);
                const normalizedCandidate = BaseActivator.normalizeBSN(bsn);
                if (seenBsn.has(normalizedCandidate)) continue;
                seenBsn.add(normalizedCandidate);

                const existing = activeBundles.find(b => {
                    const obsn = b.getSymbolicName();
                    const normalizedObsn = BaseActivator.normalizeBSN(obsn);
                    return normalizedObsn === normalizedCandidate || b.getLocation().includes(bsn);
                });

                if (existing) {
                    const state = existing.getState();
                    if (BaseActivator.isBundleActive(existing)) {
                        toKeep.push({ bsn, url: bundleUrl, id: existing.id, reason: `Sticky (State: ${state})` });
                    } else {
                        toInstall.push({ bsn, url: bundleUrl, reason: `State: ${state}` });
                    }
                } else {
                    toInstall.push({ bsn, url: bundleUrl, reason: 'Not found in registry' });
                }
            }
        }

        // 2. Identify Purge Set (Orphans)
        // Protection Shield
        const protectedBSNs = [
            "@neverplayed/realm-manager", "org.neverplayed.realm-manager",
            "@neverplayed/shell-cli", "org.neverplayed.shell-cli",
            "@neverplayed/osgi-base", "org.neverplayed.osgi-base"
        ].map(b => BaseActivator.normalizeBSN(b));

        for (const b of activeBundles) {
            const bsn = b.getSymbolicName();
            const normalized = BaseActivator.normalizeBSN(bsn);

            if (seenBsn.has(normalized)) continue;
            if (this._manualBSNs.has(normalized)) continue;
            if (protectedBSNs.includes(normalized)) continue;

            toPurge.push({ bsn, id: b.id, reason: 'Orphaned (Not in target hierarchy)' });
        }

        return { toInstall, toKeep, toPurge };
    }

    async _getBsn(url) {
        let bsn = this._bsnCache.get(url);
        if (bsn) return bsn;

        try {
            // Force resolution to system root
            const base = globalThis.location.origin + '/';
            const resolvedUrl = new URL(url, base).href;
            
            const resp = await fetch(resolvedUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            
            const manifest = await resp.json();
            bsn = manifest["Bundle-SymbolicName"] || manifest.id;
            if (bsn) this._bsnCache.set(url, bsn);
            return bsn;
        } catch (_e) {
            // Intelligent fallback: map folder names to expected BSN patterns
            const parts = url.split('/');
            const folder = parts.find(p => p.includes('org.neverplayed'));
            if (folder) return folder.replace('org.neverplayed.', '@neverplayed/');
            return url.split('/').pop().replace(/.json$/, '');
        }
    }

    async _installManualBundle(url) {
        const bsn = await this._getBsn(url);
        const bundle = await this.context.installBundle(url);
        if (bundle.getState() < 32) await bundle.start();
        
        this._manualBSNs.add(bsn);
        if (this._persistence) {
            const current = await this._persistence.load("realm-manager.manual-bundles") || [];
            if (!current.includes(url)) {
                current.push(url);
                await this._persistence.store("realm-manager.manual-bundles", current);
            }
        }
        return bundle;
    }

    async _uninstallManualBundle(target) {
        const bundles = this.context.getBundles();
        const b = bundles.find(b => b.id.toString() === target || b.getSymbolicName() === target);
        if (!b) throw new Error(`Bundle not found: ${target}`);
        
        const bsn = b.getSymbolicName();
        const urlToMatch = b.getLocation();

        await b.stop();
        await b.uninstall();
        
        this._manualBSNs.delete(bsn);
        if (this._persistence) {
            const current = await this._persistence.load("realm-manager.manual-bundles") || [];
            const filtered = current.filter(url => url !== urlToMatch);
            await this._persistence.store("realm-manager.manual-bundles", filtered);
        }
    }

    async _nextStep() {
        if (!this._pendingTransition) throw new Error("No active transition.");
        
        switch (this._pendingTransition.currentPhase) {
            case 'PLAN_READY': {
                return await this._executeTransitionPhase('ONTOLOGY');
            }
            case 'ONTOLOGY_READY': {
                return await this._executeTransitionPhase('ACTIVATION');
            }
            case 'ACTIVATION_READY': {
                const result = this._pendingTransition;
                this._pendingTransition = null;
                return { status: 'COMPLETE', message: `Universe '${result.id}' is now active.` };
            }
            default:
                throw new Error(`Invalid phase: ${this._pendingTransition.currentPhase}`);
        }
    }

    async _executeTransitionPhase(phase) {
        const pt = this._pendingTransition;
        if (!pt) return;

        if (phase === 'ONTOLOGY') {
            this.logger?.info(`Realm Manager: Applying Ontological & Privilege filters...`);
            
            const manifest = pt.manifest;
            const hierarchy = pt.hierarchy;

            // 1.1 Aggregate Domain Objects for Ontological Intersection
            const aggregatedDOs = [];
            for (const layer of hierarchy) {
                if (layer.domainObjects) {
                    layer.domainObjects.forEach(d => {
                        const existing = aggregatedDOs.find(ad => ad.id === d.id);
                        if (existing) Object.assign(existing, d);
                        else aggregatedDOs.push({ ...d });
                    });
                }
            }
            
            // 1.2 Notify Registry (Filter & Specialized Specs)
            if (this._registry) {
                 await this._registry.setRealmContext(pt.id, aggregatedDOs.length > 0 ? aggregatedDOs : (pt.manifest.domainObjects === undefined ? null : []));
            }

            // 1.4 Inject Realm privileges
            if (this.session && manifest.privileges && manifest.privileges["realm-admins"]) {
                const currentUser = this.session.scopedUsers?.["global"]?.id || this.session.currentUser?.id;
                const isAdmin = manifest.privileges["realm-admins"].includes(currentUser);
                
                if (isAdmin) {
                    this.logger?.info(`Realm Manager: Elevated privileges detected for user '${currentUser}'. Injecting 'realm-admin' attribute.`);
                    this.session.scopedUsers["global"].attributes = this.session.scopedUsers["global"].attributes || {};
                    this.session.scopedUsers["global"].attributes["realm-admin"] = true;
                } else {
                    if (this.session.scopedUsers["global"]?.attributes) {
                        delete this.session.scopedUsers["global"].attributes["realm-admin"];
                    }
                }
            }

            pt.currentPhase = 'ONTOLOGY_READY';
            pt.milestone = 'FILTERED';
            if (!pt.auto) return { status: 'FILTERED', message: "Ontology filters and privileges applied. Ready for Activation." };
            return this._executeTransitionPhase('ACTIVATION');
        }

        if (phase === 'ACTIVATION') {
            this.logger?.info(`Realm Manager: Transitioning infrastructure...`);
            
            // 1. Phase 6 (Purge Lifecycle)
            // Identify and unload "orphaned" bundles that are NOT in target hierarchy and NOT in manual layer.
            const toPurge = pt.surgePlan.toPurge || [];
            if (toPurge.length > 0) {
                this.logger?.info(`Realm Manager: Purging ${toPurge.length} orphaned bundles...`);
                const activeBundles = this.context.getBundles();
                for (const item of toPurge) {
                    const bundle = activeBundles.find(b => b.id === item.id);
                    if (bundle) {
                        try {
                            this.logger?.debug(`Purging bundle: ${item.bsn} (#${item.id})`);
                            await bundle.stop();
                            await bundle.uninstall();
                        } catch (err) {
                            this.logger?.error(`Failed to purge '${item.bsn}':`, err.message);
                        }
                    }
                }
            }

            // 2. Surge (Installation)
            for (const item of pt.surgePlan.toInstall) {
                try {
                    const bundle = await this.context.installBundle(item.url);
                    if (bundle.state === 2 || bundle.state === 4) await bundle.start();
                } catch (err) {
                    this.logger?.error(`Realm Manager: Failed to activate '${item.bsn}':`, err.message);
                }
            }

            // Persistence
            if (this._persistence) {
                 await this._persistence.store(REALM_STORAGE_PID, pt.id);
            }

            this._activeRealmId = pt.id;
            this.logger?.info(`Realm Manager: Context Transition Successful. Universe '${pt.id}' is now active. 🌌`);
            
            // Global Event
            globalThis.dispatchEvent(new CustomEvent("realm-switched", { detail: { id: pt.id, manifest: pt.manifest } }));

            // Healer
            this._registerCLI(this.context);

            pt.currentPhase = 'ACTIVATION_READY';
            pt.milestone = 'COMPLETE';
            if (!pt.auto) return { status: 'COMPLETE', message: `Infrastructure transition to '${pt.id}' finished.` };
            
            this._pendingTransition = null;
            return { status: 'COMPLETE', message: `Universe '${pt.id}' is now active 🌌` };
        }
    }

    async _resolveHierarchy(id, visited = new Set()) {
        const manifest = this._realms.get(id);
        if (!manifest) return [];
        if (visited.has(id)) throw new Error(`Circular dependency detected in realm inheritance: ${id}`);
        visited.add(id);

        let hierarchy = [];
        if (manifest.extends && Array.isArray(manifest.extends)) {
            for (const parentId of manifest.extends) {
                const parentHierarchy = await this._resolveHierarchy(parentId, visited);
                hierarchy = [...hierarchy, ...parentHierarchy];
            }
        }

        // Deduplicate and append self
        const existingIds = new Set(hierarchy.map(m => m.id));
        if (!existingIds.has(id)) {
            hierarchy.push(manifest);
        }
        
        return hierarchy;
    }
}
