import { PERSISTENCE_MANAGER_SERVICE, CONFIG_UPDATED_TOPIC } from "../../core-types.js";
import { EVENT_ADMIN_SERVICE, EVENT_FACTORY_SERVICE, EVENT_HANDLER_INTERFACE, EVENT_TOPIC } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

/**
 * Filesystem Sync Bundle (Browser Edition)
 * Periodically pulls state from the local server's .neverplayed/state.json 
 * and hydrates the local PersistenceManager.
 */
export default class Activator extends BaseActivator {
    async onStart(context) {
        this.logger.info("FS Sync: Starting synchronization loop...");

        // 1. Initial Sync
        await this.sync(context);

        // 2. Periodic Poll (Every 5 seconds for the "Twin" effect)
        this.interval = setInterval(() => this.sync(context), 5000);

        // 3. Listen to local changes via OSGi EventAdmin and POST upstream
        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: async (event) => {
                // Ignore events emitted by our own polling mechanism
                if (event.getProperty("source") === "fs-sync") return;
                
                try {
                    // 1. Fetch current server state
                    const response = await fetch("./.neverplayed/state.json", { cache: "no-store" });
                    const currentState = response.ok ? await response.json() : {};
                    
                    // 2. Patch with the updated configuration event
                    const pid = event.getProperty("pid");
                    const props = event.getProperty("properties");
                    if (pid) {
                        currentState[`config.${pid}`] = props;
                    }

                    // 3. POST back to server
                    await fetch("./.neverplayed/state.json", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(currentState, null, 2)
                    });
                    this.logger.info(`FS Sync: Handled UI event. Posted ${pid} modifications upstream.`);
                } catch (e) {
                    this.logger.error("FS Sync: Failed to post state.", e);
                }
            }
        }, { [EVENT_TOPIC]: [CONFIG_UPDATED_TOPIC] });
    }

    async sync(context) {
        try {
            const response = await fetch("./.neverplayed/state.json", { cache: "no-store" });
            if (!response.ok) return;

            const remoteState = await response.json();
            const pmRef = context.getServiceReferences(PERSISTENCE_MANAGER_SERVICE)[0];
            if (!pmRef) return;

            const pm = context.getService(pmRef);
            
            // Compare and update only if changed for performance
            let updated = false;
            for (const [key, value] of Object.entries(remoteState)) {
                const localValue = pm.load(key);
                if (JSON.stringify(localValue) !== JSON.stringify(value)) {
                    pm.store(key, value);
                    this.logger.debug(`FS Sync: Updated ${key}`);
                    updated = true;
                    if (key.startsWith('config.')) {
                        const eventAdminRef = context.getServiceReferences(EVENT_ADMIN_SERVICE)[0];
                        const eventFactoryRef = context.getServiceReferences(EVENT_FACTORY_SERVICE)[0];
                        if (eventAdminRef && eventFactoryRef) {
                            const eventAdmin = context.getService(eventAdminRef);
                            const eventFactory = context.getService(eventFactoryRef);
                            const event = eventFactory.build(CONFIG_UPDATED_TOPIC, { 
                                pid: key.replace("config.", ""), 
                                properties: value,
                                source: "fs-sync"
                            });
                            eventAdmin.postEvent(event);
                        } else {
                            // Fallback if EventAdmin is unexpectedly missing
                            globalThis.dispatchEvent(new CustomEvent('config-updated', { 
                                detail: { pid: key.replace("config.", ""), properties: value, source: "fs-sync" } 
                            }));
                        }
                    }
                }
            }

            if (updated) {
                this.logger.info("FS Sync: Local state synchronized with Filesystem.");
            }
        } catch (_err) {
            // Silently fail if file not found or not on localhost:8008
        }
    }

    onStop(_context) {
        if (this.interval) clearInterval(this.interval);
        this.logger.info("FS Sync: Stopped.");
    }
}
