/**
 * @file Activator for org.neverplayed.system-reset
 * @module platform/bundles/org.neverplayed.system-reset
 */

import { SYSTEM_RESET_SERVICE, PERSISTENCE_MANAGER_SERVICE } from "core-types";
import { CoreActivator } from "osgi-base";

export default class Activator extends CoreActivator {
    onCoreStart(_context) {
        const resetService = {
            reset: () => resetService.factoryReset(), // Unified alias
            factoryReset: async () => {
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
                            await pm.clear({ global: true });
                        } else {
                            localStorage.clear();
                        }
                    } else {
                        localStorage.clear();
                    }
                    
                    this.logger.info("SystemReset: Persistence cleared. Reloading in 1s...");
                    setTimeout(() => location.reload(), 1000);
                }
            }
        };

        this.context.registerService(SYSTEM_RESET_SERVICE, resetService, { "capability": "sys:reset" });
    }
}

