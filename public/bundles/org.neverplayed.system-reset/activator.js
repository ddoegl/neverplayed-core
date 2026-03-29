import { SYSTEM_RESET_SERVICE } from "shared-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    onStart(context) {
        const resetService = {
            factoryReset: () => {
                 if (confirm("Reset ALL stored OSGi states across all tenants and backoffices? This CANNOT be undone.")) {
                    this.logger.info("SystemReset: Factory Reset confirmed. Clearing localStorage and reloading...");
                    localStorage.clear();
                    setTimeout(() => location.reload(), 100);
                }
            }
        };

        context.registerService(SYSTEM_RESET_SERVICE, resetService, { "capability": "sys:reset" });
    }
}

