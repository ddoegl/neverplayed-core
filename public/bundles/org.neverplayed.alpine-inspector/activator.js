import { SHELL_COMMAND_SERVICE } from "../../core-types.js";

/**
 * Alpine Inspector
 * Registers the '/alpine' command to inspect reactive stores and components.
 * Follows the 'Platform Observability' pattern.
 */
export default class Activator {
    start(context) {
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "alpine",
            description: "Inspect reactive Alpine.js stores (Stores: /alpine stores, Dump: /alpine dump <name>)",
            execute: (args, _ctx, log) => {
                const sub = args[0] || "stores";

                if (sub === "stores") {
                    const stores = Array.from(globalThis.__ALPINO_STORES__ || []);
                    log({ text: `Detected Reactive Stores (${stores.length}):`, color: 'cyan', bold: true });
                    stores.forEach(name => {
                        const existsInAlpine = !!globalThis.Alpine?.store(name);
                        log(` - ${name} ${existsInAlpine ? '[ACTIVE]' : '[INACTIVE/ORPHAN]'}`);
                    });
                    if (stores.length === 0) log("No stores registered via AlpineActivator yet.");
                    return;
                }

                if (sub === "dump") {
                    const name = args[1];
                    if (!name) {
                        log({ text: "Error: Please specify a store name. Usage: /alpine dump <name>", color: 'red' });
                        return;
                    }
                    const store = globalThis.Alpine?.store(name);
                    if (!store) {
                        log({ text: `Error: Store '${name}' not found in Alpine.`, color: 'red' });
                        return;
                    }
                    log({ text: `Dump: Alpine Store '${name}'`, color: 'green', bold: true });
                    
                    // Simple recursive clean-dump to skip internal Alpine/Activator refs
                    const clean = JSON.parse(JSON.stringify(store, (key, value) => {
                        if (key === 'activator' || key.startsWith('_x_')) return undefined;
                        return value;
                    }));
                    log(clean);
                    return;
                }

                if (sub === "find") {
                    const query = args[1];
                    if (!query) return log("Usage: /alpine find <key>");
                    
                    log({ text: `Searching for '${query}' in all stores...`, color: 'cyan' });
                    const stores = Array.from(globalThis.__ALPINO_STORES__ || []);
                    stores.forEach(name => {
                        const store = globalThis.Alpine?.store(name);
                        if (!store) return;
                        const json = JSON.stringify(store);
                        if (json.includes(query)) {
                            log({ text: `Match found in store: ${name}`, color: 'green' });
                            log(store);
                        }
                    });
                }
            }
        });
    }

    stop() {
        // No persistent state to clean
    }
}
