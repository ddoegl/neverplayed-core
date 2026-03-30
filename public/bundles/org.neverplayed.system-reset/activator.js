import { SYSTEM_RESET_SERVICE, PERSISTENCE_MANAGER_SERVICE } from "core-types";
import { CoreActivator } from "osgi-base";

export default class Activator extends CoreActivator {
    onCoreStart(_context) {
        const resetService = {
            factoryReset: () => {
                if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                    alert("Access Denied: You do not have the 'neverplayed-admin' attribute required for this operation.");
                    return;
                }

                if (confirm("Reset ALL stored OSGi states across all tenants and backoffices? This CANNOT be undone.")) {
                    this.logger.info("SystemReset: Factory Reset confirmed. Clearing persistence layer and reloading...");
                    
                    const pmRef = this.context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
                    if (pmRef) {
                        const pm = this.context.getService(pmRef);
                        if (typeof pm.clear === 'function') {
                            pm.clear();
                        } else {
                            localStorage.clear();
                        }
                    } else {
                        localStorage.clear();
                    }
                    setTimeout(() => location.reload(), 500);
                }
            }
        };

        this.context.registerService(SYSTEM_RESET_SERVICE, resetService, { "capability": "sys:reset" });
    }
}

