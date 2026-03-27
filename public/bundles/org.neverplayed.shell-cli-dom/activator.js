import { FLOW_SERVICE, SHELL_CLI_SERVICE, BUNDLE_TYPE_SERVICE, SHELL_CLI_PID } from "core-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    onStart(context) {
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

        // Sync initial history
        shellService.getHistory().forEach(entry => state.addLog(entry));

        // Subscribe to live output
        shellService.subscribe(entry => state.addLog(entry));

        // 3. Define Shell Scope for Template
        globalThis.getShellScope = () => ({
            currentCommand: "",
            get history() { return state.history; },
            
            async executeCommand() {
                const cmd = this.currentCommand.trim();
                if (!cmd) return;
                this.currentCommand = "";
                state.commandHistory.push(cmd);
                state.historyIndex = state.commandHistory.length;
                await shellService.execute(cmd);
            },
            
            navigateHistory(dir) {
                if (state.commandHistory.length === 0) return;
                state.historyIndex = Math.max(0, Math.min(state.commandHistory.length - 1, state.historyIndex + dir));
                this.currentCommand = state.commandHistory[state.historyIndex] || "";
            }
        });

        // 4. Register as Flow Service
        context.registerService(FLOW_SERVICE, {
            ...this.config,
            id: SHELL_CLI_PID,
            title: "Shell CLI",
            launch: (targetElement) => {
                targetElement.innerHTML = `
                    <div id="shell-container" class="h-full w-full">
                        <div class="h-full border border-blue-900 shadow-2xl rounded-xl overflow-hidden">
                            <div id="shell-content-wrapper" class="h-full">
                                <div class="h-full" x-html="await (await fetch('./bundles/org.neverplayed.shell-cli-dom/templates/shell.html')).text()"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }, {
            "capability": "sys:cli:dom", // Specialized capability
            "flow.id": SHELL_CLI_PID,
            "flowType": BUNDLE_TYPE_SERVICE,
            "sidebar": true,
            "icon": "fas fa-terminal",
            "channels": ["real-life", "business-portal", "web-browser", "business-channel-web", "business-channel-app", "retail-channel-app"]
        });
    }

    stop(_context) {}
}
