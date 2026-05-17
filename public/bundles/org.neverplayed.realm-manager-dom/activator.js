/**
 * @file Activator for org.neverplayed.realm-manager-dom
 * @module platform/bundles/org.neverplayed.realm-manager-dom
 */

import { EVENT_TOPIC, EVENT_HANDLER_INTERFACE, REALM_CHANGED_TOPIC, LOG_SERVICE } from "../../core-types.js";

export default class Activator {
    _logger = console;
    _registration = null;

    start(context) {
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Realm Manager DOM Extender: Logger connected.");
                return logAdmin;
            }
        }).open();

        // Register EventHandler for REALM_CHANGED_TOPIC
        const props = {
            [EVENT_TOPIC]: REALM_CHANGED_TOPIC
        };

        this._registration = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                this._logger?.debug(`[RealmManager-DOM] Caught OSGi topic ${REALM_CHANGED_TOPIC}, translating to DOM...`);
                
                const id = event.getProperty("realm.id");
                const title = event.getProperty("realm.title");
                const icon = event.getProperty("realm.icon");
                
                const manifest = { id, title, icon };

                globalThis.dispatchEvent(new CustomEvent("realm-switched", { 
                    detail: { id, manifest } 
                }));
            }
        }, props);

        this._logger?.info("Realm Manager DOM Extender: Active and bridging events.");
    }

    stop() {
        if (this._registration) {
            try { this._registration.unregister(); } catch(e) {}
        }
        this._logger?.info("Realm Manager DOM Extender: Stopped.");
    }
}
