import { 
    FLOW_SERVICE, 
    SHELL_HOST_SERVICE,
    SESSION_SERVICE
} from "shared-types";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

const Alpine = globalThis.Alpine;

export default class Activator {
    start(context) {
        console.log("Shell Host: Starting...");

        // Register the Alpine Component
        Alpine.data("shellHost", (options = {}) => ({
            ready: false,
            status: "Orchestrator Active",
            activeFlowId: null,
            bootCapability: options.bootCapability || "sys:cli",
            mountPoint: options.mountPoint || "#flow-content",

            init() {
                console.log(`Shell Host: Initializing for capability: ${this.bootCapability}`);
                
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

            launch(id, flow) {
                console.log(`Shell Host: Launching ${id}`);
                
                // Use the mount point from config or fallback to ref
                const container = document.querySelector(this.mountPoint) || this.$refs.flowContent;
                if (!container) {
                    console.error(`Shell Host: Mount point not found!`);
                    return;
                }
                
                container.innerHTML = "";
                this.activeFlowId = id;
                flow.launch(container);
                this.ready = true; // Mark as ready once first flow is launched
                this.status = `Running: ${id}`;
            }
        }));

        // Register the Host Service itself
        context.registerService(SHELL_HOST_SERVICE, {
            getAlpineDataName: () => "shellHost"
        });
    }

    stop(_context) {
        console.log("Shell Host: Stopped.");
    }
}
