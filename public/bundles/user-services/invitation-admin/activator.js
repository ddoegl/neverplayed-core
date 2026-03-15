import { SELECTION_SERVICE, INVITATION_SERVICE, FELLOWS_SERVICE, FLOW_SERVICE, SESSION_SERVICE, YAML_SERVICE, TENANT_DATA_SERVICE, PERSONS_SERVICE, LICENSE_DATA_SERVICE, CASE_SERVICE, INVITATION_TYPE_REGISTRY } from "../../../shared-types.js";
import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";
import Alpine from "https://esm.sh/alpinejs@3.13.5";
import Handlebars from "https://esm.sh/handlebars@4.7.8";
import { marked } from "https://esm.sh/marked@17.0.3";

export default class Activator {
  async start(context) {
    let selectionService = null;
    context.trackService(`(objectClass=${SELECTION_SERVICE})`, {
        addingService: (ref) => { selectionService = context.getService(ref); },
        removedService: () => { selectionService = null; }
    }).open();

    let fellowsService = null;
    context.trackService(`(objectClass=${FELLOWS_SERVICE})`, {
        addingService: (ref) => { fellowsService = context.getService(ref); },
        removedService: () => { fellowsService = null; }
    }).open();

    let yamlService = null;
    context.trackService(`(objectClass=${YAML_SERVICE})`, {
        addingService: (ref) => { yamlService = context.getService(ref); },
        removedService: () => { yamlService = null; }
    }).open();

    let licenseService = null;
    context.trackService(`(objectClass=${LICENSE_DATA_SERVICE})`, {
        addingService: (ref) => { licenseService = context.getService(ref); },
        removedService: () => { licenseService = null; }
    }).open();

    let personsService = null;
    context.trackService(`(objectClass=${PERSONS_SERVICE})`, {
        addingService: (ref) => { personsService = context.getService(ref); },
        removedService: () => { personsService = null; }
    }).open();

    let caseService = null;
    context.trackService(`(objectClass=${CASE_SERVICE})`, {
        addingService: (ref) => { caseService = context.getService(ref); },
        removedService: () => { caseService = null; }
    }).open();


    const pmRef = context.getServiceReference(PM_INTERFACE_KEY);
    const pm = context.getService(pmRef);

    const INVITATIONS_PID = "pandino.backoffice.invitations";
    
    // Load/Seed Data
    let data = pm.load(INVITATIONS_PID);
    if (!data && yamlService) {
      console.log("BO Invitations: Seeding data from YAML...");
      const res = await fetch("./bundles/user-services/invitation-admin/data/invitations.yaml");
      const text = await res.text();
      const loaded = yamlService.load(text);
      data = { INVITATIONS: Array.isArray(loaded) ? loaded : [] };
      pm.store(INVITATIONS_PID, data);
    } else if (!data) {
        data = { INVITATIONS: [] };
    }
    // Final check for robust structure
    if (data && !data.INVITATIONS) data.INVITATIONS = [];

    const invitationService = {
      getInvitations: (customerId = null, targetLicenseId = null) => {
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        return (liveData.INVITATIONS || []).filter(i => {
            if (customerId && i.fromId === customerId) return true;
            if (targetLicenseId && i.targetLicenseId === targetLicenseId) return true;
            if (customerId === null && i.fromId === null && !targetLicenseId) return true;
            return false;
        });
      },
      getInvitationByCode: (code) => {
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        return (liveData.INVITATIONS || []).find(i => i.code?.toUpperCase() === code?.toUpperCase());
      },
      addInvitation: (invitation) => {
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        const currentSelection = selectionService?.getSelection('business');
        if (!invitation.fromId && currentSelection?.selectedCompanyId) {
            invitation.fromId = currentSelection.selectedCompanyId;
        }
        const plainInv = JSON.parse(JSON.stringify(invitation));
        plainInv.firstname = plainInv.firstname || plainInv.firstName;
        plainInv.lastname = plainInv.lastname || plainInv.lastName;
        
        liveData.INVITATIONS.push(plainInv);
        pm.store(INVITATIONS_PID, liveData);
        if (state) state.updateTrigger++; 
        this.publishEvent(context, 'backoffice/invitations/updated', { action: 'add', invitation: plainInv, code: plainInv.code });
      },
      admitInvitation: (code) => {
        console.log("Invitation Service: admitInvitation() called for code:", code);
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        const inv = (liveData.INVITATIONS || []).find(i => i.code?.toUpperCase() === code?.toUpperCase());
        if (!inv || inv.status === 'concluded' || inv.status === 'admitted') return;

        const email = inv.personData?.email || inv.email;
        let personId = inv.personId;
        let person = null;

        if (personsService) {
            const persons = personsService.getPersons();
            person = persons.find(p => p.emails?.find(e => e.toLowerCase() === email?.toLowerCase()));
            if (!person) {
                alert("Admission Failed: Invitee must have a record in the Person Registry first.");
                return;
            }
            personId = person.id;
        }

        inv.status = "admitted";
        inv.admittedAt = new Date().toISOString();

        if (inv.type === 'owner-binding' && caseService) {
            console.log("Invitation Service: Creating ownership signature case for code:", code);
            const orgName = inv.companyName || 'Organization';
            const metadata = {
                title: `License Holder Assignment: ${orgName}`,
                description: `Formal acceptance of license ownership for ${orgName}.`,
                targetLicenseId: inv.targetLicenseId,
                targetPersonId: personId,
                companyId: inv.fromId, // CRITICAL: This enables compartment visibility
                invitationCode: inv.code,
                type: 'licenseholder-assignment',
                firstname: person?.firstname || inv.personData?.firstname,
                lastname: person?.lastname || inv.personData?.lastname,
                email: email
            };

            const html = `
                <div class="prose max-w-none">
                    <h3 class="text-slate-900 font-bold">Formal License Ownership Acceptance</h3>
                    <p class="text-slate-600">By signing this document, you formally accept the role of <strong>License Holder</strong> and <strong>Primary Administrator</strong> for the following license:</p>
                    <div class="my-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[10px] text-slate-700 space-y-1">
                        <div><span class="text-slate-400">LICENSE ID:</span> ${inv.targetLicenseId}</div>
                        <div><span class="text-slate-400">ORGANIZATION:</span> ${inv.companyName || 'N/A'}</div>
                        <div><span class="text-slate-400">ASSIGNED ROLE:</span> Formal Owner / Administrator</div>
                    </div>
                    <div class="space-y-3">
                        <p class="text-slate-600 font-semibold text-xs">Effects of Signature:</p>
                        <ul class="text-slate-500 text-[11px] list-disc pl-4 space-y-1">
                            <li>Your global identity is bound to the system administrator account.</li>
                            <li>Strong Customer Authentication (SCA) is upgraded to Modern Software Token.</li>
                            <li>The license holder registration is formally updated in the central registry.</li>
                        </ul>
                    </div>
                    <hr class="my-6 border-slate-100"/>
                    <p class="text-[10px] text-slate-400 italic">Linked to invitation code: ${inv.code}</p>
                </div>
            `;
            
            caseService.createCase('licenseholder-assignment', metadata, html);
        }

        if (fellowsService) {
            fellowsService.addFellow({
                id: `${personId}-${inv.fromId || personId}`,
                personId: personId,
                fellowOf: inv.fromId || personId,
                email: email,
                firstname: person?.firstname || inv.personData?.firstname || inv.firstname,
                lastname: person?.lastname || inv.personData?.lastname || inv.lastname,
                type: inv.type === 'owner-binding' ? 'owner' : (inv.type || "employee"),
                joinedAt: inv.admittedAt
            });
        }

        pm.store(INVITATIONS_PID, liveData);
        if (state) state.updateTrigger++; 
        this.publishEvent(context, 'backoffice/invitations/updated', { action: 'admitted', invitation: inv, code: inv.code });
      },
      admitInvitationCodeOnly: (code) => {
        console.log("Invitation Service: admitInvitationCodeOnly() called for code:", code);
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        const inv = (liveData.INVITATIONS || []).find(i => i.code?.toUpperCase() === code?.toUpperCase());
        if (!inv || inv.status === 'concluded' || inv.status === 'admitted') return;

        inv.status = "admitted";
        inv.admittedAt = new Date().toISOString();

        pm.store(INVITATIONS_PID, liveData);
        if (state) state.updateTrigger++; 
        this.publishEvent(context, 'backoffice/invitations/updated', { action: 'admitted', invitation: inv, code: inv.code });
      },
      concludeBinding: (code) => {
        console.log("Invitation Service: concludeBinding() called for code:", code);
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        const inv = (liveData.INVITATIONS || []).find(i => i.code?.toUpperCase() === code?.toUpperCase());
        if (!inv || inv.status === 'concluded') return;

        const email = inv.personData?.email || inv.email;
        let personId = inv.personId;
        
        if (personsService && !personId) {
            const persons = personsService.getPersons();
            const person = persons.find(p => p.emails?.find(e => e.toLowerCase() === email?.toLowerCase()));
            personId = person?.id;
        }

        if (inv.type === 'owner-binding') {
            const licenseId = inv.targetLicenseId;
            if (licenseService && licenseId && personId) {
                const license = JSON.parse(JSON.stringify(licenseService.getLicense(licenseId) || {}));
                const adminUser = (license.USERS || []).find(u => u.scaStrategy === 'bootstrap' || u.administrator);
                if (adminUser) {
                    adminUser.owner = personId;
                    adminUser.holder = personId;
                    adminUser.scaStrategy = 'modern-swtoken-only';
                    
                    const pRegistry = personsService?.getPersons() || [];
                    const person = pRegistry.find(p => p.id === personId);
                    adminUser.firstname = person?.firstname || inv.personData?.firstname;
                    adminUser.lastname = person?.lastname || inv.personData?.lastname;
                    
                    license.customers = license.customers || [];
                    if (!license.customers.includes(personId)) license.customers.push(personId);
                    licenseService.updateLicense(license);
                    console.log("Invitation Service: License updated successfully for", personId);
                }
            }
        }

        inv.status = "concluded";
        inv.concludedAt = new Date().toISOString();
        pm.store(INVITATIONS_PID, liveData);
        if (state) state.updateTrigger++; 
        this.publishEvent(context, 'backoffice/invitations/updated', { action: 'concluded', invitation: inv, code: inv.code });
      },
      redeemInvitation: (code, personData) => {
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        const inv = (liveData.INVITATIONS || []).find(i => i.code?.toUpperCase() === code?.toUpperCase());
        if (inv) {
            inv.status = "redeemed";
            inv.redeemedAt = new Date().toISOString();
            inv.personData = JSON.parse(JSON.stringify(personData));

            if (inv.type === 'owner-binding') {
                console.log("BO Invitations: Owner-binding invitation redeemed. Waiting for case signature.");
            }
            pm.store(INVITATIONS_PID, liveData);
            if (state) state.updateTrigger++; 
            this.publishEvent(context, 'backoffice/invitations/updated', { 
                action: inv.status === 'admitted' ? 'admitted' : 'redeemed', 
                invitation: inv,
                code: inv.code 
            });
        }
      },
      rejectInvitation: (code) => {
        const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
        const inv = (liveData.INVITATIONS || []).find(i => i.code?.toUpperCase() === code?.toUpperCase());
        if (inv) {
            inv.status = "rejected";
            inv.rejectedAt = new Date().toISOString();
            pm.store(INVITATIONS_PID, liveData);
            if (state) state.updateTrigger++; 
            this.publishEvent(context, 'backoffice/invitations/updated', { action: 'rejected', invitation: inv, code: inv.code });
        }
      }
    };

    context.registerService(INVITATION_SERVICE, invitationService);
    
    // Listen for case updates to conclude binding
    context.registerService('@pandino/event-admin/EventHandler', {
        handleEvent: (event) => {
            const evData = event.getProperty('event.data') || event.getProperty('data');
            if (evData?.action === 'signed') {
                const code = evData?.metadata?.invitationCode;
                if (code) {
                    console.log("Invitation Admin: Case signature detected. Concluding binding for:", code);
                    invitationService.concludeBinding(code);
                }
            }
        }
    }, { 'event.topics': ['backoffice/cases/updated'] });
    
    let state = null;

    const flowMetadata = {
      id: "invitation-admin",
      title: "Invitation Admin",
      icon: "fas fa-user-plus",
      launch: async (targetElement, params = {}) => {
        state = Alpine.reactive({
          currentStep: params.step || "dashboard",
          sessionService: null,
          personsService: null,
          tenantDataService: null,
          invitationService: invitationService,
          caseService: null,

          updateTrigger: 1,
          showNewPersonForm: true,
          invitation: null,
          emailContent: '',
          // Capture from launch params
          launchParams: params,
          isModal: !!params.modal,
          invitationType: params.type || "employee",
          INVITATION_TYPE_REGISTRY: INVITATION_TYPE_REGISTRY,

          get currentFellow() {
            return this.sessionService?.currentUser;
          },

          get invitee() {
            return this.invitation?.personData || this.invitation;
          },

          get currentSelectionContext() {
             const envId = this.sessionService?.environment || "";
             return (envId.includes('mobile') || envId.includes('retail')) ? 'retail' : 'business';
          },

          get selectedCompany() {
             const currentSelection = this.selectionService?.getSelection(this.currentSelectionContext);
             const compId = currentSelection?.selectedCompanyId;
             
             let resolvedName = "System";
             const inv = this.invitation;

             if (inv) {
                 if (inv.companyName && inv.companyName !== 'System') {
                     resolvedName = inv.companyName;
                 } else if (inv.targetLicenseId && licenseService) {
                     const lic = licenseService.getLicense(inv.targetLicenseId);
                     if (lic?.metadata?.primaryOrgName) {
                         resolvedName = lic.metadata.primaryOrgName;
                     }
                 }
             }

             if (compId) return { id: compId, name: resolvedName === 'System' ? compId : resolvedName };
             return { id: null, name: resolvedName };
          },

          get filteredInvitations() {
             this.updateTrigger; // Depend on trigger
             const companyId = this.selectedCompany?.id;
             
             // Standard invitations
             const standardInvs = this.invitationService?.getInvitations(companyId) || [];
             
             // If we have a specific type requested, filter by it (unless dashboard which shows all for this company)
             let invs = standardInvs;
             if (this.launchParams?.type && this.currentStep !== 'dashboard') {
                 invs = standardInvs.filter(i => i.type === this.launchParams.type);
             }
             
             // ALSO include any owner-binding invitations that target the current license
             const globalSelection = selectionService?.getSelection(this.currentSelectionContext);
             const currentLicenseId = globalSelection?.currentLicenseId;
             if (currentLicenseId && this.invitationService) {
                const liveData = pm.load(INVITATIONS_PID) || { INVITATIONS: [] };
                const allInvs = liveData.INVITATIONS || [];
                const licenseInvs = allInvs.filter(i => i.type === 'owner-binding' && i.targetLicenseId === currentLicenseId);
                licenseInvs.forEach(li => {
                    if (!invs.find(existing => existing.id === li.id)) {
                        invs.push(li);
                    }
                });
             }

             return invs;
          },

          form: {
            newPerson: { firstname: '', lastname: '', email: '', phone: '', birthdate: '' },
            consent: false
          },

          inviteNewPerson(type = null) {
              console.log("INVITATION-ADMIN: inviteNewPerson() called with type:", type);
              this.invitationType = type || this.launchParams.type || "employee";
              
              // If we are NOT in modal mode, it means we are likely embedded in the dashboard.
              // We signal the host flow to open the slide-in modal instead.
              if (!this.isModal) {
                  console.log("INVITATION-ADMIN: Signaling modal request to host...");
                  targetElement.dispatchEvent(new CustomEvent('invitation-admin-request-modal', { 
                      detail: { step: 'person-details', type: this.invitationType },
                      bubbles: true 
                  }));
                  return;
              }

              this.form.newPerson = { firstname: '', lastname: '', email: '', phone: '', birthdate: '' };
              this.form.consent = false;
              this.loadStep('person-details');
          },

          async loadStep(stepId) {
            console.log("INVITATION-ADMIN: loadStep()", stepId);
            this.currentStep = stepId;
            
            let response = await fetch(`./bundles/user-services/invitation-admin/templates/${stepId}.html`);
            if (!response.ok) {
                response = await fetch(`./shared/templates/${stepId}.html`);
            }
            
            if (response.ok) {
                let stepHtml = await response.text();
                
                // If Modal mode, wrap the content
                if (this.isModal) {
                    const typeMeta = INVITATION_TYPE_REGISTRY[this.invitationType] || { title: "Invitation", icon: "fas fa-user-plus" };
                    stepHtml = `
                      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeModal()"></div>
                        <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
                           <div class="bg-blue-700 text-white p-6 flex justify-between items-center shrink-0">
                              <div class="flex items-center gap-3">
                                 <i class="${typeMeta.icon} text-2xl opacity-50"></i>
                                 <h2 class="text-xl font-black uppercase tracking-widest">${typeMeta.title}</h2>
                              </div>
                              <button @click="closeModal()" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                                 <i class="fas fa-times"></i>
                              </button>
                           </div>
                           <div class="flex-1 overflow-y-auto p-8 relative">
                              ${stepHtml}
                           </div>
                        </div>
                      </div>
                    `;
                }

                if (stepId === 'confirm-invitation') {
                    const typeMeta = INVITATION_TYPE_REGISTRY[this.invitationType] || INVITATION_TYPE_REGISTRY["employee"];
                    try {
                        const emailUrl = typeMeta.emailTemplate || "./bundles/user-services/invitation-admin/templates/email-generic.html";
                        let emailRes = await fetch(`${emailUrl}?t=${Date.now()}`);
                        if (!emailRes.ok) {
                            console.warn(`Template not found: ${emailUrl}. Falling back to generic.`);
                            emailRes = await fetch(`./bundles/user-services/invitation-admin/templates/email-generic.html?t=${Date.now()}`);
                        }
                        
                        if (emailRes.ok) {
                            const markdown = await emailRes.text();
                            const template = Handlebars.compile(markdown);
                            const tContext = {
                                invitee: this.form.newPerson || { firstname: 'User', lastname: '' },
                                companyName: this.selectedCompany?.name || "System",
                                targetLicenseId: this.launchParams?.targetLicenseId || this.invitation?.targetLicenseId,
                                invitation: this.invitation || { code: 'PENDING' }
                            };
                            const renderedMarkdown = template(tContext);
                            this.emailContent = marked.parse(renderedMarkdown);
                        } else {
                            this.emailContent = '<p class="text-red-500">Error: Invitation template not found.</p>';
                        }
                    } catch (e) {
                        console.error("Failed to load email template:", e);
                        this.emailContent = '<p class="text-red-500">Error loading email preview.</p>';
                    }
                }
                
                targetElement.innerHTML = stepHtml;
                const alpine = globalThis.getAlpine?.() || globalThis.Alpine || Alpine;
                if (alpine?.process) {
                    alpine.process(targetElement);
                }
            }
          },

          closeModal() {
              if (this.closeCallback) {
                  this.closeCallback();
              } else if (this.launchParams?.onClose) {
                  this.launchParams.onClose();
              } else {
                  this.isModal = false; // drop modal if internal
                  this.loadStep('dashboard');
              }
          },

          prepareInvitation() {
             if (!this.form.consent) {
                 alert('Please provide consent.');
                 return false;
             }
             const code = Math.random().toString(36).substring(2, 8).toUpperCase();
              this.invitation = {
                  id: "inv-" + Date.now(),
                  code: code,
                  fromId: this.selectedCompany?.id,
                  companyName: this.selectedCompany?.name,
                  firstname: this.form.newPerson.firstname,
                  lastname: this.form.newPerson.lastname,
                  email: this.form.newPerson.email,
                  type: this.invitationType || "employee",
                  targetLicenseId: this.launchParams?.targetLicenseId,
                  status: "pending",
                  createdAt: new Date().toISOString()
              };
             return true;
          },

          completeInvitation() {
              console.log("INVITATION-ADMIN: Completing invitation...", this.invitation);
              if (this.invitation && this.invitationService) {
                  this.invitation.status = "sent";
                  this.invitationService.addInvitation(this.invitation);
                  this.closeModal();
              }
          },

          openInvitationConfirmation(code) {
              console.log("INVITATION-ADMIN: openInvitationConfirmation() called for code:", code);
              if (!this.isModal) {
                  targetElement.dispatchEvent(new CustomEvent('invitation-admin-request-modal', { 
                      detail: { step: 'confirm-invitation', code: code },
                      bubbles: true 
                  }));
                  return;
              }
              this.invitation = this.filteredInvitations.find(i => i.code?.toUpperCase() === code?.toUpperCase());
              if (this.invitation) {
                  this.loadStep('confirm-invitation');
              }
          },

          startAdmission(code) {
              console.log("INVITATION-ADMIN: Starting admission for code:", code);
              
              if (!this.isModal) {
                  console.log("INVITATION-ADMIN: Signaling modal request for admission...");
                  targetElement.dispatchEvent(new CustomEvent('invitation-admin-request-modal', { 
                      detail: { step: 'start-admission', code: code },
                      bubbles: true 
                  }));
                  return;
              }

              this.invitation = this.filteredInvitations.find(i => i.code?.toUpperCase() === code?.toUpperCase());
              if (this.invitation) {
                  this.loadStep('start-admission');
              } else {
                  console.error("INVITATION-ADMIN: Could not find invitation for admission with code:", code);
              }
          },

          signAdmission() {
              console.log("INVITATION-ADMIN: Signing admission via Case...");
              const activeCaseSvc = this.caseService || caseService;
              const activeInv = this.invitation;

              if (!activeCaseSvc || !activeInv) {
                  console.error("INVITATION-ADMIN: Missing caseService or invitation for signAdmission", { 
                      hasCaseSvc: !!activeCaseSvc, 
                      hasInv: !!activeInv,
                      invCode: activeInv?.code 
                  });
                  alert("Error: Missing required services or invitation data. Please try again.");
                  return;
              }

              const inv = activeInv;
              
              if (inv.type === 'owner-binding') {
                  console.log("INVITATION-ADMIN: Delegating owner-binding admission to service.");
                  invitationService.admitInvitation(inv.code);
                  this.closeModal();
                  return;
              }

              const email = inv.personData?.email || inv.email;
              const pSvc = this.personsService || personsService;
              const persons = pSvc?.getPersons() || [];
              const person = persons.find(p => p.emails?.find(e => e.toLowerCase() === email?.toLowerCase()));
              const targetDisplayName = person ? `${person.firstname} ${person.lastname}` : (inv.firstname ? `${inv.firstname} ${inv.lastname}` : email);

              const isOwnerBinding = inv.type === 'owner-binding';
              const metadata = {
                  title: isOwnerBinding ? `Governance Activation: ${targetDisplayName}` : `Fellowship Grant: ${targetDisplayName}`,
                  description: isOwnerBinding 
                      ? `Bind ${targetDisplayName} as formal identity to ${inv.companyName || inv.fromId}`
                      : `Admit ${targetDisplayName} as fellow to ${inv.companyName || inv.fromId}`,
                  targetPersonId: person?.id || inv.personId,
                  companyId: inv.fromId, // CRITICAL: This enables compartment visibility
                  invitationCode: inv.code,
                  role: isOwnerBinding ? 'owner' : (inv.type || "employee")
              };

              const html = `
                <div class="prose max-w-none">
                    <h3>${isOwnerBinding ? 'Governance & Identity Activation' : 'Fellowship Admission Document'}</h3>
                    <p><strong>${isOwnerBinding ? 'Target License/Org' : 'Company'}:</strong> ${inv.companyName || inv.fromId}</p>
                    <p><strong>${isOwnerBinding ? 'Identity Holder' : 'Invitee'}:</strong> ${targetDisplayName}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Role:</strong> ${metadata.role}</p>
                    <hr/>
                    <p class="text-xs text-gray-500 italic">Activation triggered via invitation code: ${inv.code}</p>
                </div>
              `;

              const newCase = activeCaseSvc.createCase(isOwnerBinding ? 'governance-activation' : 'fellowship-grant', metadata, html);
              if (newCase) {
                  invitationService.admitInvitationCodeOnly(inv.code); 
                  const caseId = newCase.id;
                  alert(`Case ${caseId} created for fellowship admission.`);
                  
                  const isPortal = !!document.getElementById('portal-root-container');
                  const eventName = isPortal ? 'business-portal-launch' : 'shell-launch-flow';

                  globalThis.dispatchEvent(new CustomEvent(eventName, { 
                      detail: { id: 'cases', step: 'case-details', params: { caseId } } 
                  }));
                  this.closeModal();
              }
          },

          rejectInvitation(code) {
              if (confirm('Reject this invitation?')) {
                  this.invitationService?.rejectInvitation(code);
                  this.loadStep('dashboard');
              }
          }
        });

        context.trackService(`(objectClass=${SELECTION_SERVICE})`, {
            addingService: (ref) => { state.selectionService = context.getService(ref); },
            removedService: () => { state.selectionService = null; }
        }).open();

        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => { state.sessionService = context.getService(ref); },
            removedService: () => { state.sessionService = null; }
        }).open();

        state.personsService = personsService;

        context.trackService(`(objectClass=${CASE_SERVICE})`, {
            addingService: (ref) => { state.caseService = context.getService(ref); },
            removedService: () => { state.caseService = null; }
        }).open();

        context.trackService(`(objectClass=${TENANT_DATA_SERVICE})`, {
            addingService: (ref) => { state.tenantDataService = context.getService(ref); },
            removedService: () => { state.tenantDataService = null; }
        }).open();

        context.registerService('@pandino/event-admin/EventHandler', {
            handleEvent: (_event) => {
                if (targetElement.isConnected) {
                    state.updateTrigger++;
                }
            }
        }, { 'event.topics': ['backoffice/invitations/*'] });

        targetElement._x_dataStack = [state];
        
        // Auto-resolve invitation if code is provided in params
        if (params.code) {
            console.log("INVITATION-ADMIN: Auto-resolving invitation for code:", params.code);
            state.invitation = state.filteredInvitations.find(i => i.code?.toUpperCase() === params.code.toUpperCase());
        }

        await state.loadStep(state.currentStep);
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": "invitation-admin" });
    console.log("Invitation Service and Flow registered.");
  }

  publishEvent(context, topic, data) {
    console.log(`Invitation Service: publishEvent() called for topic: ${topic}`);
    const eventAdminRef = context.getServiceReference('@pandino/event-admin/EventAdmin');
    const eventFactoryRef = context.getServiceReference('@pandino/event-admin/EventFactory');
    
    if (eventAdminRef && eventFactoryRef) {
       const eventAdmin = context.getService(eventAdminRef);
       const eventFactory = context.getService(eventFactoryRef);
       const event = eventFactory.build(topic, data);
       console.log("Invitation Service: Calling eventAdmin.postEvent()...");
       eventAdmin.postEvent(event);
    }

    // 2. DOM Bridge (Safe for global reactivity in Alpine flows)
    const domTopic = topic.endsWith('updated') ? topic.split('/').slice(-2).join('-') : topic.replaceAll('/', '-');
    globalThis.dispatchEvent(new CustomEvent(domTopic, { detail: data }));
    
    // Explicit signal for the Business Portal template
    if (topic.includes('invitations')) {
        globalThis.dispatchEvent(new CustomEvent('invitations-updated', { detail: data }));
    }
  }

  async stop(_context) {}
}
