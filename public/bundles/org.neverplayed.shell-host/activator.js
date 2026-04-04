import { 
    FLOW_SERVICE, 
    SHELL_HOST_SERVICE 
} from "core-types";
import { CoreAlpineActivator } from "alpine-base";

export default class Activator extends CoreAlpineActivator {
    onCoreStart(context) {
        this.logger.info("Shell Host: Starting...");

        const headers = context.getBundle().getHeaders();
        const config = headers.Configuration || {};
        const bootCapability = config.bootCapability || "sys:cli";
        const mountPoint = config.mountPoint || "#shell-host-root";

        // Register the host service
        context.registerService(SHELL_HOST_SERVICE, {
            getAlpineDataName: () => `${(this.bsn || "unknown").replace(/[\.\-]/g, "_")}_controller`
        });

        // 1. Initial State (Reactive via initStore)
        this.initStore('shell_host_state', {
            ready: false,
            status: "Orchestrator Active",
            activeFlowId: null,
            bootCapability,
            mountPoint
        });

        // 2. Render Host UI (Atomic)
        this.render(mountPoint, 'templates/host.html', () => ({
            get state() { return globalThis.Alpine.store('shell_host_state'); },
            
            init() {
                this.logger.info(`Shell Host: Initializing Realm for capability: ${this.state.bootCapability}`);
                
                // Track Flow Discovery
                this.track(`(objectClass=${FLOW_SERVICE})`, {
                    addingService: (ref) => {
                        const svc = context.getService(ref);
                        const id = svc.id || ref.getProperty("flow.id");
                        const capability = ref.getProperty("capability");
                        
                        this.logger.debug(`Shell Host: Flow discovered: ${id} (Capability: ${capability || 'none'})`);
                        
                        if (capability === this.state.bootCapability) {
                            setTimeout(() => this.launch(id, svc), 500);
                        }
                        return svc;
                    },
                    removedService: (ref) => {
                        const id = ref.getProperty("flow.id");
                        this.logger.debug(`Shell Host: Flow removed: ${id}`);
                        
                        // If the currently active flow is uninstalled, fallback to core capability (CLI)
                        if (this.state.activeFlowId === id) {
                            this.logger.warn(`Shell Host: Active flow '${id}' uninstalled. Falling back to Core Shell.`);
                            
                            // Find the fallback flow (discovery by capability: sys:cli)
                            const fallbackCapability = "sys:cli";
                            const refs = context.getServiceReferences(FLOW_SERVICE, `(capability=${fallbackCapability})`);
                            
                            if (refs && refs.length > 0) {
                                const fallbackSvc = context.getService(refs[0]);
                                const fallbackId = refs[0].getProperty("flow.id") || fallbackSvc.id;
                                this.launch(fallbackId, fallbackSvc);
                            } else {
                                // Last resort: Wipe stage to avoid zombie state
                                const hostStage = this.$refs.flowContent || document.querySelector("#flow-mount-point");
                                if (hostStage) hostStage.innerHTML = `<div class="p-10 text-slate-400 italic">No active flow available for this realm.</div>`;
                            }
                        }
                    }
                });

                // Add Listener for cross-flow launch requests
                globalThis.addEventListener("shell-launch-flow", (e) => {
                    const reqId = e.detail.id;
                    const reqParams = e.detail.params || {};
                    const reqFlows = context.getServiceReferences(FLOW_SERVICE) || [];
                    let reqFlowSvc = null;
                    for (const ref of reqFlows) {
                        const id = ref.getProperty("flow.id") || context.getService(ref).id;
                        if (id === reqId) {
                            reqFlowSvc = context.getService(ref);
                            break;
                        }
                    }
                    if (reqFlowSvc) {
                        this.logger.info(`Shell Host: Processing shell-launch-flow for ${reqId}`, reqParams);
                        this.launch(reqId, reqFlowSvc, reqParams);
                    }
                });
            },

            async launch(id, flow, params = {}) {
                if (this.state.activeFlowId === id && Object.keys(params).length === 0) return;

                this.logger.info(`Shell Host: Provisioning stage for ${id}`);
                
                const hostStage = this.$refs.flowContent || document.querySelector("#flow-mount-point");
                if (!hostStage) {
                    this.logger.error(`Shell Host: Internal mount point not found!`);
                    return;
                }
                
                // CRITICAL: We completely re-create the child element to purge the Alpine _x_dataStack
                // that might linger from the previous flow on the same DOM node.
                hostStage.innerHTML = "";
                const target = document.createElement('div');
                target.id = "flow-active-stage";
                target.className = "h-full w-full opacity-0 transition-opacity duration-300";
                hostStage.appendChild(target);

                this.state.activeFlowId = id;
                this.state.ready = false;

                await globalThis.Alpine.nextTick();
                
                if (typeof flow.launch === 'function') {
                    const sameFlow = this.state.activeFlowId === id;
                    
                    try {
                        await flow.launch(target, params);
                        target.classList.remove('opacity-0');
                        this.state.ready = true; 
                        this.state.activeFlowId = id;
                        this.state.status = `Realm Active: ${id}`;

                        if (!sameFlow && typeof flow.onActivate === 'function') {
                            this.logger.debug(`Shell Host: Triggering onActivate for ${id}...`);
                            flow.onActivate(this.state);
                        }
                    } catch (err) {
                        this.logger.error(`Shell Host: Launch failed for ${id}:`, err);
                        target.innerHTML = `<div class="p-10 text-red-500 font-mono">Launch Error: ${err.message}</div>`;
                    }
                } else {
                    this.logger.error(`Shell Host: Flow ${id} does not provide a launch() method!`);
                }
            }
        }), {
            "id": "shell-host-root",
            "class": "h-full w-full bg-slate-50 overflow-hidden shadow-inner"
        });
    }
}
