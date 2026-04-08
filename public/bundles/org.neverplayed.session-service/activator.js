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
    _session = null;

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

        // 2. Track Persistence Manager for state hydration
        context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: (ref) => {
                this._pm = context.getService(ref);
                this._initializeSession(context);
                return this._pm;
            },
            removedService: () => { this._pm = null; }
        }).open();
    }

    async _initializeSession(context) {
        if (this._session) return; // Guard against multiple initializations

        this._logger.info("Session Service: Hydrating state from Persistence Manager...");
        
        // Wait for PM to be ready (Firebase/FS sync)
        if (this._pm.waitReady) {
            await this._pm.waitReady();
        }

        const persistedState = this._pm.load(SESSION_PID) || {
            currentUser: null,
            scopedUsers: {
                global: { id: 'guest', attributes: {} }
            }
        };

        // Universal Identity Purity Guard:
        // Always strip identity-leaking metadata from persisted state on boot.
        // These will be re-populated by the Realm Manager or explicit login if needed.
        if (persistedState.scopedUsers?.global) {
            persistedState.scopedUsers.global = {
                id: 'guest',
                attributes: {}
            };
        }

        // Create Reactive Session State
        this._session = Alpine.reactive({
            ...persistedState,
            activeFlowId: null, // Volatile
            
            get currentUser() {
                const scope = this.activeFlowId || "global";
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

            login(user, scope = 'global') {
                this._logger?.info(`Session: LOGIN requested for scope '${scope}' (id: ${user.uid || user.id})`);
                this.scopedUsers[scope] = { 
                    id: user.uid || user.id, 
                    email: user.email,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    alias: user.alias,
                    capabilities: user.capabilities || [],
                    attributes: user.attributes || {} 
                };
                globalThis.dispatchEvent(new CustomEvent('session-changed', { detail: { type: 'login', user, scope } }));
            },

            logout(scope = 'global') {
                this._logger?.info(`Session: LOGOUT requested for scope '${scope}'`);
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
                    this._logger?.info("Session: PROMOTE requested for superuser", user.email);
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

        // Register the Service
        context.registerService(SESSION_SERVICE, this._session);
        this._logger.info("Session Service: Registered 🛡️✨");

        // Set up Persistence Sync
        Alpine.effect(() => {
            if (this._pm && this._session) {
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
                
                this._pm.store(SESSION_PID, raw);
            }
        });
    }

    stop() {
        this._logger.info("Session Service: Stopped.");
    }
}
