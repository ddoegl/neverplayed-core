/**
 * @file Activator for org.neverplayed.auth-shield
 * @module platform/bundles/org.neverplayed.auth-shield
 */

import { checkAccess, signOut } from "./src/firebase-auth.js";
import { AUTH_SHIELD_SERVICE, LOG_SERVICE, SHELL_COMMAND_SERVICE, SESSION_SERVICE } from "../../core-types.js";

export default class Activator {
    async start(context) {
        // 1. Initial Logger (Fallback to console)
        this.logger = {
            info: (...args) => console.log("[BOOT] ", ...args),
            debug: (...args) => console.debug("[BOOT] ", ...args),
            warn: (...args) => console.warn("[BOOT] ", ...args),
            error: (...args) => console.error("[BOOT] ", ...args)
        };

        // 2. Track System Logger
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger(context.getBundle().getSymbolicName());
                this.logger.info("Auth Shield: Connected to System Logger.");
            },
            removedService: () => {
                // Fallback again
                this.logger = console;
            }
        }).open();

        // 3. Track Session Manager for Handshake
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                this.logger.info("Auth Shield: Session Service handshaked. Identity propagation active.");
                if (this._authenticatedUser) {
                    this._session.login(this._authenticatedUser);
                }
                return this._session;
            },
            removedService: () => {
                this._session = null;
            }
        }).open();

        // 4. Rule 27: Headless Identity Hot-Swap (SDN-0140)
        // Dispatches the host identity to the session service in TDD environments
        globalThis.addEventListener('headless-user-provided', async (event) => {
             this.logger.info(`Auth Shield [Security]: Headless Identity Pulse detected for ${event.detail?.email}. Synchronizing Session...`);
             const user = await checkAccess(this.logger);
             
             // Rule 29.1: Primary Protection (SDN-0140)
             // Only update primary certified user if cache is empty or explicitly primary
             if (!this._authenticatedUser || event.detail?.primary) {
                 this._authenticatedUser = user;
             }

             if (this._session) {
                 this._session.login(user);
                 this.logger.info("Auth Shield [Security]: Global Session Synchronized.");
             }
        });

        // Rule 29: Certified Identity Restoration (SDN-0140)
        // Automatically re-assert primary identity when a temporary session ends
        globalThis.addEventListener('session-changed', (event) => {
            const { type, scope } = event.detail || {};
            if (type === 'logout' && scope === 'global' && this._authenticatedUser && this._session) {
                this.logger.info(`Auth Shield [Security]: Temporary session ended. Re-asserting primary identity: ${this._authenticatedUser.email}`);
                this._session.login(this._authenticatedUser);
            }
        });

        this.logger.info("Auth Shield: Activator starting...");
        
        try {
            // Note: pass the dynamic logger to the auth logic
            const user = await checkAccess(this.logger);
            this._authenticatedUser = user;
            this.logger.info(`Auth Shield: Access granted for ${user.email}`);

            // If session already exists, login immediately
            if (this._session) {
                this._session.login(user);
            }
            
            context.registerService(AUTH_SHIELD_SERVICE, {
                getCurrentUser: () => user,
                logout: () => {
                    this.logger.info("Auth Shield: Logging out...");
                    signOut();
                }
            }, { 
                "capability": "auth:shield",
                "auth.user": user.email,
                "neverplayed-admin": user.isSuperuser || false,
                "neverplayed-developer": user.isDeveloper || false
            });

            context.registerService(SHELL_COMMAND_SERVICE, {
                name: "auth",
                description: "Show Google Auth information (Layer 1 Auth)",
                execute: (_args, ctx, log) => {
                    log({ text: `Google Auth Info for: ${user.email}`, color: 'green', bold: true });
                    
                    const isNeverplayedAdmin = user.isSuperuser || user.attributes?.['neverplayed-admin'] || false;
                    
                    let isRealmAdmin = false;
                    const sessionRef = ctx.getServiceReference(SESSION_SERVICE);
                    if (sessionRef) {
                        const session = ctx.getService(sessionRef);
                        const scoped = session.scopedUsers?.["global"]?.attributes || {};
                        const global = session.currentUser?.attributes || {};
                        isRealmAdmin = global['realm-admin'] === true || scoped['realm-admin'] === true;
                    }
                    
                    log({ text: `Detected System Roles:`, color: 'cyan', bold: true });
                    log(` - neverplayed-admin: ${!!isNeverplayedAdmin}`);
                    log(` - realm-admin: ${isRealmAdmin}`);
                    
                    log(user);
                }
            });

        } catch (error) {
            this.logger.error("Auth Shield: Access check failed, stopping bundle.", error);
            throw error;
        }
    }

    stop(_context) {
        if (this.logger) this.logger.info("Auth Shield: Stopped.");
    }
}
