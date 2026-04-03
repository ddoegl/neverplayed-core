import { 
    SYSTEM_READY_SERVICE, 
    LICENSE_DATA_SERVICE, 
    TENANT_DATA_SERVICE, 
    PERSONS_SERVICE, 
    COMPANIES_SERVICE, 
    RULES_DATA_SERVICE, 
    CAPABILITIES_DATA_SERVICE, 
    BIZ_FUNC_DATA_SERVICE,
    PLEXUS_ENGINE_SERVICE,
    TOPICS_DATA_SERVICE,
    CAMPAIGNS_SERVICE
} from "core-types";

export default class Activator {
    start(context) {
        const CRITICAL_SERVICES = [
            LICENSE_DATA_SERVICE,
            TENANT_DATA_SERVICE,
            PERSONS_SERVICE,
            COMPANIES_SERVICE,
            RULES_DATA_SERVICE,
            CAPABILITIES_DATA_SERVICE,
            BIZ_FUNC_DATA_SERVICE,
            TOPICS_DATA_SERVICE,
            CAMPAIGNS_SERVICE,
            PLEXUS_ENGINE_SERVICE
        ];

        const readyState = new Set();

        const checkReady = () => {
            console.log(`System Ready: ${readyState.size}/${CRITICAL_SERVICES.length} services present`);
            if (readyState.size === CRITICAL_SERVICES.length) {
                console.log("System Ready: Registering READY service!");
                context.registerService(SYSTEM_READY_SERVICE, { ready: true });
            }
        };

        CRITICAL_SERVICES.forEach(svcName => {
            const filter = `(objectClass=${svcName})`;
            const tracker = context.trackService(filter, {
                addingService: (_ref) => {
                    console.log(`System Ready: Service arrived: ${svcName}`);
                    readyState.add(svcName);
                    checkReady();
                },
                removedService: (_ref) => {
                    readyState.delete(svcName);
                }
            });
            tracker.open();
        });
        
        // Final check in case they were super fast
        checkReady();
    }

    stop(_context) {}
}
