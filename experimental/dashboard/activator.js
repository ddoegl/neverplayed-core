import { FLOW_SERVICE, SESSION_SERVICE as _SESSION_SERVICE } from "shared-types";
export default class Activator {
    start(context) {
        const flowMetadata = {
            id: 'dashboard2',
            title: 'Dashboard2',
            // The actual function that renders this flow
            launch: async (targetElement) => {
                // 1. Fetch the Session Service (the 'Elegant' way)
                const sessionRef = context.getServiceReference(_SESSION_SERVICE);
                const session = sessionRef ? context.getService(sessionRef) : null;

                // 2. Resolve template relative to this activator's own location (origin 8009)
                const templateURL = new URL('./templates/view.html', import.meta.url).href;
                const response = await fetch(templateURL);
                targetElement.innerHTML = await response.text();

                // 3. Explicitly bridge the service into the Alpine scope for this element
                // This ensures x-text="session.currentUser.id" works regardless of parent state
                targetElement._x_dataStack = [{ session }];
            }
        };

        // Register this flow so the "Main Menu" or "Router" can find it
        context.registerService(FLOW_SERVICE, flowMetadata, {
            "flow.id": "dashboard2",
            "flowType": "service-flow", // Visible in sidebar; channel visibility controlled by configAdmin
            "channels": ["business-channel-web", "retail-channel-app"]
        });
    }
}