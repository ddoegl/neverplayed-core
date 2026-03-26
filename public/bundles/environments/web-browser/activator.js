import { ENV_SERVICE, FLOW_SERVICE, CONFIG_ADMIN_SERVICE, SESSION_SERVICE } from "shared-types";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    console.log("Activator: Starting web-browser environment...");
    context.registerService(ENV_SERVICE, {
      id: "web-browser",
      name: "Web Browser",
      type: "desktop",
      icon: "fas fa-desktop",
      onActivate: (session) => {
        session.environment = "web-browser";
        console.log("Environment switched to: Web Browser");
      }
    }, { "env.id": "web-browser" });

    context.registerService(FLOW_SERVICE, {
      id: "web-springboard",
      title: "Favorites",
      launch: async (targetElement) => {
        const state = Alpine.reactive({
          availableFlows: [],
          configAdmin: null,
          session: null,

          getManifestChannels(bundle) {
            if (!bundle) return undefined;
            const headers = bundle.getHeaders();
            const configKey = Object.keys(headers).find(k => k.toLowerCase() === 'configuration');
            const configPriming = headers[configKey];
            if (!configPriming) return undefined;

            try {
                const primingData = typeof configPriming === 'string' ? JSON.parse(configPriming) : configPriming;
                return primingData.channels;
            } catch (_e) {
                return undefined;
            }
          },

          isFlowEnabled(id) {
            const flow = this.availableFlows.find(f => f.id === id);
            if (!flow) return false;
            
            const props = this.configAdmin?.getConfiguration(flow.bsn)?.getProperties();
            const manifestChannels = this.getManifestChannels(flow.bundle);
            const storedChannels = props?.channels;

            const channels = (storedChannels !== undefined) ? storedChannels : (manifestChannels !== undefined ? manifestChannels : []);
            
            const channelId = "web-browser";
            return channels.includes(channelId);
          },

          selectFlow(id) {
            targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id }, bubbles: true }));
          }
        });

        // Track Flows
        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
          addingService: (ref) => {
            const service = context.getService(ref);
            const id = ref.getProperty("flow.id");
            if (id && !state.availableFlows.find(f => f.id === id)) {
              state.availableFlows.push({
                ...service,
                id,
                bsn: ref.bundle.getSymbolicName(),
                bundle: ref.bundle
              });
            }
          },
          removedService: (ref) => {
            const id = ref.getProperty("flow.id");
            state.availableFlows = state.availableFlows.filter(f => f.id !== id);
            context.ungetService(ref);
          }
        }).open();

        // Track ConfigAdmin
        context.trackService(`(objectClass=${CONFIG_ADMIN_SERVICE})`, {
          addingService: (ref) => {
            state.configAdmin = context.getService(ref);
            globalThis.addEventListener('config-updated', () => {
              state.availableFlows = [...state.availableFlows];
            });
          }
        }).open();
        
        // Track Session
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
          addingService: (ref) => {
            state.session = context.getService(ref);
          },
          removedService: () => {
            state.session = null;
          }
        }).open();

        targetElement._x_dataStack = [state];
        const response = await fetch("./bundles/environments/web-browser/templates/dashboard.html");
        targetElement.innerHTML = await response.text();
      }
    }, { "flow.id": "web-springboard" });
  }

  stop(_context) {}
}
