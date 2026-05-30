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
    TRANSITION_PARTICIPANT_INTERFACE,
    PERSISTENCE_MANAGER_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    BEING_SERVICE,
    YAML_SERVICE
} from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import { BaseActivator } from "osgi-base";

class VirtualRealmsMap extends Map {
    _manager = null;
    constructor(manager) {
        super();
        this._manager = manager;
    }
    
    has(key) {
        if (super.has(key)) return true;
        if (typeof key === 'string' && (key.startsWith('being:') || key.startsWith('tenant:'))) {
            return this._isValidVirtualRealm(key);
        }
        return false;
    }
    
    get(key) {
        if (super.has(key)) return super.get(key);
        if (typeof key === 'string' && (key.startsWith('being:') || key.startsWith('tenant:'))) {
            if (this._isValidVirtualRealm(key)) {
                return this._synthesizeVirtualRealm(key);
            }
        }
        return undefined;
    }
    
    get size() {
        return Array.from(this.values()).length;
    }

    values() {
        const list = Array.from(super.values());
        const virtuals = this._getVirtualRealms();
        return [...list, ...virtuals].values();
    }
    
    entries() {
        const list = Array.from(super.entries());
        const virtuals = this._getVirtualRealms().map(vr => [vr.id, vr]);
        return [...list, ...virtuals].values();
    }

    [Symbol.iterator]() {
        return this.entries();
    }

    _isValidVirtualRealm(key) {
        if (key === 'tenant:global') return true;
        
        let beingId = '';
        if (key.startsWith('being:')) {
            beingId = key.substring(6);
        } else if (key.startsWith('tenant:')) {
            beingId = key.substring(7);
        }
        
        if (beingId === 'guest' || !beingId) return false;
        
        // 1. Check Session platonic stack (robust user presence check)
        const session = this._manager.session;
        if (session?.scopedUsers?.["platonic"]?.[beingId]) {
            return true;
        }
        
        // 2. Check Being Service
        const beingSvc = this._manager._beingService;
        if (beingSvc) {
            const being = beingSvc.getBeing(beingId);
            return !!being;
        }
        return false;
    }

    _synthesizeVirtualRealm(key) {
        if (key === 'tenant:global') {
            return {
                id: 'tenant:global',
                title: 'Tenant Cosmic Envelope',
                recognizedSurrogates: ["observer", "sovereign-guard", "system-collector"],
                bundles: []
            };
        }
        if (key.startsWith('being:')) {
            const beingId = key.substring(6);
            return {
                id: key,
                title: `Being Mind (${beingId})`,
                recognizedSurrogates: ["observer", "sovereign-guard", "system-collector"],
                bundles: []
            };
        }
        if (key.startsWith('tenant:')) {
            const tenantId = key.substring(7);
            return {
                id: key,
                title: `Tenant Cosmic Envelope (${tenantId})`,
                recognizedSurrogates: ["observer", "sovereign-guard", "system-collector"],
                bundles: []
            };
        }
        return undefined;
    }

    _getVirtualRealms() {
        const virtuals = [];
        virtuals.push({
            id: 'tenant:global',
            title: 'Tenant Cosmic Envelope',
            recognizedSurrogates: ["observer", "sovereign-guard", "system-collector"],
            bundles: []
        });
        
        const knownBeings = new Map();
        
        // 1. Collect from Being Service
        const beingSvc = this._manager._beingService;
        if (beingSvc) {
            const known = beingSvc.getKnownBeings() || [];
            known.forEach(b => {
                if (b.id) knownBeings.set(b.id, b);
            });
        }
        
        // 2. Collect from session platonic stack
        const session = this._manager.session;
        if (session?.scopedUsers?.["platonic"]) {
            for (const [userId, user] of Object.entries(session.scopedUsers["platonic"])) {
                if (userId && userId !== '__activeId__' && userId !== 'guest' && user) {
                    knownBeings.set(userId, user);
                }
            }
        }

        knownBeings.forEach((b, id) => {
            if (id && id !== 'guest' && !id.includes(':')) {
                virtuals.push({
                    id: `being:${id}`,
                    title: `Being Mind (${id})`,
                    recognizedSurrogates: ["observer", "sovereign-guard", "system-collector"],
                    bundles: []
                });
                virtuals.push({
                    id: `tenant:${id}`,
                    title: `Tenant Cosmic Envelope (${id})`,
                    recognizedSurrogates: ["observer", "sovereign-guard", "system-collector"],
                    bundles: []
                });
            }
        });
        
        return virtuals;
    }
}

