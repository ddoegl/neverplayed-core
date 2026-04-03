import { 
    FLOW_SERVICE, 
    CONFIG_ADMIN_SERVICE, 
    AUTH_SHIELD_SERVICE, 
    SHELL_HOST_SERVICE, 
    SHELL_COMMAND_SERVICE 
} from "core-types";
import { BaseActivator } from "osgi-base";

const _Alpine = globalThis.Alpine;

export default class Activator extends BaseActivator {
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

        const logger = this.logger;
        logger.info(`Shell Sidebar: Using Discovery Filter: ${combinedFilter}`);


        // 2. Register "Fresh Factory" Scope (Pattern 2)
        globalThis.getShellSidebarScope = () => ({
            activeFlowId: null,
            state: 0, // 0: Expanded, 1: Icons, 2: Hidden
            _flows: new Map(), 
            flows: [], 
            shellHost: null,
            user: { email: 'Guest User', uid: 'guest', isSuperuser: false },
            ready: false,

            toggleCollapse() {
                this.state = (this.state + 1) % 3;
            },

            init() {
                logger.info("Shell Sidebar: Initializing Scope...");

                // Track ConfigAdmin for property filtering
                context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
                    addingService: (ref) => {
                        this.ca = context.getService(ref);
                        this.syncFlows();
                        return this.ca;
                    },
                    removedService: () => { this.ca = null; this.syncFlows(); }
                }).open();

                // Track Auth Shield for identity (Rule 18)
                context.trackService(`(objectClass=${AUTH_SHIELD_SERVICE})`, {
                    addingService: (ref) => {
                        const svc = context.getService(ref);
                        this.user = svc.getCurrentUser();
                        logger.info(`Shell Sidebar: User identity updated: ${this.user?.email}`);
                        return svc;
                    },
                    removedService: () => { this.user = null; }
                }).open();

                // Track Shell Host Service (Orchestrator)
                context.trackService(`(objectClass=${SHELL_HOST_SERVICE})`, {
                    addingService: (ref) => {
                        this.shellHost = context.getService(ref);
                        logger.info("Shell Sidebar: Orchestrator connected.");
                        return this.shellHost;
                    },
                    removedService: () => { this.shellHost = null; }
                }).open();

                // Track Flow Services with DYNAMIC FILTER (Rule 13)
                context.trackService(combinedFilter, {
                    addingService: (ref) => {
                        const svc = context.getService(ref);
                        this.addFlow(ref, svc);
                        return svc;
                    },
                    removedService: (ref) => {
                        this.removeFlow(ref);
                    }
                }).open();
            },

            addFlow(ref, svc) {
                const bundle = ref.getBundle();
                const bundleId = bundle.id;
                const bsn = bundle.getSymbolicName();
                const flowId = ref.getProperty("flow.id") || svc.id || `unknown-${bundleId}`;
                
                // Safer Diagnostic Log (Rule 19)
                const capability = ref.getProperty("capability");
                const sidebarProp = ref.getProperty("sidebar");
                logger.debug(`Shell Sidebar: [DISCOVERY] Bundle: ${bsn} (${bundleId}) | Flow: ${flowId} | Capability: ${capability} | Sidebar: ${sidebarProp}`);
                
                // Key should be unique per registration instance
                const key = `${bundleId}:${flowId}`;
                
                const _classes = ref.getProperty("objectClass");
                const title = svc.title || ref.getProperty("flow.name") || ref.getProperty("flow.title") || flowId;
                const icon = ref.getProperty("icon") || ref.getProperty("flow.icon") || "fas fa-cube";

                this._flows.set(key, { id: flowId, title, icon, svc, bundleId, bsn, key, sidebarProp });
                this.syncFlows();
            },

            removeFlow(ref) {
                const bundleId = ref.getBundle().id;
                const flowId = ref.getProperty("flow.id") || `unknown-${bundleId}`;
                const key = `${bundleId}:${flowId}`;
                
                if (this._flows.has(key)) {
                    logger.debug(`Shell Sidebar: [REMOVAL] Bundle: ${bundleId} | Flow: ${flowId}`);
                    this._flows.delete(key);
                    this.syncFlows();
                }
            },

            syncFlows() {
                // BULLETPROOF: Use a secondary Map keyed ONLY by logical Flow ID
                const uniqueByFlowId = new Map();
                for (const item of this._flows.values()) {
                    // Filter based on ConfigAdmin or service property
                    const config = this.ca?.getConfiguration(item.bsn)?.getProperties();
                    
                    // Priority: ConfigAdmin > Service Property > Default (true)
                    const isVisible = config?.sidebar !== undefined 
                        ? config.sidebar 
                        : (item.sidebarProp !== undefined ? item.sidebarProp : true);

                    if (isVisible) {
                        uniqueByFlowId.set(item.id, item);
                    }
                }

                this.flows = Array.from(uniqueByFlowId.values()).sort((a, b) => {
                    if (a.id === "@neverplayed/shell-cli" || a.id === "shell-cli") return -1;
                    if (b.id === "@neverplayed/shell-cli" || b.id === "shell-cli") return 1;
                    return a.title.localeCompare(b.title);
                });
            },

            launch(id) {
                const flow = this.flows.find(f => f.id === id);
                if (flow && this.shellHost) {
                    this.activeFlowId = id;
                    const hostRoot = document.querySelector("#shell-host-root");

                    const hostData = hostRoot?._x_dataStack?.[0];
                    if (hostData && typeof hostData.launch === 'function') {
                        hostData.launch(id, flow.svc);
                    }
                }
            }
        });

        // 3. Inject UI
        this.render(mountPoint, logger);

        // 4. Register Shell Command
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "sidebar",
            description: "[id|bsn] - Toggle sidebar or set visibility for a specific flow",
            execute: async (args, ctx, log) => {
                const target = args[0];
                if (this.isHeadless) {
                    log("Sidebar commands are only reactive in the Web UI.", "warn");
                    return;
                }

                if (!target) {
                    globalThis.dispatchEvent(new CustomEvent('shell:sidebar-toggle'));
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
                            globalThis.dispatchEvent(new CustomEvent('shell:flows-updated'));
                            log(`Sidebar property for ${bsn} set to: ${newState}`);
                        } else {
                            log(`Bundle not found: ${target}`, "error");
                        }
                    }
                }
            }
        });
    }

    async render(mountPoint, logger) {
        const el = document.querySelector(mountPoint);
        if (!el) return;

        logger.info("Shell Sidebar: Injecting Template...");
        const response = await fetch("./bundles/org.neverplayed.shell-sidebar/templates/sidebar.html");
        const html = await response.text();
        
        // Inject the Template with the Fresh Factory (Pattern 2)
        // Note: We don't call Alpine.initTree(el) here because barebones.html 
        // calls Alpine.start() at the end of the boot sequence, which will 
        // initialize this injected content automatically.
        el.innerHTML = `<div x-data="globalThis.getShellSidebarScope()" 
                             @shell:sidebar-toggle.window="toggleCollapse()" 
                             @shell:flows-updated.window="syncFlows()"
                             class="h-full w-full">${html}</div>`;
    }
}
