/**
 * @file Activator for org.neverplayed.persistence-deno
 * @module platform/bundles/org.neverplayed.persistence-deno
 */

import { PERSISTENCE_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    onStart(context) {
        const STATE_DIR = "public/.neverplayed";
        const STATE_FILE = `${STATE_DIR}/state.json`;

        // Ensure directory exists
        try { Deno.mkdirSync(STATE_DIR, { recursive: true }); } catch (_e) { /* Ignore if exists */ }

        const getStore = () => {
            try {
                const data = Deno.readTextFileSync(STATE_FILE);
                return JSON.parse(data);
            } catch (_e) {
                return {};
            }
        };

        const saveStore = (data) => {
            Deno.writeTextFileSync(STATE_FILE, JSON.stringify(data, null, 2));
        };
        
        context.registerService(PERSISTENCE_MANAGER_SERVICE, {
            load: (key) => {
                const store = getStore();
                return store[key] !== undefined ? store[key] : null;
            },
            store: (key, val) => {
                const store = getStore();
                store[key] = val;
                saveStore(store);
            },
            clear: () => {
                saveStore({});
                this.logger.info("Deno Persistence Manager: Local state cleared.");
            },
            listKeys: (prefix = "") => {
                const store = getStore();
                return Object.keys(store).filter(k => k.startsWith(prefix));
            }
        }, {
            "capability": "sys:persistence",
            "implementation": "deno-fs",
            "persistence.type": "provider",
            "persistence.tier": "local",
            "persistence.scope": "device",
            "service.ranking": 10
        });

        this.logger.info(`Deno Persistence Manager: ACTIVE (FS: ${STATE_FILE}).`);
    }

    onStop(_context) {
        this.logger.info("Deno Persistence Manager: STOPPED.");
    }
}
