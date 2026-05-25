/**
 * @file Activator for org.neverplayed.config-admin
 * @module platform/bundles/org.neverplayed.config-admin
 */

import { 
    CONFIG_ADMIN_UI_FLOW, 
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    CONFIG_ADMIN_SERVICE, 
    FLOW_SERVICE,
    SYSTEM_RESET_SERVICE,
    SHELL_COMMAND_SERVICE,
    LOG_LEVEL_PROP,
    CONFIG_UPDATED_TOPIC,
    REALM_CORE,
    REALM_FOUNDATION,
    REALM_SHOWCASE
} from "core-types";
import { CoreAlpineActivator } from "alpine-base";
import Alpine from "alpinejs";



export default class Activator extends CoreAlpineActivator {
    onCoreStart(context) {
        const logger = this.logger;
        const pm = this.persistence;
        const configs = new Map();
        const flowMetadataCache = new Map();



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

        const primeBundle = async (bundle) => {
            if (pm.waitReady) await pm.waitReady();
            const headers = bundle.getHeaders();
            const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
            const configPriming = headers[configKey];
            if (configPriming) {
                try {
                    const primingData = typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
                    const bsn = bundle.getSymbolicName();
                    const existingMeta = flowMetadataCache.get(bsn) || {};
                    
                    // Unified metadata capture from both manifest headers and Configuration block
                    flowMetadataCache.set(bsn, { 
                        ...existingMeta, 
                        name: headers['Bundle-Name'], 
                        description: headers['Bundle-Description'],
                        title: primingData.title || headers['Bundle-Name'],
                        icon: primingData.icon || (primingData.flowType ? 'fas fa-puzzle-piece' : null),
                        flowType: primingData.flowType 
                    });

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
                    const hasPids = Object.values(primingData).some(v => typeof v === 'object' && v !== null);
                    if (primingData.flowType || primingData.channels || primingData.mountPoint) {
                        processPriming(bsn, primingData);
                    } else if (hasPids) {
                        for (const [pid, defaults] of Object.entries(primingData)) {
                            if (typeof defaults === 'object' && defaults !== null) {
                                processPriming(pid, defaults);
                            }
                        }
                    } else {
                        processPriming(bsn, primingData);
                    }
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
                if (!targetElement.id) targetElement.id = `flow-target-${CONFIG_ADMIN_UI_FLOW.replace(/\./g, '_')}`;
                
                await this.render(`#${targetElement.id}`, 'templates/settings-ui.html', () => ({
                    cfgs: [],
                    realms: [],
                    search: '',
                    // DRIFT REMEDIATED: Expose centralized IDs to UI scope
                    REALM_CORE,
                    REALM_FOUNDATION,
                    REALM_SHOWCASE,
                    init() {
                        const shell = Alpine.store('shell_context');
                        this.realms = shell.realms || [];
                        const allBundles = context.getBundles();
                        
                        this.cfgs = allBundles.map(bundle => {
                            const pid = bundle.getSymbolicName();
                            const headers = bundle.getHeaders();
                            const meta = flowMetadataCache.get(pid) || {};
                            
                            // 1. Get RAW configuration (Persistent)
                            const config = service.getConfiguration(pid);
                            const props = config.getProperties() || {};
                            
                            // 2. Extract MANIFEST defaults (Rule 4)
                            let manifestDefaults = {};
                            const configHeader = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
                            if (configHeader) {
                                try {
                                    const raw = headers[configHeader];
                                    manifestDefaults = typeof raw === 'string' ? JSON.parse(raw) : raw;
                                } catch (_e) { /* ignore */ }
                            }

                            // 3. MERGED STATE: Persistent > Runtime Metadata > Manifest Defaults
                            const mergedSidebar = props.sidebar !== undefined 
                                ? props.sidebar 
                                : (meta.sidebar !== undefined ? meta.sidebar : (manifestDefaults.sidebar || false));

                            const realm = this.realms.find(r => 
                                (r.bundles || []).some(b => b.includes(pid))
                            ) || { id: 'org.neverplayed.realm.orphaned', title: 'Standalone / Plug-in' };

                            return { 
                                pid, 
                                properties: { ...props, sidebar: mergedSidebar }, 
                                name: meta.name || headers['Bundle-Name'] || pid, 
                                description: meta.description || headers['Bundle-Description'] || 'No description available.',
                                icon: meta.icon || (manifestDefaults.flowType ? (meta.icon || 'fas fa-puzzle-piece') : 'fas fa-cube'),
                                realmId: realm.id,
                                realmTitle: realm.title,
                                // Criteria for UI Governance: Must have Title/ID/Icon in Metadata OR explicitly support sidebars
                                hasFlow: !!meta.title || !!meta.id || !!manifestDefaults.sidebar || (manifestDefaults.flowType && manifestDefaults.flowType.includes('flow'))
                            };
                        });
                    },
                    get categorized() {
                        const filtered = this.search.trim() 
                            ? this.cfgs.filter(c => 
                                c.name.toLowerCase().includes(this.search.toLowerCase()) || 
                                c.pid.toLowerCase().includes(this.search.toLowerCase())
                              )
                            : this.cfgs;

                        const realmIds = [...new Set(filtered.map(c => c.realmId))];
                        // DRIFT REMEDIATED: Use centralized Realm IDs from core-types
                        const hierarchy = [REALM_CORE, REALM_FOUNDATION, REALM_SHOWCASE];
                        
                        return realmIds.sort((a, b) => {
                            const idxA = hierarchy.indexOf(a), idxB = hierarchy.indexOf(b);
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                            return a.localeCompare(b);
                        }).map(id => {
                            const first = this.cfgs.find(c => c.realmId === id);
                            return {
                                id,
                                title: first.realmTitle,
                                items: filtered.filter(c => c.realmId === id)
                            };
                        });
                    },
                    toggleSidebar(pid) {
                        const cfg = service.getConfiguration(pid);
                        const props = cfg.getProperties() || {};
                        cfg.update({ ...props, sidebar: !props.sidebar });
                        this.init();
                    },
                    setLogLevel(pid, level) {
                        service.getConfiguration(pid).update({ [LOG_LEVEL_PROP]: level });
                        this.init();
                    },
                    updateCustomProperty(pid, key, value) {
                        const cfg = service.getConfiguration(pid);
                        const props = cfg.getProperties() || {};
                        const typedVal = isNaN(value) || value.trim() === '' ? value : Number(value);
                        cfg.update({ ...props, [key]: typedVal });
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

                const getFlowProps = () => ({
                    ...this.config, 
                    "flow.id": CONFIG_ADMIN_UI_FLOW, 
                    "sidebar": this.config.sidebar !== undefined ? this.config.sidebar : true,
                    "icon": this.config.icon || "fas fa-wrench",
                    "title": this.config.title || "Universe Settings"
                });

                const registration = context.registerService(FLOW_SERVICE, flowMetadata, getFlowProps());

                globalThis.addEventListener('config-updated', (ev) => {
                    if (ev.detail?.pid === this.bsn || ev.detail?.pid === CONFIG_ADMIN_UI_FLOW) {
                        registration.setProperties(getFlowProps());
                    }
                });

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
