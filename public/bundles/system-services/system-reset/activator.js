export default class Activator {
    start(_context) {
        const resetService = {
            factoryReset() {
                 if (confirm("Reset ALL stored OSGi states across all tenants and backoffices? This CANNOT be undone.")) {
                    console.log("SystemReset: Factory Reset confirmed. Clearing localStorage and reloading...");
                    localStorage.clear();
                    setTimeout(() => location.reload(), 100);
                }
            }
        };

        _context.registerService("prototyper.system.ResetService", resetService);
        console.log("SystemReset: Service registered.");
    }

    async stop(_context) {}
}
