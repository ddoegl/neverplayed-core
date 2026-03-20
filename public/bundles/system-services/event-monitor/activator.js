import { CONFIG_ADMIN_SERVICE, FLOW_SERVICE } from "../../../shared-types.js";

export default class Activator {
    start(context) {
        let logger = null;
        let configAdmin = null;
        let verbosity = "INFO"; // Default

        const updateConfig = (conf) => {
            const properties = conf?.getProperties() || {};
            if (properties.level) {
                verbosity = properties.level;
                console.log(`[EventMonitor] Verbosity (level) updated to: ${verbosity}`);
            }
        };

        // Track LogAdmin
        context.trackService("(objectClass=@pandino/log-service)", {
            addingService: (ref) => { 
                logger = context.getService(ref);
                console.log("[EventMonitor] LogService joined");
            },
            removedService: (ref) => { logger = null; context.ungetService(ref); }
        }).open();

        // Track ConfigAdmin
        context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                configAdmin = context.getService(ref);
                const config = configAdmin.getConfiguration("event.monitor.config");
                updateConfig(config);
            },
            removedService: () => { configAdmin = null; }
        }).open();


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
                
                const logMsg = `[EVENT] Topic: ${topic} | Data: ${safeJson(data)}`;

                if (logger) {
                    if (verbosity === "DEBUG") {
                        logger.debug(logMsg);
                    } else {
                        logger.info(logMsg);
                    }
                } else {
                    console.log(`[EventMonitor][FALLBACK][${verbosity}] ${logMsg}`);
                }
            }
        };

        context.registerService("@pandino/event-admin/EventHandler", eventHandler, {
            "event.topics": ["backoffice/invitations/*", "backoffice/cases/*"]
        });

        // Register as a FLOW_SERVICE so it can be governed
        const flowMetadata = {
            id: "event-monitor",
            title: "Event Monitor",
            icon: "fas fa-terminal",
            launch: (target) => {
                target.innerHTML = `
                    <div class="p-8 bg-slate-900 text-green-400 font-mono h-full overflow-auto">
                        <div class="mb-4 border-b border-green-900/50 pb-2 flex justify-between items-center">
                            <span>[SYSTEM] Event Monitor active...</span>
                        </div>
                        <div id="event-log-monitor">
                             Waiting for events... (Verbosity: ${verbosity})
                        </div>
                    </div>
                `;
            }
        };
        context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": "event-monitor" });

        console.log("[EventMonitor] Started and subscribed to backoffice/invitations/*");
    }

    async stop(_context) {
        
    }
}
