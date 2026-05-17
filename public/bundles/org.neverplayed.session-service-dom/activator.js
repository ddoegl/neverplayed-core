/**
 * @file Activator for org.neverplayed.session-service-dom
 * @module platform/bundles/org.neverplayed.session-service-dom
 */

import { EVENT_TOPIC, EVENT_HANDLER_INTERFACE, SESSION_CHANGED_TOPIC, LOG_SERVICE } from "../../core-types.js";

export default class Activator {
    _logger = console;
    _registration = null;

    start(context) {
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Session Service DOM Extender: Logger connected.");
                return logAdmin;
            }
        }).open();

        // Register EventHandler for SESSION_CHANGED_TOPIC
        const props = {
            [EVENT_TOPIC]: SESSION_CHANGED_TOPIC
        };

        this._registration = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                this._logger?.debug(`[SessionService-DOM] Caught OSGi topic ${SESSION_CHANGED_TOPIC}, translating to DOM...`);
                
                const type = event.getProperty("type");
                const scope = event.getProperty("scope");
                const user = event.getProperty("user");
                const surrogate = event.getProperty("surrogate");
                
                globalThis.dispatchEvent(new CustomEvent("session-changed", { 
                    detail: { type, scope, user, surrogate } 
                }));
            }
        }, props);

        this._logger?.info("Session Service DOM Extender: Active and bridging events.");
    }

    stop() {
        if (this._registration) {
            try { this._registration.unregister(); } catch(e) {}
        }
        this._logger?.info("Session Service DOM Extender: Stopped.");
    }
}
