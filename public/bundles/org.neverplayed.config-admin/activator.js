import { 
    CONFIG_ADMIN_UI_FLOW, 
    BUNDLE_TYPE_ORDER,
    BUNDLE_TYPE_SYSTEM,
    BUNDLE_TYPE_ADMIN,
    BUNDLE_TYPE_REGISTRY,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    CONFIG_ADMIN_SERVICE, 
    FLOW_SERVICE,
    SYSTEM_RESET_SERVICE,
    SHELL_CONFIG_PID,
    SHELL_COMMAND_SERVICE,
    LOG_LEVEL_PROP,
    CONFIG_UPDATED_TOPIC,
    BUNDLE_TYPE_SERVICE
} from "core-types";
import { CoreAlpineActivator } from "alpine-base";
import Alpine from "alpinejs";

const BUNDLE_TYPE_CONFIG = {
    [BUNDLE_TYPE_ORDER]: { title: "Order Pipeline", color: "orange", icon: "fas fa-shopping-cart" },
    [BUNDLE_TYPE_SYSTEM]: { title: "System Fabric", color: "slate", icon: "fas fa-microchip" },
    [BUNDLE_TYPE_ADMIN]: { title: "Administrative", color: "blue", icon: "fas fa-shield-alt" },
    [BUNDLE_TYPE_REGISTRY]: { title: "Registries", color: "indigo", icon: "fas fa-database" },
    [BUNDLE_TYPE_SERVICE]: { title: "Services", color: "purple", icon: "fas fa-cube" },
    'component': { title: "Components", color: "emerald", icon: "fas fa-puzzle-piece" }
};

