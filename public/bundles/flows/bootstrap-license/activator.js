import { FLOW_SERVICE, LICENSE_DATA_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const flowMetadata = {
      id: "bootstrap-license",
      title: "Bootstrap License",
      icon: "fas fa-rocket",
      hideNavigation: false, // Will be set dynamically in launch if needed
      launch: async (targetElement, params = {}) => {
        const state = Alpine.reactive({
          currentStep: params.step || "dashboard",
          bootstrapForm: {
              licenseId: params.licenseId || "",
              adminAlias: "Admin",
              licenseMode: "business"
          },
          isModal: false, // Default
          
          async loadStep(stepId) {
            console.log("BOOTSTRAP-LICENSE: loadStep()", stepId);
            this.currentStep = stepId;
            
            // Set hideNavigation based on step
            if (stepId === 'unbound-dashboard' || stepId === 'welcome-dashboard') {
                flowMetadata.hideNavigation = true;
            } else {
                flowMetadata.hideNavigation = false;
            }

            let response = await fetch(`./bundles/flows/bootstrap-license/templates/${stepId}.html`);
            if (!response.ok) {
                response = await fetch(`./shared/templates/${stepId}.html`);
            }
            
            if (response.ok) {
                const stepHtml = await response.text();
                
                // If focus mode (unbound-dashboard), we might want a clean background
                if (stepId === 'unbound-dashboard') {
                    // Full screen focus
                }

                targetElement.innerHTML = stepHtml;
                const alpine = globalThis.getAlpine?.() || globalThis.Alpine || Alpine;
                if (alpine?.process) {
                    alpine.process(targetElement);
                }
            } else {
                targetElement.innerHTML = `<div class="p-8 text-red-500">Step template not found: ${stepId}</div>`;
            }
          },
 
          bootstrapLicense() {
            const licenseId = (this.bootstrapForm.licenseId || '').trim();
            const adminAlias = (this.bootstrapForm.adminAlias || 'Admin').trim();
            const licenseMode = this.bootstrapForm.licenseMode || 'business';
 
            if (!licenseId) { alert('Please enter a License ID.'); return; }
 
            const licRef = context.getServiceReference(LICENSE_DATA_SERVICE);
            const licSvc = licRef ? context.getService(licRef) : null;
            if (!licSvc) { alert('License Data Service not available.'); return; }
 
            // --- 1. Build the new admin user --------------------------------
            const newUserId = String(Date.now());
            const defaultBundle = 'administrator-bundle';
            const newUser = {
                id: newUserId,
                alias: adminAlias,
                owner: null,
                holder: null,
                administrator: true,
                scaStrategy: 'bootstrap', // Set to bootstrap for enforcement
                permissionbundles: [defaultBundle],
                description: 'Administrative User',
                template: 'content/users/user.md',
            };
 
            // --- 2. Build the new license entry ----------------------------
            const newLicense = {
                id: licenseId,
                licenseType: 'bootstrap',
                licenseMode: licenseMode,
                licenseholder: [],
                customers: [],
                features: [],
                USERS: [newUser],
                PERMISSIONBUNDLES: [
                    { [defaultBundle]: [
                        'usermanagement:manage:allowed', 
                        'authorizations:manage:allowed',
                        'documents:view:allowed',
                        'documents:manage:allowed'
                    ] },
                ],
            };

            // --- 3. Persist license ----------------------------------------
            const licensesData = licSvc.getLicenses();
            if (!licensesData.LICENSES) licensesData.LICENSES = [];
            if (licensesData.LICENSES.some(l => l.id === licenseId)) {
                alert(`A license with ID "${licenseId}" already exists. Choose a different ID.`);
                return;
            }
            licensesData.LICENSES.push(newLicense);
            licSvc.setLicenses(licensesData);
            console.log("Bootstrap License: Created license", licenseId);

            // --- 4. Trigger Login -------------------------------------------
            targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { 
                detail: { 
                    id: 'login', 
                    params: { 
                        step: 'dashboard',
                        loginId: newUserId,
                        skipSCA: true
                    } 
                }, 
                bubbles: true 
            }));
          },

          launchInvitationModal() {
              console.log("BOOTSTRAP-LICENSE: Launching invitation-admin modal...");
              // We use the shell-launch-flow event with modal: true
              targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { 
                  detail: { 
                      id: 'invitation-admin', 
                      params: { 
                          step: 'person-details', 
                          modal: true, 
                          type: 'owner-binding',
                          targetLicenseId: this.bootstrapForm.licenseId,
                          onClose: () => {
                              console.log("INVITATION-ADMIN: Modal closed during bootstrap. Transitioning to Welcome Dashboard...");
                              this.loadStep('welcome-dashboard');
                          }
                      } 
                  }, 
                  bubbles: true 
              }));
          },

          selectFlow(id) {
            targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id }, bubbles: true }));
          },

          nextStep(nextId) {
              this.loadStep(nextId);
          }
        });

        targetElement._x_dataStack = [state];
        await state.loadStep(state.currentStep);
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": "bootstrap-license" });
  }
}
