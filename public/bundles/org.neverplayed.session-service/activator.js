/**
 * @file Activator for org.neverplayed.session-service
 * @module platform/bundles/org.neverplayed.session-service
 */

import { SESSION_SERVICE, LOG_SERVICE, LICENSE_DATA_SERVICE, REALM_MANAGER_SERVICE, EVENT_ADMIN_SERVICE, EVENT_FACTORY_SERVICE, SESSION_CHANGED_TOPIC } from "../../core-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

const SESSION_PID = "pandino.session.state";

export default class Activator {
    _logger = console;
    _pm = null;
    _pmRank = -1;
    _session = null;
    _initializing = false;
    _eventAdmin = null;
    _eventFactory = null;

    start(context) {
        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Session Service: Connected to Logger.");
                return logAdmin;
            }
        }).open();

        // 3. Track Persistence Manager for state hydration
        context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: (ref) => {
                const rank = ref.getProperty("service.ranking") || 0;
                
                // Rule: If we are already initialized by a high-ranking provider (Selector), ignore lower ones.
                // If we are NOT initialized, or the new provider is significantly better (higher rank), trigger hydration.
                if (!this._initializing || rank > this._pmRank) {
                    this._pm = context.getService(ref);
                    const oldRank = this._pmRank;
                    this._pmRank = rank;
                    
                    if (oldRank !== -1) {
                        this._logger?.info(`Session Service: Upgraded Persistence Manager from Rank [${oldRank}] to [${rank}].`);
                    }
                    
                    this._initializeSession(context);
                }
                return this._pm;
            },
            removedService: () => { this._pm = null; }
        }).open();

        // 3. Track Realm Manager for Context Scoping
        context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._realm = context.getService(ref);
                return this._realm;
            },
            removedService: () => { this._realm = null; }
        }).open();

        // 4. Track Event Admin & Factory
        context.trackService(`(objectClass=${EVENT_ADMIN_SERVICE})`, {
            addingService: (ref) => { 
                this._eventAdmin = context.getService(ref);
                if (this._eventAdmin?.build && !this._eventFactory) {
                    this._eventFactory = this._eventAdmin;
                }
                return this._eventAdmin; 
            },
            removedService: () => { this._eventAdmin = null; }
        }).open();

        context.trackService(`(objectClass=${EVENT_FACTORY_SERVICE})`, {
            addingService: (ref) => { 
                this._eventFactory = context.getService(ref); 
                return this._eventFactory; 
            },
            removedService: () => { this._eventFactory = null; }
        }).open();
    }

    async _initializeSession(context) {
        if (this._session || (this._initializing && this._pmRank >= 1000)) return; 
        
        this._initializing = true;
        this._logger.info(`Session Service: Hydrating state from Persistence Manager [Rank: ${this._pmRank}]...`);
        
        // Wait for PM to be ready (Firebase/FS sync)
        if (this._pm.waitReady) {
            this._logger.info("Session Service: Awaiting PM readiness...");
            await this._pm.waitReady();
        }

        const rawState = this._pm.load(SESSION_PID) || {};
        
        // Residency Grafter: Migrate legacy single-user structure to identity stacks
        const scopedUsers = rawState.scopedUsers || {
            global: { 
                guest: { id: 'guest', attributes: {} },
                __activeId__: 'guest'
            }
        };

        Object.keys(scopedUsers).forEach(scope => {
            const data = scopedUsers[scope];
            // If it doesn't have an __activeId__, it's an old structure
            if (!data.__activeId__) {
                const legacyUser = data;
                const activeId = legacyUser.id || 'guest';
                scopedUsers[scope] = {
                    [activeId]: legacyUser,
                    __activeId__: activeId
                };
            }
        });

        const persistedState = {
            ...rawState,
            scopedUsers
        };

        this._logger.info(`Session Service: DISK-LOAD COMPLETE. Residency Stacks Grafted.`);

        const logger = this._logger;
        const self = this;

        // Create Reactive Session State
        this._session = Alpine.reactive({
            ...persistedState,
            activeFlowId: null, // Volatile
            activeRealmId: null, // Volatile (Pushed from Realm Manager)
            activeBeingId: persistedState.activeBeingId || null,

            get currentUser() {
                const scope = this.activeFlowId || this.activeRealmId || "global";
                const stack = this.scopedUsers[scope] || {};
                const activeId = stack.__activeId__;
                
                let identity = (activeId && activeId !== 'guest') ? stack[activeId] : null;
                
                // 1. Explicit Scope Identity (Surrogate or Local Login)
                if (identity) {
                    return this._materialize(identity);
                }

                // 2. Being Carry-over (The Session Soul)
                if (this.activeBeingId) {
                    const profile = this._findIdentity(this.activeBeingId, scope);
                    if (profile) {
                        return this._materialize({ 
                            ...profile, 
                            isCarried: true, 
                            carriedFrom: profile.scope 
                        });
                    }
                }

                // 3. Fallback to Global Identity
                const globalStack = this.scopedUsers["global"] || {};
                const globalId = globalStack.__activeId__ || 'guest';
                identity = globalStack[globalId] || globalStack['guest'] || { id: 'guest' };

                return this._materialize(identity);
            },

            // Helper: Find an identity profile across any scope
            _findIdentity(id, preferredScope = null) {
                // 1. Try preferred scope first (Inhabitation over Carry-over)
                if (preferredScope && this.scopedUsers[preferredScope]?.[id]) {
                    return { ...this.scopedUsers[preferredScope][id], scope: preferredScope };
                }

                // 2. Try to find a Materialized version anywhere (Persona Carry-over)
                for (const [scope, stack] of Object.entries(this.scopedUsers)) {
                    if (stack[id] && stack[id].activeSurrogateId && stack[id].email) {
                        return { ...stack[id], scope };
                    }
                }

                // 3. Fallback to any other scope (e.g., Global anchor)
                for (const [scope, stack] of Object.entries(this.scopedUsers)) {
                    if (stack[id] && stack[id].email) {
                        return { ...stack[id], scope };
                    }
                }
                return null;
            },

            // Helper: Materialize surrogate if present
            _materialize(identity) {
                if (identity && identity.activeSurrogateId && identity.surrogates?.[identity.activeSurrogateId]) {
                    const surrogate = identity.surrogates[identity.activeSurrogateId];
                    
                    // Diagnostic: Materialization Trace
                    if (identity.id !== 'guest') {
                        logger?.debug(`Session: Materializing '${identity.id}' as '${identity.activeSurrogateId}' (Surrogate Internal ID: ${surrogate.id})`);
                    }

                    return {
                        ...identity,
                        ...surrogate,
                        id: identity.id, // Being ID (L1) must remain the primary identifier
                        surrogateId: surrogate.id, // Functional Role ID (L6)
                        isMaterialized: true
                    };
                }
                return identity;
            },

            setBeingFocus(beingId) {
                this.activeBeingId = beingId;
                logger?.info(`Session: Being focus shifted to '${beingId}'. All realms will now inhabit this identity by default.`);
            },

            login(user, scope = null, surrogate = null) {
                const targetScope = scope || this.activeFlowId || this.activeRealmId || 'global';
                let identity;
                if (typeof user === "string") {
                    // Inheritance Lookup: resolve full profile from existing scopes
                    let existing = null;
                    for (const stack of Object.values(this.scopedUsers || {})) {
                        if (stack[user] && stack[user].email) {
                            existing = stack[user];
                            break;
                        }
                    }
                    identity = existing ? { ...existing } : { id: user, email: `${user}@cli.local` };
                } else {
                    identity = user;
                }
                const identityId = identity.uid || identity.id;

                logger?.info(`Session: LOGIN requested for scope '${targetScope}' (id: ${identityId}${surrogate ? `, surrogate: ${surrogate.id}` : ''})`);

                if (!this.scopedUsers[targetScope]) {
                    this.scopedUsers[targetScope] = { __activeId__: 'guest', guest: { id: 'guest' } };
                }

                // Upsert Identity into Stack
                if (!this.scopedUsers[targetScope][identityId]) {
                    this.scopedUsers[targetScope][identityId] = { 
                        id: identityId, 
                        email: identity.email,
                        firstname: identity.firstname,
                        lastname: identity.lastname,
                        alias: identity.alias,
                        capabilities: identity.capabilities || [],
                        attributes: identity.attributes || {},
                        surrogates: {},
                        activeSurrogateId: null,
                        isTenant: targetScope === 'global'
                    };
                }

                // Rule: Global Anchoring (Ideation: Sovereign Beings)
                // Ensure every identity is known to the global scope for carry-over lookups.
                if (!this.scopedUsers['global'][identityId]) {
                    this.scopedUsers['global'][identityId] = { ...this.scopedUsers[targetScope][identityId] };
                    logger?.debug(`Session: Anchored identity '${identityId}' in global scope.`);
                }

                // Rule: Surrogate Grafting
                if (surrogate && surrogate.id) {
                    const sId = surrogate.id;
                    this.scopedUsers[targetScope][identityId].surrogates[sId] = {
                        ...surrogate,
                        materializedAt: new Date().toISOString()
                    };
                    this.scopedUsers[targetScope][identityId].activeSurrogateId = sId;
                    logger?.info(`Session: Materialized surrogate '${sId}' for identity '${identityId}'`);
                }

                // Pivot Active Resident
                this.scopedUsers[targetScope].__activeId__ = identityId;
                
                // Rule: Being Gravity (Ideation: Sovereign Beings)
                // If logging into a non-global scope with a real identity, establish as Being Focus.
                if (targetScope !== 'global' && identityId !== 'guest') {
                    if (!this.activeBeingId || this.activeBeingId !== identityId) {
                        this.setBeingFocus(identityId);
                    }
                }

                if (self._eventAdmin && self._eventFactory) {
                    const evt = self._eventFactory.build(SESSION_CHANGED_TOPIC, { 
                        type: 'login', 
                        user: this.currentUser,
                        scope: targetScope, 
                        surrogate 
                    });
                    self._eventAdmin.postEvent(evt);
                } else {
                    logger?.warn("Session: Cannot broadcast login, EventAdmin not ready.");
                }
            },

            activateSurrogate(surrogateId, scope = null) {
                const targetScope = scope || this.activeFlowId || this.activeRealmId || 'global';
                const stack = this.scopedUsers[targetScope];
                if (!stack) return;

                const activeId = stack.__activeId__;
                if (stack[activeId] && stack[activeId].surrogates?.[surrogateId]) {
                    stack[activeId].activeSurrogateId = surrogateId;
                    logger?.info(`Session: Switched to surrogate '${surrogateId}' for identity '${activeId}' in scope '${targetScope}'`);
                }
            },

            logout(scope = null) {
                const activeScope = this.activeFlowId || this.activeRealmId;
                const targetScope = scope || activeScope || 'global';
                
                logger?.info(`Session: LOGOUT (Exit Resident) requested for scope '${targetScope}'`);
                
                if (this.scopedUsers[targetScope]) {
                    this.scopedUsers[targetScope].__activeId__ = 'guest';
                }

                // Rule: Being Dissolution
                // If exiting a non-global scope, or if explicitly requested for global, clear the focus.
                if (targetScope !== 'global' || scope === 'global') {
                    this.activeBeingId = null;
                    logger?.info(`Session: Being focus dissolved.`);
                }

                logger?.info(`Session: Coordinate [${targetScope}] now inhabited by guest.`);
                if (self._eventAdmin && self._eventFactory) {
                    const evt = self._eventFactory.build(SESSION_CHANGED_TOPIC, { 
                        type: 'logout', 
                        scope: targetScope 
                    });
                    self._eventAdmin.postEvent(evt);
                } else {
                    logger?.warn("Session: Cannot broadcast logout, EventAdmin not ready.");
                }
            },

            shiftGrounding(targetGrounding, scope = null) {
                const targetScope = scope || this.activeFlowId || this.activeRealmId || 'global';
                const user = this.currentUser;
                if (!user || user.id === 'guest') {
                    logger?.warn("Session: Cannot shift grounding for guest or inactive user.");
                    return;
                }

                const currentSurrogateId = user.surrogateId || 'person';
                const currentSenses = user.senses || [];
                
                // Strip out any previously applied perceptual senses
                const baseSenses = currentSenses.filter(s => 
                    !["IdealistVision", "ForensicVision", "ArchitectControl"].includes(s)
                );
                
                const newSenses = targetGrounding === 'idealist' 
                    ? ["IdealistVision"] 
                    : ["IdealistVision", "ForensicVision", "ArchitectControl"];

                const surrogate = {
                    id: currentSurrogateId,
                    grounding: targetGrounding,
                    label: targetGrounding === 'idealist' ? "Idealist Mode" : "Realist Mode",
                    senses: [...baseSenses, ...newSenses]
                };

                this.login(user.id, targetScope, surrogate);
            },

            _generateBootstrapCode() {
                const genBlock = () => Math.random().toString(36).substring(2, 6).toUpperCase();
                return `${genBlock()}-${genBlock()}-${genBlock()}-${genBlock()}`;
            },

            closeBootstrapModal() {
                this.bootstrapCodeModal.show = false;
                this.logout(); // Recursively call now that modal is closed
            },

            registerIdentities(identities) {
                if (!Array.isArray(identities)) return;
                if (!this.scopedUsers || !this.scopedUsers['global']) {
                    logger?.warn("Session: Cannot register identities yet, residency stacks not initialized.");
                    return;
                }
                identities.forEach(idnt => {
                    const id = idnt.id;
                    const homeRealm = idnt.initial?.realm || idnt.homeRealm || 'global';

                    // 1. Global Anchoring
                    if (!this.scopedUsers['global'][id]) {
                        this.scopedUsers['global'][id] = {
                            id,
                            email: idnt.email || `${id}@cli.local`,
                            firstname: idnt.firstname || idnt.label,
                            lastname: idnt.lastname,
                            alias: idnt.label || idnt.alias,
                            attributes: idnt.attributes || {},
                            capabilities: idnt.capabilities || [],
                            surrogates: {},
                            activeSurrogateId: null,
                            isTenant: false
                        };
                        logger?.info(`Session: Registered identity '${id}' in global stack.`);
                    }

                    // 2. Realm Inhabitation (for shell visibility)
                    if (homeRealm !== 'global') {
                        if (!this.scopedUsers[homeRealm]) {
                            this.scopedUsers[homeRealm] = { __activeId__: 'guest', guest: { id: 'guest' } };
                        }
                        if (!this.scopedUsers[homeRealm][id]) {
                            const userObj = { ...this.scopedUsers['global'][id], isTenant: false };
                            
                            // Rule: Initial Surrogate Provisioning (L6)
                            const initialSurrogateId = idnt.initial?.surrogate;
                            const initialSurrogateData = idnt.initial?.surrogateData || {};
                            if (initialSurrogateId) {
                                userObj.surrogates[initialSurrogateId] = {
                                    id: initialSurrogateId,
                                    ...initialSurrogateData,
                                    materializedAt: new Date().toISOString()
                                };
                                userObj.activeSurrogateId = initialSurrogateId;
                                logger?.info(`Session: Provisioned initial surrogate '${initialSurrogateId}' for identity '${id}' in realm '${homeRealm}'.`);
                            }

                            this.scopedUsers[homeRealm][id] = userObj;
                            logger?.info(`Session: Inhabited identity '${id}' in home realm '${homeRealm}'.`);
                        }
                    }
                });
            },

            promoteUser(user) {
                if (user && user.isSuperuser) {
                    logger?.info("Session: PROMOTE requested for superuser", user.email);
                    this.scopedUsers["backoffice-web"] = {
                        id: "dd",
                        firstname: "Daniel Daniela",
                        lastname: "(Admin)",
                        capabilities: ["superuser", "admin"]
                    };
                    this.scopedUsers["global"] = this.scopedUsers["backoffice-web"];
                }
            }
        });

        // Rule: Mutation Forensic Guard (SDN-0165)
        // Watch for direct mutations from other bundles (Auth Shield, Realm Manager)
        Alpine.effect(() => {
            const users = JSON.parse(JSON.stringify(this._session.scopedUsers || {}));
            Object.entries(users).forEach(([scope, data]) => {
                const lastId = this._lastSeenIds?.[scope];
                if (data.id !== lastId) {
                    this._logger.info(`Session: Direct Mutation Detected -> Scope [${scope}] shift: ${lastId || 'none'} -> ${data.id}`);
                    if (!this._lastSeenIds) this._lastSeenIds = {};
                    this._lastSeenIds[scope] = data.id;
                }
            });
        });

        // Register the Service
        context.registerService(SESSION_SERVICE, this._session);
        this._logger.info("Session Service: Registered 🛡️✨");

        // Set up Persistence Sync
        Alpine.effect(async () => {
            if (this._pm && this._session) {
                // Resolve Tenant from Global Stack
                const globalStack = this._session.scopedUsers?.["global"] || {};
                const globalUser = globalStack[globalStack.__activeId__] || globalStack['guest'];
                const tenantId = (globalUser && globalUser.id !== 'guest') ? globalUser.id : "guest";
                
                // Identity (SID) is the currently active user
                const currentUser = this._session.currentUser;
                const identityId = (currentUser && currentUser.id !== 'guest') ? currentUser.id : tenantId;
                
                const ctx = {
                    tenantId,
                    identityId,
                    realmId: this._session.activeRealmId || "unknown",
                    tier: "local"
                };
                
                if (typeof this._pm.setContext === 'function') {
                    this._logger?.info(`Session: Syncing Persistence Context -> Tenant: ${tenantId}, Realm: ${ctx.realmId}, Identity: ${identityId}, Tier: ${ctx.tier}`);
                    await this._pm.setContext(ctx);
                }

                // Identity Purity Sink: Iterate through stacks and sanitize guests
                const raw = JSON.parse(JSON.stringify(this._session));
                if (raw.scopedUsers) {
                    Object.values(raw.scopedUsers).forEach(stack => {
                        Object.entries(stack).forEach(([id, user]) => {
                            if (id === 'guest' || id === '__activeId__') {
                                if (user && typeof user === 'object') {
                                    delete user.email;
                                    delete user.alias;
                                    delete user.firstname;
                                    delete user.lastname;
                                    delete user.avatar;
                                }
                            }
                        });
                    });
                }
                
                this._logger?.info(`Session: Persisting state [${SESSION_PID}] to tier...`);
                this._pm.store(SESSION_PID, raw);
            }
        });
    }

    stop() {
        this._logger.info("Session Service: Stopped.");
    }
}
