/**
 * @file Activator for org.neverplayed.stratum-core
 * @module platform/bundles/org.neverplayed.stratum-core
 */

import { 
    STRATUM_SERVICE, 
    SESSION_SERVICE, 
    REALM_MANAGER_SERVICE, 
    PERSISTENCE_MANAGER_SERVICE, 
    LOG_SERVICE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    SESSION_CHANGED_TOPIC,
    REALM_CHANGED_TOPIC,
    PERSISTENCE_CONTEXT_CHANGED_TOPIC,
    STRATUM_CHANGED_TOPIC,
    NEVERPLAYED_PREFIX
} from "../../core-types.js";

export class StratumServiceImpl {
    constructor(logger) {
        this._logger = logger;
        this._perspective = "idealist";
        this.inhabitants = [];
        this._sourceSession = null;
        this._sourceRealm = null;
        this._sourcePM = null;
        this._eventAdmin = null;
        this._eventFactory = null;
        this._updatePending = false;
    }

    get perspective() {
        return this._perspective;
    }

    set perspective(val) {
        if (this._perspective !== val) {
            this._perspective = val;
            this.triggerUpdate();
        }
    }

    get tenantId() {
        const globalStack = this._sourceSession?.scopedUsers?.["global"];
        if (!globalStack) return "guest";
        const activeId = globalStack.__activeId__;
        const globalUser = globalStack[activeId] || globalStack['guest'];
        return (globalUser && globalUser.id !== 'guest') ? globalUser.id : "guest";
    }

    get identityId() {
        const user = this._sourceSession?.currentUser;
        return (user && user.id !== 'guest') ? user.id : this.tenantId;
    }

    get realmId() {
        return this._sourceRealm?.getActiveRealm() || "unknown";
    }

    get flowId() {
        return this._sourceSession?.activeFlowId || "shell";
    }

    get tier() {
        const ctx = this._sourcePM?.getContext?.();
        return ctx?.tier || "local";
    }

    get occupants() {
        if (!this._sourceSession || !this._sourceSession.scopedUsers) return [];
        const scope = this.realmId;
        const stack = this._sourceSession.scopedUsers[scope] || {};
        return Object.keys(stack).filter(id => {
            if (id === 'guest' || id === '__activeId__') return false;
            return stack[id] && stack[id].loggedIn === true;
        });
    }

    get residents() {
        return this.occupants;
    }

    toURI() {
        if (this.perspective === 'realist') {
            return `np://${this.tenantId}/${this.realmId}/${this.identityId}/${this.flowId}?tier=${this.tier}`;
        }
        return `np://${this.tenantId}/${this.identityId}/${this.realmId}/${this.flowId}?tier=${this.tier}`;
    }

    async getHierarchy() {
        if (!this._sourceRealm) return [];
        return await this._sourceRealm.getHierarchy(this.realmId);
    }

    async getTraceMakers() {
        if (!this._sourcePM) return [];
        const currentRealm = this.realmId;
        const allKeys = await this._sourcePM.listKeys("");
        const traceMakers = new Set();
        for (const key of allKeys) {
             const probe = await this._sourcePM.probe(key);
             if (probe && probe.context && probe.context.identityId && probe.context.realmId === currentRealm) {
                  traceMakers.add(probe.context.identityId);
             }
        }
        return Array.from(traceMakers).filter(id => id !== 'guest');
    }

    async getInhabitants() {
        const occupants = this.occupants;
        const traceMakers = await this.getTraceMakers();
        const union = new Set([...occupants, ...traceMakers]);
        return Array.from(union);
    }

    async _refreshInhabitants() {
        const newInhabitants = await this.getInhabitants();
        const changed = JSON.stringify(this.inhabitants) !== JSON.stringify(newInhabitants);
        if (changed) {
            this.inhabitants = newInhabitants;
        }
    }

    triggerUpdate() {
        if (this._updatePending) return;
        this._updatePending = true;
        Promise.resolve().then(async () => {
            this._updatePending = false;
            const grounding = this._sourceSession?.currentUser?.grounding;
            if (grounding && (grounding === 'idealist' || grounding === 'realist')) {
                this._perspective = grounding;
            }
            await this._refreshInhabitants();
            this._broadcastChanged();
        });
    }

    _broadcastChanged() {
        if (this._eventAdmin && this._eventFactory) {
            const properties = {
                tenantId: this.tenantId,
                identityId: this.identityId,
                realmId: this.realmId,
                flowId: this.flowId,
                tier: this.tier,
                perspective: this.perspective,
                inhabitants: [...this.inhabitants],
                occupants: [...this.occupants],
                residents: [...this.residents]
            };
            const event = this._eventFactory.build(STRATUM_CHANGED_TOPIC, properties);
            this._eventAdmin.postEvent(event);
            this._logger?.debug(`Stratum Core: Broadcasted ${STRATUM_CHANGED_TOPIC}`, properties);
        }
    }

