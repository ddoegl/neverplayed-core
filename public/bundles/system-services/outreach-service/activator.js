import { ACTION_REGISTRY_SERVICE } from "../../../shared-types.js";

export default class Activator {
  start(context) {
    console.log("Outreach Service started.");

    const apiService = async (params) => {
      console.log("OutreachService: Calling API", params);
      const { endpoint, method = "GET", body, headers = {} } = params;
      
      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers
          },
          body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("OutreachService: API Response received", data);
        return data;
      } catch (error) {
        console.error("OutreachService: API Call failed", error);
        throw error;
      }
    };

    // Register as an OSGi service
    context.registerService("prototyper.action.service", {
      execute: apiService
    }, {
      "action.id": "apiService"
    });

    // Self-register metadata for documentation
    context.trackService(`(objectClass=${ACTION_REGISTRY_SERVICE})`, {
        addingService: (ref) => {
            const registry = context.getService(ref);
            registry.register({
                id: 'apiService',
                label: '🧩 Call API Service',
                description: 'Performs a generic API call via the APIService.',
                params: {
                    method: 'HTTP method (GET, POST, etc.)',
                    endpoint: 'API endpoint path.',
                    body: 'Data to send (if POST/PUT).',
                    headers: 'Custom headers object.'
                }
            });
        }
    }).open();

    // Also register in globalThis for backward compatibility/quick access if needed by legacy parts
    if (!globalThis.Services) globalThis.Services = {};
    globalThis.Services.apiService = apiService;
  }

  stop(_context) {
    console.log("Outreach Service stopped.");
    if (globalThis.Services) delete globalThis.Services.apiService;
  }
}
