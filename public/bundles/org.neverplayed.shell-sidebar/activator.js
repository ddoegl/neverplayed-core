/**
 * @file Activator for org.neverplayed.shell-sidebar
 * @module platform/bundles/org.neverplayed.shell-sidebar
 */

import { 
    FLOW_SERVICE, 
    CONFIG_ADMIN_SERVICE, 
    SHELL_HOST_SERVICE, 
    SHELL_COMMAND_SERVICE,
    LIMES_SERVICE,
    SESSION_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    REALM_CHANGED_TOPIC,
    SESSION_CHANGED_TOPIC,
    CONFIG_UPDATED_TOPIC,
    STRATUM_CHANGED_TOPIC
} from "core-types";
import { AlpineActivator } from "alpine-base";

export default class Activator extends AlpineActivator {
    onStart(context) {
        if (this.isHeadless) {
            this.logger.info("Shell Sidebar: Running in headless mode, skipping UI injection.");
            return;
        }

        const mountPoint = this.config.mountPoint || "#shell-sidebar-root";
        const discoveryFilter = this.config.discoveryFilter || "";
        const combinedFilter = discoveryFilter 
            ? `(&(objectClass=${FLOW_SERVICE})${discoveryFilter})`
            : `(objectClass=${FLOW_SERVICE})`;

        // 1. Unified Shell Store (Pattern 2) + Local UI Store
        const shell = this.initStore('shell_context', {
            sidebarOpen: true,
            sidebarState: 0
        });

        const sidebarState = this.initStore('shell_sidebar_state', {
            flows: [],
            activeFlowId: null
        });

        // 2. Render UI (Atomic)
        this.render(mountPoint, 'templates/sidebar.html', () => {
            const internalFlows = new Map();
            let caSvc = null;
            let hostSvc = null;
            let limesSvc = null;
            let sessionSvc = null;

            const syncFlows = () => {
                const uniqueByFlowId = new Map();
                this.logger.debug(`Shell Sidebar: Syncing ${internalFlows.size} internal flows...`);
                for (const item of internalFlows.values()) {
                    const config = caSvc?.getConfiguration(item.bsn)?.getProperties();
                    let isVisible = config?.sidebar !== undefined 
                        ? config.sidebar 
                        : (item.sidebarProp !== undefined ? item.sidebarProp : true);

                    // Institutional Privilege Filtering
                    if (isVisible && limesSvc) {
                        const allowed = limesSvc.isAllowed(`FLOW_VIEW:${item.id}`);
                        if (!allowed) {
                            this.logger.debug(`Shell Sidebar: Flow ${item.id} hidden by Limes.`);
                            isVisible = false;
                        }
                    }

                    if (isVisible) uniqueByFlowId.set(item.id, item);
                }
                const result = Array.from(uniqueByFlowId.values()).sort((a, b) => {
                    if (a.id.includes("shell-cli")) return -1;
                    if (b.id.includes("shell-cli")) return 1;
                    return a.title.localeCompare(b.title);
                });
                this.logger.debug(`Shell Sidebar: Sync complete. Visible flows: ${result.length}`);
                sidebarState.flows = result;
            };

            return {
                get shell() { return shell; },
                get state() { return shell.sidebarState; },
                get flows() { return sidebarState.flows; },
                get activeFlowId() { return sidebarState.activeFlowId; },

                toggleCollapse() {
                    shell.sidebarState = (shell.sidebarState + 1) % 3;
                },

                init() {
                    this.logger.info("Shell Sidebar: Initializing Controller...");

                    // Track ConfigAdmin
                    this.track(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
                        addingService: (ref) => {
                            caSvc = context.getService(ref);
                            syncFlows();
                            return caSvc;
                        },
                        removedService: () => { caSvc = null; syncFlows(); }
                    });


                    // Track Shell Host
                    this.track(`(objectClass=${SHELL_HOST_SERVICE})`, {
                        addingService: (ref) => {
                            hostSvc = context.getService(ref);
                            return hostSvc;
                        },
                        removedService: () => { hostSvc = null; }
                    });

                    // Track Limes (Privilege Guard)
                    this.track(`(objectClass=${LIMES_SERVICE})`, {
                        addingService: (ref) => {
                            limesSvc = context.getService(ref);
                            syncFlows();
                            return limesSvc;
                        },
                        removedService: () => { limesSvc = null; syncFlows(); }
                    });

                    // Track Session (Context)
                    this.track(`(objectClass=${SESSION_SERVICE})`, {
                        addingService: (ref) => {
                            sessionSvc = context.getService(ref);
                            syncFlows();
                            return sessionSvc;
                        },
                        removedService: () => { sessionSvc = null; syncFlows(); }
                    });

                    // Track Flows
                    this.logger.info(`Shell Sidebar: Opening tracker for ${combinedFilter}...`);
                    this.track(combinedFilter, {
                        addingService: (ref) => {
                            const svc = context.getService(ref);
                            const bundle = ref.getBundle();
                            const flowId = ref.getProperty("flow.id") || svc.id || `unknown-${bundle.id}`;
                            const key = `${bundle.id}:${flowId}`;
                            
                            this.logger.debug(`Shell Sidebar: Flow tracked: ${flowId} from bundle ${bundle.id}`);

                            internalFlows.set(key, {
                                id: flowId,
                                title: svc.title || ref.getProperty("flow.title") || flowId,
                                icon: ref.getProperty("icon") || ref.getProperty("flow.icon") || "fas fa-cube",
                                svc,
                                bundleId: bundle.id,
                                bsn: bundle.getSymbolicName(),
                                sidebarProp: ref.getProperty("sidebar")
                            });
                            syncFlows();
                            return svc;
                        },
                        removedService: (ref) => {
                            const key = `${ref.getBundle().id}:${ref.getProperty("flow.id") || 'unknown'}`;
                            internalFlows.delete(key);
                            syncFlows();
                        }
                    });

                    // Register OSGi EventHandler for State Events (ADR-0034 alignment)
                    const eventProps = {
                        [EVENT_TOPIC]: [
                            REALM_CHANGED_TOPIC,
                            SESSION_CHANGED_TOPIC,
                            CONFIG_UPDATED_TOPIC,
                            STRATUM_CHANGED_TOPIC
                        ]
                    };
                    const handler = {
                        handleEvent: (event) => {
                            this.logger?.debug(`Shell Sidebar: Event ${event.getTopic()} caught. Syncing flows...`);
                            syncFlows();
                        }
                    };
                    context.registerService(EVENT_HANDLER_INTERFACE, handler, eventProps);
                },

                launch(id) {
                    const flow = Array.from(internalFlows.values()).find(f => f.id === id);
                    if (flow && hostSvc) {
                        sidebarState.activeFlowId = id;
                        const hostRoot = document.querySelector("#shell-host-root");
                        const hostData = hostRoot?._x_dataStack?.[0];
                        if (hostData && typeof hostData.launch === 'function') {
                            hostData.launch(id, flow.svc);
                        } else {
                            globalThis.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id, params: {} } }));
                        }
                    }
                }
            };
        });

        // 3. Register Shell Command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "sidebar",
            description: "[id|bsn] - Toggle sidebar or set visibility",
            execute: async (args, ctx, log) => {
                const target = args[0];
                if (!target) {
                    shell.sidebarState = (shell.sidebarState + 1) % 3;
                    log("Toggled global sidebar.");
                } else {
                    const caRef = ctx.getServiceReference(CONFIG_ADMIN_SERVICE);
                    const ca = caRef ? ctx.getService(caRef) : null;
                    if (ca) {
                        const bundle = ctx.getBundles().find(b => String(b.id) === target || b.getSymbolicName() === target);
                        if (bundle) {
                            const bsn = bundle.getSymbolicName();
                            const config = ca.getConfiguration(bsn);
                            const props = config.getProperties() || {};
                            const newState = !props.sidebar;
                            await config.update({ ...props, sidebar: newState });
                            log(`Sidebar property for ${bsn} set to: ${newState}`);
                        }
                    }
                }
            }
        });
    }
}
