import { 
    CONFIG_ADMIN_UI_FLOW, 
    BUNDLE_TYPE_ORDER,
    BUNDLE_TYPE_SYSTEM,
    BUNDLE_TYPE_ADMIN,
    BUNDLE_TYPE_REGISTRY,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC
} from "shared-types";
import { 
    CONFIG_ADMIN_SERVICE, 
    FLOW_SERVICE,
    SYSTEM_RESET_SERVICE,
    SHELL_CONFIG_PID,
    SHELL_COMMAND_SERVICE,
    LOG_LEVEL_PROP,
    CONFIG_UPDATED_TOPIC
} from "core-types";
import { CoreActivator } from "osgi-base";

export default class Activator extends CoreActivator {
    onCoreStart(context) {
        const logger = this.logger;
        const pm = this.persistence;

        const configs = new Map();
        const flowMetadataCache = new Map(); // Map PID/BSN -> { title, icon, flowType }

        // Helper to get well-known bundle types
        const getBundleType = (pid, meta, props) => {
            // Priority 1: Manifest Header (via meta cache)
            if (meta.flowType) return meta.flowType;
            
            // Priority 2: In-Memory/Persistent Prop (deprecated/legacy support)
            if (props.flowType) return props.flowType;

            // Priority 3: Heuristics
            if (meta.orderFlow || pid.includes('order')) return BUNDLE_TYPE_ORDER;
            if (pid.includes('admin') || pid === CONFIG_ADMIN_UI_FLOW || pid === SHELL_CONFIG_PID) return BUNDLE_TYPE_ADMIN;
            if (pid.includes('event.monitor') || pid.includes('registry') || pid.includes('system') || pid.includes('logger')) return BUNDLE_TYPE_SYSTEM;
            return 'component';
        };

        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] instanceof Object && key in target) {
                    if (Array.isArray(source[key])) {
                        target[key] = source[key];
                    } else {
                        deepMerge(target[key], source[key]);
                    }
                } else {
                    target[key] = source[key];
                }
            }
            return target;
        };

        const service = {
            getConfiguration: (pid) => {
                if (typeof pid !== 'string') return { getProperties: () => ({}), update: () => {} };
                if (!configs.has(pid)) {
                    const config = {
                        getProperties: () => ({ ...(pm.load(`config.${pid}`) || {}) }),
                        update: (properties) => {
                            // Security Guard via CoreActivator helper
                            console.log(`DEBUG: ConfigAdmin.update calling isAllowed for ${pid}`);
                            if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                                if (logger) logger.warn(`Access Denied: Config update attempt for ${pid}`);
                                return;
                            }

                            const stored = pm.load(`config.${pid}`) || {};
                            deepMerge(stored, properties);
                            pm.store(`config.${pid}`, stored);
                            if (logger) logger.debug(`Updated configuration for PID: ${pid}`);
                            
                            const eventAdminRef = context.getServiceReference(EVENT_ADMIN_SERVICE);
                            const eventFactoryRef = context.getServiceReference(EVENT_FACTORY_SERVICE);
                            if (eventAdminRef && eventFactoryRef) {
                                const eventAdmin = context.getService(eventAdminRef);
                                const eventFactory = context.getService(eventFactoryRef);
                                const event = eventFactory.build(CONFIG_UPDATED_TOPIC, { pid, properties: stored });
                                eventAdmin.postEvent(event);
                            } else {
                                globalThis.dispatchEvent(new CustomEvent('config-updated', { detail: { pid, properties: stored } }));
                            }
                        }
                    };
                    configs.set(pid, config);
                }
                return configs.get(pid);
            },
            listConfigurations: () => {
                // Return all primed or currently active configuration PIDs
                // (Manifest-priming ensures all known PIDs are in the 'configs' map at least once)
                return Array.from(configs.keys()).filter(p => typeof p === 'string');
            }
        };

        // Helper to prime a single bundle based on its headers
        const primeBundle = (bundle) => {
            const headers = bundle.getHeaders();
            const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
            const configPriming = headers[configKey];
            
            if (configPriming) {
                try {
                    const primingData = typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
                    
                    // Metadata capture (for UI)
                    const bsn = bundle.getSymbolicName();
                    const existingMeta = flowMetadataCache.get(bsn) || {};
                    flowMetadataCache.set(bsn, {
                        ...existingMeta,
                        name: headers['Bundle-Name'],
                        flowType: primingData.flowType // "Flat" type declaration
                    });

                    const processPriming = (pid, defaults) => {
                        const config = service.getConfiguration(pid);
                        const current = config.getProperties();
                        
                        // We ONLY apply defaults for keys that don't exist in the current config
                        // This allows user-set overrides (including empty arrays) to persist
                        const missingDefaults = {};
                        for (const key in defaults) {
                            if (!(key in current)) {
                                missingDefaults[key] = defaults[key];
                            }
                        }
                        if (Object.keys(missingDefaults).length > 0) {
                            if (logger) logger.info(`Applying missing manifest defaults for ${pid}`);
                            // INTERNAL UPDATE: Bypass security check during boot priming
                            const stored = pm.load(`config.${pid}`) || {};
                            deepMerge(stored, missingDefaults);
                            pm.store(`config.${pid}`, stored);
                        }
                    };

                    // Detect "Flat" structure: top-level keys like flowType or channels
                    const isFlat = primingData.flowType || primingData.channels || primingData["required-permissions"];
                    if (isFlat) {
                        processPriming(bundle.getSymbolicName(), primingData);
                    } else {
                        // Classic PID mapping
                        for (const [pid, defaults] of Object.entries(primingData)) {
                            if (typeof defaults === 'object') {
                                processPriming(pid, defaults);
                            }
                        }
                    }
                } catch (e) {
                    if (logger) logger.error(`Failed to parse Configuration header in bundle ${bundle.getSymbolicName()}`, e);
                }
            }
        };

        // Manifest-driven Priming (Initial scan)
        const primeFromManifests = () => {
            const bundles = context.getBundles();
            bundles.forEach(bundle => {
                primeBundle(bundle);
            });
        };

        context.registerService(CONFIG_ADMIN_SERVICE, service, { "capability": "sys:config" });
        
        const flowMetadata = {
            id: CONFIG_ADMIN_UI_FLOW,
            title: "Universe Settings",
            icon: "fas fa-cog",
            launch: async (targetElement) => {
                const bsn = context.getBundle().getSymbolicName();
                if (targetElement.getAttribute('data-bsn') === bsn) return;
                targetElement.setAttribute('data-bsn', bsn);

                const Alpine = (await import("https://esm.sh/alpinejs@3.13.5")).default;
                const state = Alpine.reactive({
                    cfgs: [],
                    init() {
                        const configsList = service.listConfigurations().filter(p => typeof p === 'string');
                        this.cfgs = configsList.map(pid => {
                            const props = service.getConfiguration(pid).getProperties() || {};
                            const meta = flowMetadataCache.get(pid) || {};
                            const type = getBundleType(pid, meta, props);
                             return {
                                pid,
                                properties: props,
                                name: meta.name || meta.title || pid,
                                title: meta.title || pid,
                                icon: meta.icon || BUNDLE_TYPE_REGISTRY[type]?.icon || 'fas fa-cube',
                                type: type
                            };
                        });
                    },
                    get categorized() {
                        const types = [...new Set(this.cfgs.map(c => c.type))];
                        const order = Object.keys(BUNDLE_TYPE_REGISTRY);
                        const getCategoryMeta = (type) => BUNDLE_TYPE_REGISTRY[type] || { 
                            title: type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
                            color: "slate",
                            icon: "fas fa-cube"
                        };
                        return types.sort((a, b) => {
                            const idxA = order.indexOf(a);
                            const idxB = order.indexOf(b);
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                            return a.localeCompare(b);
                        }).map(type => {
                            const meta = getCategoryMeta(type);
                            return {
                                type,
                                ...meta,
                                items: this.cfgs.filter(c => (c.type === 'component' ? BUNDLE_TYPE_ADMIN : c.type) === type)
                            };
                        });
                    },
                    toggleChannel(pid, channel, enabled) {
                        const cfg = service.getConfiguration(pid);
                        const props = cfg.getProperties() || {};
                        const channels = props.channels || [];
                        const nextChannels = enabled ? [...new Set([...channels, channel])] : channels.filter(c => c !== channel);
                        cfg.update({ ...props, channels: nextChannels });
                        this.init();
                    },
                    setLogLevel(pid, level) {
                        const cfg = service.getConfiguration(pid);
                        cfg.update({ [LOG_LEVEL_PROP]: level });
                        this.init();
                    }
                });

                targetElement._x_dataStack = [state];
                const response = await fetch("./bundles/org.neverplayed.config-admin/templates/settings-ui.html");
                targetElement.innerHTML = await response.text();
                state.init();

                if (!targetElement.hasAttribute('data-reset-listener-active')) {
                    targetElement.addEventListener('shell-system-reset', () => {
                        const resetRefs = context.getServiceReferences(SYSTEM_RESET_SERVICE);
                        if (resetRefs.length > 0) {
                            context.getService(resetRefs[0]).factoryReset();
                        }
                    });
                    
                    globalThis.addEventListener('config-updated', () => {
                        if (targetElement.isConnected) {
                            state.init();
                        }
                    });
                    
                    targetElement.setAttribute('data-reset-listener-active', 'true');
                }
            }
        };

        context.registerService(FLOW_SERVICE, flowMetadata, { 
            ...this.config, 
            "flow.id": CONFIG_ADMIN_UI_FLOW 
        });

        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
            addingService: (ref) => {
                const bsn = ref.bundle.getSymbolicName();
                flowMetadataCache.set(bsn, {
                    title: ref.getProperty("flow.title") || ref.getProperty("title"),
                    icon: ref.getProperty("flow.icon") || ref.getProperty("icon"),
                    flowType: ref.getProperty("flowType")
                });
            },
            removedService: (ref) => {
                flowMetadataCache.delete(ref.bundle.getSymbolicName());
            }
        }).open();

        primeFromManifests();

        context.addBundleListener({
            bundleChanged: (event) => {
                if (event.type === "INSTALLED" || event.type === "STARTED") {
                    primeBundle(event.bundle);
                }
            }
        });

        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "prime-all",
            description: "Sync all active bundles strategies to ConfigAdmin (hot-reload)",
            execute: async (_args, _ctx, log) => {
                await Promise.resolve();
                if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                    log("Access Denied: You do not have the 'neverplayed-admin' attribute.", "error");
                    return;
                }
                log("Re-priming all bundle configurations...");
                primeFromManifests();
                log("Re-priming completed.");
            }
        });

        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "reset-config",
            description: "[pid] - Reset a specific configuration to defaults",
            execute: async (args, _ctx, log) => {
                await Promise.resolve();
                if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                    log("Access Denied: You do not have the 'neverplayed-admin' attribute.", "error");
                    return;
                }
                const pid = args[0];
                if (!pid) {
                    log("Usage: /reset-config [pid]", "error");
                    return;
                }
                const config = service.getConfiguration(pid);
                await config.update({});
                pm.store(`config.${pid}`, {});
                log(`Configuration for ${pid} reset to manifest defaults.`);
            }
        });

        // Bridge OSGi events to DOM for the UI
        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                if (event.getTopic() === CONFIG_UPDATED_TOPIC) {
                    const detail = {};
                    event.getPropertyNames().forEach(key => {
                        detail[key] = event.getProperty(key);
                    });
                    globalThis.dispatchEvent(new CustomEvent('config-updated', { detail }));
                }
            }
        }, { [EVENT_TOPIC]: [CONFIG_UPDATED_TOPIC] });
    }

    stop(_context) {}
}
