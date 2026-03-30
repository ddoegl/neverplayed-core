import { checkAccess, signOut } from "./src/firebase-auth.js";
import { AUTH_SHIELD_SERVICE, LOG_SERVICE } from "../../core-types.js";

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

        this.logger.info("Auth Shield: Activator starting...");
        
        try {
            // Note: pass the dynamic logger to the auth logic
            const user = await checkAccess(this.logger);
            this.logger.info(`Auth Shield: Access granted for ${user.email}`);
            
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

        } catch (error) {
            this.logger.error("Auth Shield: Access check failed, stopping bundle.", error);
            throw error;
        }
    }

    stop(_context) {
        if (this.logger) this.logger.info("Auth Shield: Stopped.");
    }
}
