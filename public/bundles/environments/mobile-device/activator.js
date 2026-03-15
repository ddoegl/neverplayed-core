import { ENV_SERVICE, FLOW_SERVICE, CONFIG_ADMIN_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {
    console.log("Activator: Starting mobile-device environment (Smartphone)...");
    context.registerService(ENV_SERVICE, {
      id: "mobile-device",
      name: "Smartphone",
      type: "mobile",
      icon: "fas fa-mobile-alt",
      onActivate: (session) => {
        session.environment = "mobile-device";
        console.log("Environment switched to: Smartphone");
      }
    }, { "env.id": "mobile-device" });

    context.registerService(FLOW_SERVICE, {
      id: "mobile-launcher",
      title: "Springboard",
      launch: async (targetElement) => {
        const state = Alpine.reactive({
          availableFlows: [],
          configAdmin: null,

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

          get appClients() {
            return this.availableFlows.filter(f => {
                const config = f.bundleConfig || {};
                return config.flowType === 'app-client';
            }).map(f => {
                const clientConfig = f.bundleConfig['client-config'] || {};
                return {
                    id: f.id,
                    title: clientConfig.title || f.title || f.id,
                    icon: clientConfig.icon || f.icon || 'fas fa-cube',
                    color: clientConfig.color || 'blue-500',
                    config: clientConfig
                };
            });
          },

          isFlowEnabled(id, overrideChannelId) {
            const flow = this.availableFlows.find(f => f.id === id);
            if (!flow) return false;
            
            const props = this.configAdmin?.getConfiguration(flow.bsn)?.getProperties();
            const manifestChannels = this.getManifestChannels(flow.bundle);
            const storedChannels = props?.channels;

            // CRITICAL FIX: Empty array means "turned off", so we MUST check for undefined
            const channels = (storedChannels !== undefined) ? storedChannels : (manifestChannels !== undefined ? manifestChannels : []);
            
            // If it's an app-client for mobile-device, it's enabled if it targets mobile-device
            if (flow.bundleConfig?.flowType === 'app-client' && channels.includes('mobile-device')) return true;

            const channelId = overrideChannelId || "retail-channel-app"; 
            return channels.includes(channelId);
          },

          selectFlow(id) {
            // For app-clients, we can just launch them directly
            targetElement.dispatchEvent(new CustomEvent('shell-launch-flow', { detail: { id }, bubbles: true }));
          }
        });

        // Track Flows
        context.trackService(`(objectClass=${FLOW_SERVICE})`, {
          addingService: (ref) => {
            const service = context.getService(ref);
            const id = ref.getProperty("flow.id");
            if (id && !state.availableFlows.find(f => f.id === id)) {
              const headers = ref.bundle.getHeaders();
              const configHeader = headers['Configuration'] || headers['configuration'];
              const bundleConfig = typeof configHeader === 'string' ? JSON.parse(configHeader) : (configHeader || {});

              state.availableFlows.push({
                ...service,
                id,
                bsn: ref.bundle.getSymbolicName(),
                bundle: ref.bundle,
                bundleConfig
              });
            }
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

        targetElement._x_dataStack = [state];
        const response = await fetch("./bundles/environments/mobile-device/templates/dashboard.html");
        targetElement.innerHTML = await response.text();
      }
    }, { "flow.id": "mobile-launcher" });
  }

  stop(_context) {}
}
