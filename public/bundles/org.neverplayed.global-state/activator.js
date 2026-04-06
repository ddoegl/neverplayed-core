import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import { LICENSES_PID, TENANTS_PID, BO_SESSION_PID, BUSINESS_SESSION_PID, RETAIL_SESSION_PID, CONTRIBUTION_SERVICE } from "core-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    async start(context) {
        if (globalThis.backofficeState) return;

        const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
        const pm = context.getService(pmRef);

        const sessionState = pm.load(BO_SESSION_PID) || {};

        // Shared Reactive Repository for all portals
        const sharedData = Alpine.reactive({
            parsedLicenses: { LICENSES: [] },
            parsedTenants: { TENANTS: [] },
            persons: [],
            companies: []
        });

        // Hydrate Shared Repository
        const licenseData = pm.load(LICENSES_PID);
        console.log("Global State: Hydrating Licenses from Persistence Manager", licenseData ? licenseData.LICENSES?.length : "NONE");
        if (licenseData) Object.assign(sharedData.parsedLicenses, licenseData);
        
        const tenantData = pm.load(TENANTS_PID);
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

        // --- Contribution Service ---
        const contributionSvc = {
            contribute: (portalId, definitions) => {
                const target = portalId === 'backoffice' ? globalThis.backofficeState :
                               portalId === 'business' ? globalThis.businessPortalState :
                               portalId === 'retail' ? globalThis.retailPortalState : null;
                if (!target) return;
                
                console.log(`Global State [${portalId}]: Receiving contribution:`, Object.keys(definitions));
                Object.defineProperties(target, definitions);
            }
        };
        context.registerService(CONTRIBUTION_SERVICE, contributionSvc);

        // --- Business Portal State ---
        if (!globalThis.businessPortalState) {
            const businessSession = pm.load(BUSINESS_SESSION_PID) || {};

            const bState = Alpine.reactive({
                currentStep: businessSession.currentStep || "dashboard",
                steps: [],
                availableFlows: [],
                session: null,
                renderedHTML: "",
                pluginOverlays: [],
                
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

    stop(_context) {
        console.log("Global State Bundle: Stopping. Nullifying global state stores.");
        globalThis.backofficeState = null;
        globalThis.businessPortalState = null;
        globalThis.retailPortalState = null;
    }
}
