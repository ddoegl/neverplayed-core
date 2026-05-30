/**
 * @file Activator for org.neverplayed.being-service
 * @module platform/bundles/org.neverplayed.being-service
 */

import { SESSION_SERVICE, LOG_SERVICE, BEING_SERVICE } from "../../core-types.js";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    _session = null;
    _beingsData = [];
    _surrogatesData = [
        { id: "observer", label: "Observer", senses: ["Primordial", "Language"] },
        { id: "sovereign-guard", label: "Sovereign Guard", senses: ["Primordial", "Language", "ForensicVision", "ArchitectControl", "InhabitantGuardianship"] },
        { id: "system-collector", label: "Strata Collector", senses: ["Primordial", "Language", "SpaceReclamation"] }
    ];

    async onStart(context) {
        // 1. Track Session Service
        this.track(`(objectClass=${SESSION_SERVICE})`, {
            addingService: async (ref) => {
                this._session = context.getService(ref);
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

        // 2. Register Being Service
        const beingService = {
            /**
             * Register beings dynamically.
             */
            registerBeings: (beingsArray) => {
                this._beingsData = beingsArray || [];
                this.logger?.info(`Being Service: Dynamic registration of ${this._beingsData.length} beings.`);
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
            },

            /**
             * Register surrogates dynamically (merges into defaults).
             */
            registerSurrogates: (surrogatesArray) => {
                const defaults = [
                    { id: "observer", label: "Observer", senses: ["Primordial", "Language"] },
                    { id: "sovereign-guard", label: "Sovereign Guard", senses: ["Primordial", "Language", "ForensicVision", "ArchitectControl", "InhabitantGuardianship"] },
                    { id: "system-collector", label: "Strata Collector", senses: ["Primordial", "Language", "SpaceReclamation"] }
                ];
                const dynamic = surrogatesArray || [];
                const merged = [...defaults];
                for (const item of dynamic) {
                    if (!merged.some(s => s.id === item.id)) {
                        merged.push(item);
                    }
                }
                this._surrogatesData = merged;
                this.logger?.info(`Being Service: Surrogates dynamic catalog updated. Total surrogates: ${this._surrogatesData.length}`);
            },

            /**
             * Clear dynamically registered beings/surrogates back to primordial baseline.
             */
            clear: () => {
                this._beingsData = [];
                this._surrogatesData = [
                    { id: "observer", label: "Observer", senses: ["Primordial", "Language"] },
                    { id: "sovereign-guard", label: "Sovereign Guard", senses: ["Primordial", "Language", "ForensicVision", "ArchitectControl", "InhabitantGuardianship"] },
                    { id: "system-collector", label: "Strata Collector", senses: ["Primordial", "Language", "SpaceReclamation"] }
                ];
                this.logger?.info("Being Service: Dynamic spatial seed data cleared. Restored primordial default surrogates.");
            },

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
                const targetRealm = realmId || being?.initial?.realm || this._session.activeRealmId || 'platonic';
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
                const realm = this._session.activeRealmId || being?.initial?.realm || 'platonic';
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
                return null;
            },

            /**
             * Get the current materialized identity for a given being ID.
             */
            getMaterialization: (beingId, realmId = null) => {
                if (!this._session) return null;
                const targetRealm = realmId || this._session.activeRealmId || 'platonic';
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
            getKnownBeings: () => {
                const standardRealms = [
                    "org.neverplayed.realm.core",
                    "org.neverplayed.realm.foundation",
                    "org.neverplayed.realm.showcase",
                    "org.neverplayed.realm.habitat",
                    "org.neverplayed.realm.governance"
                ];
                const synthesizedRealms = standardRealms.map(realmId => ({
                    id: `realm:${realmId}`,
                    label: `Realm Mind (${realmId.split('.').pop()})`,
                    email: `${realmId}@neverplayed.realm`,
                    originRealmId: realmId,
                    isRealmBeing: true,
                    surrogates: ['system-collector', 'sovereign-guard']
                }));
                
                // Synthesize virtual being and tenant minds for all loaded beings
                const virtuals = [];
                this._beingsData.forEach(b => {
                    if (b.id && b.id !== 'guest' && !b.id.includes(':')) {
                        virtuals.push({
                            id: `being:${b.id}`,
                            label: `Being Mind (${b.id})`,
                            email: `${b.id}@neverplayed.being`,
                            originRealmId: `being:${b.id}`,
                            isBeingRealm: true,
                            surrogates: ['observer', 'sovereign-guard', 'system-collector']
                        });
                        virtuals.push({
                            id: `tenant:${b.id}`,
                            label: `Tenant Cosmic Envelope (${b.id})`,
                            email: `${b.id}@neverplayed.tenant`,
                            originRealmId: `tenant:${b.id}`,
                            isTenantRealm: true,
                            surrogates: ['observer', 'sovereign-guard', 'system-collector']
                        });
                    }
                });
                
                // Add global tenant
                virtuals.push({
                    id: "tenant:global",
                    label: "Tenant Cosmic Envelope",
                    email: "global@neverplayed.tenant",
                    originRealmId: "tenant:global",
                    isTenantRealm: true,
                    surrogates: ['observer', 'sovereign-guard', 'system-collector']
                });

                return [...this._beingsData, ...synthesizedRealms, ...virtuals];
            },

            /**
             * Get a specific known being by ID.
             */
            getBeing: (id) => {
                if (id && id.startsWith('realm:')) {
                    const realmId = id.substring(6);
                    return {
                        id: id,
                        label: `Realm Mind (${realmId.split('.').pop()})`,
                        email: `${realmId}@neverplayed.realm`,
                        originRealmId: realmId,
                        isRealmBeing: true,
                        surrogates: ['system-collector', 'sovereign-guard']
                    };
                }
                if (id && id.startsWith('being:')) {
                    const identityId = id.substring(6);
                    return {
                        id: id,
                        label: `Being Mind (${identityId})`,
                        email: `${identityId}@neverplayed.being`,
                        originRealmId: `being:${identityId}`,
                        isBeingRealm: true,
                        surrogates: ['observer', 'sovereign-guard', 'system-collector']
                    };
                }
                if (id && id.startsWith('tenant:')) {
                    const tenantId = id.substring(7);
                    return {
                        id: id,
                        label: `Tenant Cosmic Envelope (${tenantId})`,
                        email: `${tenantId}@neverplayed.tenant`,
                        originRealmId: `tenant:${tenantId}`,
                        isTenantRealm: true,
                        surrogates: ['observer', 'sovereign-guard', 'system-collector']
                    };
                }
                return this._beingsData.find(b => b.id === id);
            },

            /**
             * Get a specific known surrogate by ID.
             */
            getSurrogate: (id) => this._surrogatesData.find(s => s.id === id)
        };

        context.registerService(BEING_SERVICE, beingService);
        this.logger.info("Being Service: Registered 🧬✨");
    }
}
