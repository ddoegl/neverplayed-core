import { FLOW_SERVICE } from "../../../shared-types.js";
import { sendInvitationRequest } from "../../../auth-shield.js";

export default class Activator {
    start(context) {
        // Initial state for the shell
        const state = Alpine.reactive({
            history: [],
            currentCommand: "",
            historyIndex: -1,
            commandHistory: [],
            
            addLog(content, type = 'output') {
                this.history.push({
                    timestamp: Date.now(),
                    time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    content,
                    type
                });
                
                // Keep history manageable
                if (this.history.length > 100) this.history.shift();
                
                // Auto-scroll
                setTimeout(() => {
                    const el = document.querySelector('[x-ref="outputArea"]');
                    if (el) el.scrollTop = el.scrollHeight;
                }, 10);
            }
        });

        // Define the scope factory for the Shell UI
        globalThis.getShellScope = () => {
            return {
                get history() { return state.history; },
                get currentCommand() { return state.currentCommand; },
                set currentCommand(val) { state.currentCommand = val; },
                
                executeCommand() {
                    const cmd = state.currentCommand.trim();
                    if (!cmd) return;
                    
                    state.addLog(cmd, 'input');
                    state.commandHistory.push(cmd);
                    state.historyIndex = state.commandHistory.length;
                    state.currentCommand = "";
                    
                    this.processCommand(cmd);
                },
                
                async processCommand(input) {
                    const parts = input.split(' ');
                    const command = parts[0].toLowerCase();
                    const args = parts.slice(1);
                    
                    switch(command) {
                        case '/help':
                            state.addLog(`
                                <div class="space-y-1">
                                    <div class="text-white font-bold underline">Available Commands:</div>
                                    <div><span class="text-yellow-400">/invite [email]</span> - Send fellowship invitation</div>
                                    <div><span class="text-yellow-400">/clear</span> - Clear terminal history</div>
                                    <div><span class="text-yellow-400">/whoami</span> - Show current session info</div>
                                    <div><span class="text-yellow-400">/help</span> - Show this help message</div>
                                </div>
                            `);
                            break;
                            
                        case '/clear':
                            state.history = [];
                            break;
                            
                        case '/whoami': {
                            const sessionRef = context.getServiceReference("prototyper.session.service");
                            const session = sessionRef ? context.getService(sessionRef) : null;
                            const user = session?.currentUser;
                            if (user) {
                                state.addLog(`Active User: <span class="text-white">${user.alias || user.email || user.firstname}</span> (ID: ${user.id})`);
                            } else {
                                state.addLog("No active session found.", 'error');
                            }
                            break;
                        }
                            
                        case '/invite': {
                            if (!args[0]) {
                                state.addLog("Usage: /invite [email]", 'error');
                                return;
                            }
                            state.addLog(`Initializing invitation for <span class="text-white">${args[0]}</span>...`);
                            try {
                                const result = await sendInvitationRequest(args[0]);
                                if (result.success) {
                                    state.addLog(`Success! Fellowship invitation sent to ${args[0]}.`, 'success');
                                    state.addLog(`Message ID: <span class="opacity-50 text-[10px]">${result.messageId}</span>`);
                                } else {
                                    state.addLog(`Failed: ${result.message || 'Unknown error'}`, 'error');
                                }
                            } catch (err) {
                                state.addLog(`System Error: ${err.message}`, 'error');
                            }
                            break;
                        }
                            
                        default:
                            state.addLog(`Unknown command: ${command}. Type /help for assistance.`, 'error');
                    }
                },
                
                navigateHistory(dir) {
                    if (state.commandHistory.length === 0) return;
                    state.historyIndex = Math.max(0, Math.min(state.commandHistory.length - 1, state.historyIndex + dir));
                    state.currentCommand = state.commandHistory[state.historyIndex] || "";
                }
            };
        };

        // Register the Flow Service
        context.registerService(FLOW_SERVICE, {
            id: "shell-cli",
            title: "Shell CLI",
            launch: (targetElement) => {
                targetElement.innerHTML = `
                    <div id="shell-container" class="h-full w-full">
                        <div class="h-full border border-blue-900 shadow-2xl rounded-xl overflow-hidden">
                            <div id="shell-content-wrapper" class="h-full">
                                <div x-html="await (await fetch('./bundles/system-clients/shell-cli/templates/shell.html')).text()"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }, {
            "flow.id": "shell-cli",
            "flowType": "service-flow",
            "channels": ["real-life", "business-portal", "web-browser", "business-channel-web", "business-channel-app", "retail-channel-app"]
        });
    }

    stop(_context) {
        console.log("Shell CLI: Bundle stopped.");
    }
}
