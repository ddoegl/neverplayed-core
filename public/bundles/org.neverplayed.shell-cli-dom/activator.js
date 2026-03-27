import { FLOW_SERVICE, SHELL_CLI_SERVICE, BUNDLE_TYPE_SERVICE, SHELL_CLI_PID } from "core-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    onStart(context) {
        // Define a placeholder scope immediately to prevent undefined errors during early Alpine parse
        globalThis.getShellScope = globalThis.getShellScope || (() => ({
            shellHistory: [],
            history: [],
            currentCommand: "",
            executeCommand: () => {},
            navigateHistory: () => {}
        }));

        // 1. Wait for Shell CLI Service
        context.trackService(`(objectClass=${SHELL_CLI_SERVICE})`, {
            addingService: (ref) => {
                const shellService = context.getService(ref);
                this.setupUI(context, shellService);
                return shellService;
            }
        }).open();
    }

    setupUI(context, shellService) {
        const Alpine = globalThis.Alpine;
        if (!Alpine) return;

        // 2. Initialize Alpine Store for Shell
        if (!Alpine.store('shell')) {
            Alpine.store('shell', {
                history: [],
                commandHistory: [],
                historyIndex: -1,
                addLog(entry) {
                    const now = new Date(entry.timestamp);
                    const time = now.getHours().toString().padStart(2, '0') + ':' + 
                                now.getMinutes().toString().padStart(2, '0') + ':' + 
                                now.getSeconds().toString().padStart(2, '0');
                    
                    this.history.push({
                        ...entry,
                        time
                    });
                    
                    if (this.history.length > 100) this.history.shift();

                    setTimeout(() => {
                        const el = document.querySelector('[x-ref="outputArea"]');
                        if (el) el.scrollTop = el.scrollHeight;
                    }, 10);
                }
            });
        }

        const state = Alpine.store('shell');
        const getLogStore = () => globalThis.Alpine?.store('shell');

        // Sync initial history
        shellService.getHistory().forEach(entry => state.addLog(entry));

        // Subscribe to live output
        shellService.subscribe(entry => state.addLog(entry));

        // 3. Define Shell Scope for Template (Final Implementation)
        globalThis.getShellScope = () => ({
            currentCommand: "",
            get shellHistory() { 
                const s = getLogStore();
                return (s && Array.isArray(s.history)) ? s.history : []; 
            },
            // Legacy fallback for cached templates
            get history() { return this.shellHistory; },
            
            async executeCommand() {
                const store = getLogStore();
                const cmd = this.currentCommand.trim();
                if (!cmd || !store) return;
                
                // Optimistic UI: update history index and clear input
                store.commandHistory.push(cmd);
                store.historyIndex = store.commandHistory.length;
                this.currentCommand = "";
                
                // Execute via service (will trigger subscriber -> addLog)
                await shellService.execute(cmd);
            },
            
            navigateHistory(dir) {
                const store = getLogStore();
                if (!store || store.commandHistory.length === 0) return;
                store.historyIndex = Math.max(0, Math.min(store.commandHistory.length - 1, store.historyIndex + dir));
                this.currentCommand = store.commandHistory[store.historyIndex] || "";
            }
        });

        // 4. Register as Flow Service
        context.registerService(FLOW_SERVICE, {
            ...this.config,
            id: SHELL_CLI_PID,
            title: "Shell CLI",
            launch: async (targetElement) => {
                const bsn = context.getBundle().getSymbolicName();
                if (targetElement.getAttribute('data-bsn') === bsn) {
                    console.log(`[${Date.now()}] Shell CLI DOM: Already rendered into this element. Skipping destructive update.`);
                    return;
                }

                console.log(`[${Date.now()}] Shell CLI DOM: Starting launch for ${bsn}`);
                const bust = Date.now();
                const template = await (await fetch(`./bundles/org.neverplayed.shell-cli-dom/templates/shell.html?cb=${bust}`)).text();
                
                targetElement.setAttribute('data-bsn', bsn);
                targetElement.innerHTML = `
                    <div id="shell-container" class="h-full w-full">
                        <div class="h-full border border-blue-900 shadow-2xl rounded-xl overflow-hidden">
                            <div id="shell-content-wrapper" class="h-full animate-fade-in">
                                ${template}
                            </div>
                        </div>
                    </div>
                `;
                console.log(`[${Date.now()}] Shell CLI DOM: HTML injected. Initializing Alpine tree manually.`);
                
                // Nuclear Stability: Manually initialize this sub-tree to avoid collisions with outer host
                await Alpine.nextTick();
                Alpine.initTree(targetElement);
                
                console.log(`[${Date.now()}] Shell CLI DOM: Alpine tree initialization triggered.`);
            }
        }, {
            "capability": "sys:cli", // Standard capability for auto-boot
            "flow.id": SHELL_CLI_PID,
            "flowType": BUNDLE_TYPE_SERVICE,
            "sidebar": true,
            "icon": "fas fa-terminal",
            "channels": ["real-life", "business-portal", "web-browser", "business-channel-web", "business-channel-app", "retail-channel-app"]
        });
    }

    stop(_context) {}
}
