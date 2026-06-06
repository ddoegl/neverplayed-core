/**
 * @file Activator for org.neverplayed.plexus-tracing
 * @module platform/bundles/org.neverplayed.plexus-tracing
 */

import { 
    FLOW_SERVICE, 
    CONFIG_ADMIN_SERVICE, 
    PLEXUS_ENGINE_SERVICE, 
    PLEXUS_TRACING_UI, 
    PLEXUS_PID, 
    LOG_SERVICE,
    PLEXUS_KNOWLEDGE_PROVIDER,
    PLEXUS_SENSOR_SERVICE
} from "core-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    start(context) {
        const self = this;
        const mainPid = PLEXUS_PID;
        this._sensor = null;
        
        const state = Alpine.reactive({
            rules: {},
            features: {},
            businessFunctions: [],
            licenses: [],
            roleAliases: {},
            registry: [],
            sensedDomains: [], // Track registered domains via BYOS
            sensingLog: [],    // Live Perceptual Log
            logLevel: "INFO",
            isTraceEnabled: false,
            testUserId: null,
            testBusinessFunctions: [],
            testUserProperties: {},
            testUserAuthorities: {},
            evaluationResults: null,
            evaluationContext: null,
            traceLogs: [],
            activePrimitives: ["matchAlways", "matchFeature", "matchLicenseholder", "matchRole", "matchProperty", "matchPersona", "matchRealm"],
            
            get businessFunctionIds() {
                return (this.businessFunctions || []).map(f => f.id);
            },
            
            get availableUsers() {
                const users = [];
                (this.licenses || []).forEach(lic => {
                    (lic.USERS || []).forEach(u => {
                        if (!users.find(existing => existing.id === u.id)) {
                            users.push({ 
                                id: u.id, 
                                label: `${u.alias || u.firstname || 'User'} (${u.id})` 
                            });
                        }
                    });
                });
                return users.sort((a, b) => a.label.localeCompare(b.label));
            },

            init() {
                // Initial user selection (Delay to allow Knowledge Providers to arrive)
                setTimeout(() => {
                    if (!this.testUserId && this.availableUsers.length > 0) {
                        this.testUserId = this.availableUsers[0].id;
                    }
                }, 500);
            },

            syncLiveFunctions: () => {
                const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
                const engine = engineRef ? context.getService(engineRef) : null;
                const matcherEngine = engine ? engine.getMatcherEngine() : null;

                for (const lic of state.licenses) {
                    const u = (lic.USERS || []).find(u => u.id === state.testUserId);
                    if (u && matcherEngine) {
                        const normalized = matcherEngine.normalizeContext(u, lic, state.registry);
                        state.testUserProperties.self = normalized.self;
                        state.testUserAuthorities = normalized.userAuthorities;
                        state.testBusinessFunctions = normalized.activeBusinessFunction;
                        return;
                    }
                }
                state.testBusinessFunctions = [];
                state.testUserAuthorities = {};
            },

            toggleTrace: () => {
                const ref = context.getServiceReference(CONFIG_ADMIN_SERVICE);
                const ca = ref ? context.getService(ref) : null;
                if (!ca) return;
                const nextLevel = state.isTraceEnabled ? 'INFO' : 'TRACE';
                ca.getConfiguration(mainPid).update({ logLevel: nextLevel });
                globalThis.dispatchEvent(new CustomEvent('config-updated', { detail: { pid: mainPid } }));
            },

            runEvaluation: () => {
                state.traceLogs = []; 
                state.syncLiveFunctions();
                
                const engineRef = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
                const engine = engineRef ? context.getService(engineRef) : null;
                if (!engine) return;

                let currentLicense = null;
                const userProfile = (() => {
                    for (const lic of state.licenses) {
                        const u = (lic.USERS || []).find(u => u.id === state.testUserId);
                        if (u) {
                            currentLicense = lic;
                            return { ...u, licenseId: lic.id };
                        }
                    }
                    return null;
                })();
                
                const ctx = {
                    userId: state.testUserId,
                    activeBusinessFunction: state.testBusinessFunctions,
                    userAuthorities: state.testUserAuthorities,
                    licenseCustomers: currentLicense ? currentLicense.customers : [],
                    ...(userProfile || {}),
                    ...(state.testUserProperties || {})
                };
                
                state.evaluationContext = ctx;

                const { grantedKeys } = engine.evaluateCapabilitiesDynamic(ctx);
                state.evaluationResults = Object.keys(grantedKeys).sort();
            }
        });

        // Component Registration (Legacy support) & Store Registration (Global access)
        Alpine.store("plexusTracing", state);
        Alpine.data("plexusTracingUI", () => Alpine.store("plexusTracing"));

        // Live Forensic Listener (High Priority)
        globalThis.addEventListener('plexus-perceptual-update', (ev) => {
            const s = Alpine.store("plexusTracing");
            s.sensingLog.unshift(ev.detail);
            if (s.sensingLog.length > 100) s.sensingLog.pop();
        });

        // Track Sensor
        context.trackService(`(objectClass=${PLEXUS_SENSOR_SERVICE})`, {
            addingService: (ref) => {
                self._sensor = context.getService(ref);
                return self._sensor;
            },
            removedService: () => { self._sensor = null; }
        }).open();

        // BYOS Domain Mapping Logic (Mirroring the Engine)
        const domainHandlers = {
            "rules": (data) => { /* display logic if needed */ },
            "capabilities": (data) => { 
                const raw = data;
                const caps = Array.isArray(raw) ? raw : (raw?.capabilities || []);
                state.rules = { capabilities: caps };
            },
            "features": (data) => { state.features = data || {}; },
            "business-functions": (data) => { state.businessFunctions = data || []; },
            "licenses": (data) => { 
                const d = data || { LICENSES: [] };
                state.licenses = d.LICENSES || [];
            },
            "companies": (data) => { state.registry = data || []; }
        };

        // Track Knowledge Providers
        context.trackService(`(objectClass=${PLEXUS_KNOWLEDGE_PROVIDER})`, {
            addingService: (ref) => {
                const domain = ref.getProperty("plexus.domain");
                if (domain) {
                    if (!state.sensedDomains.includes(domain)) state.sensedDomains.push(domain);
                    const provider = context.getService(ref);
                    const knowledge = provider.getKnowledge();
                    if (domainHandlers[domain]) domainHandlers[domain](knowledge);
                }
                return domain;
            },
            removedService: (ref, domain) => {
                state.sensedDomains = state.sensedDomains.filter(d => d !== domain);
            }
        }).open();

        // Register Tracing UI Flow
        context.registerService(FLOW_SERVICE, {
            id: PLEXUS_TRACING_UI,
            title: "Plexus Tracing",
            icon: "fas fa-microscope",
            launch: async (targetElement) => {
                const response = await fetch("./bundles/org.neverplayed.plexus-tracing/templates/tracing-ui.html");
                const html = await response.text();
                // Standard Alpine 3 Injection
                targetElement.innerHTML = `<div x-data="plexusTracingUI" class="h-full w-full">${html}</div>`;
            }
        }, { 
            "flow.id": PLEXUS_TRACING_UI,
            "sidebar": true 
        });
    }

    stop() {}
}
