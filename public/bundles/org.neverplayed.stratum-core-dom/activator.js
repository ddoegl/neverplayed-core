/**
 * @file Activator for org.neverplayed.stratum-core-dom
 * @module platform/bundles/org.neverplayed.stratum-core-dom
 */

import { 
    STRATUM_SERVICE, 
    LOG_SERVICE, 
    EVENT_HANDLER_INTERFACE, 
    EVENT_TOPIC, 
    STRATUM_CHANGED_TOPIC 
} from "../../core-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    _logger = console;
    _stratum = null;
    _registration = null;
    _tracker = null;

    start(context) {
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratum Core DOM Extender: Logger connected.");
                return logAdmin;
            }
        }).open();

        // Register Alpine global store
        Alpine.store('stratum', {
            tenantId: 'guest',
            identityId: 'guest',
            realmId: 'unknown',
            tier: 'local',
            perspective: 'idealist',
            inhabitants: [],
            occupants: [],
            residents: [],
            _stratumSvc: null,

            login(id, scope = null) {
                if (this._stratumSvc) {
                    return this._stratumSvc.login(id, scope);
                }
                return Promise.resolve();
            },

            logout(scope = null) {
                if (this._stratumSvc) {
                    return this._stratumSvc.logout(scope);
                }
                return Promise.resolve();
            },

            jump(uri) {
                if (this._stratumSvc) {
                    return this._stratumSvc.jump(uri);
                }
            }
        });

        // Track the Stratum Core headless service
        this._tracker = context.trackService(`(objectClass=${STRATUM_SERVICE})`, {
            addingService: (ref) => {
                this._stratum = context.getService(ref);
                const store = Alpine.store('stratum');
                store._stratumSvc = this._stratum;
                this._updateStore(store);
                this._logger.info("Stratum Core DOM Extender: Linked to headless Stratum Core service.");
                return this._stratum;
            },
            removedService: () => {
                this._stratum = null;
                const store = Alpine.store('stratum');
                store._stratumSvc = null;
            }
        });
        this._tracker.open();

        // Register EventHandler for STRATUM_CHANGED_TOPIC
        const props = {
            [EVENT_TOPIC]: STRATUM_CHANGED_TOPIC
        };

        this._registration = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                this._logger?.debug(`[StratumCore-DOM] Caught OSGi topic ${STRATUM_CHANGED_TOPIC}, syncing to Alpine store...`);
                const store = Alpine.store('stratum');
                this._updateStore(store);
            }
        }, props);

        this._logger.info("Stratum Core DOM Extender: Active.");
    }

    _updateStore(store) {
        if (!this._stratum) return;
        store.tenantId = this._stratum.tenantId;
        store.identityId = this._stratum.identityId;
        store.realmId = this._stratum.realmId;
        store.tier = this._stratum.tier;
        store.perspective = this._stratum.perspective;
        store.inhabitants = [...(this._stratum.inhabitants || [])];
        store.occupants = [...(this._stratum.occupants || [])];
        store.residents = [...(this._stratum.residents || [])];
    }

    stop() {
        if (this._registration) {
            try { this._registration.unregister(); } catch(e) {}
        }
        if (this._tracker) {
            try { this._tracker.close(); } catch(e) {}
        }
        this._logger.info("Stratum Core DOM Extender: Stopped.");
    }
}