    async jump(uri) {
        if (!uri || !uri.startsWith("np://")) throw new Error("Invalid Stratum URI");
        const url = new URL(uri.replace("np://", "http://")); 
        const tenant = url.hostname;
        const segments = url.pathname.split('/').filter(s => s);
        const tier = url.searchParams.get("tier");
        let identity, realm, perspective;
        if (segments[0]?.startsWith(`${NEVERPLAYED_PREFIX}realm`)) {
            realm = segments[0];
            identity = segments[1];
            perspective = 'realist';
        } else {
            identity = segments[0];
            realm = segments[1];
            perspective = 'idealist';
        }
        identity = identity || tenant;
        const aperture = segments[2] || 'shell';

        if (this._sourceSession && tier) {
            this._sourceSession.tier = tier;
        }
        this._perspective = perspective;

        if (this._sourceRealm && realm && typeof this._sourceRealm.coordinateTransition === 'function') {
            await this._sourceRealm.coordinateTransition({
                realmId: realm,
                identityId: identity,
                perspective,
                aperture,
                tenantId: tenant
            });
        } else {
            if (this._sourceSession) {
                await this._sourceSession.login(identity, realm);
            }
            if (this._sourceRealm && realm) {
                await this._sourceRealm.switchRealm(realm);
            }
        }
        if (aperture && aperture !== 'shell') {
            if (this._sourceSession) {
                this._sourceSession.activeFlowId = aperture;
            }
            if (typeof globalThis.dispatchEvent === 'function') {
                globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id: aperture } }));
            }
        }
        this.triggerUpdate();
        return { perspective, tenant, identity, realm, tier: tier || 'local' };
    }

    async login(identityId, scope = null) {
        if (!this._sourceSession) return;
        const targetScope = scope || this.realmId || 'global';
        this._logger.info(`[StratumCore] Identity LOGIN triggered: ${identityId} in scope ${targetScope}`);
        await this._sourceSession.login(identityId, targetScope);
        this.triggerUpdate();
    }

    async logout(scope = null) {
        if (!this._sourceSession) return;
        const targetScope = scope || (this.realmId !== 'unknown' ? this.realmId : 'global');
        this._logger.info(`[StratumCore] Identity LOGOUT triggered for scope: ${targetScope}`);
        await this._sourceSession.logout(targetScope);
        this.triggerUpdate();
    }
}

export default class Activator {
    _logger = console;
    _service = null;
    _trackers = [];
    _registrations = [];

    start(context) {
        // 1. Logger Integration
        this._logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratum Core: Connected to Logger.");
                if (this._service) this._service._logger = this._logger;
                return logAdmin;
            }
        });
        this._logTracker.open();
        this._trackers.push(this._logTracker);

        // 2. Initialize plain JS Stratum Service
        this._service = new StratumServiceImpl(this._logger);

        // 3. Register OSGi EventHandlers to track session, realm, and persistence updates
        const props = {
            [EVENT_TOPIC]: [
                SESSION_CHANGED_TOPIC,
                REALM_CHANGED_TOPIC,
                PERSISTENCE_CONTEXT_CHANGED_TOPIC
            ]
        };
        const handlerReg = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                this._logger?.debug(`Stratum Core: Caught event topic ${event.getTopic()}, updating...`);
                this._service.triggerUpdate();
            }
        }, props);
        this._registrations.push(handlerReg);

        // 4. Track Event Admin & Factory for broadcasting Stratum Core changes
        const eventAdminTracker = context.trackService(`(objectClass=${EVENT_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                this._service._eventAdmin = context.getService(ref);
                if (this._service._eventAdmin?.build && !this._service._eventFactory) {
                    this._service._eventFactory = this._service._eventAdmin;
                }
                return this._service._eventAdmin;
            },
            removedService: () => {
                this._service._eventAdmin = null;
            }
        });
        eventAdminTracker.open();
        this._trackers.push(eventAdminTracker);

        const eventFactoryTracker = context.trackService(`(objectClass=${EVENT_FACTORY_SERVICE})`, {
            addingService: (ref) => {
                this._service._eventFactory = context.getService(ref);
                return this._service._eventFactory;
            },
            removedService: () => {
                this._service._eventFactory = null;
            }
        });
        eventFactoryTracker.open();
        this._trackers.push(eventFactoryTracker);

        // 5. Track other dependencies (Session, RealmManager, PM Selector Proxy)
        const sessionTracker = context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._service._sourceSession = context.getService(ref);
                this._logger.debug("Stratum Core: Session linked.");
                this._service.triggerUpdate();
                return this._service._sourceSession;
            },
            removedService: () => {
                this._service._sourceSession = null;
            }
        });
        sessionTracker.open();
        this._trackers.push(sessionTracker);

        const realmTracker = context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._service._sourceRealm = context.getService(ref);
                this._logger.debug("Stratum Core: Realm Manager linked.");
                this._service.triggerUpdate();
                return this._service._sourceRealm;
            },
            removedService: () => {
                this._service._sourceRealm = null;
            }
        });
        realmTracker.open();
        this._trackers.push(realmTracker);

        const pmTracker = context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(implementation=selector-proxy))`, {
            addingService: (ref) => {
                this._service._sourcePM = context.getService(ref);
                this._logger.debug("Stratum Core: Persistence Manager linked.");
                this._service.triggerUpdate();
                return this._service._sourcePM;
            },
            removedService: () => {
                this._service._sourcePM = null;
            }
        });
        pmTracker.open();
        this._trackers.push(pmTracker);

        // 6. Register Stratum Core Service
        const serviceReg = context.registerService(STRATUM_SERVICE, this._service);
        this._registrations.push(serviceReg);
        this._logger.info("Stratum Core Indicator: Registered Headless 🪐🛡️");
    }

    stop() {
        for (const reg of this._registrations) {
            try { reg.unregister(); } catch(e) {}
        }
        for (const tracker of this._trackers) {
            try { tracker.close(); } catch(e) {}
        }
        this._logger.info("Stratum Core: Stopped.");
    }
}
