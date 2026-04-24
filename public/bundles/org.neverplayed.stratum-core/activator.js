/**
 * @file Activator for org.neverplayed.stratum-core
 * @module platform/bundles/org.neverplayed.stratum-core
 */

import { 
    STRATUM_SERVICE, 
    SESSION_SERVICE, 
    REALM_MANAGER_SERVICE, 
    PERSISTENCE_MANAGER_SERVICE, 
    LOG_SERVICE 
} from "../../core-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    _logger = console;
    _session = null;
    _realm = null;
    _pm = null;
    _service = null;

    start(context) {
        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratum Core: Connected to Logger.");
                return logAdmin;
            }
        }).open();

        // 2. Initialize Reactive Stratum Service
        this._service = Alpine.reactive({
            get tenantId() {
                return this._sourceSession?.scopedUsers?.global?.id || "guest";
            },
            get identityId() {
                const user = this._sourceSession?.currentUser;
                return (user && user.id !== 'guest') ? user.id : this.tenantId;
            },
            get realmId() {
                return this._sourceRealm?.getActiveRealm() || "unknown";
            },
            get flowId() {
                return this._sourceSession?.activeFlowId || "shell";
            },
            get tier() {
                const ctx = this._sourcePM?.getContext?.();
                return ctx?.tier || "local";
            },
            
            // Interaction: Generate Canonical URI
            toURI() {
                const base = `np://${this.tenantId}/${this.identityId}/${this.realmId}/${this.flowId}`;
                return `${base}?tier=${this.tier}`;
            },

            // Internal Sources (Private-ish)
            _sourceSession: null,
            _sourceRealm: null,
            _sourcePM: null
        });

        // 3. Service Trackers
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._service._sourceSession = context.getService(ref);
                this._logger.debug("Stratum Core: Session linked.");
                return this._service._sourceSession;
            },
            removedService: () => { this._service._sourceSession = null; }
        }).open();

        context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._service._sourceRealm = context.getService(ref);
                this._logger.debug("Stratum Core: Realm Manager linked.");
                return this._service._sourceRealm;
            },
            removedService: () => { this._service._sourceRealm = null; }
        }).open();

        context.trackService(`(objectClass=${PERSISTENCE_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._service._sourcePM = context.getService(ref);
                this._logger.debug("Stratum Core: Persistence Manager linked.");
                return this._service._sourcePM;
            },
            removedService: () => { this._service._sourcePM = null; }
        }).open();

        // 4. Register the Service
        context.registerService(STRATUM_SERVICE, this._service);
        this._logger.info("Stratum Core Indicator: Registered 🪐🛡️");
    }

    stop() {
        this._logger.info("Stratum Core: Stopped.");
    }
}
