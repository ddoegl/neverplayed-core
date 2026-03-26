import { LOG_SERVICE, CONFIG_ADMIN_SERVICE, SHELL_CONFIG_PID } from "../../../shared-types.js";

export default class Activator {
    start(context) {
        let configAdmin = null;
        const levels = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, NONE: 5 };
        const levelColors = {
            TRACE: 'color: #a855f7',
            DEBUG: 'color: #8b5cf6',
            INFO: 'color: #3b82f6',
            WARN: 'color: #eab308; font-weight: bold',
            ERROR: 'color: #ef4444; font-weight: bold'
        };

        const getEffectiveLevel = (pid) => {
            if (!configAdmin) return levels.INFO;
            
            // 1. Check bundle specific config
            const bundleCfg = configAdmin.getConfiguration(pid)?.getProperties() || {};
            if (bundleCfg["log-level"]) return levels[bundleCfg["log-level"].toUpperCase()] ?? levels.INFO;

            // 2. Check global shell config
            const globalCfg = configAdmin.getConfiguration(SHELL_CONFIG_PID)?.getProperties() || {};
            if (globalCfg["log-level"]) return levels[globalCfg["log-level"].toUpperCase()] ?? levels.INFO;

            return levels.INFO;
        };

        const createLogger = (targetPid = "global") => {
            const logFn = (levelName, msg, err) => {
                const targetLevel = levels[levelName];
                const currentLevel = getEffectiveLevel(targetPid);

                if (targetLevel >= currentLevel) {
                    const prefix = `%c[${levelName}]%c [${targetPid}]`;
                    const color = levelColors[levelName];
                    
                    if (levelName === 'ERROR') {
                        console.error(prefix + ` ${msg}`, color, 'color: inherit');
                        if (err) console.error(err);
                    } else if (levelName === 'WARN') {
                        console.warn(prefix + ` ${msg}`, color, 'color: inherit');
                    } else if (levelName === 'DEBUG') {
                        console.debug(prefix + ` ${msg}`, color, 'color: inherit');
                    } else if (levelName === 'TRACE') {
                        console.trace(prefix + ` ${msg}`, color, 'color: inherit');
                    } else {
                        console.info(prefix + ` ${msg}`, color, 'color: inherit');
                    }
                }
            };

            return {
                trace: (msg) => logFn('TRACE', msg),
                debug: (msg) => logFn('DEBUG', msg),
                info: (msg) => logFn('INFO', msg),
                log: (msg) => logFn('INFO', msg),
                warn: (msg) => logFn('WARN', msg),
                error: (msg, err) => logFn('ERROR', msg, err)
            };
        };

        // Standard LogService implementation
        const logService = createLogger();
        
        // Helper to get bundle-specific loggers
        logService.getLogger = (bsn) => createLogger(bsn);

        // Track ConfigAdmin to enable dynamic level switching
        context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                configAdmin = context.getService(ref);
                const logger = logService.getLogger("system-logger");
                logger.info("ConfigAdmin connected, dynamic filtering enabled.");
            },
            removedService: () => { configAdmin = null; }
        }).open();

        const logger = logService.getLogger("system-logger");
        logger.info(`Registering ${LOG_SERVICE} service...`);
        this.registration = context.registerService(LOG_SERVICE, logService);
        
        // Backward compatibility registrations
        context.registerService('@pandino/pandino/Logger', logService);
        context.registerService('system.logger', logService);
    }

    stop(_context) {
        if (this.registration) {
            this.registration.unregister();
        }
    }
}
