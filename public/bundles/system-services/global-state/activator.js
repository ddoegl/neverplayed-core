import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import { SELECTION_SERVICE, PLEXUS_ENGINE_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    async start(context) {
        if (globalThis.backofficeState) return;

        const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
        const pm = context.getService(pmRef);

        const BO_SESSION_PID = "pandino.backoffice.session";
        const sessionState = pm.load(BO_SESSION_PID) || {};

        // Shared Reactive Repository for all portals
        const sharedData = Alpine.reactive({
            parsedLicenses: { LICENSES: [] },
            parsedTenants: { TENANTS: [] },
            persons: [],
            companies: []
        });

        // Hydrate Shared Repository
        const licenseData = pm.load("pandino.backoffice.licenses");
        console.log("Global State: Hydrating Licenses from Persistence Manager", licenseData ? licenseData.LICENSES?.length : "NONE");
        if (licenseData) Object.assign(sharedData.parsedLicenses, licenseData);
        
        const tenantData = pm.load("pandino.backoffice.tenants");
        console.log("Global State: Hydrating Tenants from Persistence Manager", tenantData ? tenantData.TENANTS?.length : "NONE");
        if (tenantData) Object.assign(sharedData.parsedTenants, tenantData);

        const state = Alpine.reactive({
            currentStep: sessionState.currentStep || "",
            steps: [], 
            availableFlows: [],
            session: null,
            renderedHTML: sessionState.renderedHTML || "",
            isStandaloneAdmin: sessionState.isStandaloneAdmin ?? true,

            evaluatedData: [],
            selectedUserIndex: sessionState.selectedUserIndex || null,
            selectedLicenseIndex: sessionState.selectedLicenseIndex || 0,
            selectedTenantIndex: sessionState.selectedTenantIndex || 0,
            detailTab: sessionState.detailTab || "promotions",
            ruleTab: sessionState.ruleTab || "keys",
            featureTab: sessionState.featureTab || "registry",
            pluginOverlays: [], 

            yamlEditor: {
                active: false,
                title: "",
                content: "",
                save: () => {},
                cancel: () => {},
            },
            parsedRules: {},
            get parsedLicenses() { return sharedData.parsedLicenses; },
            get parsedTenants() { return sharedData.parsedTenants; },
            parsedTopicStrategies: [],
            parsedTopics: [],
            parsedFeatures: {},
            parsedBusinessFunctions: [], 
            parsedCampaigns: [],
            parsedStrategies: [],
            parsedRuleFeatures: [],
            parsedRuleKeys: [],
            parsedSCAStrategies: [],
            parsedSCAMethods: [],
            parsedSigningStrategies: [],
            parsedCaseTypes: [],
            parsedDOStrategies: {},
            parsedDOInstances: {},
            selectedCampaignIndex: 0,
            selectedStrategyIndex: 0,
            selectedTopicIndex: 0,
            selectedTopicStrategyIndex: 0,

            get host() { return this; },
            get currentLicense() {
                const ref = context.getServiceReference(SELECTION_SERVICE);
                const sel = ref ? context.getService(ref).getSelection('business') : null;
                return sel?.currentLicenseId || null;
            },
            get activeLicense() {
                const licenses = (sharedData.parsedLicenses?.LICENSES || []);
                const currentId = this.currentLicense;
                if (!currentId) return null;
                return licenses.find(l => String(l.id) === String(currentId));
            },
            get persons() {
                if (sharedData.persons.length) return sharedData.persons;
                const ref = context.getServiceReference("infrastructure.persons.data");
                const list = ref ? context.getService(ref).getPersons() || [] : [];
                if (list.length) sharedData.persons = list;
                return list;
            },
            get companies() {
                if (sharedData.companies.length) return sharedData.companies;
                const ref = context.getServiceReference("infrastructure.companies.data");
                const list = ref ? context.getService(ref).getCompanies() || [] : [];
                if (list.length) sharedData.companies = list;
                return list;
            },
            isCompany(id) {
                return this.companies.some(c => String(c.id) === String(id));
            },
            get spaCustomers() {
                return [
                    ...this.companies.map(c => ({ id: c.id, name: c.name, type: "Company" })),
                    ...this.persons.map(p => ({ id: p.id, name: `${p.firstname} ${p.lastname}`, type: "Person" }))
                ];
            },
            get allAvailableCustomers() {
                return this.spaCustomers;
            },

            get availableFeatures() {
                if (!this.parsedFeatures || typeof this.parsedFeatures !== 'object') return [];
                try {
                    return Object.keys(this.parsedFeatures).sort();
                } catch (_e) {
                    return [];
                }
            },

            get availableRoles() {
                const roles = (this.parsedBusinessFunctions || []).map(f => ({ 
                    id: f.id, 
                    label: f.label || f.id, 
                    type: f.type || 'BF' 
                }));
                return roles.sort((a,b) => a.id.localeCompare(b.id));
            },

            get availablePrimitives() {
                const ref = context.getServiceReference(PLEXUS_ENGINE_SERVICE);
                if (ref) {
                    const engine = context.getService(ref);
                    return engine.getMatcherEngine?.().getPrimitives() || [];
                }
                return ["matchAlways", "matchRole", "matchFeature", "matchProperty"];
            },

            init() {
                Alpine.effect(() => {
                    const toPersist = {
                        currentStep: this.currentStep,
                        renderedHTML: this.renderedHTML,
                        isStandaloneAdmin: this.isStandaloneAdmin,
                        selectedUserIndex: this.selectedUserIndex,
                        selectedLicenseIndex: this.selectedLicenseIndex,
                        selectedTenantIndex: this.selectedTenantIndex,
                        detailTab: this.detailTab,
                        ruleTab: this.ruleTab,
                        featureTab: this.featureTab,
                    };
                    pm.store(BO_SESSION_PID, toPersist);
                });
            }
        });

        globalThis.backofficeState = state;
        await state.init();
        console.log("Global State Bundle: Initialized backofficeState (Host only).");

        // --- Business Portal State ---
        if (!globalThis.businessPortalState) {
            const BUSINESS_SESSION_PID = "pandino.business.session";
            const businessSession = pm.load(BUSINESS_SESSION_PID) || {};

            const bState = Alpine.reactive({
                currentStep: businessSession.currentStep || "dashboard",
                steps: [],
                availableFlows: [],
                session: null,
                renderedHTML: "",
                pluginOverlays: [],

                get currentLicense() {
                    const ref = context.getServiceReference(SELECTION_SERVICE);
                    const sel = ref ? context.getService(ref).getSelection('business') : null;
                    return sel?.currentLicenseId || null;
                },
                get activeLicense() {
                    return state.activeLicense; // Point to backofficeState's getter (shared result)
                },
                get persons() { return state.persons; },
                get companies() { return state.companies; },
                
                init() {
                    Alpine.effect(() => {
                        pm.store(BUSINESS_SESSION_PID, {
                            currentStep: this.currentStep
                        });
                    });
                }
            });

            globalThis.businessPortalState = bState;
            console.log("Global State Bundle: Initialized businessPortalState.");
        }

        // --- Retail Portal State ---
        if (!globalThis.retailPortalState) {
            const RETAIL_SESSION_PID = "pandino.retail.session";
            const retailSession = pm.load(RETAIL_SESSION_PID) || {};

            const rState = Alpine.reactive({
                currentStep: retailSession.currentStep || "dashboard",
                promoShownThisSession: false,
                init() {
                    Alpine.effect(() => {
                        pm.store(RETAIL_SESSION_PID, {
                            currentStep: this.currentStep
                        });
                    });
                }
            });

            globalThis.retailPortalState = rState;
            await rState.init();
            console.log("Global State Bundle: Initialized retailPortalState.");
        }
    }

    async stop(_context) {}
}
