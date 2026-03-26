import { FLOW_SERVICE, SESSION_SERVICE, SELECTION_SERVICE, LICENSE_DATA_SERVICE, PERSONS_SERVICE, EVAL_DATA_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    const flowMetadata = {
      id: "login",
      title: "User Login",
      launch: async (targetElement, params = {}) => {
        // Lazy lookup of services
        const sessionRef = context.getServiceReference(SESSION_SERVICE);
        const sessionSvc = sessionRef ? context.getService(sessionRef) : { currentUser: null };

        const persRef = context.getServiceReference(PERSONS_SERVICE);
        const _persSvc = persRef ? context.getService(persRef) : { getPersons: () => [] };

        const licRef = context.getServiceReference(LICENSE_DATA_SERVICE);
        const licSvc = licRef ? context.getService(licRef) : { getLicenses: () => ({ LICENSES: [] }) };

        const selRef = context.getServiceReference(SELECTION_SERVICE);
        const selSvc = selRef ? context.getService(selRef) : null;

        const state = Alpine.reactive({
          currentChannel: "business",
          loginForm: { identifier: "" },
          pendingLoginUser: null,
          pendingFlowId: null,
          parsedSCAStrategies: {},
          parsedSCAMethods: {},
          targetFlow: params.targetFlow || 'any',
          targetStep: params.targetStep || params.step || null,
          targetParams: params.targetParams || params.params || {},

          async loadStep(step) {
            const response = await fetch(`./bundles/flows/login/templates/${step}.html`);
            targetElement.innerHTML = await response.text();
          },

          loginUser(loginIdArg) {
            const id = (loginIdArg || "").trim();
            const target = state.targetFlow || 'any'; // 'business', 'email', 'any'

            console.log(`Login: Attempting login for: "${id}" (Target: ${target})`);

            // 1. Privileged Backoffice Login
            if (id.toLowerCase() === "dd") {
              console.log("Login: Privileged access granted for 'dd'");
              if (!sessionSvc.scopedUsers) sessionSvc.scopedUsers = {};
              sessionSvc.scopedUsers['global'] = { 
                id: 'dd', 
                firstname: 'Daniel Daniela', 
                lastname: '(Admin)',
                capabilities: ['superuser', 'admin']
              };
              targetElement.dispatchEvent(
                new CustomEvent("shell-launch-flow", {
                  detail: { id: "backoffice-web" },
                  bubbles: true,
                }),
              );
              return;
            }

            if (target === 'backoffice-web') {
              console.log("Login: Non-privileged user rejected for Backoffice gate.");
              alert("Unauthorized: Only the superuser 'dd' can access the Backoffice.");
              return;
            }

            // 2. License-based resolution has moved to launch scope (licSvc)

            // 1. Check License Registry (Business/Licensed users)
            const foundLicense = (licSvc.getLicenses()?.LICENSES || []).find(lic =>
              (lic.USERS || []).some(u => 
                String(u.id) === String(id) || 
                (u.alias && u.alias.toLowerCase() === id.toLowerCase())
              )
            );
            const foundUser = foundLicense
              ? foundLicense.USERS.find(u => 
                  String(u.id) === String(id) || 
                  (u.alias && u.alias.toLowerCase() === id.toLowerCase())
                )
              : null;

            if (foundUser) {
              if (target === 'email') {
                console.log("Login: Rejected business account in email gate.");
                alert("This account is for the Business Portal. Please use your Email address for Web Mail.");
                return;
              }

              // 5. Handle 'open' strategy or 'skipSCA' focus
              if (foundUser.scaStrategy === 'open' || (params.skipSCA && foundUser.scaStrategy === 'bootstrap')) {
                console.log(`Login: SCA bypass approved for ${foundUser.id} (skipSCA: ${params.skipSCA})`);
                if (foundUser.scaStrategy === 'open') {
                   foundUser.scaStrategy = 'bootstrap';
                   if (licSvc.setLicenses) {
                     const licenses = licSvc.getLicenses();
                     licSvc.setLicenses(licenses); 
                   }
                }
                
                this.pendingLoginUser = { ...foundUser, licenseId: foundLicense.id };
                this.pendingFlowId = "business-channel-web"; // Default
                this.completeLoginWithSCA("auto-login-bypass");
                return;
              }

              // 3. Prepare for SCA step
              state.pendingLoginUser = { ...foundUser, licenseId: foundLicense.id };

              // Determine target flow
              const userChannel = foundUser.channel;
              const licChannel = foundLicense.channel;
              const effectiveChannels = Array.isArray(userChannel)
                ? userChannel
                : userChannel
                ? [userChannel]
                : [licChannel];

              if (
                effectiveChannels.includes("retail") &&
                !effectiveChannels.includes("business")
              ) {
                state.pendingFlowId = "user-home-retail";
              } else if (effectiveChannels.includes("business")) {
                state.pendingFlowId = "business-channel-web";
              } else {
                state.pendingFlowId = state.currentChannel === "business"
                  ? "business-channel-web"
                  : "user-home-retail";
              }

              // Dispatch to generic signing flow
              console.log("Login: Redirecting to standalone signing flow for:", foundUser.alias || foundUser.id);
              
              const isBusinessPortal = !!document.getElementById('portal-root-container');
              const isRetailPortal = !!document.getElementById('retail-root-container');
              const isSubflow = !!document.getElementById('business-subflow-container');
              const eventName = isBusinessPortal ? 'business-portal-launch' : (isRetailPortal ? 'retail-portal-launch' : (isSubflow ? 'business-launch-flow' : 'shell-launch-flow'));

              targetElement.dispatchEvent(
                  new CustomEvent(eventName, {
                      detail: { 
                          id: 'signing', 
                          params: { 
                              signee: foundUser,
                              summaryHtml: `<div class="p-3 bg-white rounded border border-gray-100 shadow-sm text-center">
                                  <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full mb-2">
                                    <i class="fas fa-sign-in-alt text-xl"></i>
                                  </div>
                                  <p class="text-sm font-semibold mb-1">Login Request</p>
                                  <p class="text-xs text-gray-500">Authenticating as: <b>${foundUser.alias || foundUser.id}</b></p>
                              </div>`,
                              actionTitle: 'Secure Login',
                              onSuccess: { 
                                  action: 'complete-login-sca', 
                                  flow: 'login', 
                                  pendingFlowId: state.pendingFlowId,
                                  targetFlow: state.targetFlow,
                                  targetStep: state.targetStep,
                                  targetParams: state.targetParams,
                                  pendingLoginUser: foundUser
                              },
                              onCancel: { flow: 'login', step: 'dashboard' }
                          } 
                      },
                      bubbles: true
                  })
              );
            } else {
              // 4. Fallback: Check Person Registry for Email Login
              console.log("Login: License lookup failed, checking Person Registry for email:", id);
              const persons = _persSvc.getPersons() || [];
              const personByEmail = persons.find(p => (p.emails || []).includes(id));

              if (personByEmail) {
                if (target === 'business') {
                  console.log("Login: Rejected email account in business gate.");
                  alert("This account only has access to Web Mail. Please log in with a business ID for the Portal.");
                  return;
                }
                console.log("Login: Email match found in Person Registry. User:", personByEmail.firstname);
                state.pendingLoginUser = { ...personByEmail, scope: 'email-only' };
                state.pendingFlowId = "email-client"; // Default to email client for email login
                
                // For simplicity, we skip SCA for direct email login in this prototype
                state.completeLoginWithSCA("email-pre-verified");
              } else {
                console.log("Login: Account not found in any registry.");
                alert("Account not found: " + id);
              }
            }
          },

          completeLoginWithSCA(methodId) {
            console.log(
              "Login: SCA completed via:",
              methodId,
              "Redirecting to:",
              this.pendingFlowId,
            );
            
            // Re-resolve sessionSvc to be sure
            const sessionRef = context.getServiceReference(SESSION_SERVICE);
            const sessionSvc = sessionRef ? context.getService(sessionRef) : { currentUser: null };
            
            // Determine the final redirect flow
            let redirectId = state.pendingFlowId;
            let redirectStep = state.targetStep;
            const redirectParams = state.targetParams;

            if (this.pendingLoginUser?.scaStrategy === 'bootstrap' && state.targetFlow !== 'business-channel-web') {
                console.log("Login: Bootstrap admin detected. Redirecting to Business Portal (Standard Journey).");
                redirectId = 'business-channel-web';
                redirectStep = 'user-home-business';
                // Ensure the license is selected
                if (selSvc) selSvc.setSelection({ currentLicenseId: this.pendingLoginUser.licenseId }, 'business');
            } else if (state.targetFlow && state.targetFlow !== 'any' && state.targetFlow !== 'business' && state.targetFlow !== 'email') {
                redirectId = state.targetFlow;
            }

            // sessionSvc.currentUser = this.pendingLoginUser; // Master fallback
            const scope = redirectId || 'global';
            if (!sessionSvc.scopedUsers) sessionSvc.scopedUsers = {};
            
            // Use a shallow copy to ensure session enrichment (capabilities) doesn't stain the master object
            sessionSvc.scopedUsers[scope] = { ...this.pendingLoginUser };
            console.log(`Login: Session established for scope [${scope}]`);

            // Enrich with capabilities if available
            const evalRef = context.getServiceReference(EVAL_DATA_SERVICE);
            const evalSvc = evalRef ? context.getService(evalRef) : null;
            if (evalSvc && sessionSvc.scopedUsers[scope]) {
                const userObj = sessionSvc.scopedUsers[scope];
                const userId = userObj.id || Object.keys(userObj || {})[0];
                const capabilities = evalSvc.getFlattenedCapabilities(userId);
                userObj.capabilities = capabilities;
                console.log("Login: Enriched session for user:", userId, "with capabilities:", capabilities);
            }
            
            targetElement.dispatchEvent(
              new CustomEvent("shell-launch-flow", {
                detail: { 
                    id: redirectId,
                    step: redirectStep,
                    params: redirectParams
                },
                bubbles: true,
              }),
            );
          },

          selectFlow(id, step = null, params = {}) {
            if (id === "login") {
              state.loadStep(step || "dashboard");
              return;
            }
            if (id === "real-life" && sessionSvc.environment === "web-browser") {
                targetElement.dispatchEvent(new CustomEvent("shell-launch-flow", { detail: { id: "web-springboard" }, bubbles: true }));
                return;
            }
            targetElement.dispatchEvent(
              new CustomEvent("shell-launch-flow", {
                detail: { id, step, params },
                bubbles: true,
              }),
            );
          },
        });

        targetElement._x_dataStack = [state];

        // Process callbacks from standalone flows
        if (params?.action === 'complete-login-sca') {
            state.pendingFlowId = params.pendingFlowId;
            state.targetFlow = params.targetFlow;
            state.targetStep = params.targetStep;
            state.targetParams = params.targetParams;
            state.pendingLoginUser = params.pendingLoginUser;
            state.completeLoginWithSCA(params.methodId);
        } else {
            if (params?.step) {
                await state.loadStep(params.step);
            } else {
                await state.loadStep("dashboard");
            }
            
            if (params?.loginId) {
                state.loginForm.identifier = params.loginId;
                // Use setTimeout to ensure Alpine has finished rendering if we just switched to dashboard
                setTimeout(() => state.loginUser(params.loginId), 100);
            }
        }
      }
    };

    context.registerService(FLOW_SERVICE, flowMetadata, { "flow.id": "login" });
  }
}
