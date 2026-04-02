import { DOMAIN_OBJECT_REGISTRY_SERVICE, DOMAIN_STRATEGY_SERVICE, PERSISTENCE_RESOLVER_SERVICE, LIMES_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
    _pms = new Map(); // tier -> pm
    _resolver = null;
    _limes = null;
    _registry = null;
    _context = null;

    start(context) {
        this._context = context;
        console.log("Shared Domain Strategies: Starting Gravity-Aware Strategy provider...");

        // 1. Track PMs by tier
        context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                const tier = ref.getProperty("persistence.tier") || "local";
                this._pms.set(tier, svc);
                return svc;
            },
            removedService: (ref) => {
                const tier = ref.getProperty("persistence.tier") || "local";
                this._pms.delete(tier);
            }
        }).open();

        // 2. Track Resolver
        context.trackService(`(objectClass=${PERSISTENCE_RESOLVER_SERVICE})`, {
            addingService: (ref) => { 
                this._resolver = context.getService(ref); 
                return this._resolver; 
            },
            removedService: () => { this._resolver = null; }
        }).open();

        // 3. Track Registry
        context.trackService(`(objectClass=${DOMAIN_OBJECT_REGISTRY_SERVICE})`, {
            addingService: (ref) => { 
                this._registry = context.getService(ref); 
                this._registerIfReady(); 
                return this._registry; 
            },
            removedService: () => { this._registry = null; }
        }).open();

        // 4. Track Limes
        context.trackService(`(objectClass=${LIMES_SERVICE})`, {
            addingService: (ref) => { this._limes = context.getService(ref); return this._limes; },
            removedService: () => { this._limes = null; }
        }).open();
    }

    _registerIfReady() {
        if (!this._registry) return;
        
        const generateId = () => {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            return Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        };

        const localStrategy = {
            id: "LOCAL_STRATEGY",
            label: "Managed Persistence Engine",
            limesPrefix: "DO",
            actions: [
                { id: "view", label: "Resume Flow", icon: "fas fa-play" },
                { id: "delete", label: "Archive", icon: "fas fa-archive" }
            ],

            /**
             * Create a new Domain Object instance.
             * Gravity is resolved via Hierarchy (Tier 0-4).
             */
            createInstance: (blueprint) => {
                const policy = this._resolver ? this._resolver.resolve({ blueprintSpec: blueprint }) : { tier: 'local' };
                const pm = this._pms.get(policy.tier) || this._pms.get('local');

                if (!pm) throw new Error(`Persistence Manager for tier '${policy.tier}' not available.`);

                const pmKey = policy.bucket || blueprint.id;
                const storageKey = `do_instances_${pmKey}`;

                const instanceId = `${blueprint.id}-${generateId()}`;
                const newInstance = {
                    id: instanceId,
                    strategyId: "LOCAL_STRATEGY",
                    blueprintId: blueprint.id,
                    bucketKey: storageKey,
                    persistence: policy,
                    label: `${blueprint.label || blueprint.id} (${instanceId})`,
                    properties: {},
                    state: "DRAFT",
                    currentStep: blueprint.ui?.initialStep || (Object.keys(blueprint.ui?.steps || {}).length > 0 ? Object.keys(blueprint.ui.steps)[0] : null),
                    createdAt: new Date().toISOString()
                };

                const currentBucket = pm.load(storageKey) || {};
                currentBucket[instanceId] = newInstance;
                pm.store(storageKey, currentBucket);

                // Register with Central Index (Always Cloud/Firebase for visibility)
                this._registry.addInstance(newInstance);
                return newInstance;
            },

            updateInstance: (instanceId, blueprintId, patch) => {
                const instance = this._registry.getInstance(instanceId);
                if (!instance) return;

                const policy = instance.persistence || { tier: 'local' };
                const pm = this._pms.get(policy.tier) || this._pms.get('local');
                
                const storageKey = instance.bucketKey || `do_instances_${blueprintId}`;
                const currentBucket = pm.load(storageKey) || {};
                const oldInstance = currentBucket[instanceId];

                if (oldInstance) {
                    const updatedInstance = {
                        ...oldInstance,
                        ...patch,
                        properties: { ...(oldInstance.properties || {}), ...(patch.properties || {}) },
                        updatedAt: new Date().toISOString()
                    };
                    currentBucket[instanceId] = updatedInstance;
                    pm.store(storageKey, currentBucket);
                    this._registry.addInstance(updatedInstance);
                }
            },

            getInstance: (instanceId, blueprintId) => {
                const instance = this._registry.getInstance(instanceId);
                const policy = instance?.persistence || { tier: 'local' };
                const pm = this._pms.get(policy.tier) || this._pms.get('local');
                
                const storageKey = instance?.bucketKey || `do_instances_${blueprintId}`;
                const bucket = pm.load(storageKey) || {};
                return bucket[instanceId];
            },

            deleteInstance: (instanceId, blueprintId) => {
                const instance = this._registry.getInstance(instanceId);
                const policy = instance?.persistence || { tier: 'local' };
                const pm = this._pms.get(policy.tier) || this._pms.get('local');

                const storageKey = instance?.bucketKey || `do_instances_${blueprintId}`;
                const currentBucket = pm.load(storageKey) || {};
                
                if (currentBucket[instanceId]) {
                    delete currentBucket[instanceId];
                    pm.store(storageKey, currentBucket);
                    this._registry.removeInstance(instanceId);
                    return true;
                }
                return false;
            },

            /**
             * Move an instance between persistence tiers (The Gravity Shift).
             */
            migrateInstance: async (instanceId, targetTier) => {
                const instance = this._registry.getInstance(instanceId);
                if (!instance) return false;

                const currentPolicy = instance.persistence || { tier: 'local' };
                const targetPolicy = { ...currentPolicy, tier: targetTier };
                
                if (currentPolicy.tier === targetTier) return true;

                // Limes Safety Check
                if (targetTier === 'cloud' && this._limes) {
                    const hasPerm = await this._limes.hasCapability('sys:persistence-cloud');
                    if (!hasPerm) throw new Error("Security Violation: User not authorized to export data to Cloud.");
                }

                const sourcePm = this._pms.get(currentPolicy.tier) || this._pms.get('local');
                const targetPm = this._pms.get(targetTier) || this._pms.get('local');

                if (!sourcePm || !targetPm) return false;

                // 1. Load from source
                const storageKey = instance.bucketKey;
                const sourceBucket = sourcePm.load(storageKey) || {};
                const data = sourceBucket[instanceId];

                if (!data) return false;

                // 2. Store in target
                const targetBucket = targetPm.load(storageKey) || {};
                targetBucket[instanceId] = { ...data, persistence: targetPolicy };
                await targetPm.store(storageKey, targetBucket);

                // 3. Wipe source
                delete sourceBucket[instanceId];
                await sourcePm.store(storageKey, sourceBucket);

                // 4. Update Registry
                this._registry.addInstance({ ...data, persistence: targetPolicy });
                return true;
            }
        };

        this._context.registerService(DOMAIN_STRATEGY_SERVICE, localStrategy);
        this._registry.addStrategy(localStrategy);
        console.log("Shared Domain Strategies: Registered Gravity-Aware LOCAL_STRATEGY");
    }
}
