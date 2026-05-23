/**
 * @file Activator for org.neverplayed.realm-manager
 * @module platform/bundles/org.neverplayed.realm-manager
 */

import { 
    REALM_MANAGER_SERVICE, 
    REALM_SERVICE,
    LOG_SERVICE, 
    SESSION_SERVICE, 
    DOMAIN_OBJECT_REGISTRY_SERVICE, 
    REALM_STORAGE_PID, 
    SHELL_COMMAND_SERVICE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE, 
    REALM_CHANGED_TOPIC, 
    REALM_REGISTERED_TOPIC, 
    REALM_UNREGISTERED_TOPIC,
    AUTH_SHIELD_SERVICE,
    FLOW_SERVICE,
    LIMES_SERVICE,
    TRANSITION_PARTICIPANT_INTERFACE
} from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    _realms = new Map();
    _activeRealmId = null;
    _isTransitioning = false;
    _persistence = null;
    _registry = null;
    _eventAdmin = null;
    _eventFactory = null;
    _realmCommandReg = null;
    _realmRegs = new Map(); // id -> ServiceRegistration
    _bsnCache = new Map(); // url -> bsn
    _manualBSNs = new Set();
    _pendingTransition = null; 
    _instanceId = Math.random().toString(36).substring(7);
    _orderedRealmIds = []; // For numeric switching
    _discoveryPromise = null;
    _recoveryPromise = null;
    _isRecovering = false;
    _lock = Promise.resolve(); // Orchestration lock
    _bootReadyPromise = new Promise(r => this._bootReadyResolve = r);
    _registrationBuffer = []; // Buffer for early discovery events (Step 1)
    _flowService = null;
    _flowTracker = null;
    _flows = new Map(); // Store discovered flows: id -> service
    _limes = null;
    _limesTracker = null;

    onStart(context) {
        // 1. Initialize Logger
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger(this.bsn);
                this.logger.info(`Realm Manager: Bridge Active [ID: ${this._instanceId}]. Configuration synchronized.`);
                return svc;
            }
        });
        this._logTracker.open();
        
        // 1.2 Track Session Service (Late-Join Sync)
        this._sessionTracker = context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this.session = context.getService(ref);
                this.logger?.info("Realm Manager: Connected to Session Service. Privilege Injection active.");
                
                // Late-Join Sync: If realm active OR pending transition, push attributes
                const targetId = this._activeRealmId || this._pendingTransition?.id;
                if (targetId) {
                    this._syncPrivileges(targetId);
                }
                return this.session;
            }
        });
        this._sessionTracker.open();

        // 1.3 Launch Discovery & Recovery (Moved to step 3 for serialization)

        // 1.4 Persistence Tracker (Vital for recovery)
        this._persistenceTracker = context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: (ref) => {
                this._persistence = context.getService(ref);
                this.logger?.info("Realm Manager: Persistence connected.");
                return this._persistence;
            },
            removedService: () => { this._persistence = null; }
        });
        this._persistenceTracker.open();

        // 1.5 Track Registry for Ontological Intersection
        this._registryTracker = context.trackService(`(objectClass=${DOMAIN_OBJECT_REGISTRY_SERVICE})`, {
            addingService: (ref) => { this._registry = context.getService(ref); return this._registry; },
            removedService: () => { this._registry = null; }
        });
        this._registryTracker.open();

        // 1.6 Track Event Admin
        this._eventTracker = context.trackService(`(objectClass=${EVENT_ADMIN_SERVICE})`, {
            addingService: (ref) => { 
                this._eventAdmin = context.getService(ref); 
                this.logger?.info(`[RealmManager] Event Admin Service arrived: ${ref.getBundle().getSymbolicName()}`);
                
                // Resilience Handshake
                if (this._eventAdmin?.build && !this._eventFactory) {
                    this._eventFactory = this._eventAdmin;
                    this.logger?.info("[RealmManager] Event Factory synthesized from Admin.");
                }

                this.logger?.info(`[RealmManager] Current Buffer size: ${this._registrationBuffer.length} | Has Factory: ${!!this._eventFactory}`);
                this._flushRegistrationBuffer();
                return this._eventAdmin; 
            },
            removedService: () => { this._eventAdmin = null; }
        });
        this._eventTracker.open();
        
        // --- Direct Handshake: Immediate capture to prevent race ---
        const eaRef = context.getServiceReference(EVENT_ADMIN_SERVICE);
        if (eaRef) {
            this._eventAdmin = context.getService(eaRef);
            // v0.8.33 Resilieny: Check if Admin also acts as Factory
            if (this._eventAdmin?.build && !this._eventFactory) {
                this._eventFactory = this._eventAdmin;
                this.logger?.info("[RealmManager] Event Admin detected as Factory provider.");
            }
        }

        this._factoryTracker = context.trackService(`(objectClass=${EVENT_FACTORY_SERVICE})`, {
            addingService: (ref) => { 
                this._eventFactory = context.getService(ref); 
                this.logger?.info(`[RealmManager] Event Factory Service arrived: ${ref.getBundle().getSymbolicName()}`);
                this.logger?.info(`[RealmManager] Current Buffer size: ${this._registrationBuffer.length} | Has Admin: ${!!this._eventAdmin}`);
                this._flushRegistrationBuffer();
                return this._eventFactory; 
            },
            removedService: () => { this._eventFactory = null; }
        });
        this._factoryTracker.open();

        const efRef = context.getServiceReference(EVENT_FACTORY_SERVICE);
        if (efRef) this._eventFactory = context.getService(efRef);

        // 1.7 Track Auth Shield (Global Account)
        this._authTracker = context.trackService(`(objectClass=${AUTH_SHIELD_SERVICE})`, {
            addingService: (ref) => {
                this.auth = context.getService(ref);
                this.logger?.info("Realm Manager: Connected to Auth Shield (Global Identity).");
                const targetId = this._activeRealmId || this._pendingTransition?.id;
                if (targetId) this._syncPrivileges(targetId);
                return this.auth;
            },
            removedService: () => { this.auth = null; }
        });
        this._authTracker.open();

        // Final attempt to flush if services were already ready
        this._flushRegistrationBuffer();

        // 1.8 Track & Sync FLOW_SERVICE (Startup Policy Manager)
        this._flowTracker = context.trackService(`(objectClass=${FLOW_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                const id = ref.getProperty("flow.id") || svc.id;
                if (id) this._flows.set(id, svc);
                
                // Synthesize a high-level Flow Manager if unavailable
                if (!this._flowService) {
                    this._flowService = {
                        launch: async (flowId, params = {}) => {
                                const targetFlow = await this._waitForFlow(flowId);
                                if (targetFlow) {
                                    const containerId = params.containerId || 'flow-active-stage';
                                    const el = await this._waitForElement(containerId);
                                    if (el) {
                                        this.logger?.info(`[RealmManager] Policy Launch: ${flowId} -> #${containerId}`);
                                        await targetFlow.launch(el, params);
                                    } else {
                                        this.logger?.warn(`[RealmManager] Policy Launch Failed: #${containerId} not found after timeout.`);
                                    }
                                } else {
                                    this.logger?.error(`[RealmManager] Policy Launch Aborted: Flow ${flowId} did not arrive within timeout.`);
                                }
                        }
                    };
                }
                return svc;
            },
            removedService: (ref) => {
                const id = ref.getProperty("flow.id");
                if (id) this._flows.delete(id);
            }
        });
        this._flowTracker.open();
        
        // 1.9 Track Limes Service (Access Guard)
        this._limesTracker = context.trackService(`(objectClass=${LIMES_SERVICE})`, {
            addingService: (ref) => {
                this._limes = context.getService(ref);
                this.logger?.info("Realm Manager: Limes Guard connected. Access control active.");

                // Rule: Markov Blanket Injection (SDN-0192)
                // Dynamically register strategies for all already discovered realms
                for (const realm of this._realms.values()) {
                    if (realm.strategies) {
                        this.logger?.info(`Realm Manager: Injecting Markov Blanket for universe '${realm.id}'`);
                        for (const [id, def] of Object.entries(realm.strategies)) {
                            this._limes.registerStrategy(id, def);
                        }
                    }
                }
                return this._limes;
            },
            removedService: () => { this._limes = null; }
        });
        this._limesTracker.open();

        // 1.10 Track Transition Participants (Atomic Coordinator)
        this._participants = new Set();
        this._participantTracker = context.trackService(`(objectClass=${TRANSITION_PARTICIPANT_INTERFACE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this._participants.add(svc);
                this.logger?.info(`Realm Manager: Registered Transition Participant: ${ref.getBundle().getSymbolicName()}`);
                return svc;
            },
            removedService: (_ref, svc) => {
                this._participants.delete(svc);
            }
        });
        this._participantTracker.open();

        this._registerCLI(context);

        // Pre-initialize promises to prevent waitReady race (Step 1)
        this._discoveryPromise = null;
        this._recoveryPromise = null;

        // 1.8 Register Service
        context.registerService(REALM_MANAGER_SERVICE, {
            registerRealm: (manifest) => this._registerRealm(manifest),
            switchRealm: (id, interactive = false) => {
                const targetId = isNaN(id) ? id : this._orderedRealmIds[parseInt(id) - 1];
                return this._switchRealm(this.context, targetId, interactive);
            },
            coordinateTransition: (proposed) => this._coordinateTransition(proposed),
            nextStep: () => this._nextStep(),
            abort: () => { this._pendingTransition = null; },
            getTransitionStatus: () => this._pendingTransition ? { ...this._pendingTransition, context: undefined } : null,
            getActiveRealm: () => this._activeRealmId,
            getRealms: () => Array.from(this._realms.values()),
            getOrderedRealms: () => this._orderedRealmIds.map(id => this._realms.get(id)),
            unregisterRealm: (id) => this._unregisterRealm(id),
            waitReady: async () => {
                await this._bootReadyPromise;
                if (this._discoveryPromise) await this._discoveryPromise;
                if (this._recoveryPromise) await this._recoveryPromise;
                // Double-check recovery actually finished
                while (this._isRecovering) await new Promise(r => setTimeout(r, 50));
                return true;
            },
            installManualBundle: (url) => this._installManualBundle(url),
            uninstallManualBundle: (target) => this._uninstallManualBundle(target),
            getHierarchy: (id) => this._resolveHierarchy(id || this._activeRealmId)
        });

        this._discoveryPromise = this._discoverRealms();
        this._recoveryPromise = this._recoverState(context);
        
        // Signal readiness
        this._bootReadyResolve();
        this.logger.info(`[RealmManager] Boot promises initialized & Ready Signal emitted.`);
    }

    onStop(_context) {
        if (this._logTracker) this._logTracker.close();
        if (this._sessionTracker) this._sessionTracker.close();
        if (this._persistenceTracker) this._persistenceTracker.close();
        if (this._registryTracker) this._registryTracker.close();
        if (this._eventTracker) this._eventTracker.close();
        if (this._factoryTracker) this._factoryTracker.close();
        if (this._authTracker) this._authTracker.close();
        if (this._flowTracker) this._flowTracker.close();
        if (this._limesTracker) this._limesTracker.close();
        if (this._participantTracker) this._participantTracker.close();
        if (this.logger) this.logger.info("Realm Manager: Stopped.");
    }

    async _discoverRealms() {
        try {
            // 1. Fetch Environment (for Provider Injection)
            const root = globalThis.location.origin + '/';
            const envResp = await fetch(new URL("./env.json", root).href);
            const envConfig = envResp.ok ? await envResp.json() : {};
            const envTier = envConfig.persistencePolicy?.tier || envConfig.persistence_mode || "local";

            // 2. Fetch Discovery Index
            const resp = await fetch(new URL("./realms/index.json", root).href);
            if (!resp.ok) return;
            const files = await resp.json();
            
            for (const file of files) {
                try {
                    const realmUrl = new URL(`./realms/${file}`, root).href;
                    this.logger?.debug(`Realm Manager: Fetching ${realmUrl}...`);
                    const r = await fetch(realmUrl);
                    if (r.ok) {
                        const manifest = await r.json();
                        
                        // 3. Provider Injection (Rule 1: Patch Core Universe)
                        if (manifest.id === "org.neverplayed.realm.core" || manifest.id === "org.neverplayed.realm.persistence") {
                            // Defensive Initializer: Ensure bundles array exists
                            manifest.bundles = Array.isArray(manifest.bundles) ? manifest.bundles : [];
                            
                            const mode = manifest.persistencePolicy?.tier || envTier;
                            this.logger?.info(`[RealmManager] Persistence Tier Resolved: ${mode} (Source: ${manifest.persistencePolicy?.tier ? 'Manifest' : 'Environment'})`);
                            const isFirebase = mode === "cloud";
                            const isLocalFs = mode === "local-fs";
                            const isLocalBrowser = mode === "local";
                            const isMemory = mode === "volatile";

                            if (isFirebase) {
                                manifest.bundles.push("./bundles/org.neverplayed.persistence-firebase/manifest.json");
                            } else if (isLocalFs) {
                                manifest.bundles.push("./bundles/org.neverplayed.persistence-localstorage/manifest.json");
                                manifest.bundles.push("./bundles/org.neverplayed.persistence-fs-sync/manifest.json");
                            } else if (isLocalBrowser) {
                                manifest.bundles.push("./bundles/org.neverplayed.persistence-localstorage/manifest.json");
                            } else if (isMemory) {
                                this.logger?.info("Realm Manager: Persistence Phase skipped (Memory Mode). Data resides in Volatile Store.");
                            }
                        }
                        
                        await this._registerRealm(manifest);
                    }
                } catch (err) {
                    this.logger?.error(`Realm Manager: Failed to load context from './realms/${file}':`, err.message);
                }
            }
            this.logger?.info(`Realm Manager: Discovered ${this._orderedRealmIds.length} worlds via dynamic manifest.`);
        } catch (err) {
            this.logger?.error("Failed to discover realms:", err.message);
        }
    }


    _syncPrivileges(realmId) {
        if (!this.session) return;
        
        const manifest = this._realms.get(realmId);
        if (!manifest || !manifest.privileges || !manifest.privileges["realm-admins"]) return;

        const admins = manifest.privileges["realm-admins"];
        
        // 1. Resolve Global Identity (Auth Shield / Layer 1)
        const globalUser = this.auth?.getCurrentUser ? this.auth.getCurrentUser() : null;
        
        // 2. Resolve Session User (Domain / Layer 3)
        const sessionUser = this.session.scopedUsers?.["global"] || this.session.currentUser;
        
        const isGlobalAdmin = globalUser && (admins.includes(globalUser.id) || (globalUser.email && admins.includes(globalUser.email)));
        const isSessionAdmin = sessionUser && (admins.includes(sessionUser.id) || (sessionUser.email && admins.includes(sessionUser.email)));

        if (isGlobalAdmin || isSessionAdmin) {
            this.logger?.info(`Realm Manager: Elevated privileges in '${realmId}'. Injecting 'realm-admin'.`);
            
            // Identity Guard: Ensure scopedUsers and global entry are initialized
            if (!this.session.scopedUsers) this.session.scopedUsers = {};
            if (!this.session.scopedUsers["global"]) {
                this.session.scopedUsers["global"] = { id: 'guest' };
            }
            
            const target = this.session.scopedUsers["global"];
            
            // Sanitize Identity: If it is a guest-level auto-elevation, reset to a clean state to trigger reactivity
            if (target.id === 'guest') {
                this.session.scopedUsers["global"] = { 
                    id: 'guest',
                    attributes: target.attributes || {}
                };
            }

            this.session.scopedUsers["global"].attributes = this.session.scopedUsers["global"].attributes || {};
            this.session.scopedUsers["global"].attributes["realm-admin"] = true;
        } else {
            if (this.session.scopedUsers?.["global"]?.attributes) {
                delete this.session.scopedUsers["global"].attributes["realm-admin"];
            }
        }
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
                    const realms = this._orderedRealmIds.map(id => this._realms.get(id));
                    log({ text: `Available Realms (${realms.length}):`, color: 'blue', bold: true });
                    realms.forEach((r, idx) => {
                        const marker = r.id === activeId ? ' (ACTIVE) 🌌' : '';
                        log(` [${idx + 1}] ${r.id.padEnd(30)} | ${r.title}${marker}`);
                    });
                } else if (sub === 'switch' && args[1]) {
                    const target = args[1];
                    let targetId = target;
                    if (!isNaN(target)) {
                        targetId = this._orderedRealmIds[parseInt(target) - 1];
                    }
                    
                    if (!targetId || !this._realms.has(targetId)) {
                        return log(`Universe not found: ${target}`, 'error');
                    }

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
                    // 1. Inhabitant Layer (Personal Tools) - ALWAYS VISIBLE
                    if (this._manualBSNs.size > 0) {
                        log({ text: ` --- Inhabitant Layer (Personal Tools) ---`, color: 'magenta' });
                        this._manualBSNs.forEach(norm => {
                            const b = this.context.getBundles().find(b => BaseActivator.normalizeBSN(b.getSymbolicName()) === norm);
                            const rawInfo = b ? ` (${b.getSymbolicName()})` : '';
                            log(`   - ${norm}${rawInfo}`);
                        });
                    } else {
                        log({ text: " --- Inhabitant Layer (Personal Tools) ---", color: 'magenta' });
                        log("   [Empty]");
                    }
                    
                    // 2. Pending Transitions - ALWAYS VISIBLE
                    if (this._pendingTransition) {
                        log({ text: ` --- PENDING TRANSITION ---`, color: 'yellow' });
                        log(` Target: ${this._pendingTransition.id}`);
                        log(` Phase: ${this._pendingTransition.currentPhase}`);
                        log(` Delta: ${this._pendingTransition.surgePlan.toInstall.length} Surge, ${this._pendingTransition.surgePlan.toPurge.length} Purge.`);
                    }

                    // 3. Universe Layers (Only if active)
                    const manifest = this._realms.get(this._activeRealmId);
                    if (!manifest) {
                         log({ text: " --- Universe Layers ---", color: 'blue' });
                         log("   [No realm active]");
                         return;
                    }
                    
                    const hierarchy = await this._resolveHierarchy(this._activeRealmId);
                    
                    log({ text: `🌌 Active Context: ${manifest.title}`, color: 'blue', bold: true });
                    log(` ID: ${manifest.id}`);
                    
                    log({ text: ` --- Layers (Hierarchy) ---`, color: 'cyan' });
                    hierarchy.map(h => h.id).reverse().forEach((id, idx) => {
                        const prefix = idx === 0 ? '📍 ' : '   ';
                        log(`${prefix}${id}`);
                    });

                    // 4. Ontology (Domain Objects)
                    const aggregatedDOs = [];
                    for (const layer of hierarchy) {
                        if (layer.domainObjects) {
                            layer.domainObjects.forEach(d => {
                                if (!aggregatedDOs.some(ad => ad.id === d.id)) aggregatedDOs.push(d);
                            });
                        }
                    }
                    if (aggregatedDOs.length > 0) {
                        log({ text: ` --- Ontological Horizon (Domain Objects) ---`, color: 'yellow' });
                        log(` Total Blueprints: ${aggregatedDOs.length}`);
                        aggregatedDOs.map(d => d.id).sort().forEach(id => log(`   - ${id}`));
                    }
                    
                    // 5. Manifest Bundles
                    const manifestBSNs = new Set();
                    for (const layer of hierarchy) {
                        if (layer.bundles) {
                            for (const url of layer.bundles) {
                                const bsn = await this._getBsn(url);
                                manifestBSNs.add(BaseActivator.normalizeBSN(bsn));
                            }
                        }
                    }
                    log({ text: ` --- Component Stack (Manifest Bundles) ---`, color: 'green' });
                    log(` Total Manifest Bundles: ${manifestBSNs.size}`);
                } else {
                    log("Usage: /realm <list|switch [id] [--step]|next|abort|info>");
                }
            }
        });
    }

    async _recoverState(context) {
        // 2. Orchestration Shield: Double-trigger
        if (this._isRecovering) return;
        this._isRecovering = true;
        
        try {
            if (this._discoveryPromise) await this._discoveryPromise;
            // 3. Stateless Fallback for Catch-22 (Cold Boot)
            let lastRealmId = null;
            if (this._persistence) {
                // Wait for Persistence Readiness
                if (typeof this._persistence.waitReady === 'function') {
                    try { await this._persistence.waitReady(); } catch (_e) { /* ignore */ }
                }
                lastRealmId = await this._persistence.load(REALM_STORAGE_PID);
            } else {
                // Direct LocalStorage fallback before service is active
                try {
                    lastRealmId = localStorage.getItem(REALM_STORAGE_PID);
                    if (lastRealmId) lastRealmId = lastRealmId.replace(/^"|"$/g, ''); // unquote if stored as JSON
                } catch (_e) { /* ignore */ }
            }

            // 4. Recover Manual Bundles (Inhabitant Layer)
            if (this._persistence) {
                const manualUrls = await this._persistence.load("realm-manager.manual-bundles") || [];
                if (manualUrls.length > 0) {
                    this.logger?.info(`[RealmManager] Recovering ${manualUrls.length} inhabitant bundles...`);
                    for (const url of manualUrls) {
                        try { await this._installManualBundle(url); } catch (_e) { /* ignore */ }
                    }
                }
            }

            // 5. Recover Active Realm
            lastRealmId = this._persistence 
                ? await this._persistence.load(REALM_STORAGE_PID) 
                : lastRealmId;
                
            if (lastRealmId && this._realms.has(lastRealmId)) {
                this.logger.info(`Realm Manager: Recovering Context -> '${lastRealmId}'...`);
                await this._switchRealm(context, lastRealmId);
            } else if (this._realms.has("org.neverplayed.realm.core")) {
                // Primordial Bootstrapping: Default to Core Realm (ADR-0165 / TAME Genesis)
                this.logger.info(`Realm Manager: Primordial Awakening. Defaulting to 'org.neverplayed.realm.core'...`);
                await this._switchRealm(context, "org.neverplayed.realm.core");
            } else if (this._realms.has("org.neverplayed.realm.real-life")) {
                // Default Fallback: Real-Life Universe
                this.logger.info(`Realm Manager: Cold Boot detected. Defaulting to 'org.neverplayed.realm.real-life'...`);
                await this._switchRealm(context, "org.neverplayed.realm.real-life");
            } else if (this._realms.size > 0) {
                this.logger.info(`Realm Manager: Cold Boot detected. Defaulting to first available realm '${this._realms.entries().next().value[0]}'...`);
                await this._switchRealm(context, this._realms.entries().next().value[0]);
            }
        } finally {
            this._isRecovering = false;
        }
    }

    _registerRealm(manifest) {
        return this._lock = this._lock.then(() => {
            if (!manifest.id) throw new Error("Realm manifest must have a unique ID.");
            this._realms.set(manifest.id, manifest);
            if (!this._orderedRealmIds.includes(manifest.id)) {
                this._orderedRealmIds.push(manifest.id);
            }
            this.logger?.info(`Realm Manager: Registered universe '${manifest.id}' (${manifest.title})`);

            // Rule: Markov Blanket Injection (SDN-0192)
            if (this._limes && manifest.strategies) {
                this.logger?.info(`Realm Manager: Injecting Markov Blanket for universe '${manifest.id}'`);
                for (const [strategyId, definition] of Object.entries(manifest.strategies)) {
                    this._limes.registerStrategy(strategyId, definition);
                }
            }

            // 1.9 Resilience: Unregister old service if it exists (prevents duplication in UI)
            const oldReg = this._realmRegs.get(manifest.id);
            if (oldReg) {
                try { oldReg.unregister(); } catch (_e) { /* ignore */ }
            }

            const serviceProps = {
                "realm.id": manifest.id,
                "realm.title": manifest.title,
                "realm.icon": manifest.icon || "fas fa-universe",
                "realm.active": manifest.id === this._activeRealmId
            };

            const registration = this.context.registerService(REALM_SERVICE, {
                getId: () => manifest.id,
                getManifest: () => ({ ...manifest }),
                switch: (interactive = false) => this._switchRealm(this.context, manifest.id, interactive)
            }, serviceProps);
            
            this._realmRegs.set(manifest.id, registration);

            // Broadcast discovery (Step 1)
            if (this._eventAdmin && this._eventFactory) {
                this.logger?.info(`Realm Manager: Broadcasting realm registration for '${manifest.id}'`);
                const event = this._eventFactory.build(REALM_REGISTERED_TOPIC, {
                    "realm.id": manifest.id,
                    "realm.title": manifest.title,
                    "realm.icon": manifest.icon || "fas fa-universe"
                });
                this._eventAdmin.postEvent(event);
            } else {
                this._registrationBuffer.push(manifest);
            }
        });
    }

    _flushRegistrationBuffer() {
        if (!this._eventAdmin || !this._eventFactory || this._registrationBuffer.length === 0) return;
        
        this.logger?.info(`[RealmManager] Flushing ${this._registrationBuffer.length} registration events from buffer...`);
        const artifacts = [...this._registrationBuffer];
        this._registrationBuffer = [];
        
        for (const manifest of artifacts) {
            const event = this._eventFactory.build(REALM_REGISTERED_TOPIC, {
                "realm.id": manifest.id,
                "realm.title": manifest.title,
                "realm.icon": manifest.icon || "fas fa-universe"
            });
            this._eventAdmin.postEvent(event);
        }
    }

    _unregisterRealm(id) {
        const manifest = this._realms.get(id);
        if (!manifest) return;

        this._realms.delete(id);
        this._orderedRealmIds = this._orderedRealmIds.filter(rid => rid !== id);
        
        const registration = this._realmRegs.get(id);
        if (registration) {
            try { registration.unregister(); } catch (_e) { /* ignore */ }
            this._realmRegs.delete(id);
        }

        this.logger?.info(`Realm Manager: Unregistered universe '${id}'`);

        // Broadcast removal (Step 1)
        if (this._eventAdmin && this._eventFactory) {
            const event = this._eventFactory.build(REALM_UNREGISTERED_TOPIC, {
                "realm.id": id
            });
            this._eventAdmin.postEvent(event);
        }
    }

    async _executeTransition({ realmId, identityId, perspective, aperture, tenantId, interactive = false }) {
        this.logger?.info(`Realm Manager: Initiating Transition to realm '${realmId}' for identity '${identityId}'...`);
        
        // 1. Resolve Hierarchy and Manifest early
        const hierarchy = await this._resolveHierarchy(realmId);
        if (hierarchy.length === 0) throw new Error(`Realm '${realmId}' not found.`);
        const manifest = this._realms.get(realmId);

        // 2. Resolve Active Surrogate (Sensing / Fallback Rules)
        let activeSurrogate = null;
        if (this.session && identityId !== 'guest' && manifest) {
            const userProfile = this.session.getResolvedIdentity(identityId) || {};
            const surrogates = userProfile.surrogates || {};
            const recognized = manifest.recognizedSurrogates || [];
            const currentActiveSurrogateId = userProfile.activeSurrogateId;
            
            this.logger?.info(`Realm Manager: Sensing '${identityId}'. Current role: '${currentActiveSurrogateId || 'naked'}', recognized: ${JSON.stringify(recognized)}, possessed surrogates: ${JSON.stringify(Object.keys(surrogates))}`);
            
            // 1. If the current active surrogate is recognized by the destination realm, keep it.
            if (currentActiveSurrogateId && recognized.includes(currentActiveSurrogateId)) {
                activeSurrogate = surrogates[currentActiveSurrogateId];
                this.logger?.info(`Realm Manager: Keeping recognized active surrogate '${currentActiveSurrogateId}'.`);
            } 
            // 2. Else, if the user possesses any recognized surrogate for that realm, auto-materialize it.
            else {
                const available = recognized.find(sId => surrogates[sId]);
                if (available) {
                    activeSurrogate = surrogates[available];
                    this.logger?.info(`Realm Manager: Sensed and auto-materializing recognized surrogate '${available}'.`);
                } 
                // 3. Else, transition as a naked observer (activeSurrogate = null).
                else {
                    activeSurrogate = null;
                    this.logger?.info(`Realm Manager: Being '${identityId}' will transition as a naked observer.`);
                }
            }
        }

        // 3. Access Guard (Markov Blanket / Limes)
        if (this._limes && identityId !== 'guest') {
            const strategyId = `REALM_ACCESS:${realmId}`;
            const strategy = this._limes.getStrategies().find(s => s.id === strategyId);
            let allowed = true;

            if (strategy) {
                // Construct transient user representation to check access
                const tempUser = {
                    id: identityId,
                    surrogateId: activeSurrogate?.id || null,
                    isMaterialized: !!activeSurrogate,
                    ...(activeSurrogate || {})
                };
                allowed = this._limes.isAllowed(tempUser, strategyId, { realmId });
                this.logger?.debug(`Realm Manager: Access Check Result for '${realmId}': ${allowed ? 'ALLOWED' : 'DENIED'}`);
            } else {
                this.logger?.debug(`Realm Manager: No specific strategy found for '${realmId}'. Defaulting to ALLOWED.`);
            }

            if (!allowed) {
                const msg = manifest?.onAccessDenied || `Sovereign Block: Access to universe '${realmId}' denied for '${identityId}'.`;
                throw new Error(msg);
            }
        }

        // 4. Phase 1: Fan-In (Prepare & Veto)
        const proposed = {
            realmId,
            identityId,
            perspective,
            aperture,
            tenantId
        };
        for (const participant of this._participants) {
            try {
                const allowed = await participant.onPrepareTransition(proposed);
                if (allowed === false) {
                    throw new Error(`Vetoed by participant.`);
                }
            } catch (e) {
                throw new Error(`Transition vetoed by participant during preparation: ${e.message}`);
            }
        }

        this.logger?.info(`Realm Manager: Phase 1 (Fan-In/Prepare) SUCCESS.`);

        // 5. Phase 2: Atomic Commit
        this.logger?.info(`Realm Manager: Starting Phase 2 (Atomic Commit) for '${realmId}'...`);
        if (this.session) {
            const previousRealmId = this.session.activeRealmId;
            if (previousRealmId && previousRealmId !== realmId) {
                this.logger?.info(`Realm Manager: Pruning residency stack for previous realm '${previousRealmId}' via logout.`);
                this.session.logout(previousRealmId);
            }
            this.session.activeRealmId = realmId;
            this.session.activeBeingId = identityId;
            
            // Call session.login to construct the resident stack and activate the surrogate if materialized
            await this.session.login(identityId, realmId, activeSurrogate);
        }
        this.logger?.info(`Realm Manager: Phase 2 (Atomic Commit) SUCCESS.`);

        // 6. Phase 3: Fan-Out (Commit/Activate)
        this.logger?.info(`Realm Manager: Starting Phase 3 (Fan-Out/Activate) for '${realmId}'...`);
        const surgePlan = await this._prepareSurgePlan(this.context, hierarchy);
        this._pendingTransition = {
            id: realmId,
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
                message: `Hierarchy resolved for '${realmId}'. Delta: ${surgePlan.toInstall.length} to install, ${surgePlan.toKeep.length} sticky.`,
                plan: surgePlan 
            };
        }

        // Auto path executes transition phase directly
        const result = await this._executeTransitionPhase('ONTOLOGY');

        // Notify external participants of commit completion
        const activeContext = {
            realmId,
            identityId,
            perspective,
            aperture,
            tenantId
        };
        for (const participant of this._participants) {
            try {
                await participant.onCommitTransition(activeContext);
            } catch (e) {
                this.logger?.error(`Error during onCommitTransition for participant:`, e);
            }
        }

        this.logger?.info(`Realm Manager: Phase 3 (Fan-Out/Activate) COMPLETE. System Operational. 🌌`);
        return result;
    }

    _coordinateTransition(proposed) {
        this._lock = this._lock.catch(() => { /* recover chain */ });

        return this._lock = this._lock.then(async () => {
            if (this._pendingTransition) {
                throw new Error("A transition is already in progress.");
            }

            try {
                return await this._executeTransition({
                    realmId: proposed.realmId,
                    identityId: proposed.identityId,
                    perspective: proposed.perspective,
                    aperture: proposed.aperture,
                    tenantId: proposed.tenantId,
                    interactive: false
                });
            } catch (err) {
                this._pendingTransition = null;
                throw err;
            }
        });
    }

    _switchRealm(context, id, interactive = false) {
        this._lock = this._lock.catch(() => { /* recover chain */ });

        return this._lock = this._lock.then(async () => {
            if (this._pendingTransition) {
                throw new Error("A transition is already in progress. Type '/realm next' to proceed or '/realm abort' to cancel.");
            }

            try {
                const identityId = (this.session && this.session.currentUser) ? this.session.currentUser.id : 'guest';
                const tenantId = (this.session && this.session.scopedUsers?.["global"]) ? this.session.scopedUsers["global"].__activeId__ : 'guest';
                return await this._executeTransition({
                    realmId: id,
                    identityId,
                    tenantId,
                    interactive
                });
            } catch (err) {
                this._pendingTransition = null;
                this.logger?.warn(`Realm Manager: Switch failed for '${id}':`, err.message);
                throw err;
            }
        });
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

        const protectedBSNs = [
            "org.neverplayed.realm-manager",
            "org.neverplayed.shell-cli",
            "org.neverplayed.osgi-base",
            "org.neverplayed.backoffice-host"
        ].map(b => BaseActivator.normalizeBSN(b));

        for (const b of activeBundles) {
            const bsn = b.getSymbolicName();
            const normalized = BaseActivator.normalizeBSN(bsn);

            if (seenBsn.has(normalized)) continue;
            if (this._manualBSNs.has(normalized)) continue;
            if (protectedBSNs.includes(normalized)) continue;

            toPurge.push({ bsn, id: b.id, reason: 'Orphaned (Not in target hierarchy)' });
        }

        // 3. Final Plan
        this.logger?.debug(`[RealmManager] Surge Plan: ${toInstall.length} to install, ${toKeep.length} sticky, ${toPurge.length} orphans.`);
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
            if (folder) return folder.replace('org.neverplayed.', 'org.neverplayed.');
            return url.split('/').pop().replace(/.json$/, '');
        }
    }

    async _installManualBundle(url) {
        const bsn = await this._getBsn(url);
        const normalized = BaseActivator.normalizeBSN(bsn);
        
        console.debug(`[RealmManager] Manual install initiated for [${normalized}] from ${url}`);
        
        const bundle = await this.context.installBundle(url);
        if (bundle.getState() < 32) await bundle.start();
        
        this._manualBSNs.add(normalized);
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
        const normalized = BaseActivator.normalizeBSN(bsn);
        const urlToMatch = b.getLocation();

        await b.stop();
        await b.uninstall();
        
        this._manualBSNs.delete(normalized);
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
        this.logger?.info(`[RealmManager] Phase '${phase}' | EventAdmin: ${!!this._eventAdmin} | EventFactory: ${!!this._eventFactory}`);

        if (phase === 'ONTOLOGY') {
            this.logger?.info(`Realm Manager: Applying Ontological & Privilege filters...`);
            
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
            await this._syncPrivileges(pt.id);

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
                            const bsn = bundle.getSymbolicName();
                            const norm = BaseActivator.normalizeBSN(bsn);

                            if (this._manualBSNs.has(norm)) {
                                this.logger?.debug(`Skipping purge for ${bsn}: Found in Inhabitant Layer.`);
                                continue;
                            }

                            this.logger?.debug(`Purging bundle: ${bsn} (#${item.id})`);
                            const state = bundle.getState();
                            if (state !== 1) { // 1 = UNINSTALLED
                                if (state > 1) { // Start/Resolved/Active
                                     try { await bundle.stop(); } catch (_e) { /* already stopped */ }
                                }
                                try { await bundle.uninstall(); } catch (_e) { /* already gone */ }
                            }
                        } catch (err) {
                            this.logger?.error(`Failed to purge '${item.bsn}':`, err.message);
                        }
                    }
                }
            }

            // 2. Surge (Installation & Start)
            for (const item of pt.surgePlan.toInstall) {
                try {
                    this.logger?.info(`[RealmManager] Surging: ${item.bsn} from ${item.url}...`);
                    const bundle = await this.context.installBundle(item.url);
                    
                    const state = bundle.getState();
                    if (state < 32) { // Not ACTIVE
                        this.logger?.debug(`[RealmManager] Starting bundle: ${item.bsn} (Current State: ${state})`);
                        await bundle.start();
                    } else {
                        this.logger?.debug(`[RealmManager] Bundle ${item.bsn} already active, skipping start.`);
                    }
                } catch (err) {
                    this.logger?.error(`[RealmManager] Failed to surge '${item.bsn}':`, err.message);
                }
            }

            // Persistence
            if (this._persistence) {
                 await this._persistence.store(REALM_STORAGE_PID, pt.id);
            }

            this._activeRealmId = pt.id;
            if (this.session) {
                this.session.activeRealmId = pt.id;
            }
            this.logger?.info(`Realm Manager: Context Transition Successful. Universe '${pt.id}' is now active. 🌌`);
            
            // Update Service Properties for all Realms
            for (const [id, reg] of this._realmRegs.entries()) {
                const manifest = this._realms.get(id);
                reg.setProperties({ 
                    "realm.id": id,
                    "realm.title": manifest.title,
                    "realm.icon": manifest.icon || "fas fa-universe",
                    "realm.active": id === pt.id 
                });
            }

            // OSGi EventAdmin Broadcast
            if (this._eventAdmin && this._eventFactory) {
                this.logger?.info(`[RealmManager] Broadcasting Universe Change: ${pt.id} on topic ${REALM_CHANGED_TOPIC}`);
                const event = this._eventFactory.build(REALM_CHANGED_TOPIC, {
                    "realm.id": pt.id,
                    "realm.title": pt.manifest.title,
                    "realm.icon": pt.manifest.icon || "fas fa-universe"
                });
                this._eventAdmin.postEvent(event);
            } else {
                this.logger?.warn(`[RealmManager] EventAdmin Broadcast skipped! Admin: ${!!this._eventAdmin}, Factory: ${!!this._eventFactory}`);
            }

            // Healer
            this._registerCLI(this.context);

            pt.currentPhase = 'ACTIVATION_READY';
            pt.milestone = 'COMPLETE';
            if (!pt.auto) return { status: 'COMPLETE', message: `Infrastructure transition to '${pt.id}' finished.` };
            
            // 3. Policy-Driven Startup Flow
            if (pt.manifest.startupFlow && this._flowService) {
                this.logger?.info(`[RealmManager] Triggering Startup Flow Policy: ${pt.manifest.startupFlow}`);
                // Background execution to not block the main transition return, 
                // but handled resiliently by the internal _waitForFlow.
                this._flowService.launch(pt.manifest.startupFlow, { containerId: 'flow-active-stage' })
                    .catch(e => this.logger?.error(`[RealmManager] Startup Flow Policy Failed:`, e));
            }

            this._pendingTransition = null;
            this.logger?.info(`[RealmManager] Transition to '${pt.id}' COMPLETE. System Operational.`);
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

    async _waitForElement(id, timeout = 2500) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.getElementById(id);
            if (el) return el;
            await new Promise(r => setTimeout(r, 75));
        }
        return null;
    }

    async _waitForFlow(flowId, timeout = 3000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const flow = this._flows.get(flowId);
            if (flow) return flow;
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }
}
