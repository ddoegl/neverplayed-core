import { INTERFACE_KEY as PM_INTERFACE_KEY } from "https://esm.sh/@pandino/persistence-manager-api@0.8.33";

export default class Activator {
    start(context) {
        const EMAIL_STORAGE_PID = "prototyper.email.storage";

        context.trackService(`(objectClass=${PM_INTERFACE_KEY})`, {
            addingService: (ref) => {
                const pm = context.getService(ref);
                const emailData = pm.load(EMAIL_STORAGE_PID) || { emails: [] };
                console.log(`Email Data Store: Loaded ${emailData.emails.length} emails from storage.`);

                const dataService = {
                    getEmails: () => emailData.emails,
                    addEmail: (email) => {
                        email.id = "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
                        email.timestamp = email.timestamp || new Date().toISOString();
                        console.log(`Email Data Store: Adding email [${email.id}] to: ${email.to}`);
                        emailData.emails.unshift(email);
                        pm.store(EMAIL_STORAGE_PID, emailData);
                        return email;
                    },
                    clear: () => {
                        console.log("Email Data Store: Clearing all emails.");
                        emailData.emails = [];
                        pm.store(EMAIL_STORAGE_PID, emailData);
                    }
                };

                context.registerService("prototyper.email.data", dataService);
                console.log("Email Data Store registered.");
            }
        }).open();
    }

    stop(_context) {}
}