export default class Activator extends CoreAlpineActivator {
    onCoreStart(context) {
        const logger = this.logger;
        const pm = this.persistence;
        const configs = new Map();
        const flowMetadataCache = new Map();

        const getBundleType = (pid, meta, props) => {
            if (meta.flowType) return meta.flowType;
            if (props.flowType) return props.flowType;
            if (meta.orderFlow || pid.includes('order')) return BUNDLE_TYPE_ORDER;
            if (pid.includes('admin') || pid === CONFIG_ADMIN_UI_FLOW || pid === SHELL_CONFIG_PID) return BUNDLE_TYPE_ADMIN;
            if (pid.includes('event.monitor') || pid.includes('registry') || pid.includes('system') || pid.includes('logger')) return BUNDLE_TYPE_SYSTEM;
            return 'component';
        };

        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] instanceof Object && key in target && !Array.isArray(source[key])) {
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
            return target;
        };

        const primeBundle = (bundle) => {
            const headers = bundle.getHeaders();
            const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
            const configPriming = headers[configKey];
            if (configPriming) {
                try {
                    const primingData = typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
                    const bsn = bundle.getSymbolicName();
                    const existingMeta = flowMetadataCache.get(bsn) || {};
                    flowMetadataCache.set(bsn, { ...existingMeta, name: headers['Bundle-Name'], flowType: primingData.flowType });
                    const processPriming = (pid, defaults) => {
                        const config = service.getConfiguration(pid);
                        const current = config.getProperties();
                        const missingDefaults = {};
                        for (const key in defaults) if (!(key in current)) missingDefaults[key] = defaults[key];
                        if (Object.keys(missingDefaults).length > 0) {
                            const stored = pm.load(`config.${pid}`) || {};
                            deepMerge(stored, missingDefaults);
                            pm.store(`config.${pid}`, stored);
                        }
                    };
                    if (primingData.flowType || primingData.channels) processPriming(bsn, primingData);
                    else for (const [pid, defaults] of Object.entries(primingData)) if (typeof defaults === 'object') processPriming(pid, defaults);
                } catch (e) { logger.error(`Failed priming: ${bundle.getSymbolicName()}`, e); }
            }
        };

        const primeFromManifests = () => context.getBundles().forEach(b => primeBundle(b));

        const service = {
            getConfiguration: (pid) => {
                if (typeof pid !== 'string') return { getProperties: () => ({}), update: () => {} };
                if (!configs.has(pid)) {
                    const config = {
                        getProperties: () => ({ ...(pm.load(`config.${pid}`) || {}) }),
                        update: async (properties) => {
                            if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) {
                                if (logger) logger.warn(`Access Denied: Config update attempt for ${pid}`);
                                return;
                            }
                            const stored = pm.load(`config.${pid}`) || {};
                            deepMerge(stored, properties);
                            await pm.store(`config.${pid}`, stored);
                            
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
            listConfigurations: () => Array.from(configs.keys()).filter(p => typeof p === 'string')
        };


        context.registerService(CONFIG_ADMIN_SERVICE, service, { "capability": "sys:config" });
        
        const flowMetadata = {
            id: CONFIG_ADMIN_UI_FLOW,
            title: "Universe Settings",
            icon: "fas fa-cog",
            launch: async (targetElement) => {
                // Determine CSS target (Ensure target has an ID for our renderer)
                if (!targetElement.id) targetElement.id = `flow-target-${CONFIG_ADMIN_UI_FLOW.replace(/\./g, '_')}`;
                
                await this.render(`#${targetElement.id}`, 'templates/settings-ui.html', () => ({
                    cfgs: [],
                    init() {
                        this.cfgs = service.listConfigurations().map(pid => {
                            const props = service.getConfiguration(pid).getProperties() || {};
                            const meta = flowMetadataCache.get(pid) || {};
                            const type = getBundleType(pid, meta, props);
                             return { pid, properties: props, name: meta.name || meta.title || pid, title: meta.title || pid, icon: meta.icon || BUNDLE_TYPE_CONFIG[type]?.icon || 'fas fa-cube', type };
                        });
                    },
                    get categorized() {
                        const types = [...new Set(this.cfgs.map(c => c.type))];
                        const order = Object.keys(BUNDLE_TYPE_CONFIG);
                        return types.sort((a, b) => {
                            const idxA = order.indexOf(a), idxB = order.indexOf(b);
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            return a.localeCompare(b);
                        }).map(type => ({
                            type,
                            ...(BUNDLE_TYPE_CONFIG[type] || { title: type, color: "slate", icon: "fas fa-cube" }),
                            items: this.cfgs.filter(c => (c.type === 'component' ? BUNDLE_TYPE_ADMIN : c.type) === type)
                        }));
                    },
                    toggleChannel(pid, channel, enabled) {
                        const cfg = service.getConfiguration(pid);
                        const props = cfg.getProperties() || {};
                        const channels = props.channels || [];
                        cfg.update({ ...props, channels: enabled ? [...new Set([...channels, channel])] : channels.filter(c => c !== channel) });
                        this.init();
                    },
                    setLogLevel(pid, level) {
                        service.getConfiguration(pid).update({ [LOG_LEVEL_PROP]: level });
                        this.init();
                    }
                }));

                if (!targetElement.dataset.listenersActive) {
                    targetElement.addEventListener('shell-system-reset', () => {
                        const resetRefs = context.getServiceReferences(SYSTEM_RESET_SERVICE);
                        if (resetRefs.length > 0) context.getService(resetRefs[0]).factoryReset();
                    });
                    globalThis.addEventListener('config-updated', () => { if (targetElement.isConnected) Alpine.nextTick(() => { /* handled by reactivity */ }); });
                    targetElement.dataset.listenersActive = 'true';
                }
            }
        };

        context.registerService(FLOW_SERVICE, flowMetadata, { ...this.config, "flow.id": CONFIG_ADMIN_UI_FLOW, "sidebar": true });

        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
            addingService: (ref) => {
                flowMetadataCache.set(ref.bundle.getSymbolicName(), {
                    title: ref.getProperty("flow.title") || ref.getProperty("title"),
                    icon: ref.getProperty("flow.icon") || ref.getProperty("icon"),
                    flowType: ref.getProperty("flowType")
                });
            },
            removedService: (ref) => flowMetadataCache.delete(ref.bundle.getSymbolicName())
        }).open();

        primeFromManifests();

        context.addBundleListener({
            bundleChanged: (event) => { if (event.type === "INSTALLED" || event.type === "STARTED") primeBundle(event.bundle); }
        });

        // Shell Commands
        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "prime-all",
            description: "Sync all active bundles strategies to ConfigAdmin",
            execute: (_args, _ctx, log) => {
                if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) return log("Access Denied", "error");
                primeFromManifests();
                log("Re-priming completed.");
            }
        });

        context.registerService(SHELL_COMMAND_SERVICE, {
            name: "reset-config",
            description: "[pid] - Reset configuration to defaults",
            execute: async (args, _ctx, log) => {
                if (!this.isAllowed("SYSTEM_ADMIN_REQUIRED")) return log("Access Denied", "error");
                const pid = args[0];
                if (!pid) return log("Usage: /reset-config [pid]", "error");
                await service.getConfiguration(pid).update({});
                pm.store(`config.${pid}`, {});
                log(`Config for ${pid} reset.`);
            }
        });

        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                if (event.getTopic() === CONFIG_UPDATED_TOPIC) {
                    const detail = {};
                    event.getPropertyNames().forEach(key => detail[key] = event.getProperty(key));
                    globalThis.dispatchEvent(new CustomEvent('config-updated', { detail }));
                }
            }
        }, { [EVENT_TOPIC]: [CONFIG_UPDATED_TOPIC] });
    }

    onStop() {
        if (this.logger) this.logger.info("Config Admin Stopped.");
    }
}
