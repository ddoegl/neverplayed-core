import { PERSISTENCE_RESOLVER_SERVICE, REALM_MANAGER_SERVICE } from "../../shared-types.js";
import { BaseActivator } from "../../osgi-base.js";

export default class Activator extends BaseActivator {
    _realmManager = null;
    _realms = new Map();

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
             * @param {Object} contextInfo - { instanceSpec, blueprintSpec, bundlePolicy, systemDefault }
             * @returns {Object} - { tier: 'local'|'cloud'|'volatile', provider?: string, bucket?: string }
             */
            resolve: (contextInfo = {}) => this._resolveEffectivePolicy(contextInfo)
        });

        this.logger.info("Persistence Resolver: ACTIVE. 🏗️✅");
    }

    _resolveEffectivePolicy(info) {
        // --- TIER -1: REALM-DO SPECIALIZED POLICY (NPRF Absolute Priority) ---
        if (this._realmManager && (info.blueprintSpec?.id || info.instanceSpec?.blueprintId)) {
            const doId = info.blueprintSpec?.id || info.instanceSpec?.blueprintId;
            const activeId = this._realmManager.getActiveRealm();
            const realms = this._realmManager.getRealms();
            const activeRealm = realms.find(r => r.id === activeId);
            
            if (activeRealm?.domainObjects) {
                const doConfig = activeRealm.domainObjects.find(d => d.id === doId);
                if (doConfig?.persistence) {
                    this.logger.debug(`Persistence Resolver: Realm '${activeId}' enforcing SPECIALIZED policy for DO '${doId}':`, doConfig.persistence);
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
                this.logger.debug(`Persistence Resolver: Realm '${activeId}' enforcing policy:`, activeRealm.persistencePolicy);
                // Realm can be absolute (enforce: true) or a suggestion
                if (activeRealm.persistencePolicy.enforce) {
                    return activeRealm.persistencePolicy;
                }
            }
        }

        // --- TIER 1: BUNDLE POLICY (Developer Mandate) ---
        if (info.bundlePolicy) {
            this.logger.debug("Persistence Resolver: Using Bundle-level policy override.");
            return info.bundlePolicy;
        }

        // --- TIER 2: INSTANCE OVERRIDE (User Choice) ---
        if (info.instanceSpec?.persistence) {
            this.logger.debug("Persistence Resolver: Using Instance-level persistence choice.");
            return info.instanceSpec.persistence;
        }

        // --- TIER 3: BLUEPRINT DEFAULT (Designer Intent) ---
        if (info.blueprintSpec?.domainObject?.persistence) {
            this.logger.debug("Persistence Resolver: Using Blueprint-level default policy.");
            return info.blueprintSpec.domainObject.persistence;
        }

        // --- TIER 4: SYSTEM DEFAULT (Infrastructure Gravity) ---
        this.logger.debug("Persistence Resolver: Falling back to System Default (Cloud).");
        return info.systemDefault || { tier: 'cloud' };
    }
}
