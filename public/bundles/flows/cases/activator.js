import {
  FLOW_SERVICE,
  SELECTION_SERVICE,
  LICENSE_DATA_SERVICE,
  CASE_SERVICE,
  SESSION_SERVICE,
  SIGNING_DATA_SERVICE,
  LIMES_SERVICE
} from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const signingDataRef = context.getServiceReference(SIGNING_DATA_SERVICE);
    if (signingDataRef) {
      context.getService(signingDataRef);
    }

    // 1. Register Limes Strategies for Cases
    context.trackService(`(objectClass=${LIMES_SERVICE})`, {
      addingService: (ref) => {
        const limes = context.getService(ref);
        limes.registerStrategy("CASE_VIEW", {
            operator: "AND",
            matchers: [
                { type: "matchPermission", value: "DOCUMENTS_VIEW_ALLOWED" },
                { type: "matchScopeIntersection", permission: "DOCUMENTS_VIEW_ALLOWED", property: "customers" }
            ]
        });
        limes.registerStrategy("CASE_SIGN", {
            operator: "AND",
            matchers: [
                { type: "matchPermission", value: "DOCUMENTS_MANAGE_ALLOWED" },
                { type: "matchScopeIntersection", permission: "DOCUMENTS_MANAGE_ALLOWED", property: "customers" }
            ]
        });
      }
    }).open();

    const flowMetadata = {
      id: "cases",
      title: "Case Management",
      icon: "fas fa-folder-open",
      launch: async (targetElement, params = {}) => {
        const hostState = globalThis.businessPortalState;
        const currentUser = hostState?.session?.currentUser;
        if (!currentUser) return;

        const state = Alpine.reactive({
          currentStep: "dashboard",
          selectedCompany: null,
          caseService: null,
          selectedCase: null,
          selectionService: null,
          licenseDataService: null,
          evaluatorDataService: null,
          sessionService: null,
          updateTrigger: 1,

          get currentSelectionContext() {
            const envId = this.sessionService?.environment || "";
            const isRetailPortal = !!document.getElementById('retail-root-container');
            return (envId.includes('mobile') || envId.includes('retail') || isRetailPortal) ? 'retail' : 'business';
          },

          get currentLicenseId() {
            return this.selectionService?.getSelection(this.currentSelectionContext)?.currentLicenseId;
          },

          get isLimesReady() {
            return !!context.getServiceReference(LIMES_SERVICE);
          },

          documentVisibility(caseObj) {
            // 1. Signatory Visibility Fallback: If you are on the list, you can see it!
            if (this.canSign && caseObj.signatures?.some(sig => this.canSign(sig))) {
              return true;
            }

            // 2. Standard Permission Check via Limes
            const limesRef = context.getServiceReference(LIMES_SERVICE);
            const limes = limesRef ? context.getService(limesRef) : null;
            if (!limes) return false;
            return limes.isAllowed(currentUser.id, "CASE_VIEW", caseObj);
          },

          canManageSignatures(caseObj) {
            const limesRef = context.getServiceReference(LIMES_SERVICE);
            const limes = limesRef ? context.getService(limesRef) : null;
            if (!limes) return false;
            return limes.isAllowed(currentUser.id, "CASE_SIGN", caseObj);
          },

          get cases() {
            this.updateTrigger;
            if (!this.caseService) return [];
            return (this.caseService.getCases() || []).filter(c => this.documentVisibility(c));
          },

          get filteredLicenseMembers() {
            this.updateTrigger;
            if (!this.licenseDataService || !this.currentLicenseId) return [];
            
            const license = this.licenseDataService.getLicense(this.currentLicenseId);
            if (!license) return [];

            return this.licenseDataService.getFilteredMembers(this.currentLicenseId) || [];
          },

          get signatureTasks() {
            this.updateTrigger;
            return this.cases.filter(c => {
                const isSignee = c.signatures?.some(sig => this.canSign(sig));
                const isPending = c.status === 'pending';
                return isSignee && isPending;
            });
          },

          get pendingCases() {
            this.updateTrigger;
            if (!this.selectedCompany) return [];
            return this.cases.filter(c => {
                const compId = this.selectedCompany.id;
                const matchesCompany = c.customers?.includes(compId) || c.metadata?.companyId === compId;
                if (!matchesCompany || c.status !== 'pending') return false;
                
                return this.canManageSignatures(c) || c.signatures?.some(sig => this.canSign(sig));
            });
          },

          get signedCases() {
            this.updateTrigger;
            if (!this.selectedCompany) return [];
            return this.cases.filter(c => {
                const compId = this.selectedCompany.id;
                const matchesCompany = c.customers?.includes(compId) || c.metadata?.companyId === compId;
                if (!matchesCompany || c.status !== 'signed') return false;
                
                const hasMySignature = (c.signatures || []).some(s => {
                    const isMe = String(s.personId) === String(currentUser.holder);
                    return isMe;
                });
                return this.canManageSignatures(c) || hasMySignature;
            });
          },

          async loadStep(stepId) {
            this.currentStep = stepId;
            let response = await fetch(`./bundles/flows/cases/templates/${stepId}.html`);
            if (!response.ok) {
                response = await fetch(`./shared/templates/${stepId}.html`);
            }
            if (response.ok) {
                const markup = await response.text();
                targetElement.innerHTML = `<div x-data="globalThis.getCasesFlowScope()" class="h-full w-full">${markup}</div>`;
            }
          },

          selectCompany(company) {
            this.selectedCompany = company;
            if (this.selectionService) {
                this.selectionService.setSelection({ selectedCompanyId: company.id }, this.currentSelectionContext);
            }
          },

          selectCase(caseItem) {
            this.selectedCase = caseItem;
          },

          performSignCase(caseId, index) {
            if (this.caseService) {
                const c = this.caseService.getCase(caseId);
                if (c && c.signatures[index]) {
                    const updates = { signatures: [...c.signatures] };
                    updates.signatures[index].status = 'signed';
                    if (updates.signatures.every(s => s.status === 'signed')) {
                        updates.status = 'signed';
                    }
                    this.caseService.updateCase(caseId, updates);
                    this.selectedCase = this.caseService.getCase(caseId);
                    this.updateTrigger++;
                }
            }
          },

          signCase(caseId, _signee, index) {
            const hostUser = this.sessionService?.currentUser;
            const c = this.caseService?.getCase(caseId);
            if (!hostUser || !c) return;

            const isPortal = !!document.getElementById('portal-root-container');
            const isSubflow = !!document.getElementById('business-subflow-container');
            
            const eventName = isPortal ? 'business-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow');

            globalThis.dispatchEvent(new CustomEvent(eventName, { 
                detail: { 
                    id: 'signing', 
                    params: { 
                        signee: hostUser,
                        summaryHtml: `<div class="p-3 bg-white rounded border border-gray-100 shadow-sm">
                            <p class="text-sm font-semibold mb-1">Authorization Action</p>
                            <p class="text-xs text-gray-500">Signing Case: <b>${c.name}</b></p>
                            <p class="text-[10px] text-gray-400 mt-2 font-mono">ID: ${c.id}</p>
                        </div>`,
                        actionTitle: 'Sign Document',
                        onSuccess: { action: 'sign-case', caseId, signatureIndex: index, flow: 'cases', step: 'case-details' },
                        onCancel: { flow: 'cases', step: 'case-details', params: { caseId } }
                    } 
                } 
            }));
          },

          viewCase(id) {
            this.selectedCase = this.cases.find(c => c.id === id);
            this.loadStep("case-details");
          },

          nextStep(nextId) {
            this.loadStep(nextId);
          }
        });

        // Track Required Services
        context.trackService(`(objectClass=${SELECTION_SERVICE})`, {
            addingService: (ref) => { state.selectionService = context.getService(ref); },
            removedService: () => { state.selectionService = null; }
        }).open();

        context.trackService(`(objectClass=${LICENSE_DATA_SERVICE})`, {
            addingService: (ref) => { state.licenseDataService = context.getService(ref); },
            removedService: () => { state.licenseDataService = null; }
        }).open();

        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => { 
                state.sessionService = context.getService(ref); 
                state.updateTrigger++; 
            },
            removedService: () => { state.sessionService = null; }
        }).open();

        context.trackService(`(objectClass=${CASE_SERVICE})`, {
            addingService: (ref) => { 
                state.caseService = context.getService(ref); 
                state.updateTrigger++; 
            },
            removedService: () => { state.caseService = null; }
        }).open();

        context.trackService(`(objectClass=backoffice.evaluator.data)`, {
            addingService: (ref) => { 
                state.evaluatorDataService = context.getService(ref); 
                state.updateTrigger++;
            },
            removedService: () => { state.evaluatorDataService = null; }
        }).open();

        // Register EventAdmin handler for Case updates
        const eventHandlerObj = {
            handleEvent: (_event) => {
                if (targetElement.isConnected) {
                    state.updateTrigger++;
                }
            }
        };
        context.registerService('@pandino/event-admin/EventHandler', eventHandlerObj, {
            'event.topics': ['backoffice/cases/*']
        });

        // Add canSign helper
        state.canSign = (sig) => {
            state.updateTrigger; // track reactivity
            const hostUser = state.sessionService?.currentUser;
            if (!hostUser) return false;
            
            const ownerId = String(hostUser.owner || hostUser.holder || "").toLowerCase();
            const id = String(hostUser.id || "").toLowerCase();
            const alias = String(hostUser.alias || "").toLowerCase();

            const sigPersonId = String(sig.personId || "").toLowerCase();
            const sigSignee = String(sig.signee || "").toLowerCase();
            
            return sigPersonId === ownerId || sigSignee === alias || sigSignee === id;
        };

        globalThis.getCasesFlowScope = () => ({
            get currentStep() { return state.currentStep },
            set currentStep(val) { state.currentStep = val },
            get selectedCompany() { return state.selectedCompany },
            get selectedCase() { return state.selectedCase },
            get currentSelectionContext() { return state.currentSelectionContext },
            get currentLicenseId() { return state.currentLicenseId },
            get cases() { return state.cases },
            get filteredLicenseMembers() { return state.filteredLicenseMembers },
            get signatureTasks() { return state.signatureTasks },
            get pendingCases() { return state.pendingCases },
            get signedCases() { return state.signedCases },
            loadStep: (...args) => state.loadStep(...args),
            selectCompany: (...args) => state.selectCompany(...args),
            selectCase: (...args) => state.selectCase(...args),
            performSignCase: (...args) => state.performSignCase(...args),
            signCase: (...args) => state.signCase(...args),
            viewCase: (...args) => state.viewCase(...args),
            nextStep: (...args) => state.nextStep(...args),
            canSign: (...args) => state.canSign(...args)
        });

        // Process deep links and callbacks
        if (params?.action === 'sign-case' && params.caseId) {
           state.performSignCase(params.caseId, params.signatureIndex);
           await state.loadStep(params.step || "case-details");
        } else if (params?.step) {
           if (params.caseId && state.caseService) {
               state.selectedCase = state.caseService.getCase(params.caseId);
           }
           await state.loadStep(params.step);
        } else {
           await state.loadStep("dashboard");
        }
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { 
      "flow.id": "cases",
      "flowType": "service-flow",
      "channels": ["business-channel-web", "retail-channel-app"]
    });
  }
}
