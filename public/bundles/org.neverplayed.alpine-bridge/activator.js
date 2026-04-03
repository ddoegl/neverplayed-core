import Alpine from "alpinejs";
import { BaseActivator } from "osgi-base";

/**
 * Alpine Bridge Activator
 * Extends Alpine.js with OSGi-native magics and directives.
 * Makes the Service Registry fully reactive within HTML templates.
 */
export default class Activator extends BaseActivator {
    onStart(context) {
        this.logger.info("Alpine-Bridge: Initializing OSGi Magics and Directives...");

        // 1. Magic: $context
        // Provides direct access to the BundleContext for debugging and ad-hoc lookups.
        Alpine.magic('context', () => context);

        // 2. Magic: $service(id)
        // Performs an on-demand service lookup. Non-reactive, use for one-off calls.
        Alpine.magic('service', () => (sid) => {
            const ref = context.getServiceReference(sid);
            return ref ? context.getService(ref) : null;
        });

        // 3. Directive: x-service="INTERFACE_CONSTANT"
        // Injects a service instance into the local Alpine scope.
        // It reactively updates if the service is swapped or removed.
        Alpine.directive('service', (el, { expression }, { _evaluate }) => {
            const sid = expression; // Usually a constant imported into global scope or passed as string
            
            const updateNode = () => {
                const ref = context.getServiceReference(sid);
                const svc = ref ? context.getService(ref) : null;
                
                // Determine a clean variable name from the service ID
                const varName = sid.includes('/') 
                    ? sid.split('/').pop().replace(/-/g, '_') 
                    : sid.replace(/\./g, '_');

                // Inject into Alpine data stack (atomic update)
                Alpine.mergeProxies([ { [varName]: svc } ])
                
                // Note: Alpine.addScopeToNode is better for targeted injection
                // but requires careful lifecycle management. 
                // For now, we rely on the service being available in the evaluation context.
            };

            updateNode();

            // Resilient Track: Ensure the UI reacts to provider changes (hot-reloads)
            const tracker = context.trackService(`(objectClass=${sid})`, {
                addingService: () => { updateNode(); },
                removedService: () => { updateNode(); }
            });
            tracker.open();
            
            // Cleanup on DOM removal
            el._x_serviceTracker = tracker;
        });

        this.logger.info("Alpine-Bridge: Hydration complete. $context and $service are now available.");
    }

    onStop() {
        this.logger.info("Alpine-Bridge: Shutting down.");
    }
}
