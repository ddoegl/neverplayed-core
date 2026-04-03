import { FLOW_SERVICE, SHELL_CLI_SERVICE, BUNDLE_TYPE_SERVICE, SHELL_CLI_PID } from "core-types";
import { AlpineActivator } from "alpine-base";

export default class Activator extends AlpineActivator {
    onStart(context) {
        // 1. Maintain reactive log state
        const state = this.initStore('shell_cli', {
            history: [],
            commandHistory: [],
            historyIndex: -1
        });

        // 2. Track & Sync CLI Service
        this.track(`(objectClass=${SHELL_CLI_SERVICE})`, {
            addingService: (ref) => {
                const shellService = context.getService(ref);
                
                // Sync initial history
                shellService.getHistory().forEach(entry => this.addLog(state, entry));

                // Subscribe to live output
                shellService.subscribe(entry => {
                    if (entry.type === 'clear') state.history = [];
                    else this.addLog(state, entry);
                });

                // Register Flow Service
                const getFlowProps = () => ({
                    "flow.id": SHELL_CLI_PID,
                    "flow.title": this.config.title || "Shell CLI",
                    "flow.icon": this.config.icon || "fas fa-terminal",
                    "flowType": this.config.flowType || BUNDLE_TYPE_SERVICE,
                    "sidebar": this.config.sidebar !== undefined ? this.config.sidebar : true,
                    "channels": this.config.channels || ["real-life", "business-portal", "web-browser", "business-channel-web"],
                    "capability": "sys:cli"
                });

                const registration = context.registerService(FLOW_SERVICE, {
                    id: SHELL_CLI_PID,
                    title: this.config.title || "Shell CLI",
                    launch: async (target) => {
                        if (!target.id) target.id = `flow-target-${SHELL_CLI_PID.replace(/\./g, '_')}`;
                        await this.render(`#${target.id}`, 'templates/shell.html', () => ({
                            currentCommand: "",
                            get shellHistory() { return state.history; },
                            async executeCommand() {
                                const cmd = this.currentCommand.trim();
                                if (!cmd) return;
                                state.commandHistory.push(cmd);
                                state.historyIndex = state.commandHistory.length;
                                this.currentCommand = "";
                                await shellService.execute(cmd);
                            },
                            navigateHistory(dir) {
                                if (state.commandHistory.length === 0) return;
                                state.historyIndex = Math.max(0, Math.min(state.commandHistory.length - 1, state.historyIndex + dir));
                                this.currentCommand = state.commandHistory[state.historyIndex] || "";
                            }
                        }), {
                            "class": "h-full border border-blue-900 shadow-2xl rounded-xl overflow-hidden animate-fade-in"
                        });
                    }
                }, getFlowProps());

                // Listen for config updates to reactively update sidebar visibility
                globalThis.addEventListener('config-updated', (ev) => {
                    if (ev.detail?.pid === this.bsn || ev.detail?.pid === SHELL_CLI_PID) {
                        this.logger?.debug(`[${this.bsn}] Configuration updated, refreshing flow properties...`);
                        registration.setProperties(getFlowProps());
                    }
                });

                return shellService;
            }
        });
    }

    addLog(state, entry) {
        const now = new Date(entry.timestamp);
        const time = now.getHours().toString().padStart(2, '0') + ':' + 
                    now.getMinutes().toString().padStart(2, '0') + ':' + 
                    now.getSeconds().toString().padStart(2, '0');
        
        let formatted = entry.content;
        if (typeof formatted === 'object' && formatted !== null) {
            if (formatted.text) {
                const colors = { blue: 'text-blue-400', green: 'text-emerald-400', yellow: 'text-amber-400', red: 'text-rose-400' };
                formatted = `<span class="${colors[formatted.color] || 'text-slate-200'}">${formatted.text}</span>`;
            } else {
                formatted = `<pre class="text-[10px] text-emerald-400 overflow-x-auto">${JSON.stringify(formatted, null, 2)}</pre>`;
            }
        }

        state.history.push({ ...entry, content: formatted, time });
        if (state.history.length > 100) state.history.shift();

        setTimeout(() => {
            const el = document.querySelector('[x-ref="outputArea"]');
            if (el) el.scrollTop = el.scrollHeight;
        }, 10);
    }
}
