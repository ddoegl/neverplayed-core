/**
 * @file Activator for org.neverplayed.shell-host
 * @module platform/bundles/org.neverplayed.shell-host
 */

import { 
    FLOW_SERVICE, 
    SHELL_HOST_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    REALM_CHANGED_TOPIC
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
                
                const launchPlatonicLobby = () => {
                    this.logger.info("Shell Host: Transitioning stage to Platonic Staging Lobby...");
                    const stratographerRefs = context.getServiceReferences(FLOW_SERVICE, "(flow.id=org.neverplayed.stratographer)");
                    if (stratographerRefs && stratographerRefs.length > 0) {
                        const stratSvc = context.getService(stratographerRefs[0]);
                        this.launch("org.neverplayed.stratographer", stratSvc);
                        return;
                    }

                    const cliRefs = context.getServiceReferences(FLOW_SERVICE, "(capability=sys:cli)");
                    if (cliRefs && cliRefs.length > 0) {
                        const cliSvc = context.getService(cliRefs[0]);
                        const cliId = cliRefs[0].getProperty("flow.id") || cliSvc.id;
                        this.launch(cliId, cliSvc);
                        return;
                    }

                    const hostStage = this.$refs.flowContent || document.querySelector("#flow-mount-point");
                    if (hostStage) {
                        hostStage.innerHTML = `
                          <div class="h-full w-full flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-100 font-sans space-y-4">
                            <div class="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-2xl shadow-xl">
                              <i class="fas fa-cubes"></i>
                            </div>
                            <div class="text-center space-y-1 max-w-md">
                              <h2 class="text-xl font-bold text-white">Platonic Staging Lobby</h2>
                              <p class="text-xs text-slate-400 leading-relaxed">
                                Session attention span exhausted or reset to operator baseline. Select a realm in the header or universe menu to resume.
                              </p>
                            </div>
                          </div>
                        `;
                    }
                };

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
                        
                        if (this.state.activeFlowId === id) {
                            setTimeout(() => {
                                const refs = context.getServiceReferences(FLOW_SERVICE, `(flow.id=${id})`);
                                if (refs && refs.length > 0) {
                                    this.logger.info(`Shell Host: Replacement flow found for '${id}'.`);
                                    return;
                                }

                                this.logger.warn(`Shell Host: Active flow '${id}' uninstalled. Falling back to Platonic Lobby.`);
                                launchPlatonicLobby();
                            }, 200);
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

                // Listen for realm changes to update host stage immediately
                globalThis.addEventListener("realm-changed", (e) => {
                    const realmId = e.detail?.realmId || e.detail?.id;
                    if (realmId === "platonic" || realmId === "org.neverplayed.realm.empty") {
                        launchPlatonicLobby();
                    }
                });

                // Register EventAdmin Handler for REALM_CHANGED_TOPIC
                context.registerService(EVENT_HANDLER_INTERFACE, {
                    handleEvent: (event) => {
                        const topic = event.getTopic();
                        if (topic === REALM_CHANGED_TOPIC) {
                            const realmId = event.getProperty("realm.id");
                            if (realmId === "platonic" || realmId === "org.neverplayed.realm.empty") {
                                launchPlatonicLobby();
                            }
                        }
                    }
                }, { [EVENT_TOPIC]: [REALM_CHANGED_TOPIC] });
            },

            async launch(id, flow, params = {}) {
                if (this.state.activeFlowId === id && Object.keys(params).length === 0) return;

                this.logger.info(`Shell Host: Provisioning stage for ${id}`);
                
                const hostStage = this.$refs.flowContent || document.querySelector("#flow-mount-point");
                if (!hostStage) {
                    this.logger.error(`Shell Host: Internal mount point not found!`);
                    return;
                }
                
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
