/**
 * @file Activator for org.neverplayed.session-service
 * @module platform/bundles/org.neverplayed.session-service
 */

import { SESSION_SERVICE, LOG_SERVICE, LICENSE_DATA_SERVICE } from "../../core-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

const SESSION_PID = "pandino.session.state";

export default class Activator {
    _logger = console;
    _pm = null;
    _pmRank = -1;
    _session = null;
    _initializing = false;

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
                    this._pmRank = rank;
                    this._initializeSession(context);
                }
                return this._pm;
            },
            removedService: () => { this._pm = null; }
        }).open();

        // 3. Track Realm Manager for Context Scoping
        context.trackService(`(objectClass=org.neverplayed.realm.RealmManager)`, {
            addingService: (ref) => {
                this._realm = context.getService(ref);
                return this._realm;
            },
            removedService: () => { this._realm = null; }
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

        // Create Reactive Session State
        this._session = Alpine.reactive({
            ...persistedState,
            activeFlowId: null, // Volatile
            activeRealmId: null, // Volatile (Pushed from Realm Manager)
            tier: persistedState.tier || "local",
            
            get currentUser() {
                const scope = this.activeFlowId || this.activeRealmId || "global";
                const stack = this.scopedUsers[scope] || this.scopedUsers["global"] || {};
                const activeId = stack.__activeId__ || 'guest';
                
                let user = stack[activeId];
                
                // Fallback inheritance logic
                if (activeId === 'guest' || !user) {
                   const globalStack = this.scopedUsers["global"] || {};
                   user = globalStack[globalStack.__activeId__] || globalStack['guest'] || { id: 'guest' };
                }

                return user;
            },

            login(user, scope = null) {
                const targetScope = scope || this.activeFlowId || this.activeRealmId || 'global';
                const identity = typeof user === "string" ? { id: user, email: `${user}@cli.local` } : user;
                const identityId = identity.uid || identity.id;

                logger?.info(`Session: LOGIN requested for scope '${targetScope}' (id: ${identityId})`);

                if (!this.scopedUsers[targetScope]) {
                    this.scopedUsers[targetScope] = { __activeId__: 'guest', guest: { id: 'guest' } };
                }

                // Upsert Identity into Stack
                this.scopedUsers[targetScope][identityId] = { 
                    id: identityId, 
                    email: identity.email,
                    firstname: identity.firstname,
                    lastname: identity.lastname,
                    alias: identity.alias,
                    capabilities: identity.capabilities || [],
                    attributes: identity.attributes || {},
                    isTenant: targetScope === 'global'
                };

                // Pivot Active Resident
                this.scopedUsers[targetScope].__activeId__ = identityId;
                
                globalThis.dispatchEvent(new CustomEvent('session-changed', { detail: { type: 'login', user, scope } }));
            },

            logout(scope = null) {
                const activeScope = this.activeFlowId || this.activeRealmId;
                const targetScope = scope || activeScope || 'global';
                
                logger?.info(`Session: LOGOUT (Exit Resident) requested for scope '${targetScope}'`);
                
                if (this.scopedUsers[targetScope]) {
                    this.scopedUsers[targetScope].__activeId__ = 'guest';
                }

                logger?.info(`Session: Coordinate [${targetScope}] now inhabited by guest.`);
                globalThis.dispatchEvent(new CustomEvent('session-changed', { detail: { type: 'logout', scope: targetScope } }));
            },

            _generateBootstrapCode() {
                const genBlock = () => Math.random().toString(36).substring(2, 6).toUpperCase();
                return `${genBlock()}-${genBlock()}-${genBlock()}-${genBlock()}`;
            },

            closeBootstrapModal() {
                this.bootstrapCodeModal.show = false;
                this.logout(); // Recursively call now that modal is closed
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
        Alpine.effect(() => {
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
                    tier: this._session.tier || "local"
                };
                
                if (typeof this._pm.setContext === 'function') {
                    this._logger?.info(`Session: Syncing Persistence Context -> Tenant: ${tenantId}, Realm: ${ctx.realmId}, Identity: ${identityId}, Tier: ${ctx.tier}`);
                    this._pm.setContext(ctx);
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
