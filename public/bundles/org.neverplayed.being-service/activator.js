/**
 * @file Activator for org.neverplayed.being-service
 * @module platform/bundles/org.neverplayed.being-service
 */

import { SESSION_SERVICE, LOG_SERVICE, PERSISTENCE_RESOLVER_SERVICE, BEING_SERVICE } from "../../core-types.js";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    _session = null;
    _resolver = null;

    async onStart(context) {
        // 1. Track Session Service
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                return this._session;
            },
            removedService: () => { this._session = null; }
        });

        // 2. Track Persistence Resolver (to resolve being homes)
        this.track(`(objectClass=${PERSISTENCE_RESOLVER_SERVICE})`, {
            addingService: (ref) => {
                this._resolver = context.getService(ref);
                return this._resolver;
            },
            removedService: () => { this._resolver = null; }
        });

        // 3. Register Being Service
        const beingService = {
            /**
             * Materialize a being as a specific surrogate.
             * @param {string} beingId - The Level 1 Identity ID (e.g., 'rob')
             * @param {string} surrogateId - The functional role (e.g., 'person', 'registry-admin')
             * @param {Object} attributes - Functional attributes for the surrogate
             * @param {string} [realmId] - Optional target realm for the materialization
             */
            materialize: (beingId, surrogateId, attributes = {}, realmId = null) => {
                if (!this._session) throw new Error("Session Service unavailable");

                const targetRealm = realmId || this._session.activeRealmId || 'global';
                
                this.logger.info(`Being Service: Materializing ${beingId} as ${surrogateId} in realm ${targetRealm}`);
                
                this._session.login(beingId, targetRealm, {
                    id: surrogateId,
                    ...attributes,
                    beingId
                });

                // Auto-focus the being if it's the first materialization
                if (!this._session.activeBeingId) {
                    this._session.setBeingFocus(beingId);
                }
            },

            /**
             * Anchor a specific Being as the session focus (Carry-over).
             */
            activateBeing: (beingId) => {
                if (!this._session) throw new Error("Session Service unavailable");
                this._session.setBeingFocus(beingId);
                
                // Ensure the being is logged into the current realm at least as a baseline
                const realm = this._session.activeRealmId || 'global';
                this._session.login(beingId, realm);
            },

            /**
             * Resolve the home realm for a being type.
             */
            getBeingHome: (type) => {
                if (!this._resolver) return null;
                const policy = this._resolver.getPolicy(`org.neverplayed.beings/${type}/`);
                return policy ? policy.realm : null;
            },

            /**
             * Get the current materialized identity for a given being ID.
             */
            getMaterialization: (beingId, realmId = null) => {
                if (!this._session) return null;
                const targetRealm = realmId || this._session.activeRealmId || 'global';
                const stack = this._session.scopedUsers[targetRealm];
                if (!stack || !stack[beingId]) return null;

                const identity = stack[beingId];
                if (identity.activeSurrogateId && identity.surrogates[identity.activeSurrogateId]) {
                    return {
                        ...identity,
                        ...identity.surrogates[identity.activeSurrogateId]
                    };
                }
                return identity;
            }
        };

        context.registerService(BEING_SERVICE, beingService);
        this.logger.info("Being Service: Registered 🧬✨");
    }
}
