/**
 * @file Activator for org.neverplayed.session-service
 * @module platform/bundles/org.neverplayed.session-service
 */

import { SESSION_SERVICE, LOG_SERVICE, LICENSE_DATA_SERVICE as _LICENSE_DATA_SERVICE, REALM_MANAGER_SERVICE, EVENT_ADMIN_SERVICE, EVENT_FACTORY_SERVICE, SESSION_CHANGED_TOPIC, TRANSITION_PARTICIPANT_INTERFACE, PERSISTENCE_CONTEXT_CHANGED_TOPIC, CONFIG_ADMIN_SERVICE, EVENT_HANDLER_INTERFACE, SESSION_SERVICE_PID } from "../../core-types.js";
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
    _configAdmin = null;

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

        // 5. Track Config Admin for attention span configuration
        context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                this._configAdmin = context.getService(ref);
                this._updateAttentionSpan();
                return this._configAdmin;
            },
            removedService: () => {
                this._configAdmin = null;
            }
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
        const scopedUsers = rawState.scopedUsers || {};
        
        if (!scopedUsers.platonic) {
            scopedUsers.platonic = {
                guest: { id: 'guest', attributes: {} },
                __activeId__: 'guest'
            };
        }

        Object.keys(scopedUsers).forEach(scope => {
            if (scope === 'global') return;
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
            // Sync/repair the loggedIn flag based on __activeId__
            const activeId = scopedUsers[scope].__activeId__;
            Object.keys(scopedUsers[scope]).forEach(key => {
                if (key !== 'guest' && key !== '__activeId__') {
                    scopedUsers[scope][key].loggedIn = (key === activeId);
                }
            });
        });

        const persistedState = {
            ...rawState,
            scopedUsers
        };

        this._logger.info(`Session Service: DISK-LOAD COMPLETE. Residency Stacks Grafted.`);

        const logger = this._logger;
        // deno-lint-ignore no-this-alias
        const self = this;

        // Create Reactive Session State
        this._session = Alpine.reactive({
            ...persistedState,
            activeFlowId: null, // Volatile
            activeRealmId: null, // Volatile (Pushed from Realm Manager)
            activeBeingId: persistedState.activeBeingId || null,
            attentionSpanMs: 30000,
            _homeostasisScheduled: false,
            _cachedUser: null,
            _cacheDirty: true,
            _lastInteractionTime: 0,
            _scheduleHomeostasis() {
                if (this._homeostasisScheduled) return;
                this._homeostasisScheduled = true;
                queueMicrotask(() => this.homeostasisStep());
            },
            homeostasisStep() {
                this._homeostasisScheduled = false;
                const now = Date.now();
                for (const [scope, stack] of Object.entries(this.scopedUsers || {})) {
                    if (scope === 'platonic' || scope === 'global') continue;
                    for (const [userId, user] of Object.entries(stack)) {
                        if (userId === '__activeId__' || userId === 'guest') continue;
                        if (user && user.loggedIn) {
                            const lastActive = user.lastActiveTime || 0;
                            if (now - lastActive > (this.attentionSpanMs || 30000)) {
                                logger?.info(`Session: Homeostasis evicting stale occupant '${userId}' in scope '${scope}' due to attention exhaustion.`);
                                this.logout(scope, userId);
                                if (this.activeRealmId === scope) {
                                    this.activeRealmId = 'platonic';
                                    logger?.info(`Session: Reverted active realm to 'platonic' for evicted user '${userId}'.`);
                                    if (self._realm && typeof self._realm.switchRealm === 'function') {
                                        self._realm.switchRealm('platonic').catch(err => {
                                            logger?.error(`Session: Failed transitioning RealmManager back to platonic:`, err);
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            },

            get currentUser() {
                if (typeof globalThis.Deno === 'undefined' && !this._cacheDirty && this._cachedUser) {
                    return this._cachedUser;
                }

                let scope = this.activeFlowId || this.activeRealmId || "platonic";
                if (scope === "global") scope = "platonic";
                const stack = this.scopedUsers[scope] || {};
                const activeId = stack.__activeId__;
                
                let identity = (activeId && activeId !== 'guest') ? stack[activeId] : null;
                let rawUser = null;
                
                // 1. Explicit Scope Identity (Surrogate or Local Login)
                if (identity) {
                    rawUser = this._materialize(identity);
                } else if (this.activeBeingId) {
                    // 2. Being Carry-over (The Session Soul)
                    const profile = this._findIdentity(this.activeBeingId, scope);
                    if (profile) {
                        rawUser = this._materialize({ 
                            ...profile, 
                            isCarried: true, 
                            carriedFrom: profile.scope 
                        });
                    }
                }

                if (!rawUser) {
                    // 3. Fallback to Global Identity (Platonic)
                    const globalStack = this.scopedUsers["platonic"] || {};
                    const globalId = globalStack.__activeId__ || 'guest';
                    identity = globalStack[globalId] || globalStack['guest'] || { id: 'guest' };
                    rawUser = this._materialize(identity);
                }

                this._cachedUser = rawUser;
                this._cacheDirty = false;
                return rawUser;
            },

            // Helper: Find an identity profile across any scope
            _findIdentity(id, preferredScope = null) {
                let prefScope = preferredScope;
                if (prefScope === 'global') prefScope = 'platonic';
                
                let lookupId = id;
                if (id && (id.startsWith('being:') || id.startsWith('realm:'))) {
                    lookupId = id.substring(id.indexOf(':') + 1);
                }

                // 1. Try preferred scope first (Inhabitation over Carry-over)
                if (prefScope && this.scopedUsers[prefScope]?.[lookupId]) {
                    return { ...this.scopedUsers[prefScope][lookupId], scope: prefScope };
                }

                // 2. Try to find a Materialized version anywhere (Persona Carry-over)
                for (const [scope, stack] of Object.entries(this.scopedUsers)) {
                    if (scope === 'global') continue;
                    if (stack[lookupId] && stack[lookupId].activeSurrogateId && stack[lookupId].email) {
                        return { ...stack[lookupId], scope };
                    }
                }

                // 3. Fallback to any other scope (e.g., Global/Platonic anchor)
                for (const [scope, stack] of Object.entries(this.scopedUsers)) {
                    if (scope === 'global') continue;
                    if (stack[lookupId] && stack[lookupId].email) {
                        return { ...stack[lookupId], scope };
                    }
                }
                return null;
            },

            // Helper: Materialize surrogate if present
            _materialize(identity) {
                if (!identity) return identity;
                const base = {
                    ...identity,
                    grounding: identity.grounding || 'idealist'
                };
                if (identity.activeSurrogateId && identity.surrogates?.[identity.activeSurrogateId]) {
                    const surrogate = identity.surrogates[identity.activeSurrogateId];
                    
                    // Diagnostic: Materialization Trace
                    if (identity.id !== 'guest') {
                        logger?.debug(`Session: Materializing '${identity.id}' as '${identity.activeSurrogateId}' (Surrogate Internal ID: ${surrogate.id})`);
                    }

                    return {
                        ...base,
                        ...surrogate,
                        id: identity.id, // Being ID (L1) must remain the primary identifier
                        surrogateId: surrogate.id, // Functional Role ID (L6)
                        isMaterialized: true,
                        grounding: identity.grounding || surrogate.grounding || 'idealist'
                    };
                }
                return base;
            },

            getResolvedIdentity(beingId) {
                return this._findIdentity(beingId);
            },

            setBeingFocus(beingId) {
                this._cacheDirty = true;
                // Rule 1: Lock Grounding Soul
                const baseBeingId = beingId && (beingId.startsWith('being:') || beingId.startsWith('realm:')) ? beingId.substring(beingId.indexOf(':') + 1) : beingId;
                const baseActiveBeingId = this.activeBeingId && (this.activeBeingId.startsWith('being:') || this.activeBeingId.startsWith('realm:')) ? this.activeBeingId.substring(this.activeBeingId.indexOf(':') + 1) : this.activeBeingId;

                let shouldBlock = false;
                if (this.activeBeingId && this.activeBeingId !== 'guest' && baseActiveBeingId !== baseBeingId) {
                    const currentPlatonicUser = this.scopedUsers['platonic']?.[baseActiveBeingId];
                    if (currentPlatonicUser && currentPlatonicUser.isTenant && !beingId.startsWith('realm:')) {
                        shouldBlock = true;
                    }
                }

                if (shouldBlock) {
                    logger?.warn(`Session: Being focus is locked to Grounding Soul '${this.activeBeingId}' and cannot be shifted to '${beingId}'.`);
                    return;
                }

                this.activeBeingId = beingId;
                logger?.info(`Session: Being focus shifted to '${beingId}'. All realms will now inhabit this identity by default.`);
            },

            login(user, scope = null, surrogate = undefined) {
                this._cacheDirty = true;
                this._pendingLobbyFallback = null;
                let targetScope = scope || this.activeFlowId || this.activeRealmId || 'platonic';
                if (targetScope === 'global') targetScope = 'platonic';

                const originalIdentityId = (typeof user === "string") ? user : (user.uid || user.id);
                let resolvedIdentityId = originalIdentityId;
                let isShunt = false;

                if (targetScope !== 'platonic' && (originalIdentityId.startsWith('being:') || originalIdentityId.startsWith('realm:'))) {
                    isShunt = true;
                    resolvedIdentityId = originalIdentityId.substring(originalIdentityId.indexOf(':') + 1);
                }

                let identity;
                if (typeof user === "string") {
                    // Inheritance Lookup: resolve full profile from existing scopes using resolvedIdentityId
                    let existing = null;
                    for (const stack of Object.values(this.scopedUsers || {})) {
                        if (stack[resolvedIdentityId] && stack[resolvedIdentityId].email) {
                            existing = stack[resolvedIdentityId];
                            break;
                        }
                    }
                    identity = existing ? { ...existing } : { id: resolvedIdentityId, email: `${resolvedIdentityId}@cli.local` };
                } else {
                    identity = { ...user, id: resolvedIdentityId };
                }
                const identityId = identity.uid || identity.id;
                this._isShunt = isShunt;
                this._originalIdentityId = originalIdentityId;

                // Rule 2 (Primordial Exclusivity):
                if (targetScope === 'platonic' && identityId !== 'guest') {
                    if (this.activeBeingId && this.activeBeingId !== 'guest' && this.activeBeingId !== identityId) {
                        const currentPlatonicUser = this.scopedUsers['platonic']?.[this.activeBeingId];
                        const isCurrentTenant = currentPlatonicUser && currentPlatonicUser.isTenant;
                        if (!isCurrentTenant) {
                            logger?.info(`Session: Overriding stale/invalid Grounding Soul '${this.activeBeingId}' with true tenant '${identityId}'`);
                            this.activeBeingId = identityId;
                        } else {
                            throw new Error(`Ontological Violation: Only the Grounding Soul (${this.activeBeingId}) can inhabit the Platonic Staging Lobby. Other identities must be impersonated inside spatial realms.`);
                        }
                    }
                }

                // Objective 1: Surrogate Carry-over (Traveler's Clothing)
                if (surrogate === undefined && targetScope !== 'platonic' && identityId !== 'guest') {
                    const realms = self._realm ? self._realm.getRealms() : [];
                    const targetRealm = realms.find(r => r.id === targetScope);
                    const recognized = targetRealm?.recognizedSurrogates || [];
                    const userProfile = this._findIdentity(identityId);
                    
                    if (userProfile) {
                        const surrogates = userProfile.surrogates || {};
                        const currentActiveId = userProfile.activeSurrogateId;
                        
                        if (currentActiveId && recognized.includes(currentActiveId) && surrogates[currentActiveId]) {
                            surrogate = surrogates[currentActiveId];
                            logger?.info(`Session: Carry-over recognized active surrogate '${currentActiveId}' for '${identityId}'`);
                        } else {
                            const availableId = recognized.find(sId => surrogates[sId]);
                            if (availableId) {
                                surrogate = surrogates[availableId];
                                logger?.info(`Session: Auto-materializing recognized surrogate '${availableId}' for '${identityId}'`);
                            } else {
                                surrogate = null;
                                logger?.info(`Session: Being '${identityId}' will transition into scope '${targetScope}' as a naked observer (no recognized surrogates).`);
                            }
                        }
                    } else {
                        surrogate = null;
                    }
                }

                logger?.info(`Session: LOGIN requested for scope '${targetScope}' (id: ${identityId}${surrogate ? `, surrogate: ${surrogate.id}` : ''})`);

                if (!this.scopedUsers[targetScope]) {
                    this.scopedUsers[targetScope] = { __activeId__: 'guest', guest: { id: 'guest' } };
                }

                // Resolve root grounding to preserve/upsert
                const resolvedGrounding = (this.scopedUsers[targetScope][identityId] ? this.scopedUsers[targetScope][identityId].grounding : null) || identity.grounding || 'idealist';

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
                        originRealmId: identity.originRealmId || identity.initial?.originRealmId || identity.initial?.realm || identity.homeRealm || 'platonic',
                        surrogates: identity.surrogates ? { ...identity.surrogates } : {},
                        activeSurrogateId: null,
                        isTenant: targetScope === 'platonic',
                        loggedIn: true,
                        grounding: resolvedGrounding,
                        lastActiveTime: Date.now()
                    };
                } else {
                    this.scopedUsers[targetScope][identityId].loggedIn = true;
                    this.scopedUsers[targetScope][identityId].grounding = resolvedGrounding;
                    this.scopedUsers[targetScope][identityId].lastActiveTime = Date.now();
                    if (!this.scopedUsers[targetScope][identityId].originRealmId) {
                        this.scopedUsers[targetScope][identityId].originRealmId = identity.originRealmId || identity.initial?.originRealmId || identity.initial?.realm || identity.homeRealm || 'platonic';
                    }
                }



                // Rule: Surrogate Grafting / Deactivation
                if (surrogate && surrogate.id) {
                    const sId = surrogate.id;
                    this.scopedUsers[targetScope][identityId].surrogates[sId] = {
                        ...surrogate,
                        materializedAt: new Date().toISOString()
                    };
                    this.scopedUsers[targetScope][identityId].activeSurrogateId = sId;
                    if (surrogate.grounding) {
                        this.scopedUsers[targetScope][identityId].grounding = surrogate.grounding;
                    }
                    logger?.info(`Session: Materialized surrogate '${sId}' for identity '${identityId}'`);
                } else if (surrogate === null) {
                    this.scopedUsers[targetScope][identityId].activeSurrogateId = null;
                    logger?.info(`Session: Deactivated surrogate (naked observer state) for identity '${identityId}'`);
                    if (targetScope !== 'platonic' && identityId !== 'guest') {
                        const existing = this.scopedUsers[targetScope]?.[identityId];
                        if (existing && (!existing.surrogates || Object.keys(existing.surrogates).length === 0)) {
                            const realms = self._realm ? self._realm.getRealms() : [];
                            const targetRealm = realms.find(r => r.id === targetScope);
                            const recognized = targetRealm?.recognizedSurrogates || [];
                            if (recognized.includes('observer')) {
                                existing.surrogates = existing.surrogates || {};
                                existing.surrogates['observer'] = {
                                    id: 'observer',
                                    label: 'Observer',
                                    senses: ['Primordial', 'Language'],
                                    materializedAt: new Date().toISOString()
                                };
                                existing.activeSurrogateId = 'observer';
                                logger?.info(`Session: Auto-provisioned fallback observer surrogate for dynamic identity '${identityId}' in scope '${targetScope}' during naked observer transition.`);
                            }
                        }
                    }
                } else if (targetScope === 'platonic') {
                    // Rule: Platonic Lobby Observer Provisioning
                    // When entering the platonic staging lobby with no explicit surrogate,
                    // auto-graft the default observer surrogate so it is available for
                    // subsequent realm entry checks (recognizedSurrogates matching).
                    const existing = this.scopedUsers[targetScope][identityId];
                    if (existing && !existing.surrogates?.['observer']) {
                        existing.surrogates = existing.surrogates || {};
                        existing.surrogates['observer'] = {
                            id: 'observer',
                            label: 'Observer',
                            senses: ['Primordial', 'Language'],
                            materializedAt: new Date().toISOString()
                        };
                        existing.activeSurrogateId = 'observer';
                        logger?.info(`Session: Auto-provisioned observer surrogate in platonic lobby for '${identityId}'.`);
                    }
                } else if (targetScope !== 'platonic' && identityId !== 'guest') {
                    const existing = this.scopedUsers[targetScope]?.[identityId];
                    if (existing && (!existing.surrogates || Object.keys(existing.surrogates).length === 0)) {
                        const realms = self._realm ? self._realm.getRealms() : [];
                        const targetRealm = realms.find(r => r.id === targetScope);
                        const recognized = targetRealm?.recognizedSurrogates || [];
                        if (recognized.includes('observer')) {
                            existing.surrogates = existing.surrogates || {};
                            existing.surrogates['observer'] = {
                                id: 'observer',
                                label: 'Observer',
                                senses: ['Primordial', 'Language'],
                                materializedAt: new Date().toISOString()
                            };
                            existing.activeSurrogateId = 'observer';
                            logger?.info(`Session: Auto-provisioned fallback observer surrogate for dynamic identity '${identityId}' in scope '${targetScope}'.`);
                        }
                    }
                }

                if (targetScope !== 'platonic' && identityId !== 'guest') {
                    if (this._isShunt) {
                        this.setBeingFocus(this._originalIdentityId);
                    }
                }

                // Pivot Active Resident
                this.scopedUsers[targetScope].__activeId__ = identityId;
                
                // Rule: Being Gravity & locking Grounding Soul (Rule 1)
                if (targetScope === 'platonic' && identityId !== 'guest') {
                    this.scopedUsers['platonic'].__activeId__ = identityId;
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
                this._scheduleHomeostasis();
            },

            activateSurrogate(surrogateId, scope = null) {
                this._cacheDirty = true;
                const targetScope = scope || this.activeFlowId || this.activeRealmId || 'global';
                const stack = this.scopedUsers[targetScope];
                if (!stack) return;

                const activeId = stack.__activeId__;
                if (stack[activeId] && stack[activeId].surrogates?.[surrogateId]) {
                    stack[activeId].activeSurrogateId = surrogateId;
                    logger?.info(`Session: Switched to surrogate '${surrogateId}' for identity '${activeId}' in scope '${targetScope}'`);
                }
            },

            logout(scope = null, userId = null) {
                this._cacheDirty = true;
                const activeScope = this.activeFlowId || this.activeRealmId;
                let targetScope = scope || activeScope || 'platonic';
                if (targetScope === 'global') targetScope = 'platonic';
                
                logger?.info(`Session: LOGOUT (Exit Resident) requested for scope '${targetScope}'${userId ? ` for user '${userId}'` : ''}`);
                
                if (targetScope === 'platonic') {
                    logger?.info("Dissolving the primordium. Triggering total system reset...");
                    try {
                        localStorage.clear();
                    } catch (_e) { /* ignore */ }
                    
                    if (this._pm && typeof this._pm.clear === 'function') {
                        try {
                            this._pm.clear({ global: true });
                        } catch (_e) { /* ignore */ }
                    }
                    
                    if (typeof globalThis.location?.reload === 'function') {
                        globalThis.location.reload();
                        return;
                    } else {
                        throw new Error("GenesisInterrupt");
                    }
                }

                if (this.scopedUsers[targetScope]) {
                    const stack = this.scopedUsers[targetScope];
                    const resolvedUserId = userId || stack.__activeId__;
                    
                    if (resolvedUserId && resolvedUserId !== 'guest' && stack[resolvedUserId]) {
                        stack[resolvedUserId].loggedIn = false;
                    }
                    if (stack.__activeId__ === resolvedUserId) {
                        stack.__activeId__ = 'guest';
                    }

                    // Rule: Lobby Fallback (replaces Being Dissolution)
                    // Logging out of a spatial realm scope returns the being to the platonic lobby.
                    // Only a global logout (e.g. Firebase sign-out) fully dissolves the being focus.
                    if (targetScope !== 'platonic') {
                        if (resolvedUserId && resolvedUserId !== 'guest' && stack[resolvedUserId]) {
                            stack[resolvedUserId].activeSurrogateId = null;
                        }
                        logger?.info(`Session: Realm exit from '${targetScope}'. Being '${resolvedUserId}' falls back to platonic lobby.`);
                        if (resolvedUserId && resolvedUserId !== 'guest') {
                            this._pendingLobbyFallback = resolvedUserId;
                        }
                        
                        // Revert active spatial realm scope to Platonic Staging Lobby
                        if (targetScope === this.activeRealmId) {
                            this.activeRealmId = 'platonic';
                            logger?.info(`Session: Reverted active realm to 'platonic' for user '${resolvedUserId}'.`);
                            if (self._realm && typeof self._realm.switchRealm === 'function') {
                                self._realm.switchRealm('platonic').catch(err => {
                                    logger?.error(`Session: Failed transitioning RealmManager back to platonic:`, err);
                                });
                            }
                        }
                    }
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
                this._scheduleHomeostasis();
            },

            shiftGrounding(targetGrounding, scope = null) {
                this._cacheDirty = true;
                let targetScope = scope || this.activeRealmId || 'platonic';
                if (targetScope === 'global') targetScope = 'platonic';
                const user = this.currentUser;
                if (!user || user.id === 'guest') {
                    logger?.warn("Session: Cannot shift grounding for guest or inactive user.");
                    return;
                }

                // 1. Update root grounding globally in all scopes for this user
                for (const sc of Object.keys(this.scopedUsers)) {
                    if (this.scopedUsers[sc]?.[user.id]) {
                        this.scopedUsers[sc][user.id].grounding = targetGrounding;
                    }
                }

                // 2. Fetch current surrogate ID to decide how to login.
                const activeSurrogateId = this.scopedUsers[targetScope]?.[user.id]?.activeSurrogateId;
                
                let surrogate = null;
                if (activeSurrogateId) {
                    const rawSurrogate = this.scopedUsers[targetScope][user.id].surrogates[activeSurrogateId];
                    const currentSenses = rawSurrogate?.senses || [];
                    const baseSenses = currentSenses.filter(s => 
                        !["IdealistVision", "ForensicVision", "ArchitectControl"].includes(s)
                    );
                    surrogate = {
                        ...rawSurrogate,
                        id: activeSurrogateId,
                        grounding: targetGrounding,
                        label: targetGrounding === 'idealist' ? "Idealist Mode" : "Realist Mode",
                        senses: baseSenses
                    };
                }

                this.login(user.id, targetScope, surrogate);
            },

            registerInteraction() {
                const now = Date.now();
                const currentRealm = this.activeRealmId || 'platonic';
                const currentUserId = this.currentUser?.id;

                // 1Hz Cooldown Throttle Guard at the core source of truth
                if (now - this._lastInteractionTime < 1000) {
                    return;
                }
                this._lastInteractionTime = now;

                // 0. Update the active Being's own attention span (Actor Reset to 100% in all active/source residency stacks)
                if (currentUserId && currentUserId !== 'guest') {
                    for (const scope of Object.keys(this.scopedUsers || {})) {
                        const actor = this.scopedUsers[scope]?.[currentUserId];
                        if (actor) {
                            actor.lastActiveTime = now;
                        }
                    }
                    // High-level Presence Heartbeat log (throttled naturally to interaction frequency)
                    logger?.info(`Session: Active Being '${currentUserId}' presence detected. Attention span refreshed to 100%.`);
                }

                // 1. Stigmergic Sensation Resonance
                if (currentRealm && currentRealm !== 'platonic') {
                    const stack = this.scopedUsers[currentRealm] || {};
                    
                    for (const [userId, user] of Object.entries(stack)) {
                        if (userId === '__activeId__' || userId === 'guest' || userId === currentUserId) continue;
                        if (user && user.loggedIn) {
                            // Ontological Sense Constraint: Sensed by compatible senses
                            const activeSurrogateId = user.activeSurrogateId;
                            const activeSurrogate = user.surrogates?.[activeSurrogateId];
                            const senses = activeSurrogate?.senses || ['Primordial', 'Language']; // fallback
                            
                            if (senses.includes('Language') || senses.includes('ToolUse') || senses.includes('Primordial')) {
                                // Boost attention span by 40% of maximum attention span, capped at 60% of maximum remaining attention (to ensure occupants decay quicker than the active Being)
                                const boostAmount = (this.attentionSpanMs || 30000) * 0.4;
                                const maxCap = now - (this.attentionSpanMs || 30000) * 0.4;
                                const potentialTime = (user.lastActiveTime || 0) + boostAmount;
                                user.lastActiveTime = Math.max(user.lastActiveTime || 0, Math.min(maxCap, potentialTime));
                                logger?.debug(`Session: Stigmergic coupling boosted attention for occupant '${userId}' in scope '${currentRealm}' by ${boostAmount}ms (capped at 60% remaining).`);
                            }
                        }
                    }
                }
                
                // 2. Schedule L1 Homeostasis step
                this._scheduleHomeostasis();
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
                this._cacheDirty = true;
                if (!Array.isArray(identities)) return;
                if (!this.scopedUsers || !this.scopedUsers['platonic']) {
                    logger?.warn("Session: Cannot register identities yet, residency stacks not initialized.");
                    return;
                }
                identities.forEach(idnt => {
                    const id = idnt.id;
                    let homeRealm = idnt.originRealmId || idnt.initial?.originRealmId || idnt.initial?.realm || idnt.homeRealm || 'platonic';
                    if (homeRealm === 'global') homeRealm = 'platonic';

                    // 1. Global/Platonic Anchoring (Only for true Platonic staging lobby residents)
                    if (homeRealm === 'platonic') {
                        if (!this.scopedUsers['platonic'][id]) {
                            this.scopedUsers['platonic'][id] = {
                                id,
                                email: idnt.email || `${id}@cli.local`,
                                firstname: idnt.firstname || idnt.label,
                                lastname: idnt.lastname,
                                alias: idnt.label || idnt.alias,
                                attributes: idnt.attributes || {},
                                capabilities: idnt.capabilities || [],
                                originRealmId: homeRealm,
                                surrogates: {},
                                activeSurrogateId: null,
                                isTenant: true,
                                loggedIn: false,
                                lastActiveTime: Date.now()
                            };
                            logger?.info(`Session: Registered identity '${id}' in platonic stack.`);
                        }
                    }

                    // 2. Realm Inhabitation (for spatial worlds)
                    if (homeRealm !== 'platonic') {
                        if (!this.scopedUsers[homeRealm]) {
                            this.scopedUsers[homeRealm] = { __activeId__: 'guest', guest: { id: 'guest' } };
                        }
                        if (!this.scopedUsers[homeRealm][id]) {
                            const userObj = {
                                id,
                                email: idnt.email || `${id}@cli.local`,
                                firstname: idnt.firstname || idnt.label,
                                lastname: idnt.lastname,
                                alias: idnt.label || idnt.alias,
                                attributes: idnt.attributes || {},
                                capabilities: idnt.capabilities || [],
                                originRealmId: homeRealm,
                                surrogates: {},
                                activeSurrogateId: null,
                                isTenant: false,
                                loggedIn: false,
                                lastActiveTime: Date.now()
                            };
                            
                            // Rule: Initial Surrogate Provisioning (L6)
                            const initialSurrogateId = idnt.initial?.surrogate || 'observer';
                            const initialSurrogateData = idnt.initial?.surrogateData || {};
                            userObj.surrogates[initialSurrogateId] = {
                                id: initialSurrogateId,
                                ...initialSurrogateData,
                                materializedAt: new Date().toISOString()
                            };
                            userObj.activeSurrogateId = initialSurrogateId;
                            logger?.info(`Session: Mapped initial surrogate '${initialSurrogateId}' for identity '${id}' in realm '${homeRealm}'.`);

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
                    this.scopedUsers["platonic"] = this.scopedUsers["backoffice-web"];
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

        // Cache Invalidator Effect
        Alpine.effect(() => {
            if (typeof globalThis.Deno !== 'undefined') return;
            
            // Read reactive dependencies for current active scope & user
            const scope = this._session.activeFlowId || this._session.activeRealmId || 'platonic';
            const stack = this._session.scopedUsers?.[scope] || {};
            const activeId = stack.__activeId__;
            const activeUser = stack[activeId];
            
            const _d1 = this._session.activeFlowId;
            const _d2 = this._session.activeRealmId;
            const _d3 = this._session.activeBeingId;
            const _d4 = activeId;
            const _d5 = activeUser?.loggedIn;
            const _d6 = activeUser?.activeSurrogateId;
            const _d7 = activeUser?.lastActiveTime;
            const _d8 = activeUser?.grounding;

            // Trace active Being's profile details across all scoped stacks
            const beingId = this._session.activeBeingId;
            if (beingId) {
                for (const s of Object.keys(this._session.scopedUsers || {})) {
                    const profile = this._session.scopedUsers[s]?.[beingId];
                    if (profile) {
                        const _p1 = profile.activeSurrogateId;
                        const _p2 = profile.loggedIn;
                        const _p3 = profile.lastActiveTime;
                        const _p4 = profile.grounding;
                    }
                }
            }
            
            if (this._session) {
                this._session._cacheDirty = true;
            }
        });

        // Register EventHandler for homeostasis (L1 TAME Engine)
        const EVENT_TOPIC = "event.topics";
        const topics = [
            "org/neverplayed/session/CHANGED",
            "org/neverplayed/realm/CHANGED",
            "org/neverplayed/persistence/CONTEXT_CHANGED",
            "org/neverplayed/persistence/CHANGED",
            "org/neverplayed/stratum/CHANGED",
            "org/neverplayed/config/UPDATED"
        ];
        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (_event) => {
                this._updateAttentionSpan();
                this._session?._scheduleHomeostasis();
            }
        }, { [EVENT_TOPIC]: topics });

        // Add window event listeners for UI interactions
        if (typeof globalThis.addEventListener === 'function') {
            const trigger = () => this._session?.registerInteraction();
            globalThis.addEventListener('click', trigger);
            globalThis.addEventListener('keydown', trigger);
        }

        // Register the Alpine Store for global cross-component template reactivity
        Alpine.store('session', this._session);

        // Register the Service
        context.registerService(SESSION_SERVICE, this._session);

        // Prime the attention span from config if available
        this._updateAttentionSpan();
        
        // Register as Transition Participant
        context.registerService(TRANSITION_PARTICIPANT_INTERFACE, {
            // deno-lint-ignore require-await
            onPrepareTransition: async (proposed) => {
                this._logger.info(`Session [TransitionParticipant]: Preparing for pivot to '${proposed.realmId}' for user '${proposed.identityId}'`);
            },
            // deno-lint-ignore require-await
            onCommitTransition: async (committed) => {
                this._logger.info(`Session [TransitionParticipant]: Transition committed. Active context is now:`, committed);
            }
        });

        this._logger.info("Session Service: Registered 🛡️✨");

        // Set up Persistence Sync
        let lastSyncedCtx = null;
        let writeTimeout = null;
        Alpine.effect(async () => {
            if (this._pm && this._session) {
                // Resolve Tenant from Global Stack / Grounding Soul (Rule 3)
                const tenantId = (this._session.activeBeingId && this._session.activeBeingId !== 'guest') 
                    ? this._session.activeBeingId 
                    : "guest";
                
                // Identity (SID) is the currently active user
                const currentUser = this._session.currentUser;
                const identityId = (currentUser && currentUser.id !== 'guest') ? currentUser.id : tenantId;
                
                const ctx = {
                    tenantId,
                    identityId,
                    realmId: this._session.activeRealmId || "unknown",
                    tier: "local"
                };
                
                // Only sync context if it actually shifted
                const contextShifted = !lastSyncedCtx ||
                    lastSyncedCtx.tenantId !== ctx.tenantId ||
                    lastSyncedCtx.identityId !== ctx.identityId ||
                    lastSyncedCtx.realmId !== ctx.realmId ||
                    lastSyncedCtx.tier !== ctx.tier;

                if (contextShifted && typeof this._pm.setContext === 'function') {
                    lastSyncedCtx = ctx;
                    this._logger?.info(`Session: Syncing Persistence Context -> Tenant: ${tenantId}, Realm: ${ctx.realmId}, Identity: ${identityId}, Tier: ${ctx.tier}`);
                    await this._pm.setContext(ctx);
                    if (self._eventAdmin && self._eventFactory) {
                        const evt = self._eventFactory.build(PERSISTENCE_CONTEXT_CHANGED_TOPIC, ctx);
                        self._eventAdmin.postEvent(evt);
                    }
                }

                // Debounce disk write: run synchronously in Deno tests, but debounce to 100ms in the browser
                const performWrite = () => {
                    if (!this._session || !this._pm) return;

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
                    
                    this._logger?.debug(`Session: Persisting state [${SESSION_PID}] to tier...`);
                    this._pm.store(SESSION_PID, raw);
                };

                if (typeof globalThis.Deno !== 'undefined') {
                    performWrite();
                } else {
                    if (writeTimeout) clearTimeout(writeTimeout);
                    writeTimeout = setTimeout(performWrite, 100);
                }
            }
        });
    }

    _updateAttentionSpan() {
        if (this._session && this._configAdmin) {
            const cfg = this._configAdmin.getConfiguration(SESSION_SERVICE_PID)?.getProperties() || {};
            const secs = cfg["attention-span-seconds"] !== undefined ? Number(cfg["attention-span-seconds"]) : 30;
            const targetMs = secs * 1000;
            if (this._session.attentionSpanMs !== targetMs) {
                this._session.attentionSpanMs = targetMs;
                this._logger?.info(`Session Service: Attention Span updated to ${secs}s (${this._session.attentionSpanMs}ms).`);
            }
        }
    }

    stop() {
        this._logger.info("Session Service: Stopped.");
    }
}
