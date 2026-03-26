import { 
    CONFIG_ADMIN_SERVICE, 
    FLOW_SERVICE, 
    LOG_SERVICE, 
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC
} from "shared-types";

export default class Activator {
    start(context) {
        let logger = null;
        let configAdmin = null;
        let verbosity = "INFO"; // Default

        const updateConfig = (conf) => {
            const properties = conf?.getProperties() || {};
            if (properties.level) {
                verbosity = properties.level;
                if (logger) logger.info(`Verbosity updated to: ${verbosity}`);
            }
        };

        // Track LogAdmin
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => { 
                const logAdmin = context.getService(ref);
                logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                logger.info("Log Service connected");
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
                
                const logMsg = `Topic: ${topic} | Data: ${safeJson(data)}`;

                if (logger) {
                    if (verbosity === "DEBUG") {
                        logger.debug(logMsg);
                    } else {
                        logger.info(logMsg);
                    }
                } else {
                    console.warn(`[EventMonitor][FALLBACK] ${logMsg}`);
                }
            }
        };

        context.registerService(EVENT_HANDLER_INTERFACE, eventHandler, {
            [EVENT_TOPIC]: ["backoffice/invitations/*", "backoffice/cases/*"]
        });

        // Register as a FLOW_SERVICE so it can be governed
        const flowMetadata = {
            id: "@neverplayed/event-monitor",
            title: "Event Monitor",
            icon: "fas fa-terminal",
            launch: (target) => {
                target.innerHTML = `
                    <div class="p-8 bg-slate-900 text-green-400 font-mono h-full overflow-auto text-xs">
                        <div class="mb-4 border-b border-green-900/50 pb-2 flex justify-between items-center text-xs uppercase tracking-widest font-bold">
                            <span>[SYSTEM] Event Monitor active...</span>
                            <span class="text-[9px] opacity-50">Verbosity: ${verbosity}</span>
                        </div>
                        <div id="event-log-monitor" class="space-y-1">
                             Waiting for events...
                        </div>
                    </div>
                `;
            }
        };
        context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": "@neverplayed/event-monitor" });

        if (logger) logger.info("Event Monitor started and subscribed to topics");
    }

    async stop(_context) {
        
    }
}
