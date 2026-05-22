/**
 * @file Activator for org.neverplayed.being-service
 * @module platform/bundles/org.neverplayed.being-service
 */

import { SESSION_SERVICE, LOG_SERVICE, PERSISTENCE_RESOLVER_SERVICE, BEING_SERVICE, YAML_SERVICE } from "../../core-types.js";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    _session = null;
    _resolver = null;
    _yaml = null;
    _beingsData = [];
    _surrogatesData = [];
    _hydrationPromise = null;

    async onStart(context) {
        // 1. Track Session Service
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: async (ref) => {
                this._session = context.getService(ref);
                if (this._hydrationPromise) await this._hydrationPromise;
                if (this._session && this._beingsData.length > 0) {
                    const enrichedBeings = this._beingsData.map(b => {
                        if (b.initial?.surrogate) {
                            return { 
                                ...b, 
                                initial: { 
                                    ...b.initial, 
                                    surrogateData: this._surrogatesData.find(s => s.id === b.initial.surrogate) || {} 
                                } 
                            };
                        }
                        return b;
                    });
                    this._session.registerIdentities(enrichedBeings);
                }
                return this._session;
            },
            removedService: () => { this._session = null; }
        });

        // 2. Track Persistence Resolver (to resolve being homes)
        this.track(`(objectClass=${PERSISTENCE_RESOLVER_SERVICE})`, {
            addingService: (ref) => {
                this._resolver = context.getService(ref);
                this._hydrationPromise = this._hydrateBeings();
                return this._resolver;
            },
            removedService: () => { this._resolver = null; }
        });

        // 3. Track YAML Service (for seed data)
        this.track(`(objectClass=${YAML_SERVICE})`, {
            addingService: (ref) => {
                this._yaml = context.getService(ref);
                this._hydrationPromise = this._hydrateBeings();
                return this._yaml;
            },
            removedService: () => { this._yaml = null; }
        });

        // 4. Register Being Service
        const beingService = {
            /**
             * Materialize a being as a specific surrogate.
             * @param {string} beingId - The Level 1 Identity ID (e.g., 'rob')
             * @param {string} [surrogateId] - The functional role (defaults to initial coordinate or 'guest')
             * @param {Object} [attributes] - Functional attributes for the surrogate
             * @param {string} [realmId] - Optional target realm for the materialization
             */
            materialize: (beingId, surrogateId = null, attributes = {}, realmId = null) => {
                if (!this._session) throw new Error("Session Service unavailable");

                const being = beingService.getBeing(beingId);
                const targetSurrogate = surrogateId || being?.initial?.surrogate || 'guest';
                const targetRealm = realmId || being?.initial?.realm || this._session.activeRealmId || 'global';
                const surrogateData = beingService.getSurrogate(targetSurrogate) || {};
                
                this.logger.info(`Being Service: Materializing ${beingId} as ${targetSurrogate} in realm ${targetRealm}`);
                
                this._session.login(beingId, targetRealm, {
                    id: targetSurrogate,
                    ...surrogateData,
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
                const being = beingService.getBeing(beingId);
                const realm = this._session.activeRealmId || being?.initial?.realm || 'global';
                this._session.login(beingId, realm);
            },

            /**
             * Resolve the home realm for a being (L1) or type (Legacy).
             */
            getBeingHome: (beingIdOrType) => {
                // 1. L1 Resolution (Ontological Grounding)
                const being = beingService.getBeing(beingIdOrType);
                if (being) {
                    if (being.originRealmId) return being.originRealmId;
                    if (being.initial?.originRealmId) return being.initial.originRealmId;
                    if (being.initial?.realm) return being.initial.realm;
                }

                // 2. Legacy Type Resolution (Policy-based)
                if (!this._resolver) return null;
                const policy = this._resolver.getPolicy(`org.neverplayed.beings/${beingIdOrType}/`);
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
            },
            
            /**
             * Get all known beings from seed data.
             */
            getKnownBeings: () => this._beingsData,

            /**
             * Get a specific known being by ID.
             */
            getBeing: (id) => this._beingsData.find(b => b.id === id),

            /**
             * Get a specific known surrogate by ID.
             */
            getSurrogate: (id) => this._surrogatesData.find(s => s.id === id)
        };

        context.registerService(BEING_SERVICE, beingService);
        this.logger.info("Being Service: Registered 🧬✨");
    }

    async _hydrateBeings() {
        if (!this._yaml) {
            this.logger.debug("Being Service: Delaying hydration, YAML service not yet available.");
            return;
        }
        
        try {
            // 1. Hydrate Surrogates
            const surrogatesUrl = this.resolveResource("data/surrogates.yaml");
            this.logger.info(`Being Service: Fetching surrogates from ${surrogatesUrl}...`);
            const surrogatesRes = await fetch(surrogatesUrl);
            if (!surrogatesRes.ok) throw new Error(`HTTP ${surrogatesRes.status}`);
            this._surrogatesData = this._yaml.load(await surrogatesRes.text()) || [];
            this.logger.info(`Being Service: Hydrated ${this._surrogatesData.length} known surrogates.`);

            // 2. Hydrate Beings
            const url = this.resolveResource("data/beings.yaml");
            this.logger.info(`Being Service: Fetching beings from ${url}...`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            this._beingsData = this._yaml.load(text) || [];
            this.logger.info(`Being Service: Hydrated ${this._beingsData.length} known beings.`);
            
            if (this._session) {
                this.logger.info(`Being Service: Injecting ${this._beingsData.length} beings into Session Service...`);
                const enrichedBeings = this._beingsData.map(b => {
                    if (b.initial?.surrogate) {
                        return { 
                            ...b, 
                            initial: { 
                                ...b.initial, 
                                surrogateData: this._surrogatesData.find(s => s.id === b.initial.surrogate) || {} 
                            } 
                        };
                    }
                    return b;
                });
                this._session.registerIdentities(enrichedBeings);
            } else {
                this.logger.warn("Being Service: Cannot inject beings, Session Service not yet available.");
            }
        } catch (err) {
            this.logger.error("Being Service: Failed to hydrate beings or surrogates:", err.message);
        }
    }
}
