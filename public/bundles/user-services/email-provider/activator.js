import { EMAIL_SERVICE } from "shared-types";

export default class Activator {
    start(context) {
        let emailDataSvc = null;
        let emailService = null;

        const registerProviderService = () => {
            if (emailDataSvc && !emailService) {
                emailService = {
                    getInbox: (emailAddress) => {
                        return emailDataSvc.getEmails().filter(e => e.to === emailAddress);
                    },
                    getAllEmails: () => {
                        return emailDataSvc.getEmails();
                    },
                    sendEmail: (email) => {
                        const savedEmail = emailDataSvc.addEmail(email);
                        // Notify listeners
                        globalThis.dispatchEvent(new CustomEvent('email-received', { detail: savedEmail }));
                        return savedEmail;
                    }
                };
                context.registerService(EMAIL_SERVICE, emailService);
                console.log("Email Provider Service registered (using Data Store).");
                
                // Trigger Seeding check once service is ready
                seedWelcomeEmails();
            }
        };

        const seedWelcomeEmails = () => {
            const processPersonsSvc = (personsSvc) => {
                const persons = personsSvc.getPersons() || [];
                persons.forEach(person => {
                    const email = (person.emails && person.emails[0]) || (person.firstname.toLowerCase() + "@example.com");
                    const hasWelcome = emailDataSvc.getEmails().some(e => e.to === email && e.subject.includes("Welcome"));
                    
                    if (!hasWelcome) {
                        emailService.sendEmail({
                            to: email,
                            subject: "Welcome to the Neverplayed!",
                            from: "system@neverplayed.org",
                            body: `Hello ${person.firstname},\n\nWelcome to your new digital existence! You can use this inbox to receive invitations and important notifications.\n\nBest regards,\nThe Universe`
                        });
                    }
                });
            };

            // 1. Check for already registered services
            const refs = context.getServiceReferences("infrastructure.persons.data");
            console.log(`Email Provider: Seeding check. Found ${refs ? refs.length : 0} existing Person Data services.`);
            if (refs) {
                refs.forEach(ref => {
                    const svc = context.getService(ref);
                    processPersonsSvc(svc);
                });
            }

            // 2. Track for future services (or updates)
            context.trackService("(objectClass=infrastructure.persons.data)", {
                addingService: (ref) => {
                    console.log("Email Provider: New Person Data service discovered. Triggering seeding...");
                    const personsSvc = context.getService(ref);
                    processPersonsSvc(personsSvc);
                }
            }).open();
        };

        context.trackService("(objectClass=prototyper.email.data)", {
            addingService: (ref) => {
                console.log("Email Provider: Discovered Email Data Service.");
                emailDataSvc = context.getService(ref);
                registerProviderService();
            }
        }).open();

        // Listen for Invitations via EventAdmin
        context.trackService("(objectClass=@pandino/event-admin/EventAdmin)", {
            addingService: (ref) => {
                console.log("Email Provider: Discovered Event Admin Service.");
                const _eventAdmin = context.getService(ref);
                context.registerService("@pandino/event-admin/EventHandler", {
                    handleEvent: (event) => {
                        const topic = event.getTopic();
                        // In this OSGi implementation, properties are either accessed via getProperty(name)
                        // or they are just keys on the event object itself if it was built via EventFactory.
                        // Based on the logs, 'action' and 'invitation' are direct properties.
                        const action = event.getProperty('action');
                        const invitation = event.getProperty('invitation');

                        console.log("Email Provider: Received event:", topic, { action, invitation });

                        if (topic === 'backoffice/invitations/updated' && (action === 'add' || action === 'addInvitation')) {
                            const inv = invitation;
                            console.log("Email Provider: Translating invitation to email for:", inv.email);
                            
                            if (emailService) {
                                const isOwnerBinding = inv.type === 'owner-binding';
                                const subject = isOwnerBinding 
                                    ? `URGENT: Invitation to become License Owner for ${inv.companyName || 'Universe'}`
                                    : `Invitation from ${inv.companyName || 'Universe'}`;
                                
                                const body = isOwnerBinding
                                    ? `Hi ${inv.firstName || 'there'},\n\nYou have been invited to become the formal **License Holder** for ${inv.companyName || 'Universe'}.\n\nThis is a critical administrative role. Your invitation code is: **${inv.code || inv.id}**\n\nPlease use this code in the retail app to accept ownership and sign-off.`
                                    : `Hi ${inv.firstName || 'there'},\n\nYou have been invited to join ${inv.companyName || 'Universe'}.\n\nYour invitation code is: **${inv.code || inv.id}**\n\nPlease use this code in the portal to accept the invitation.`;

                                emailService.sendEmail({
                                    to: inv.email,
                                    from: "system@neverplayed.org",
                                    subject: subject,
                                    body: body,
                                    data: {
                                        type: 'invitation',
                                        code: inv.code || inv.id,
                                        invitationId: inv.id,
                                        fromId: inv.fromId,
                                        invitationType: inv.type // Pass through the specialized type
                                    }
                                });
                            }
                        }
                    }
                }, { "event.topics": ["backoffice/invitations/updated"] });
            }
        }).open();
    }

    async stop(_context) {}
}
