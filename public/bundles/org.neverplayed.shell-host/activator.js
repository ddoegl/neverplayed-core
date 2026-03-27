import { 
    FLOW_SERVICE, 
    SESSION_SERVICE
} from "core-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

const Alpine = globalThis.Alpine;

export default class Activator {
    start(context) {
        console.log("Shell Host: Starting...");

        // Pull dynamic configuration for the "Realm" (embedded in manifest headers)
        const headers = context.getBundle().getHeaders();
        const config = headers.Configuration || {};
        const bootCapability = config.bootCapability || "sys:cli";
        const mountPoint = config.mountPoint || "#flow-content";

        // Register the Alpine Component
        Alpine.data("shellHost", () => ({
            ready: false,
            status: "Orchestrator Active",
            activeFlowId: null,
            bootCapability,
            mountPoint,

            init() {
                console.log(`Shell Host: Initializing Realm for capability: ${this.bootCapability}`);
                
                // Minimal Session Mock if not already registered
                const sessionRef = context.getServiceReference(SESSION_SERVICE);
                if (!sessionRef) {
                    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
                    const _pm = context.getService(pmRef);
                    const session = Alpine.reactive({
                        environment: "desktop",
                        scopedUsers: { "global": { id: "guest", alias: "Guest" } },
                        activeFlowId: null
                    });
                    context.registerService(SESSION_SERVICE, session);
                }

                // Flow Discovery & Auto-Launch
                context.trackService(`(objectClass=${FLOW_SERVICE})`, {
                    addingService: (ref) => {
                        const svc = context.getService(ref);
                        const id = svc.id || ref.getProperty("flow.id");
                        const capability = ref.getProperty("capability");
                        
                        console.log(`Shell Host: Flow discovered: ${id} (Capability: ${capability || 'none'})`);
                        
                        if (capability === this.bootCapability) {
                            // Delay launch slightly to ensure Alpine has finished initializing the component
                            setTimeout(() => this.launch(id, svc), 500);
                        }
                        return svc;
                    }
                }).open();
            },

            async launch(id, flow) {
                if (this.activeFlowId === id) {
                    console.log(`Shell Host: Flow ${id} already active, skipping clear.`);
                    return;
                }

                console.log(`Shell Host: Launching ${id} into Realm`);
                
                // Use the mount point from config or fallback to ref
                const container = document.querySelector(this.mountPoint) || this.$refs.flowContent;
                if (!container) {
                    console.error(`Shell Host: Mount point ${this.mountPoint} not found!`);
                    return;
                }
                
                // Non-destructive tick
                this.activeFlowId = id;
                container.innerHTML = ""; 
                container.removeAttribute('data-bsn'); // Clear the Focus Guard attribute to ensure the new/returning flow can render
                
                console.log(`[${Date.now()}] Shell Host: Container cleared, attribute removed. Waiting for nextTick...`);
                await Alpine.nextTick();
                
                console.log(`[${Date.now()}] Shell Host: Calling flow.launch...`);
                await flow.launch(container);
                
                console.log(`[${Date.now()}] Shell Host: flow.launch completed.`);
                this.ready = true; 
                this.status = `Realm Active: ${id}`;
            }
        }));

        // Register the Host Service itself
        context.registerService("@neverplayed/shell-host-service", {
            getAlpineDataName: () => "shellHost"
        });
    }

    stop(_context) {
        console.log("Shell Host: Stopped.");
    }
}
