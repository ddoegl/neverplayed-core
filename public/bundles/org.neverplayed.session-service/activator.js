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

        const persistedState = this._pm.load(SESSION_PID) || {
            currentUser: null,
            scopedUsers: {
                global: { id: 'guest', attributes: {} }
            }
        };
        this._logger.info(`Session Service: DISK-LOAD COMPLETE. Found Identity: ${persistedState.currentUser?.id || 'guest'}`);
        this._logger.info(`Session Service: Persisted state loaded. Identity: ${persistedState.currentUser?.id || 'guest'}`);

        // Universal Identity Purity Guard:
        // Always strip identity-leaking metadata from persisted state on boot.
        // These will be re-populated by the Realm Manager or explicit login if needed.
        if (persistedState.scopedUsers?.global) {
            persistedState.scopedUsers.global = {
                id: 'guest',
                attributes: {}
            };
        }

        const logger = this._logger;

        // Create Reactive Session State
        this._session = Alpine.reactive({
            ...persistedState,
            activeFlowId: null, // Volatile
            activeRealmId: null, // Volatile (Pushed from Realm Manager)
            
            get currentUser() {
                const scope = this.activeFlowId || this.activeRealmId || "global";
                const isRetail = (this.environment || "").includes("mobile") || (this.environment || "").includes("retail");
                
                const inheritanceScopes = [
                    "cases", "invitation-admin", "company-authorizations", 
                    "signing", "dashboard", "dashboard2", "do-dashboard"
                ];

                if (!this.scopedUsers[scope] && inheritanceScopes.includes(scope)) {
                    if (isRetail) {
                        return this.scopedUsers["retail-channel-app"] || 
                               this.scopedUsers["user-home-retail"] || 
                               this.scopedUsers["global"] || null;
                    } else {
                        return this.scopedUsers["business-channel-web"] || 
                               this.scopedUsers["user-home-business"] || 
                               this.scopedUsers["global"] || null;
                    }
                }
                return this.scopedUsers[scope] || this.scopedUsers["global"] || null;
            },

            login(user, scope = null) {
                // Resolution: Flow > Current Realm > global
                const currentRealm = this.activeRealmId || null;
                const targetScope = scope || this.activeFlowId || currentRealm || 'global';
                
                const identity = typeof user === "string" ? { id: user, email: `${user}@cli.local` } : user;
                logger?.info(`Session: LOGIN requested for scope '${targetScope}' (id: ${identity.uid || identity.id})`);

                this.scopedUsers[targetScope] = { 
                    id: identity.uid || identity.id, 
                    email: identity.email,
                    firstname: identity.firstname,
                    lastname: identity.lastname,
                    alias: identity.alias,
                    capabilities: identity.capabilities || [],
                    attributes: identity.attributes || {} 
                };
                logger?.info(`Session: Scoped user [${targetScope}] updated to identity [${this.scopedUsers[targetScope].id}]`);
                globalThis.dispatchEvent(new CustomEvent('session-changed', { detail: { type: 'login', user, scope } }));
            },

            logout(scope = 'global') {
                logger?.info(`Session: LOGOUT requested for scope '${scope}'`);
                const user = this.scopedUsers[scope] || this.scopedUsers["global"];
                
                // --- SCA Bootstrap Logic ---
                if (user && user.scaStrategy === "bootstrap") {
                  const phone = prompt(
                    "Bootstrap Strategy Enforced: Please enter your phone number to secure your account before logging out:",
                    user["bootstrap-phonenumber"] || "",
                  );
                  if (phone) {
                    const newCode = this._generateBootstrapCode();
                    user["bootstrap-phonenumber"] = phone;
                    user["bootstrap-code"] = newCode;
    
                    // Persist via LicenseDataService (Lazy Lookup)
                    const licRef = context.getServiceReference(LICENSE_DATA_SERVICE);
                    const licSvc = licRef ? context.getService(licRef) : null;
                    if (licSvc && licSvc.updateUser) {
                      licSvc.updateUser(user.licenseId, {
                        id: user.id,
                        "bootstrap-phonenumber": phone,
                        "bootstrap-code": newCode,
                      });
                    }
    
                    // Show modal (Triggered via Reactive State)
                    this.bootstrapCodeModal = {
                      show: true,
                      code: newCode,
                      phone,
                    };
                    return; // Wait for modal close in UI
                  }
                }

                // Standard Logout
                this.scopedUsers[scope] = { id: 'guest', attributes: {} };
                logger?.info(`Session: Scope [${scope}] reset to guest.`);
                globalThis.dispatchEvent(new CustomEvent('session-changed', { detail: { type: 'logout', scope } }));
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
                // Rule: Sovereign Context Propagation (SDN-0165)
                // Tenant (UID) is pinned to the global scope anchor
                const globalUser = this._session.scopedUsers?.["global"];
                const tenantId = (globalUser && globalUser.id !== 'guest') ? globalUser.id : "guest";
                
                // Identity (SID) is the currently active user (flow-scoped)
                const currentUser = this._session.currentUser;
                const identityId = (currentUser && currentUser.id !== 'guest') ? currentUser.id : tenantId;
                
                const ctx = {
                    tenantId,
                    identityId,
                    realmId: this._session.activeRealmId || "unknown"
                };
                
                if (typeof this._pm.setContext === 'function') {
                    this._logger?.info(`Session: Syncing Persistence Context -> Tenant: ${tenantId}, Realm: ${ctx.realmId}, Identity: ${identityId}`);
                    this._pm.setContext(ctx);
                }
                // Identity Purity Sink:
                // Never persist identity meta-data for unauthenticated guest sessions
                const raw = JSON.parse(JSON.stringify(this._session));
                if (raw.scopedUsers) {
                    Object.values(raw.scopedUsers).forEach(user => {
                        if (user.id === 'guest') {
                            delete user.email;
                            delete user.alias;
                            delete user.firstname;
                            delete user.lastname;
                            delete user.avatar;
                        }
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
