import { FLOW_SERVICE, SESSION_SERVICE, EMAIL_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
    start(context) {
        const state = Alpine.reactive({
            currentStep: "dashboard",
            emails: [],
            selectedEmail: null,
            emailService: null,
            session: null,

            async loadStep(stepId) {
                let actualId = stepId || "dashboard";
                
                // Guard: If not logged in, force login step
                if (!this.session?.currentUser && actualId !== 'login') {
                    console.log("Email Client: Unauthenticated - forcing login gate");
                    actualId = 'login';
                } else if (this.session?.currentUser && actualId === 'login') {
                    console.log("Email Client: Already authenticated - redirecting to dashboard");
                    actualId = 'dashboard';
                }

                this.currentStep = actualId;

                if (actualId === 'login') {
                    this.targetElement.innerHTML = `<div id="email-login-container" class="h-full flex">
                        <div class="bg-white pt-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md">
                            <h2 class="text-2xl font-bold text-slate-800 mt-8 mx-16 mb-6 flex items-center gap-3">
                                <i class="fas fa-envelope text-rose-500"></i>
                                Web Mail Login
                            </h2>
                             
                                <div id="email-login-flow-mount" class="overflow-hidden"></div>
                        </div>
                    </div>`;
                    
                    const loginFlow = (this.availableFlows || []).find(f => f.id === 'login');
                    if (loginFlow) {
                        loginFlow.launch(document.getElementById("email-login-flow-mount"), { targetFlow: 'email' });
                    }
                    return;
                }

                const response = await fetch(`./bundles/user-clients/email-client/templates/${actualId}.html`);
                const html = await response.text();
                this.targetElement.innerHTML = html;

                if (actualId === 'dashboard') {
                    this.refreshInbox();
                }
            },

            refreshInbox() {
                if (!this.emailService) return;

                console.log("Email Client: Refreshing inbox. Current session user:", this.session?.currentUser);
                let resolveEmail = this.session?.currentUser?.email;

                // Robust Resolution: If user has no email in session, look up by ID in Person Registry
                if (!resolveEmail && this.session?.currentUser && this.personsSvc) {
                    const userId = this.session.currentUser.id || (typeof this.session.currentUser === 'object' ? Object.keys(this.session.currentUser)[0] : this.session.currentUser);
                    console.log("Email Client: Attempting resolution for userId:", userId);
                    const person = (this.personsSvc.getPersons() || []).find(p => p.id === userId || (p.userids || []).includes(userId));
                    if (person && person.emails && person.emails.length > 0) {
                        resolveEmail = person.emails[0];
                        console.log("Email Client: Resolved email from Person Registry:", resolveEmail, "for user:", userId);
                    } else {
                        console.log("Email Client: Resolution failed in Person Registry for:", userId);
                    }
                }

                if (resolveEmail) {
                    console.log("Email Client: Refreshing inbox for:", resolveEmail);
                    this.emails = this.emailService.getInbox(resolveEmail);
                } else {
                    console.log("Email Client: Could not resolve email address for current user.");
                    this.emails = [];
                }
            },

            viewEmail(email) {
                this.selectedEmail = email;
                this.loadStep("detail");
            },

            formatDate(iso) {
                return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        });

        // Track Persons (for email resolution)
        context.trackService(`(objectClass=infrastructure.persons.data)`, {
            addingService: (ref) => {
                state.personsSvc = context.getService(ref);
                state.refreshInbox();
            },
            removedService: () => { state.personsSvc = null; }
        }).open();

        // Track all flows (to find 'login')
        state.availableFlows = [];
        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
            addingService: (ref) => {
                const service = context.getService(ref);
                const id = ref.getProperty("flow.id");
                if (id && !state.availableFlows.find(f => f.id === id)) {
                    state.availableFlows.push({ ...service, id });
                    // If we are waiting for login, refresh
                    if (state.currentStep === 'login') state.loadStep('login');
                }
            },
            removedService: (ref) => {
                const id = ref.getProperty("flow.id");
                state.availableFlows = state.availableFlows.filter(f => f.id !== id);
                context.ungetService(ref);
            }
        }).open();

        // Track Session
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                state.session = context.getService(ref);
                if (state.session.currentUser && state.currentStep === 'login') {
                    state.loadStep('dashboard');
                } else {
                    state.refreshInbox();
                }
            },
            removedService: () => { state.session = null; }
        }).open();

        // Track Email Service
        context.trackService(`(objectClass=${EMAIL_SERVICE})`, {
            addingService: (ref) => {
                state.emailService = context.getService(ref);
                state.refreshInbox();
            },
            removedService: () => { state.emailService = null; }
        }).open();

        // Listen for live updates
        globalThis.addEventListener('email-received', () => {
             state.refreshInbox();
        });

        const flowMetadata = {
            id: "email-client",
            title: "Email",
            icon: "fas fa-envelope",
            launch: async (targetElement) => {
                state.targetElement = targetElement;
                targetElement._x_dataStack = [state];
                await state.loadStep(state.currentStep);
            }
        };

        context.registerService(FLOW_SERVICE, flowMetadata, { 
            "flow.id": "email-client",
            "flowType": "service-flow"
        });

    }

    stop(_context) {}
}
