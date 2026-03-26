import { 
    CONFIG_ADMIN_SERVICE, 
    FLOW_SERVICE, 
    CONFIG_ADMIN_UI_FLOW, 
    SYSTEM_RESET_SERVICE,
    BUNDLE_TYPE_ORDER,
    BUNDLE_TYPE_SYSTEM,
    BUNDLE_TYPE_ADMIN,
    SHELL_CONFIG_PID,
    BUNDLE_TYPE_REGISTRY,
    LOG_SERVICE,
    LOG_LEVEL_PROP
} from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
    start(context) {
        let logger = null;
        const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
        const pm = context.getService(pmRef);

        const configs = new Map();
        const flowMetadataCache = new Map(); // Map PID/BSN -> { title, icon, flowType }

        // Track LogService for standardized logging
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                logger.info("Log Service connected");
            },
            removedService: () => { logger = null; }
        }).open();

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
                        // For arrays, we now replace them to support subtraction (e.g. toggles)
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
                    const stored = pm.load(`config.${pid}`) || {};
                    const config = {
                        getProperties: () => ({ ...stored }),
                        update: (properties) => {
                            // Deep merge updates into stored config
                            deepMerge(stored, properties);
                            pm.store(`config.${pid}`, stored);
                            if (logger) logger.debug(`Updated configuration for PID: ${pid}`);
                            globalThis.dispatchEvent(new CustomEvent('config-updated', { detail: { pid, properties: stored } }));
                        }
                    };
                    configs.set(pid, config);
                }
                return configs.get(pid);
            },
            listConfigurations: () => {
                // Return all primed or stored configuration PIDs
                const pids = new Set(configs.keys());
                // Also scan localStorage for any stored configs not yet loaded
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('config.')) {
                        pids.add(key.replace('config.', ''));
                    }
                }
                 return Array.from(pids).filter(p => typeof p === 'string');
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
                            config.update(missingDefaults);
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
                    else console.error(`ConfigAdmin: Failed to parse Configuration header in bundle ${bundle.getSymbolicName()}`, e);
                }
            }
        };

        // Manifest-driven Priming (Initial scan)
        const primeFromManifests = () => {
            const bundles = context.getBundles();
            bundles.forEach(bundle => {
                primeBundle(bundle, bundle.getHeaders());
            });
        };

        context.registerService(CONFIG_ADMIN_SERVICE, service);
        // Register the ConfigAdmin UI Flow
        const flowMetadata = {
            id: CONFIG_ADMIN_UI_FLOW,
            title: "Universe Settings",
            icon: "fas fa-cog",
            launch: async (targetElement) => {
                const state = Alpine.reactive({
                    cfgs: [],
                    init() {
                        const configsList = service.listConfigurations().filter(p => typeof p === 'string');
                        if (logger) logger.debug(`UI initializing with ${configsList.length} PIDs`);

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
                        let nextChannels;
                        if (enabled) {
                            nextChannels = [...new Set([...channels, channel])];
                        } else {
                            nextChannels = channels.filter(c => c !== channel);
                        }
                        cfg.update({ ...props, channels: nextChannels });
                        this.init(); // Refresh local list
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

                // Listen for system reset from the template
                targetElement.addEventListener('shell-system-reset', () => {
                   const resetRefs = context.getServiceReferences(SYSTEM_RESET_SERVICE);
                   if (resetRefs.length > 0) {
                       context.getService(resetRefs[0]).factoryReset();
                   }
                });
            }
        };
        context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": CONFIG_ADMIN_UI_FLOW });

        if (logger) logger.info("Service registered successfully");

        // Track Flow Metadata to enrich the UI
        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
            addingService: (ref) => {
                const bsn = ref.bundle.getSymbolicName();
                const pid = bsn; // We use BSN as default PID for flat configs
                flowMetadataCache.set(pid, {
                    title: ref.getProperty("flow.title") || ref.getProperty("title"),
                    icon: ref.getProperty("flow.icon") || ref.getProperty("icon"),
                    flowType: ref.getProperty("flowType")
                });
            },
            removedService: (ref) => {
                flowMetadataCache.delete(ref.bundle.getSymbolicName());
            }
        }).open();

        // Initial scan
        primeFromManifests();

        // Listen for future bundles
        context.addBundleListener({
            bundleChanged: (event) => {
                if (event.type === "INSTALLED" || event.type === "STARTED") {
                    primeBundle(event.bundle);
                }
            }
        });
    }

    async stop(_context) {}
}
