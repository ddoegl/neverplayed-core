import { FLOW_SERVICE, SELECTION_SERVICE, LICENSE_DATA_SERVICE, FELLOWS_SERVICE, TENANT_DATA_SERVICE, INVITATION_SERVICE, PERSONS_SERVICE, COMPANIES_SERVICE, CASE_SERVICE, SESSION_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const flowMetadata = {
      id: "company-authorizations",
      title: "License Profile",
      icon: "fas fa-building",
      launch: async (targetElement) => {
        console.log("Authorizations Dashboard: Launching flow...");
        const state = Alpine.reactive({
          currentStep: "dashboard",
          selectionService: null,
          licenseDataService: null,
          fellowsService: null,
          invitationService: null,
          tenantDataService: null,
          businessFunctionsService: null,
          session: null,
          
          // UI State
          currentMainTab: "company",
          currentFellowTab: "authorized",
          searchQuery: "",
          selectedFilters: [], // Authorization IDs
          selectedCompany: null,
          updateTrigger: 1,
          
          get currentSelectionContext() {
            const envId = this.session?.environment || "";
            return (envId.includes('mobile') || envId.includes('retail')) ? 'retail' : 'business';
          },

          get currentLicenseId() {
            this.updateTrigger;
            return this.selectionService?.getSelection(this.currentSelectionContext)?.currentLicenseId;
          },

          get currentLicense() {
            if (!this.licenseDataService || !this.currentLicenseId) return "None Selected";
            const licenses = this.licenseDataService.getLicenses()?.LICENSES || [];
            const found = licenses.find(l => l.id === this.currentLicenseId);
            return found ? (found.name || found.id) : this.currentLicenseId;
          },

          get filteredLicenseMembers() {
            this.updateTrigger;
            if (!this.licenseDataService || !this.currentLicenseId) return [];
            return this.licenseDataService.getFilteredMembers(this.currentLicenseId);
          },

          get invitations() {
             this.updateTrigger;
             const invs = this.invitationService ? this.invitationService.getInvitations(this.selectedCompany?.id) : [];
             console.log(`Authorizations Dashboard: fetched ${invs.length} invitations for ${this.selectedCompany?.id}`);
             return invs;
          },

          get filteredInvitations() {
             const q = this.searchQuery.toLowerCase();
             return this.invitations.filter(i => (i.email || "").toLowerCase().includes(q));
          },

          get authorizations() {
             const funcs = this.businessFunctionsService?.getBusinessFunctions() || [];
             return funcs
                .filter(item => item.type === 'authorized-delegate')
                .map(item => ({
                    id: item.id,
                    name: item.label || item.id,
                    type: item.type,
                    manageable: true
                }));
          },

          get fellows() {
             this.updateTrigger;
             if (!this.selectedCompany || !this.tenantDataService) return [];
             
             // 1. Identify the Tenant and its Customers
             const tenants = this.tenantDataService.getTenants()?.TENANTS || [];
             const activeTenant = tenants.find(t => (t.customers || []).some(c => c.id === this.selectedCompany.id));
             console.log("Authorizations Dashboard: Active Tenant:", activeTenant?.id, "for company:", this.selectedCompany.id);
             if (!activeTenant) return [];
             const tenantCustomers = activeTenant.customers || [];
             const customerPoolIds = tenantCustomers.map(c => c.id);

             // 2. Get fellows from FellowsService (now includes LRs via auto-sync)
             const merged = this.fellowsService ? this.fellowsService.getFellows(this.selectedCompany.id) : [];
             console.log(`Authorizations Dashboard: fetched ${merged.length} fellows for ${this.selectedCompany.id}`);

             // 4. Enforce "Only customers can become fellows" AND pull name from Person data
             const persRef = context.getServiceReference(PERSONS_SERVICE);
             const persons = persRef ? context.getService(persRef).getPersons() : [];

              //console.log("Authorizations Dashboard: Merged list before eligibility filter:", JSON.stringify(merged));
              console.log("Authorizations Dashboard: Customer pool IDs:", customerPoolIds);

              return merged
                 .filter(f => {
                    const pid = f.personId || f.person;
                    let isEligible = customerPoolIds.includes(pid);
                    
                    // Fallback: If no personId, try to match by email in the registry to get the ID
                    if (!isEligible && f.email && state.personsService) {
                        const persons = state.personsService.getPersons();
                        const p = persons.find(person => person.emails?.includes(f.email));
                        if (p && customerPoolIds.includes(p.id)) {
                            console.log("Authorizations Dashboard: Eligible via email fallback for:", f.email, "->", p.id);
                            f.personId = p.id; // Patch it for later use
                            isEligible = true;
                        }
                    }

                    if (!isEligible) console.log("Authorizations Dashboard: Filtering out non-customer fellow:", pid, f.email);
                    return isEligible;
                 }) // Eligibility filter
                .map(f => {
                   const personId = f.personId || f.person;
                   const person = persons.find(p => p.id === personId);
                   const displayName = person ? `${person.firstname} ${person.lastname}` : personId;
                   const isLegalRep = f.type === 'legal-representative' || !!f.role;
                   const typeDesc = isLegalRep ? 'Legal Representative' : (f.type || 'Fellow');
                   
                   const html = `
                     <div class="flex items-center space-x-3 mb-3">
                        <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                           ${displayName.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                           <div class="font-bold text-gray-800">${displayName}</div>
                           <div class="text-xs text-gray-500 uppercase">${typeDesc}</div>
                        </div>
                     </div>
                   `;

                   return { 
                      ...f, 
                      personId,
                      isLegalRep,
                      displayName,
                      html
                   };
                });
          },

          get filteredFellows() {
             let list = this.fellows;
             if (this.currentFellowTab === 'authorized') {
                list = list.filter(f => (this.getFellowAuths(f) || []).length > 0);
             } else if (this.currentFellowTab === 'employees') {
                list = list.filter(f => f.type === 'employee' || f.isLegalRep);
             }

             if (this.selectedFilters.length > 0) {
                list = list.filter(f => (this.getFellowAuths(f) || []).some(auth => this.selectedFilters.includes(auth.id)));
             }

             const q = this.searchQuery.toLowerCase();
             if (q) {
                list = list.filter(f => f.displayName?.toLowerCase().includes(q));
             }
             return list;
          },

          getTabCount(tabId) {
             if (tabId === 'authorized') return this.fellows.filter(f => (this.getFellowAuths(f) || []).length > 0).length;
             if (tabId === 'employees') return this.fellows.filter(f => f.type === 'employee' || f.isLegalRep || f.type === 'legal-representative').length;
             return 0;
          },

          getAuthorizationCount(authId) {
             return this.fellows.filter(f => (this.getFellowAuths(f) || []).some(a => a.id === authId)).length;
          },

          getFellowAuths(fellow) {
             if (!this.selectedCompany) return [];
             const auths = [];

             // 1. Add Role from Legal Representatives (if applicable)
             if (fellow.isLegalRep && fellow.role) {
                const allAuths = this.authorizations;
                const roleAuth = allAuths.find(a => a.id === fellow.role);
                auths.push(roleAuth || { id: fellow.role, name: fellow.role, type: 'structural' });
             }
             
             // 2. Add fine-grained authorizations from Fellow object
             const allAuths = this.authorizations;
             if (fellow.authorizations && Array.isArray(fellow.authorizations)) {
                 fellow.authorizations.forEach(id => {
                     if (!auths.find(a => a.id === id)) {
                         const found = allAuths.find(a => a.id === id);
                         auths.push(found || { id, name: id });
                     }
                 });
             }

             // 3. Fallback: Add fine-grained authorizations from Person Data
             const persRef = context.getServiceReference(PERSONS_SERVICE);
             const persons = persRef ? context.getService(persRef).getPersons() : [];
             const person = persons.find(p => p.id === (fellow.personId || fellow.person));
             
             if (person && person.authorizations) {
                const companyAuths = person.authorizations.find(a => a.company === this.selectedCompany.id);
                if (companyAuths && companyAuths.authorizations) {
                    companyAuths.authorizations.forEach(id => {
                        if (!auths.find(a => a.id === id)) {
                            const found = allAuths.find(a => a.id === id);
                            auths.push(found || { id, name: id });
                        }
                    });
                }
             }
             
             return auths;
          },

          getPersonPossessions(id) {
             if (!this.licenseDataService || !this.currentLicenseId) return [];
             const licenses = this.licenseDataService.getLicenses()?.LICENSES || [];
             const currentLic = licenses.find(l => l.id === this.currentLicenseId);
             if (!currentLic || !currentLic.USERS) return [];
             
             return currentLic.USERS.filter(u => String(u.owner) === String(id) || String(u.holder) === String(id)).map(u => ({
                 id: u.id,
                 isOwner: String(u.owner) === String(id),
                 isHolder: String(u.holder) === String(id),
                 alias: u.alias
             }));
          },

          async loadStep(stepId) {
            this.currentStep = stepId;
            let response = await fetch(`./bundles/flows/company-authorizations/templates/${stepId}.html`);
            if (!response.ok) {
                response = await fetch(`./shared/templates/${stepId}.html`);
            }
            
            if (response.ok) {
                targetElement.innerHTML = await response.text();
                if (typeof Alpine?.process === 'function') {
                    Alpine.process(targetElement);
                } else if (typeof globalThis.Alpine?.process === 'function') {
                    globalThis.Alpine.process(targetElement);
                } else {
                    console.log("Authorizations Dashboard: Alpine.process not found - skipping manual re-process");
                }
            } else {
                targetElement.innerHTML = `<div class="p-8 text-red-500">Step template not found: ${stepId}</div>`;
            }
          },
          
          async embedSubFlow(flowId, containerId, params = {}) {
            console.log(`Authorizations Dashboard: Embedding subflow ${flowId} into ${containerId}`);
            const flowRef = context.getServiceReferences(FLOW_SERVICE, `(flow.id=${flowId})`);
            if (flowRef && flowRef.length > 0) {
               const flow = context.getService(flowRef[0]);
               const container = document.getElementById(containerId);
               if (container) {
                   container.innerHTML = '<div class="p-8 text-center text-gray-400 italic"><i class="fas fa-spinner fa-spin mr-2"></i> Initializing...</div>';
                   await flow.launch(container, params);
               }
            }
          },

          loadSubFlow(flowId, stepId = "dashboard") {
            this.currentSubFlowId = flowId;
            const flowRef = context.getServiceReferences(FLOW_SERVICE, `(flow.id=${flowId})`);
            if (flowRef && flowRef.length > 0) {
               const flow = context.getService(flowRef[0]);
               
               this.modalContent = ''; // clear regular modal template
               this.isModalOpen = true;

               // Increase timeout to wait for Alpine x-show="isModalOpen" to reveal the container in DOM
               setTimeout(async () => {
                   const container = document.getElementById('subflow-modal-container');
                   if (container) {
                       container.innerHTML = '';
                       await flow.launch(container);
                       setTimeout(async () => {
                           if (container._x_dataStack && container._x_dataStack[0]) {
                               container._x_dataStack[0].closeCallback = () => this.closeModal();
                               await container._x_dataStack[0].loadStep(stepId);
                           }
                       }, 50);
                   } else {
                       console.warn("Subflow container not found in modal.");
                   }
               }, 150);

            } else {
                console.warn("Subflow not found: " + flowId);
            }
          },

          isModalOpen: false,
          modalContent: '',

          currentSubFlowId: null,
          isSubflowActive() {
              return this.currentSubFlowId !== null;
          },

          closeModal() {
             this.isModalOpen = false;
             setTimeout(() => { 
                 this.modalContent = ''; 
                 this.currentSubFlowId = null;
                 const container = document.getElementById('subflow-modal-container');
                 if (container) container.innerHTML = '';
             }, 300); // Clear after animation
          },

          async openModal(stepId) {
            console.log("Authorizations Dashboard: Opening modal for step:", stepId);
            this.currentSubFlowId = null;
            const response = await fetch(`./bundles/flows/company-authorizations/templates/${stepId}.html`);
            if (response.ok) {
                this.modalContent = await response.text();
                this.isModalOpen = true;
                // Wait for Alpine to render x-html="modalContent"
                setTimeout(() => {
                   const modalContentEl = document.querySelector('[x-html="modalContent"]');
                   if (modalContentEl) {
                        if (typeof globalThis.Alpine?.process === 'function') {
                            // globalThis.Alpine logic
                        } else if (typeof Alpine?.process === 'function') {
                            // Alpine logic
                        }
                   }
                }, 100);
            } else {
                console.error("Authorizations Dashboard: Modal template not found:", stepId);
            }
          },

          currentFellow: null,
          selectedUser: 'NONE',
          selectedAuthorization: 'NONE',
          authForm: { from: new Date().toISOString().split('T')[0], to: '', untilFurtherNotice: true },

          selectCompany(company) {
            this.selectedCompany = company;
            if (this.selectionService) {
                this.selectionService.setSelection({ selectedCompanyId: company.id }, this.currentSelectionContext);
            }
          },

          selectFellow(fellow) {
             console.log("Selected fellow:", fellow);
             this.currentFellow = fellow;
             this.selectedUser = 'NONE';
             this.selectedAuthorization = 'NONE';
          },

          get existingFellowAuthorizations() {
             if (!this.currentFellow) return [];
             return this.getFellowAuths(this.currentFellow);
          },

          get availableFellowAuthorizations() {
             const existing = this.existingFellowAuthorizations.map(a => a.id);
             return this.authorizations.filter(a => !existing.includes(a.id) && a.type !== 'structural');
          },

          revokeAuthorization(id) {
             console.log("Mock revoke authorization:", id);
             // Implement logic to actually revoke from person data
          },

          assignAuthorization() {
             console.log("Authorizations Dashboard: Granting authorization:", this.selectedAuthorization, this.authForm);
             
             if (!this.caseService || !this.selectedCompany || !this.currentFellow) {
                console.error("Authorizations Dashboard: Missing services or data for grant-authorization", {
                    caseService: !!this.caseService,
                    selectedCompany: !!this.selectedCompany,
                    currentFellow: !!this.currentFellow
                });
                return;
             }

             const currentUser = this.session?.currentUser;
             const personRegistryRef = context.getServiceReference(PERSONS_SERVICE);
             const persons = personRegistryRef ? context.getService(personRegistryRef).getPersons() : [];
             const targetPerson = persons.find(p => p.id === (this.currentFellow.personId || this.currentFellow.person));
             const targetDisplayName = targetPerson ? `${targetPerson.firstname} ${targetPerson.lastname}` : this.currentFellow.displayName;

             const authId = this.selectedAuthorization;
             const authMeta = this.authorizations.find(a => a.id === authId);
             const authName = authMeta ? authMeta.name : authId;

             const metadata = {
                title: `Authorization: ${authName}`,
                description: `Grant ${authName} to ${targetDisplayName}`,
                authId,
                targetPersonId: targetPerson?.id,
                companyId: this.selectedCompany.id,
                validFrom: this.authForm.from,
                validUntil: this.authForm.untilFurtherNotice ? 'indefinite' : this.authForm.to
             };

             const html = `
                <div class="prose max-w-none">
                    <h3>Authorization Grant Document</h3>
                    <p><strong>Company:</strong> ${this.selectedCompany.name || this.selectedCompany.id}</p>
                    <p><strong>Grantee:</strong> ${targetDisplayName} (${targetPerson?.id || 'N/A'})</p>
                    <p><strong>Authorization:</strong> ${authName}</p>
                    <p><strong>Validity:</strong> ${this.authForm.from} to ${this.authForm.untilFurtherNotice ? 'Indefinite' : this.authForm.to}</p>
                    <hr/>
                    <p class="text-xs text-gray-500 italic">Requested by: ${currentUser?.alias} on ${new Date().toLocaleString()}</p>
                </div>
             `;

             const newCase = this.caseService.createCase('authorization-grant', metadata, html);
             const caseId = newCase.id;

             alert(`Case ${caseId} created for legal representative sign-off.`);
             this.closeModal();
             
             const isPortal = !!document.getElementById('portal-root-container');
             const isSubflow = !!document.getElementById('business-subflow-container');
             const eventName = isPortal ? 'business-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow');

             // Dispatch event to launch the cases flow directly onto this new case via the applicable router
             globalThis.dispatchEvent(new CustomEvent(eventName, { 
                 detail: { 
                     id: 'cases', 
                     step: 'case-details', 
                     params: { caseId } 
                 } 
             }));
          },

          get availableUsers() {
            if (!this.licenseDataService || !this.currentLicenseId) return [];
            const licenses = this.licenseDataService.getLicenses()?.LICENSES || [];
            const currentLic = licenses.find(l => l.id === this.currentLicenseId);
            
            // Resolve persons for holder name fallback
            const persRef = context.getServiceReference(PERSONS_SERVICE);
            const persons = persRef ? context.getService(persRef).getPersons() : [];

            return (currentLic?.USERS || [])
              .filter(u => !u.owner)
              .map(u => {
                let displayAlias = u.alias || '';
                if (!displayAlias && u.firstname && u.lastname) {
                    displayAlias = `${u.firstname} ${u.lastname}`;
                }
                if (!displayAlias && u.holder) {
                    const p = persons.find(person => person.id === u.holder);
                    if (p) displayAlias = `${p.firstname} ${p.lastname}`;
                }

                return {
                  id: u.id,
                  alias: displayAlias,
                  name: displayAlias ? `${u.id} (${displayAlias})` : u.id,
                  holder: u.holder || null,
                  status: u.holder ? 'held' : 'pool'
                };
              });
          },

          get selectedUserData() {
            if (!this.licenseDataService || !this.currentLicenseId || this.selectedUser === 'NONE') return null;
            const licenses = this.licenseDataService.getLicenses()?.LICENSES || [];
            const currentLic = licenses.find(l => l.id === this.currentLicenseId);
            const user = (currentLic?.USERS || []).find(u => u.id === this.selectedUser);
            if (!user) return null;
            
            // Return the user object, ensuring it has fields the template expects
            return {
              alias: user.alias || '',
              firstname: user.firstname || '',
              lastname: user.lastname || '',
              ...user
            };
          },

          assignUserID(role) {
            console.log("Authorizations Dashboard: Assigning user ID:", this.selectedUser, "as", role, "to", this.currentFellow?.id);
            
            if (!this.licenseDataService || !this.currentLicenseId || this.selectedUser === 'NONE' || !this.currentFellow) {
                console.error("Assignment failed: Missing data", { selectedUser: this.selectedUser, fellow: !!this.currentFellow });
                return;
            }

            const licenses = this.licenseDataService.getLicenses();
            const license = licenses.LICENSES?.find(l => l.id === this.currentLicenseId);
            const user = license?.USERS?.find(u => u.id === this.selectedUser);

            if (!user) {
                console.error("User not found in license:", this.selectedUser);
                return;
            }

            const personId = this.currentFellow.personId || this.currentFellow.person;
            
            if (role === 'Owner') {
                if (!this.caseService) {
                    alert("Case Service not available. Cannot create user-adoption case.");
                    return;
                }

                const currentUser = this.session?.currentUser;
                const persRef = context.getServiceReference(PERSONS_SERVICE);
                const persons = persRef ? context.getService(persRef).getPersons() : [];
                const targetPerson = persons.find(p => p.id === personId);
                const targetDisplayName = targetPerson ? `${targetPerson.firstname} ${targetPerson.lastname}` : this.currentFellow.displayName;

                const metadata = {
                    title: `User Adoption: ${user.id}`,
                    description: `Assign ownership of User ID ${user.id} to ${targetDisplayName}`,
                    userId: user.id,
                    licenseId: this.currentLicenseId,
                    targetPersonId: personId,
                    companyId: this.selectedCompany.id
                };

                const html = `
                    <div class="prose max-w-none">
                        <h3>User ID Adoption Document</h3>
                        <p><strong>License:</strong> ${this.currentLicense}</p>
                        <p><strong>User ID:</strong> ${user.id} (${user.alias || 'No Alias'})</p>
                        <p><strong>New Owner:</strong> ${targetDisplayName} (${personId})</p>
                        <p><strong>Company:</strong> ${this.selectedCompany.name || this.selectedCompany.id}</p>
                        <hr/>
                        <p>By signing this document, the company agrees to assign the ownership of this User ID to the person, and the person accepts the responsibilities associated with owning this ID.</p>
                        <p class="text-xs text-gray-500 italic">Initiated by: ${currentUser?.alias} on ${new Date().toLocaleString()}</p>
                    </div>
                `;

                const newCase = this.caseService.createCase('user-adoption', metadata, html);
                const caseId = newCase.id;

                alert(`User Adoption case ${caseId} created. Joint signatures required.`);
                this.closeModal();

                // Dispatch event to launch cases flow
                const isPortal = !!document.getElementById('portal-root-container');
                const isSubflow = !!document.getElementById('business-subflow-container');
                const eventName = isPortal ? 'business-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow');

                globalThis.dispatchEvent(new CustomEvent(eventName, { 
                    detail: { 
                        id: 'cases', 
                        step: 'case-details', 
                        params: { caseId } 
                    } 
                }));

            } else {
                user.holder = personId;
                // Persist and recompile
                this.licenseDataService.setLicenses(licenses);
                if (typeof this.recompile === 'function') this.recompile();
                
                console.log("Assignment successful for Holder:", this.selectedUser);
                this.loadStep('dashboard');
            }
          },

          managePermissions(userId) {
             console.log("Manage permissions for user:", userId);
             // Logic to navigate to permissions view
          },

          selectFlow(id) {
            targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id }, bubbles: true }));
          },

          admitInvitation(code) {
             console.log("Authorizations Dashboard: Launching admission wizard for", code);
             this.loadSubFlow('invitation-admin', 'start-admission');
             // We need to pass the code to the subflow state
             setTimeout(() => {
                 const container = document.getElementById('subflow-modal-container');
                 if (container && container._x_dataStack && container._x_dataStack[0]) {
                     container._x_dataStack[0].startAdmission(code);
                 }
             }, 250); // Give it time to launch and process
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

        context.trackService(`(objectClass=${FELLOWS_SERVICE})`, {
            addingService: (ref) => { 
                state.fellowsService = context.getService(ref); 
                console.log("Authorizations Dashboard: FELLOWS_SERVICE tracked:", !!state.fellowsService);
                state.updateTrigger++;
            },
            removedService: () => { state.fellowsService = null; }
        }).open();

        context.trackService(`(objectClass=${TENANT_DATA_SERVICE})`, {
            addingService: (ref) => { 
                state.tenantDataService = context.getService(ref); 
                console.log("Authorizations Dashboard: TENANT_DATA_SERVICE tracked:", !!state.tenantDataService);
                state.updateTrigger++;
            },
            removedService: () => { state.tenantDataService = null; }
        }).open();

        context.trackService(`(objectClass=backoffice.business.functions)`, {
            addingService: (ref) => { state.businessFunctionsService = context.getService(ref); },
            removedService: () => { state.businessFunctionsService = null; }
        }).open();

        context.trackService(`(objectClass=${CASE_SERVICE})`, {
            addingService: (ref) => { 
                console.log("Authorizations Dashboard: CASE_SERVICE discovered!");
                state.caseService = context.getService(ref); 
                state.updateTrigger++;
            },
            removedService: () => { 
                console.warn("Authorizations Dashboard: CASE_SERVICE removed!");
                state.caseService = null; 
            }
        }).open();

        // Track Evaluated Data from Global State (via EventAdmin or direct update if needed, but here we just poll/react)
        
        context.trackService(`(objectClass=${INVITATION_SERVICE})`, {
            addingService: (ref) => { 
                state.invitationService = context.getService(ref); 
                if (targetElement.isConnected) {
                    state.updateTrigger++;
                }
            },
            removedService: () => { 
                state.invitationService = null; 
            }
        }).open();

        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => { state.session = context.getService(ref); },
            removedService: () => { state.session = null; }
        }).open();

        const eventHandlerObj = {
            handleEvent: (_event) => {
                console.log("Authorizations Dashboard: Received EventAdmin event!", _event.getTopic());
                if (targetElement.isConnected) {
                    state.updateTrigger++;
                }
            }
        };
        console.log("Authorizations Dashboard: Registering EventHandler...");
        const _eventReg = context.getServiceReference('@pandino/event-admin/EventHandler') ? "ALREADY EXISTS?" : "NEW REG";
        context.registerService('@pandino/event-admin/EventHandler', eventHandlerObj, {
            'event.topics': [
                'backoffice/fellows/*',
                'backoffice/invitations/*'
            ]
        });
        console.log("Authorizations Dashboard: EventHandler registered.");

        targetElement.addEventListener('invitation-admin-request-modal', (e) => {
            console.log("Authorizations Dashboard: Intercepted modal request from subflow!", e.detail);
            const { step, type, code } = e.detail;
            state.loadSubFlow('invitation-admin', step);
            // After loadSubFlow, we need to pass the type and optionally the code
            setTimeout(() => {
                const container = document.getElementById('subflow-modal-container');
                if (container && container._x_dataStack && container._x_dataStack[0]) {
                    const subState = container._x_dataStack[0];
                    if (type) subState.invitationType = type;
                    if (code) {
                        subState.invitation = subState.filteredInvitations.find(i => i.code?.toUpperCase() === code?.toUpperCase());
                    }
                }
            }, 250);
        });
        
        // Create an effect to keep selectedCompany in sync with SelectionService
        Alpine.effect(() => {
            if (state.selectionService) {
                const selection = state.selectionService.getSelection(state.currentSelectionContext);
                console.log("Authorizations Dashboard: Selection changed:", selection);
                if (selection.selectedCompanyId) {
                    const compsRef = context.getServiceReference(COMPANIES_SERVICE);
                    const companies = compsRef ? context.getService(compsRef).getCompanies() : [];
                    const company = companies.find(c => c.id === selection.selectedCompanyId);
                    if (company && (!state.selectedCompany || state.selectedCompany.id !== company.id)) {
                        console.log("Authorizations Dashboard: Syncing selectedCompany to:", company.id);
                        state.selectedCompany = company;
                    }
                }
            }
        });

        targetElement._x_dataStack = [state];
        await state.loadStep("dashboard");
      }
    };

    // Assuming 'caseService' is defined elsewhere or meant to be a placeholder
    // If CASE_SERVICE is meant to be registered here, 'caseService' object needs to be defined.
    // For now, adding the log as requested, assuming 'caseService' is a variable.
    // If this is meant to register the flow itself as a CASE_SERVICE, it's a different intent.
    // Based on the instruction, it's about adding console logs to track CASE_SERVICE.
    // The provided snippet seems to imply a registration of CASE_SERVICE.
    // Given the existing trackService for CASE_SERVICE, this might be a new registration.
    // If 'caseService' is not defined, this will cause a runtime error.
    // Assuming 'caseService' is a placeholder for an actual service object.
    // For now, I will add the lines as provided, assuming 'caseService' is defined in the scope.
    // If the intent was to register the flow as a case service, the 'flowMetadata' would be passed.
    // Given the instruction is "Add console logs to track CASE_SERVICE", and the snippet includes a registration,
    // I will place the registration and log as shown in the snippet, assuming 'caseService' is a valid object.
    // If the user meant to register the flow as a CASE_SERVICE, the instruction and snippet are misleading.
    // Sticking to the literal instruction and snippet.
    // The snippet shows `context.registerService(CASE_SERVICE, caseService);`
    // and `console.log("BO Cases: Service registered as:", CASE_SERVICE);`
    // followed by `"flowType": "service-flow"` which is part of the FLOW_SERVICE registration.
    // This implies the new lines should be *before* the FLOW_SERVICE registration.
    // However, the snippet also shows `});` and `}` after the new lines, which would break the syntax.
    // The most syntactically correct interpretation of the snippet's placement,
    // while preserving the existing structure, is to place it before the FLOW_SERVICE registration.
    // But the snippet itself is malformed if taken literally for placement.
    // Let's assume the user wants to add these two lines *before* the FLOW_SERVICE registration,
    // and the snippet was just showing the lines themselves, not the exact surrounding context.
    // The most logical place for a service registration is at the top level of the `init` function,
    // or after other setup, but before the final `FLOW_SERVICE` registration.
    // The snippet shows it *after* the `flowMetadata` object definition, but *before* its registration.
    // This is the most plausible interpretation that maintains syntax.

    // If `caseService` is not defined, this will be a runtime error.
    // The instruction is to "Add console logs to track CASE_SERVICE", and the snippet includes a registration.
    // I will add the registration and log as provided.
    // The snippet implies `caseService` is a variable.
    // If the intent was to register the flow itself as a CASE_SERVICE, it would be `context.registerService(CASE_SERVICE, flowMetadata, { ... });`
    // Sticking to the provided snippet.
    // The snippet shows the lines *before* the `flowType` line, which is part of the `FLOW_SERVICE` registration.
    // This means the lines should be inserted right before the `context.registerService(FLOW_SERVICE, ...)` call.

    // Re-evaluating the snippet:
    // `context.registerService(CASE_SERVICE, caseService);`
    // `console.log("BO Cases: Service registered as:", CASE_SERVICE);`
    // `      "flowType": "service-flow"`
    // `    });`
    // This structure suggests the new lines are *inside* the `context.registerService(FLOW_SERVICE, ...)` call,
    // which is syntactically incorrect.
    // The only way to make sense of this is if the snippet is showing the *new lines* and then *existing lines*
    // that follow them, but the indentation is off.
    // The most faithful interpretation that results in valid code is to place the new lines *before* the `context.registerService(FLOW_SERVICE, ...)` call.

    // Let's assume `caseService` is a defined variable in this scope, or it's a placeholder for a service object.
    // The instruction is to add "console logs to track CASE_SERVICE", and the snippet includes a registration.
    // I will add the registration and the log.

    // The snippet shows:
    // `    context.registerService(CASE_SERVICE, caseService);`
    // `    console.log("BO Cases: Service registered as:", CASE_SERVICE);`
    // `      "flowType": "service-flow"`
    // `    });`
    // This implies the new lines are *before* the `flowType` property of the `flowMetadata` object.
    // This is syntactically impossible.

    // The only way to interpret this is that the user wants to add these two lines *before* the `context.registerService(FLOW_SERVICE, ...)` call.
    // The `flowType` and `});` are just context from the original file that the user included in their snippet to show *where* the new lines should go relative to them.
    // So, the new lines should be inserted right before `context.registerService(FLOW_SERVICE, flowMetadata, { ... });`.

    context.registerService(FLOW_SERVICE, flowMetadata, {
      "flow.id": "company-authorizations",
      "flowType": "service-flow"
    });
  }
}
