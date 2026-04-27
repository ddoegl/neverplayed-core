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
            _pulse: 0,
            get tenantId() {
                this._pulse; // Dependency
                return this._sourceSession?.scopedUsers?.global?.id || "guest";
            },
            get identityId() {
                this._pulse; // Dependency
                const user = this._sourceSession?.currentUser;
                return (user && user.id !== 'guest') ? user.id : this.tenantId;
            },
            get realmId() {
                this._pulse; // Dependency
                return this._sourceRealm?.getActiveRealm() || "unknown";
            },
            get flowId() {
                this._pulse; // Dependency
                return this._sourceSession?.activeFlowId || "shell";
            },
            get tier() {
                this._pulse; // Dependency
                const ctx = this._sourcePM?.getContext?.();
                return ctx?.tier || "local";
            },
            
            perspective: "idealist", // Stance: 'idealist' or 'realist'

            // Interaction: Generate Canonical URI
            toURI() {
                if (this.perspective === 'realist') {
                    // Environment-Centric: Realm [Soil] is foundational
                    return `np://${this.tenantId}/${this.realmId}/${this.identityId}/${this.flowId}?tier=${this.tier}`;
                }
                // Idealist-Centric (Default): World is a projection of the Identity [Lightcone]
                return `np://${this.tenantId}/${this.identityId}/${this.realmId}/${this.flowId}?tier=${this.tier}`;
            },

            async getHierarchy() {
                if (!this._sourceRealm) return [];
                return await this._sourceRealm.getHierarchy(this.realmId);
            },

            async getInhabitants() {
                if (!this._sourcePM) return [];
                
                // Forensic Scan: We use listKeys with a broad prefix to find other identities
                // We assume the provider allows listing across identities if we have permission.
                const allKeys = await this._sourcePM.listKeys("");
                const inhabitants = new Set();
                
                // Rule: Identity Trace Recovery (ADR-0167)
                // Physical Key: np:v1:tenant:realm:identity:logicalKey
                // So identity is at index 4 in ':' split
                for (const key of allKeys) {
                    // Note: PersistenceManager.listKeys returns logical keys, 
                    // we need to probe to find the physical identity.
                     const probe = await this._sourcePM.probe(key);
                     if (probe && probe.context && probe.context.identityId) {
                         inhabitants.add(probe.context.identityId);
                     }
                }
                
                // Fallback: Also include scoped users from session
                if (this._sourceSession?.scopedUsers) {
                    Object.values(this._sourceSession.scopedUsers).forEach(u => {
                        if (u.id) inhabitants.add(u.id);
                    });
                }
                if (this._sourceSession?.currentUser) inhabitants.add(this._sourceSession.currentUser.id);

                return Array.from(inhabitants).filter(id => id !== 'guest');
            },

            get residents() {
                this._pulse;
                if (!this._sourceSession || !this._sourceSession.scopedUsers) return [];
                const scope = this.realmId;
                const stack = this._sourceSession.scopedUsers[scope] || {};
                return Object.keys(stack).filter(id => id !== 'guest' && id !== '__activeId__');
            },

            // Unified Interaction Protocol
            async jump(uri) {
                if (!uri || !uri.startsWith("np://")) throw new Error("Invalid Stratum URI");
                
                const url = new URL(uri.replace("np://", "http://")); 
                const tenant = url.hostname;
                const segments = url.pathname.split('/').filter(s => s);
                const tier = url.searchParams.get("tier");

                let identity, realm, perspective;

                // Cognitive Detection: Deduce perspective from segment structure
                if (segments[0]?.startsWith('org.neverplayed.realm')) {
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

                // 1. Persistence Pivot (Tier Shunting via Session)
                if (this._sourceSession && tier) {
                    this._sourceSession.tier = tier;
                }

                // 2. Perspective Alignment
                this.perspective = perspective;

                // 3. Identity Pivot (Sovereign Login)
                if (this._sourceSession) {
                    await this._sourceSession.login(identity, realm);
                }

                // 4. Realm Pivot (Structural Transition)
                if (this._sourceRealm && realm) {
                    await this._sourceRealm.switchRealm(realm);
                }

                this._pulse++; // Broadcast state pulse
                return { perspective, tenant, identity, realm, tier: tier || 'local' };
            },

            async login(identityId, scope = null) {
                if (!this._sourceSession) return;
                const targetScope = scope || this.realmId || 'global';
                console.info(`[StratumCore] Identity LOGIN triggered: ${identityId} in scope ${targetScope}`);
                await this._sourceSession.login(identityId, targetScope);
                this._pulse++;
            },

            async logout(scope = null) {
                if (!this._sourceSession) return;
                const targetScope = scope || (this.realmId !== 'unknown' ? this.realmId : 'global');
                console.info(`[StratumCore] Identity LOGOUT triggered for scope: ${targetScope}`);
                await this._sourceSession.logout(targetScope);
                this._pulse++;
            },

            // Internal Sources (Private-ish)
            _sourceSession: null,
            _sourceRealm: null,
            _sourcePM: null
        });
 
        // 2.1 Listen for System Shunts
        globalThis.addEventListener("pm-context-shifted", () => {
            this._logger.info("Stratum Core: System Shunt detected. Pulsing state...");
            this._service._pulse++;
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

        context.trackService(`(&(objectClass=${PERSISTENCE_MANAGER_SERVICE})(implementation=selector-proxy))`, {
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
