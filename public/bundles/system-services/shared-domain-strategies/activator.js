import { DOMAIN_OBJECT_REGISTRY_SERVICE } from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
    start(context) {
        console.log("Shared Domain Strategies: Starting LocalStrategy provider...");

        const getSvc = (id) => {
            const ref = context.getServiceReference(id);
            return ref ? context.getService(ref) : null;
        };

        const generateId = () => {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            return Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        };

        // Delay registration to ensure Registry is up
        setTimeout(() => {
            const registry = getSvc(DOMAIN_OBJECT_REGISTRY_SERVICE);
            const pm = getSvc(PM_INTERFACE_KEY);

            if (!registry || !pm) {
                console.warn("Shared Domain Strategies: Required services missing (Registry or PM). LocalStrategy not registered.");
                return;
            }

            const localStrategy = {
                id: "LOCAL_STRATEGY",
                label: "Local Browser Engine (PM)",
                limesPrefix: "DO",
                actions: [
                    { id: "view", label: "Resume Flow", icon: "fas fa-play" },
                    { id: "delete", label: "Archive", icon: "fas fa-archive" }
                ],
                
                // Persistence Management Layer
                createInstance: (blueprint) => {
                    // 1. Determine the storage bucket (pmKey)
                    const pmKey = blueprint.properties?.find(p => p.name === 'pmKey')?.value || blueprint.id;
                    const storageKey = `do_instances_${pmKey}`;

                    // 2. Generate new record
                    const instanceId = `${blueprint.id}-${generateId()}`;
                    const newInstance = {
                        id: instanceId,
                        strategyId: "LOCAL_STRATEGY",
                        blueprintId: blueprint.id, // Store relationship to schema
                        bucketKey: storageKey,
                        label: `${blueprint.label || blueprint.id} (${instanceId})`,
                        properties: {}, // Captured form values
                        state: "DRAFT",
                        currentStep: blueprint.ui?.initialStep || (Object.keys(blueprint.ui?.steps || {}).length > 0 ? Object.keys(blueprint.ui.steps)[0] : null),
                        createdAt: new Date().toISOString()
                    };

                    // 3. Save to Local Storage bucket
                    const currentBucket = pm.load(storageKey) || {};
                    currentBucket[instanceId] = newInstance;
                    pm.store(storageKey, currentBucket);

                    // 4. Notify the central DO Registry index
                    registry.addInstance({
                        id: instanceId,
                        strategyId: "LOCAL_STRATEGY",
                        blueprintId: blueprint.id,
                        bucketKey: newInstance.bucketKey,
                        label: newInstance.label,
                        currentStep: newInstance.currentStep,
                        properties: newInstance.properties
                    });

                    console.log(`LocalStrategy: Created new instance ${instanceId} in bucket ${storageKey}`);
                    return newInstance;
                },

                updateInstance: (instanceId, blueprintId, patch) => {
                    // Try to find the instance in the central index first to get bucketKey
                    const registryInst = registry.getInstance(instanceId);
                    
                    const storageKey = registryInst?.bucketKey || `do_instances_${blueprintId}`;

                    const currentBucket = pm.load(storageKey) || {};
                    const oldInstance = currentBucket[instanceId];
                    
                    if (oldInstance) {
                        const updatedInstance = {
                            ...oldInstance,
                            ...patch,
                            properties: {
                                ...(oldInstance.properties || {}),
                                ...(patch.properties || {})
                            },
                            updatedAt: new Date().toISOString()
                        };
                        
                        // Also sync history if provided (not part of properties but of the DO state)
                        if (patch.history) updatedInstance.history = patch.history;

                        currentBucket[instanceId] = updatedInstance;
                        pm.store(storageKey, currentBucket);

                        // Update central index
                        registry.addInstance(updatedInstance);
                    }
                },

                deleteInstance: (instanceId, blueprintId) => {
                    console.log(`LocalStrategy: deleteInstance(${instanceId}) request received.`);
                    const storageKey = `do_instances_${blueprintId}`;
                    const currentBucket = pm.load(storageKey) || {};
                    
                    if (currentBucket[instanceId]) {
                        delete currentBucket[instanceId];
                        pm.store(storageKey, currentBucket);
                        
                        // Notify Registry to remove from central index
                        if (registry.removeInstance) {
                            registry.removeInstance(instanceId);
                        }
                        
                        console.log(`LocalStrategy: deleteInstance(${instanceId}) - Removed from bucket ${storageKey}.`);
                        return true;
                    }
                    console.warn(`LocalStrategy: deleteInstance(${instanceId}) - NOT found in bucket ${storageKey}.`);
                    return false;
                },

                getInstance: (instanceId, blueprintId) => {
                    const storageKey = `do_instances_${blueprintId}`;
                    const bucket = pm.load(storageKey) || {};
                    return bucket[instanceId];
                }
            };

            // Register with OSGi
            context.registerService("prototyper.domain.strategy", localStrategy);

            // Tell the DO registry about this strategy
            registry.addStrategy(localStrategy);
            
            console.log("Shared Domain Strategies: Registered LOCAL_STRATEGY");
            
        }, 500); // 500ms delay to give backoffice-do-registry time to mount
    }
}
