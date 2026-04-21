import { PERSISTENCE_RESOLVER_SERVICE, REALM_MANAGER_SERVICE } from "../../core-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    _realmManager = null;
    _realms = new Map();

    _briefings = new Map();

    onStart(context) {
        this.logger.info("Persistence Resolver: Starting...");

        // 1. Track Realm Manager for Active Context (Tier 0 Authority)
        context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._realmManager = context.getService(ref);
                this.logger.debug("Persistence Resolver: Connected to Realm Manager.");
                return this._realmManager;
            },
            removedService: () => {
                this._realmManager = null;
            }
        }).open();

        // 2. Register Global Resolver Service
        context.registerService(PERSISTENCE_RESOLVER_SERVICE, {
            /**
             * Resolve the effective persistence strategy for a specific Domain Object or Bundle.
             * 
             * @param {Object} contextInfo - { key, instanceSpec, blueprintSpec, bundlePolicy, systemDefault }
             * @returns {Object} - { tier: 'local'|'cloud'|'volatile', provider?: string, bucket?: string }
             */
            resolve: (contextInfo = {}) => this._resolveEffectivePolicy(contextInfo),

            /**
             * Brief the oracle on a strategic persistence policy for a specific key pattern.
             * 
             * @param {string} pattern - Key prefix or unique identifier
             * @param {Object} policy - { tier, bucket, ... }
             */
            registerPolicy: (pattern, policy) => {
                console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Briefing accepted for [${pattern}] ->`, policy);
                this._briefings.set(pattern, policy);
            },

            unregisterPolicy: (pattern) => {
                this._briefings.delete(pattern);
            }
        });

        this.logger.info("Persistence Resolver: ACTIVE. 🏗️✅");
    }

    _resolveEffectivePolicy(info) {
        const targetId = info.blueprintSpec?.id || info.instanceSpec?.blueprintId || info.key || "unknown";

        // --- TIER -1: REALM-DO SPECIALIZED POLICY (NPRF Absolute Priority) ---
        if (this._realmManager && (info.blueprintSpec?.id || info.instanceSpec?.blueprintId)) {
            const doId = info.blueprintSpec?.id || info.instanceSpec?.blueprintId;
            const activeId = this._realmManager.getActiveRealm();
            const realms = this._realmManager.getRealms();
            const activeRealm = realms.find(r => r.id === activeId);
            
            if (activeRealm?.domainObjects) {
                const doConfig = activeRealm.domainObjects.find(d => d.id === doId);
                if (doConfig?.persistence) {
                    console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Realm '${activeId}' enforcing SPECIALIZED policy for DO '${doId}':`, doConfig.persistence);
                    return doConfig.persistence;
                }
            }
        }

        // --- TIER 0: REALM GLOBAL POLICY (The Context Boundary) ---
        if (this._realmManager) {
            const activeId = this._realmManager.getActiveRealm();
            const realms = this._realmManager.getRealms();
            const activeRealm = realms.find(r => r.id === activeId);
            
            if (activeRealm?.persistencePolicy) {
                if (activeRealm.persistencePolicy.enforce) {
                    console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Realm '${activeId}' enforcing GLOBAL policy:`, activeRealm.persistencePolicy);
                    return activeRealm.persistencePolicy;
                }
            }
        }

        // --- TIER 1: BUNDLE POLICY (Developer Mandate) ---
        if (info.bundlePolicy) {
            console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Using Bundle-level policy override for [${targetId}].`);
            return info.bundlePolicy;
        }

        // --- TIER 1.5: DYNAMIC BRIEFING REGISTRY (Sovereign Intent) ---
        if (info.key) {
            for (const [pattern, policy] of this._briefings.entries()) {
                if (info.key.startsWith(pattern)) {
                    console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Hierarchical match found for [${info.key}] via Briefing [${pattern}] -> Tier: ${policy.tier}`);
                    return policy;
                }
            }
        }

        // --- TIER 2: INSTANCE OVERRIDE (User Choice) ---
        if (info.instanceSpec?.persistence) {
            console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Using Instance-level persistence choice for [${targetId}].`);
            return info.instanceSpec.persistence;
        }

        // --- TIER 3: BLUEPRINT DEFAULT (Designer Intent) ---
        if (info.blueprintSpec?.domainObject?.persistence) {
            console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Resolved Tier [${info.blueprintSpec.domainObject.persistence.tier}] from Blueprint Default for [${targetId}].`);
            return info.blueprintSpec.domainObject.persistence;
        }

        // --- TIER 4: SYSTEM DEFAULT (Infrastructure Gravity) ---
        const fallback = info.systemDefault || { tier: 'cloud' };
        console.info(`[LOOP-SAFE] [FORENSIC] Persistence Resolver: Falling back to System Default [${fallback.tier}] for [${targetId}].`);
        return fallback;
    }
}