export default class Activator extends BaseActivator {
    _realms = new Map();
    _activeRealmId = null;
    _isTransitioning = false;
    _persistenceVal = null;
    get _persistence() {
        return this._persistenceTracker ? (this._persistenceTracker.getService() || this._persistenceVal) : this._persistenceVal;
    }
    set _persistence(val) {
        this._persistenceVal = val;
    }
    _registry = null;
    _eventAdmin = null;
    _eventFactory = null;
    _realmCommandReg = null;
    _realmRegs = new Map(); // id -> ServiceRegistration
    _bsnCache = new Map(); // url -> bsn
    _manualBSNs = new Set();
    _primordialBSNs = new Set();
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
    _limesTracker = null;
    _beingService = null;
    _yamlService = null;

    // Dynamic Cognition (TAME Engine)
    _cognitions = new Map(); // id -> cognition loop state
    _cognitionRegs = new Map(); // id -> ServiceRegistration
    _homeostasisScheduled = false;
    _homeostasisHandlerReg = null;

    onStart(context) {
        this._realms = new VirtualRealmsMap(this);
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
                    this.session.activeRealmId = targetId;
                    this._syncPrivileges(targetId);
                }
                return this.session;
            }
        });
        this._sessionTracker.open();

        // 1.3 Launch Discovery & Recovery (Moved to step 3 for serialization)

        // 1.4 Persistence Tracker (Vital for recovery)
        this._persistenceTracker = context.trackService(`(|(objectClass=${PM_INTERFACE_KEY})(objectClass=${PERSISTENCE_MANAGER_SERVICE}))`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this._persistence = svc;
                this.logger?.info("Realm Manager: Persistence connected.");
                this._scheduleHomeostasis();
                return svc;
            },
            removedService: (ref) => {
                const svc = context.getService(ref);
                if (this._persistenceVal === svc) {
                    this._persistenceVal = null;
                }
            }
        });
        this._persistenceTracker.open();

        // 1.5 Track Registry for Ontological Intersection
        this._registryTracker = context.trackService(`(objectClass=${DOMAIN_OBJECT_REGISTRY_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this._registry = svc;
                return svc;
            },
            removedService: (ref) => {
                const svc = context.getService(ref);
                if (this._registry === svc) {
                    this._registry = null;
                }
            }
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

        // 1.11 Track Being Service (Dynamic Seeding)
        this._beingTracker = context.trackService(`(objectClass=${BEING_SERVICE})`, {
            addingService: (ref) => {
                this._beingService = context.getService(ref);
                this.logger?.info("Realm Manager: Connected to Being Service.");
                return this._beingService;
            },
            removedService: () => {
                this._beingService = null;
            }
        });
        this._beingTracker.open();

        // 1.12 Track YAML Service (Dynamic Seeding)
        this._yamlTracker = context.trackService(`(objectClass=${YAML_SERVICE})`, {
            addingService: (ref) => {
                this._yamlService = context.getService(ref);
                this.logger?.info("Realm Manager: Connected to YAML Service.");
                return this._yamlService;
            },
            removedService: () => {
                this._yamlService = null;
            }
        });
        this._yamlTracker.open();

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
            shutdownRealm: (realmId) => this.shutdownRealm(realmId),
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
                if (!this._recoveryPromise) {
                    this._recoveryPromise = this._recoverState(context);
                }
                await this._recoveryPromise;
                // Double-check recovery actually finished
                while (this._isRecovering) await new Promise(r => setTimeout(r, 50));
                
                // Capture all currently active bundles as part of the immutable primordial plane
                this._primordialBSNs = new Set(
                    this.context.getBundles().map(b => BaseActivator.normalizeBSN(b.getSymbolicName()))
                );
                this.logger?.info(`Realm Manager: Captured ${this._primordialBSNs.size} primordial plane bundles.`);
                
                return true;
            },
            installManualBundle: (url) => this._installManualBundle(url),
            uninstallManualBundle: (target) => this._uninstallManualBundle(target),
            getHierarchy: (id) => this._resolveHierarchy(id || this._activeRealmId),
            getPrimordialBSNs: () => this._primordialBSNs,
            getManualBSNs: () => this._manualBSNs
        });

        // 1.11 Register EventHandler for homeostasis (TAME Engine)
        const topics = [
            "org/neverplayed/session/CHANGED",
            "org/neverplayed/realm/CHANGED",
            "org/neverplayed/persistence/CONTEXT_CHANGED",
            "org/neverplayed/persistence/CHANGED",
            "org/neverplayed/stratum/CHANGED"
        ];

        this._homeostasisHandlerReg = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (_event) => {
                this._scheduleHomeostasis();
            }
        }, { [EVENT_TOPIC]: topics });

        this._discoveryPromise = this._discoverRealms();
        this._recoveryPromise = null;
        
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

        // Dynamic Cognition Cleanups
        if (this._homeostasisHandlerReg) {
            try { this._homeostasisHandlerReg.unregister(); } catch (_e) {}
            this._homeostasisHandlerReg = null;
        }
        for (const reg of this._cognitionRegs.values()) {
            try { reg.unregister(); } catch (_e) {}
        }
        this._cognitionRegs.clear();
        this._cognitions.clear();

        if (this.logger) this.logger.info("Realm Manager: Stopped.");
    }

    async _discoverRealms() {
        try {
            // 1. Fetch Environment (for Provider Injection)
            const root = globalThis.location.origin + '/';
            const envResp = await fetch(new URL("./env.json", root).href);
            const envConfig = envResp.ok ? await envResp.json() : {};
            const envTier = envConfig.persistencePolicy?.tier || envConfig.persistence_mode || "local";

            // Store env config for later use (e.g. landingRealmId shortcut)
            this._envConfig = envConfig;
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
        const globalStack = this.session.scopedUsers?.["platonic"] || {};
        const activeId = globalStack.__activeId__;
        const activePlatonicUser = (activeId && activeId !== 'guest') ? globalStack[activeId] : null;
        const sessionUser = activePlatonicUser || this.session.currentUser;
        
        const isGlobalAdmin = globalUser && (admins.includes(globalUser.id) || (globalUser.email && admins.includes(globalUser.email)));
        const isSessionAdmin = sessionUser && (admins.includes(sessionUser.id) || (sessionUser.email && admins.includes(sessionUser.email)));

        if (isGlobalAdmin || isSessionAdmin) {
            this.logger?.info(`Realm Manager: Elevated privileges in '${realmId}'. Injecting 'realm-admin'.`);
            
            // Identity Guard: Ensure scopedUsers and platonic entry are initialized
            if (!this.session.scopedUsers) this.session.scopedUsers = {};
            if (!this.session.scopedUsers["platonic"]) {
                this.session.scopedUsers["platonic"] = { id: 'guest' };
            }
            
            const target = this.session.scopedUsers["platonic"];
            
            // Sanitize Identity: If it is a guest-level auto-elevation, reset to a clean state to trigger reactivity
            if (target.id === 'guest') {
                this.session.scopedUsers["platonic"] = { 
                    id: 'guest',
                    attributes: target.attributes || {}
                };
            }

            // B. User Profile Sync: Inject directly into the active user record in the platonic stack so it propagates reactively
            const activePlatonicId = this.session.scopedUsers["platonic"].__activeId__;
            if (activePlatonicId && this.session.scopedUsers["platonic"][activePlatonicId]) {
                const userAttrs = this.session.scopedUsers["platonic"][activePlatonicId].attributes || {};
                this.session.scopedUsers["platonic"][activePlatonicId].attributes = {
                    ...userAttrs,
                    "realm-admin": true
                };
            }

            // C. Spatial Realm Profile Sync: Inject directly into the active user record in the active spatial realm stack
            if (realmId && this.session.scopedUsers[realmId]) {
                const activeRealmId = this.session.scopedUsers[realmId].__activeId__;
                if (activeRealmId && this.session.scopedUsers[realmId][activeRealmId]) {
                    const realmAttrs = this.session.scopedUsers[realmId][activeRealmId].attributes || {};
                    this.session.scopedUsers[realmId][activeRealmId].attributes = {
                        ...realmAttrs,
                        "realm-admin": true
                    };
                }
            }
        } else {
            // Cleanup B: active user record inside the stack
            const activePlatonicId = this.session.scopedUsers?.["platonic"]?.__activeId__;
            if (activePlatonicId && this.session.scopedUsers["platonic"][activePlatonicId]?.attributes) {
                const attrs = { ...this.session.scopedUsers["platonic"][activePlatonicId].attributes };
                delete attrs["realm-admin"];
                this.session.scopedUsers["platonic"][activePlatonicId].attributes = attrs;
            }
            // Cleanup C: active user record inside the spatial realm stack
            if (realmId && this.session.scopedUsers[realmId]) {
                const activeRealmId = this.session.scopedUsers[realmId].__activeId__;
                if (activeRealmId && this.session.scopedUsers[realmId][activeRealmId]?.attributes) {
                    const attrs = { ...this.session.scopedUsers[realmId][activeRealmId].attributes };
                    delete attrs["realm-admin"];
                    this.session.scopedUsers[realmId][activeRealmId].attributes = attrs;
                }
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
                } else if (sub === 'shutdown') {
                    const realmId = activeId;
                    if (!realmId || realmId === 'platonic') {
                        return log("No active spatial realm to shut down.", 'error');
                    }
                    try {
                        log({ text: `Shutting down and de-reifying realm '${realmId}'...`, color: 'orange' });
                        await this.shutdownRealm(realmId);
                        log({ text: `Realm '${realmId}' has cleanly collapsed into somatic sleep. Returning to Platonic Lobby.`, color: 'green', bold: true });
                    } catch (e) {
                        log({ text: `Shutdown Failed: ${e.message}`, color: 'red' });
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
                
            // Rule: Platonic Lobby Boot (Decoupled Authentication)
            // Always enter the platonic staging lobby first after discovery.
            // The observer surrogate is already grafted by AuthShield → SessionService.
            if (this.session) {
                this.session.activeRealmId = 'platonic';
            }
            this._activeRealmId = 'platonic';
            this.logger.info(`Realm Manager: Entered Platonic Staging Lobby.`);

            // Broadcast initial Lobby context shift to Perceiver/Stratographer
            if (this._eventAdmin && this._eventFactory) {
                const event = this._eventFactory.build(REALM_CHANGED_TOPIC, {
                    "realm.id": 'platonic',
                    "realm.title": 'Platonic Lobby',
                    "realm.icon": 'fas fa-door-open'
                });
                this._eventAdmin.postEvent(event);
            }

            // Dynamically register RealmCognitionService for the Platonic Staging Lobby
            if (!this._cognitions.has('platonic')) {
                const oldCognitionReg = this._cognitionRegs.get('platonic');
                if (oldCognitionReg) {
                    try { oldCognitionReg.unregister(); } catch (_e) {}
                }

                const cognition = {
                    predictionError: 0.0,
                    reifiedPids: [],
                    getPredictionError() { return this.predictionError; },
                    getReifiedPids() { return this.reifiedPids; }
                };
                this._cognitions.set('platonic', cognition);

                const cognitionReg = context.registerService("org.neverplayed.realm.RealmCognitionService", cognition, {
                    "realm.id": 'platonic'
                });
                this._cognitionRegs.set('platonic', cognitionReg);
                this._scheduleHomeostasis();
            }

            // Rule: Landing Realm Shortcut (env.json `landingRealmId`)
            // If configured, auto-switch immediately after discovery — bypasses the chooser.
            const landingRealmId = this._envConfig?.landingRealmId;
            if (landingRealmId && this._realms.has(landingRealmId)) {
                this.logger.info(`Realm Manager: Landing Shortcut → auto-switching to '${landingRealmId}'...`);
                await this._switchRealm(context, landingRealmId);
            } else {
                this.logger.info(`Realm Manager: Staying in Platonic Lobby. Core shell bundles already loaded via primordial plane.`);
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

            // Dynamically register RealmCognitionService (TAME Engine)
            const oldCognitionReg = this._cognitionRegs.get(manifest.id);
            if (oldCognitionReg) {
                try { oldCognitionReg.unregister(); } catch (_e) {}
            }

            const cognition = {
                predictionError: 0.0,
                reifiedPids: [],
                getPredictionError() { return this.predictionError; },
                getReifiedPids() { return this.reifiedPids; }
            };
            this._cognitions.set(manifest.id, cognition);

            const cognitionReg = this.context.registerService("org.neverplayed.realm.RealmCognitionService", cognition, {
                "realm.id": manifest.id
            });
            this._cognitionRegs.set(manifest.id, cognitionReg);
            this._scheduleHomeostasis();

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

        // Clean up dynamic cognition
        const cognitionReg = this._cognitionRegs.get(id);
        if (cognitionReg) {
            try { cognitionReg.unregister(); } catch (_e) {}
            this._cognitionRegs.delete(id);
        }
        this._cognitions.delete(id);

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
        const manifest = this._realms.get(realmId);
        if (hierarchy.length === 0 && !manifest) {
            throw new Error(`Realm '${realmId}' not found.`);
        }

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
                this._cleanupVirtualRealmServices(previousRealmId);
            }
            if (previousRealmId && previousRealmId !== realmId && previousRealmId !== 'platonic') {
                this.logger?.info(`Realm Manager: Pruning residency stack for previous realm '${previousRealmId}' via logout.`);
                this.session.logout(previousRealmId);
                // Clear lobby fallback signal — we're mid-transition to a new realm, not the lobby.
                this.session._pendingLobbyFallback = null;
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
        if (id === 'platonic') {
            const previousRealmId = this._activeRealmId;
            if (previousRealmId && previousRealmId !== 'platonic') {
                this._cleanupVirtualRealmServices(previousRealmId);
            }
            this._activeRealmId = 'platonic';
            if (this.session) {
                this.session.activeRealmId = 'platonic';
            }
            if (this._beingService) {
                this._beingService.clear();
            }
            if (this._persistence) {
                Promise.resolve(this._persistence.store(REALM_STORAGE_PID, 'platonic')).catch(err => {
                    this.logger?.warn(`Failed to persist platonic realm: ${err.message}`);
                });
            }
            if (this._eventAdmin && this._eventFactory) {
                const event = this._eventFactory.build(REALM_CHANGED_TOPIC, {
                    "realm.id": 'platonic',
                    "realm.title": 'Platonic Lobby'
                });
                this._eventAdmin.postEvent(event);
            }
            return Promise.resolve({ status: 'COMPLETE', message: "Returned to Platonic Staging Lobby 🌌" });
        }

        this._lock = this._lock.catch(() => { /* recover chain */ });

        return this._lock = this._lock.then(async () => {
            if (this._pendingTransition) {
                throw new Error("A transition is already in progress. Type '/realm next' to proceed or '/realm abort' to cancel.");
            }

            try {
                const identityId = (this.session && this.session.currentUser) ? this.session.currentUser.id : 'guest';
                const tenantId = (this.session && this.session.activeBeingId && this.session.activeBeingId !== 'guest') ? this.session.activeBeingId : 'guest';
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

    _cleanupVirtualRealmServices(realmId) {
        if (realmId && (realmId.startsWith('being:') || realmId.startsWith('tenant:'))) {
            const reg = this._realmRegs.get(realmId);
            if (reg) {
                try { reg.unregister(); } catch (_e) {}
                this._realmRegs.delete(realmId);
            }
            const cognitionReg = this._cognitionRegs.get(realmId);
            if (cognitionReg) {
                try { cognitionReg.unregister(); } catch (_e) {}
                this._cognitionRegs.delete(realmId);
            }
            this._cognitions.delete(realmId);
        }
    }

    async shutdownRealm(realmId) {
        this.logger?.info(`[RealmManager] Somatic Shutdown: De-reifying realm '${realmId}'...`);
        this._cleanupVirtualRealmServices(realmId);
        
        // 1. Resolve Dynamic Bundles to Uninstall
        const hierarchy = await this._resolveHierarchy(realmId);
        const toUninstall = [];
        const activeBundles = this.context.getBundles();
        
        for (const layer of hierarchy) {
            if (!layer.bundles) continue;
            for (const bundleUrl of layer.bundles) {
                const bsn = await this._getBsn(bundleUrl);
                const normalized = BaseActivator.normalizeBSN(bsn);
                
                // Protected: strictly exclude primordial and manual/inhabitant layer bundles
                if (this._primordialBSNs?.has(normalized)) continue;
                if (this._manualBSNs?.has(normalized)) continue;
                
                const bundle = activeBundles.find(b => {
                    const obsn = b.getSymbolicName();
                    return BaseActivator.normalizeBSN(obsn) === normalized || b.getLocation().includes(bsn);
                });
                if (bundle && !toUninstall.some(b => b.id === bundle.id)) {
                    toUninstall.push(bundle);
                }
            }
        }
        
        // 2. Uninstall Dynamic Bundles
        if (toUninstall.length > 0) {
            this.logger?.info(`[RealmManager] Shutting down: Uninstalling ${toUninstall.length} dynamic bundles...`);
            for (const bundle of toUninstall) {
                try {
                    this.logger?.debug(`[RealmManager] Stopping & Uninstalling bundle: ${bundle.getSymbolicName()}`);
                    const state = bundle.getState();
                    if (state > 1) { // Not UNINSTALLED
                        if (state > 2) { // Installed, Resolved, or Active
                            try { await bundle.stop(); } catch (_e) {}
                        }
                        await bundle.uninstall();
                    }
                } catch (err) {
                    this.logger?.error(`[RealmManager] Failed to uninstall bundle '${bundle.getSymbolicName()}':`, err.message);
                }
            }
        }
        
        // 3. Eject to Platonic Lobby
        this._activeRealmId = 'platonic';
        if (this.session) {
            this.session.activeRealmId = 'platonic';
            
            // Revert activeBeingId to the Grounding Soul ID (tenant in the Platonic stack)
            const globalStack = this.session.scopedUsers?.["platonic"] || {};
            const activeId = globalStack.__activeId__ || 'guest';
            this.session.activeBeingId = activeId;
            
            // Clean up the spatial stack via logout
            this.session.logout(realmId);
            this.session._pendingLobbyFallback = null;
        }
        
        if (this._beingService) {
            this._beingService.clear();
        }
        
        if (this._persistence) {
            await this._persistence.store(REALM_STORAGE_PID, 'platonic');
        }
        
        // Broadcast Realm Change
        if (this._eventAdmin && this._eventFactory) {
            const event = this._eventFactory.build(REALM_CHANGED_TOPIC, {
                "realm.id": 'platonic',
                "realm.title": 'Platonic Lobby',
                "realm.icon": 'fas fa-door-open'
            });
            this._eventAdmin.postEvent(event);
        }
    }

    async _prepareSurgePlan(context, hierarchy) {
        const toInstall = [];
        const toKeep = [];
        const toPurge = [];
        const seenBsn = new Set();
        const activeBundles = context.getBundles();

        // Fallback for headless environments or tests where _recoverState is bypassed
        if (!this._primordialBSNs || this._primordialBSNs.size === 0) {
            this._primordialBSNs = new Set(
                activeBundles.map(b => BaseActivator.normalizeBSN(b.getSymbolicName()))
            );
        }

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
            if (this._primordialBSNs?.has(normalized)) continue; // Dynamic Primordial Plane Protection

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

            // Dynamically register Realm service for virtual realms if not already registered
            const REALM_SERVICE_NAME = "org.neverplayed.realm.Realm";
            if (pt.id && (pt.id.startsWith('being:') || pt.id.startsWith('tenant:'))) {
                if (!this._realmRegs.has(pt.id)) {
                    const reg = this.context.registerService(REALM_SERVICE_NAME, {
                        getId: () => pt.id,
                        getManifest: () => ({ ...pt.manifest }),
                        switch: (interactive = false) => this._switchRealm(this.context, pt.id, interactive)
                    }, {
                        "realm.id": pt.id,
                        "realm.title": pt.manifest?.title || pt.id,
                        "realm.icon": pt.id.startsWith('being:') ? "fas fa-brain" : "fas fa-globe",
                        "realm.active": true
                    });
                    this._realmRegs.set(pt.id, reg);
                }
            }

            // Dynamically provision and register BeingCognitionService / TenantCognitionService
            if (pt.id && pt.id.startsWith('being:')) {
                const beingId = pt.id.substring(6);
                const identity = this.session?.getResolvedIdentity(beingId) || {};
                
                const beingCognition = {
                    predictionError: 0.0,
                    getPredictionError: () => 0.0,
                    getReifiedPids: () => [
                        `being.${beingId}.surrogates`,
                        `being.${beingId}.attributes`,
                        `being.${beingId}.grounding`
                    ],
                    getSurrogates: () => identity.surrogates || {},
                    getAttributes: () => identity.attributes || {},
                    getGrounding: () => identity.grounding || 'idealist'
                };
                
                this._cognitions.set(pt.id, beingCognition);
                
                // Clean up previous registration for this ID
                const oldReg = this._cognitionRegs.get(pt.id);
                if (oldReg) {
                    try { oldReg.unregister(); } catch (_e) {}
                }
                
                const cognitionReg = this.context.registerService("org.neverplayed.realm.BeingCognitionService", beingCognition, {
                    "realm.id": pt.id
                });
                this._cognitionRegs.set(pt.id, cognitionReg);
                this._scheduleHomeostasis();
            } else if (pt.id && pt.id.startsWith('tenant:')) {
                const tenantId = pt.id.substring(7);
                const self = this;
                
                const tenantCognition = {
                    predictionError: 0.0,
                    getPredictionError: () => 0.0,
                    getReifiedPids: () => [
                        `tenant.${tenantId}.realms`,
                        `tenant.${tenantId}.telemetry`
                    ],
                    getRegisteredRealms: () => self.getRealms(),
                    getGlobalTelemetry: () => {
                        const activeBundles = self.context.getBundles().filter(b => b.getState() === 32 || b.getState() === 'ACTIVE').length;
                        const realmsCount = self._realms.size;
                        let usersCount = 0;
                        if (self.session?.scopedUsers) {
                            for (const scope of Object.keys(self.session.scopedUsers)) {
                                if (scope === 'global') continue;
                                const stack = self.session.scopedUsers[scope];
                                for (const [userId, user] of Object.entries(stack)) {
                                    if (userId !== '__activeId__' && userId !== 'guest' && user && user.loggedIn) {
                                        usersCount++;
                                    }
                                }
                            }
                        }
                        return {
                            activeBundles,
                            registeredRealms: realmsCount,
                            activeUsers: usersCount
                        };
                    }
                };
                
                this._cognitions.set(pt.id, tenantCognition);
                
                // Clean up previous registration
                const oldReg = this._cognitionRegs.get(pt.id);
                if (oldReg) {
                    try { oldReg.unregister(); } catch (_e) {}
                }
                
                const cognitionReg = this.context.registerService("org.neverplayed.realm.TenantCognitionService", tenantCognition, {
                    "realm.id": pt.id
                });
                this._cognitionRegs.set(pt.id, cognitionReg);
                this._scheduleHomeostasis();
            }

            // Dynamic Seeding & Purging (OSGi dynamic fragment seeding)
            if (this._beingService) {
                this._beingService.clear();

                if (pt.manifest?.seedData) {
                    this.logger?.info(`[RealmManager] Dynamic Seeding for realm '${pt.id}'...`);
                    const yamlSvc = this._yamlService;
                    if (yamlSvc) {
                        try {
                            const base = globalThis.location.origin + '/';
                            
                            if (pt.manifest.seedData.surrogates) {
                                const surrogatesUrl = new URL(pt.manifest.seedData.surrogates, base).href;
                                this.logger?.debug(`[RealmManager] Fetching surrogates fragment from ${surrogatesUrl}`);
                                const res = await fetch(surrogatesUrl);
                                if (res.ok) {
                                    const text = await res.text();
                                    const surrogates = yamlSvc.load(text) || [];
                                    this._beingService.registerSurrogates(surrogates);
                                    this.logger?.info(`[RealmManager] Seeded ${surrogates.length} surrogates.`);
                                } else {
                                    this.logger?.error(`[RealmManager] Failed to fetch surrogates fragment: HTTP ${res.status}`);
                                }
                            }
                            
                            if (pt.manifest.seedData.beings) {
                                const beingsUrl = new URL(pt.manifest.seedData.beings, base).href;
                                this.logger?.debug(`[RealmManager] Fetching beings fragment from ${beingsUrl}`);
                                const res = await fetch(beingsUrl);
                                if (res.ok) {
                                    const text = await res.text();
                                    const beings = yamlSvc.load(text) || [];
                                    this._beingService.registerBeings(beings);
                                    this.logger?.info(`[RealmManager] Seeded ${beings.length} beings.`);
                                } else {
                                    this.logger?.error(`[RealmManager] Failed to fetch beings fragment: HTTP ${res.status}`);
                                }
                            }
                        } catch (err) {
                            this.logger?.error(`[RealmManager] Dynamic seeding error: ${err.message}`);
                        }
                    } else {
                        this.logger?.warn(`[RealmManager] YAML Service not available. Skipping dynamic seeding.`);
                    }
                }
            }

            this.logger?.info(`Realm Manager: Context Transition Successful. Universe '${pt.id}' is now active. 🌌`);
            
            // Update Service Properties for all Realms
            for (const [id, reg] of this._realmRegs.entries()) {
                const manifest = this._realms.get(id);
                if (manifest) {
                    reg.setProperties({ 
                        "realm.id": id,
                        "realm.title": manifest.title,
                        "realm.icon": manifest.icon || "fas fa-universe",
                        "realm.active": id === pt.id 
                    });
                }
            }

            // OSGi EventAdmin Broadcast
            if (this._eventAdmin && this._eventFactory) {
                this.logger?.info(`[RealmManager] Broadcasting Universe Change: ${pt.id} on topic ${REALM_CHANGED_TOPIC}`);
                const event = this._eventFactory.build(REALM_CHANGED_TOPIC, {
                    "realm.id": pt.id,
                    "realm.title": pt.manifest?.title || pt.id,
                    "realm.icon": pt.manifest?.icon || "fas fa-universe"
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
        if (id && (id.startsWith('being:') || id.startsWith('tenant:'))) {
            return [];
        }
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

    _scheduleHomeostasis() {
        if (this._homeostasisScheduled) return;
        this._homeostasisScheduled = true;
        queueMicrotask(() => this.homeostasisStep());
    }

    async homeostasisStep() {
        this._homeostasisScheduled = false;

        for (const [realmId, cognition] of this._cognitions.entries()) {
            // 1. Epistemic Config Scan
            const pm = this._persistence;
            if (pm && typeof pm.listKeys === 'function') {
                try {
                    if (typeof pm.waitReady === 'function') {
                        try { await pm.waitReady(); } catch (_e) {}
                    }
                    const configKeys = (await pm.listKeys("config.")) || [];
                    cognition.reifiedPids = configKeys.map(key => key.substring(7));
                } catch (err) {
                    this.logger?.error(`Realm Manager: Failed sensing config traces for ${realmId}`, err);
                }
            }

            // 3. Broadcast Completion via custom event
            const detail = { realmId, reifiedPids: cognition.reifiedPids };
            const event = new CustomEvent("realm-homeostasis-completed", { 
                detail,
                bubbles: true,
                cancelable: true
            });
            globalThis.dispatchEvent(event);
        }
    }
}
