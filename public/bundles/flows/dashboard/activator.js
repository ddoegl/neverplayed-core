import { FLOW_SERVICE, SESSION_SERVICE } from "shared-types";
export default class Activator {
    async start(context) {
        const flowMetadata = {
            id: 'dashboard',
            title: 'Dashboard',
            // The actual function that renders this flow
            launch: async (targetElement) => {
                const response = await fetch('./bundles/flows/dashboard/templates/view.html');
                targetElement.innerHTML = await response.text();
                // Alpine.js will automatically pick up the new x-data
            }
        };

        // Register this flow so the "Main Menu" or "Router" can find it
        context.registerService(FLOW_SERVICE, flowMetadata, { 'flow.id': 'dashboard' });
    }
}