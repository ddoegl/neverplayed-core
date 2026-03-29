import { checkAccess, signOut } from "../../auth-shield.js";
import { AUTH_SHIELD_SERVICE } from "../../core-types.js";

export default class Activator {
    async start(context) {
        console.log("Auth Shield: Activator starting...");
        
        try {
            const user = await checkAccess();
            console.log("Auth Shield: Access granted for", user.email);
            
            context.registerService(AUTH_SHIELD_SERVICE, {
                getCurrentUser: () => user,
                logout: () => {
                    console.log("Auth Shield: Logging out...");
                    signOut();
                }
            }, { 
                "capability": "auth:shield",
                "auth.user": user.email
            });

        } catch (error) {
            console.error("Auth Shield: Access check failed, stopping bundle.", error);
            // In a real OSGi env, we might want to stop the bundle or even the framework
            // but for now, we just don't register the service.
            throw error;
        }
    }

    stop(_context) {
        console.log("Auth Shield: Stopped.");
    }
}
