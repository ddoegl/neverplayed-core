import { 
    FLOW_SERVICE, 
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    EVENT_MONITOR_PID,
    LOG_LEVEL_PROP
} from "shared-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
    onStart(context) {
        const logger = this.logger;
        const config = this.config;
        const verbosity = config[LOG_LEVEL_PROP] || "INFO";

        // Maintain an in-memory ring buffer of the last 100 events
        this.eventHistory = [];
        const MAX_HISTORY = 100;

        // Register Event Handler for ALL topics
        const eventHandler = {
            handleEvent: (event) => {
                const topic = event.getTopic();
                let data = event.getProperty('data');
                
                // If no distinct data property, extract all properties as a plain object
                if (!data) {
                    data = {};
                    const keys = event.getPropertyNames();
                    for (const key of keys) {
                        data[key] = event.getProperty(key);
                    }
                }

                // Safe stringify helper for circular refs
                const safeJson = (obj) => {
                    const cache = new Set();
                    return JSON.stringify(obj, (_key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (cache.has(value)) return '[Circular]';
                            cache.add(value);
                        }
                        return value;
                    }, 2);
                };
                
                const logMsg = `[${new Date().toLocaleTimeString()}] Topic: ${topic} | Data: ${safeJson(data)}`;
                
                // Save to history buffer (unshift puts newest at index 0)
                this.eventHistory.unshift(logMsg);
                if (this.eventHistory.length > MAX_HISTORY) {
                    this.eventHistory.pop();
                }

                // Also Render to UI Element if active
                const ui = globalThis.document?.getElementById('event-log-monitor');
                if (ui) {
                     if (ui.innerHTML.includes("Waiting for events...")) ui.innerHTML = "";
                     const entry = globalThis.document.createElement('div');
                     entry.className = "border-b border-green-900/30 pb-1 mb-1";
                     entry.innerText = logMsg;
                     ui.prepend(entry);
                }

                if (verbosity === "DEBUG") {
                    logger.debug(logMsg);
                } else {
                    logger.info(logMsg);
                }
            }
        };

        context.registerService(EVENT_HANDLER_INTERFACE, eventHandler, {
            [EVENT_TOPIC]: ["backoffice/invitations/*", "backoffice/cases/*", "org/neverplayed/config/*"]
        });

        // Register as a FLOW_SERVICE so it can be governed
        const flowMetadata = {
            id: EVENT_MONITOR_PID,
            title: "Event Monitor",
            icon: "fas fa-terminal",
            launch: (target) => {
                const historyHtml = this.eventHistory.length > 0 
                    ? this.eventHistory.map(msg => `<div class="border-b border-green-900/30 pb-1 mb-1">${msg}</div>`).join('') 
                    : "Waiting for events...";

                target.innerHTML = `
                    <div class="p-8 bg-slate-900 text-green-400 font-mono h-full overflow-auto text-xs">
                        <div class="mb-4 border-b border-green-900/50 pb-2 flex justify-between items-center text-xs uppercase tracking-widest font-bold">
                            <span>[SYSTEM] Event Monitor active...</span>
                            <span class="text-[9px] opacity-50">Verbosity: ${verbosity}</span>
                        </div>
                        <div id="event-log-monitor" class="space-y-1">
                             ${historyHtml}
                        </div>
                    </div>
                `;
            }
        };
        context.registerService(FLOW_SERVICE, flowMetadata, { 
            ...config,
            "flow.id": EVENT_MONITOR_PID,
            "sidebar": true
        });

        logger.info("Event Monitor started and subscribed to topics");
    }
}
