import { FLOW_SERVICE, BPMN_ENGINE_SERVICE } from "../../../shared-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

export default class Activator {
  start(context) {

    // ─── Service Task Handlers ──────────────────────────────────────────────
    // Each handler is a plain async function: (variables) => partialVariables
    // They are registered on the engine by their 'implementation' ref in the BPMN.

    const handlers = {
      "build-greeting": (vars) => {
        const name = vars.name || "World";
        return { builtName: name };
      },
      "formal-greeting": (vars) => {
        return {
          greeting: `Good day, ${vars.builtName}. I trust this finds you well.`,
          greetingStyle: "formal"
        };
      },
      "casual-greeting": (vars) => {
        return {
          greeting: `Hey ${vars.builtName}! 👋 What's up?`,
          greetingStyle: "casual"
        };
      }
    };

    // ─── BPMN XML Loader ────────────────────────────────────────────────────
    async function loadBpmnXml() {
      const res = await fetch("./bundles/flows/hello-bpmn/processes/hello-world.bpmn");
      if (!res.ok) throw new Error("hello-bpmn: Failed to load BPMN file: " + res.status);
      return res.text();
    }

    // ─── Flow Registration ──────────────────────────────────────────────────
    context.registerService(FLOW_SERVICE, {
      id: "hello-bpmn",
      title: "Hello BPMN",
      icon: "fas fa-project-diagram",

      launch: async (targetElement) => {
        console.log("hello-bpmn: Launching flow...");

        // 1. Load template
        const tmplRes = await fetch("./bundles/flows/hello-bpmn/templates/main.html");
        if (!tmplRes.ok) { targetElement.innerHTML = "<p class='p-8 text-red-500'>Template not found</p>"; return; }
        targetElement.innerHTML = await tmplRes.text();

        // 2. Get engine service
        const engineRef = context.getServiceReference(BPMN_ENGINE_SERVICE);
        if (!engineRef) { console.error("hello-bpmn: BPMN_ENGINE_SERVICE not found!"); return; }
        const engine = context.getService(engineRef);

        // Register service task handlers
        Object.entries(handlers).forEach(([ref, fn]) => engine.registerHandler(ref, fn));

        // 3. Build Alpine reactive state
        const state = Alpine.reactive({
          status: "idle",          // idle | running | waiting | complete | error
          currentNodeId: null,
          currentNodeName: null,
          currentFormFields: [],
          formValues: {},
          greeting: null,
          log: [],                 // {icon, text, ts}
          instance: null,
          bpmnXml: null,
          errorMsg: null,

          // Token highlighting: returns the current active node id for the viewer
          get activeNodeId() { return this.currentNodeId; },

          addLog(icon, text) {
            this.log.unshift({ icon, text, ts: new Date().toLocaleTimeString() });
          },

          async startProcess() {
            if (this.status !== "idle") return; // guard against double-fire
            this.status = "running";
            this.log = [];
            this.greeting = null;
            this.errorMsg = null;
            this.addLog("▶", "Process started");

            const xml = this.bpmnXml;
            const instance = await engine.createInstance(xml);
            this.instance = instance;

            instance.on("token:moved", ({ node, variables: _variables }) => {
              this.currentNodeId   = node.id;
              this.currentNodeName = node.name;
              this.addLog("🔵", `Token → ${node.name} [${node.type}]`);
              highlightNode(node.id);
            });

            instance.on("task:user", ({ nodeId, nodeName, formFields }) => {
              this.status          = "waiting";
              this.currentNodeId   = nodeId;
              this.currentNodeName = nodeName;
              this.currentFormFields = formFields;
              this.formValues      = {};
              formFields.forEach(f => { this.formValues[f.id] = f.defaultValue || ""; });
              this.addLog("🟡", `User task: ${nodeName}`);
            });

            instance.on("task:service", ({ nodeName }) => {
              this.addLog("⚙️", `Service task: ${nodeName}`);
            });

            instance.on("task:complete", ({ _nodeId, variables }) => {
              if (variables.greeting) this.greeting = variables.greeting;
            });

            instance.on("process:complete", ({ variables }) => {
              this.status         = "complete";
              this.currentNodeId  = "end";
              this.greeting       = variables.greeting || this.greeting;
              this.addLog("✅", "Process complete!");
              highlightNode("end");
            });

            instance.on("process:error", ({ _nodeId, error }) => {
              this.status   = "error";
              this.errorMsg = error.message;
              this.addLog("❌", "Error: " + error.message);
            });

            // Start AFTER all listeners are registered so no events are missed
            await instance.start();
          },

          async submitTask() {
            if (!this.instance || this.status !== "waiting") return;
            const output = { ...this.formValues };
            this.addLog("✔️", `Task submitted`);
            await this.instance.completeUserTask(output);
          },

          reset() {
            this.status = "idle";
            this.currentNodeId = null;
            this.currentNodeName = null;
            this.currentFormFields = [];
            this.formValues = {};
            this.greeting = null;
            this.log = [];
            this.instance = null;
            this.errorMsg = null;
          }
        });

        // Expose state for x-data="globalThis.helloBpmnState" — no _x_dataStack manipulation needed
        globalThis.helloBpmnState = state;

        // ─── bpmn.js Viewer setup ─────────────────────────────────────────
        let viewer = null;

        async function initViewer(xml) {
          const container = document.getElementById("bpmn-viewer-container");
          if (!container) return;

          // Load bpmn-js viewer from unpkg (UMD)
          if (!globalThis.BpmnJS) {
            await new Promise((resolve, reject) => {
              const s = document.createElement("script");
              s.src = "https://unpkg.com/bpmn-js@17.11.1/dist/bpmn-viewer.development.js";
              s.onload = resolve;
              s.onerror = () => reject(new Error("Failed to load bpmn-js from CDN"));
              document.head.appendChild(s);
            });
          }

          viewer = new globalThis.BpmnJS({ container });
          try {
            await viewer.importXML(xml);
            const canvas = viewer.get("canvas");
            canvas.zoom("fit-viewport");

            // Inject highlight CSS into document head so it applies regardless of mount point
            if (!document.getElementById("bpmn-highlight-styles")) {
              const style = document.createElement("style");
              style.id = "bpmn-highlight-styles";
              style.textContent = `
                .djs-element.highlight-active .djs-visual > rect,
                .djs-element.highlight-active .djs-visual > circle,
                .djs-element.highlight-active .djs-visual > polygon {
                  stroke: #3b82f6 !important;
                  stroke-width: 4px !important;
                  filter: drop-shadow(0 0 8px rgba(59,130,246,0.7));
                }
              `;
              document.head.appendChild(style);
            }

            console.log("hello-bpmn: Viewer loaded OK");
          } catch(e) {
            console.error("hello-bpmn: Viewer import failed:", e);
          }
        }

        function highlightNode(nodeId) {
          if (!viewer) return;
          try {
            const canvas = viewer.get("canvas");
            // Clear previous: find all SVG elements carrying the marker class
            const svgEl = document.querySelector("#bpmn-viewer-container svg");
            if (svgEl) {
              [...svgEl.querySelectorAll(".highlight-active")].forEach(el => {
                const eid = el.getAttribute("data-element-id");
                if (eid) canvas.removeMarker(eid, "highlight-active");
              });
            }
            canvas.addMarker(nodeId, "highlight-active");
          } catch(_e) { /* viewer not ready */ }
        }

        // 4. Load BPMN & init viewer (Alpine handles x-data via globalThis.helloBpmnState)
        try {
          const xml = await loadBpmnXml();
          state.bpmnXml = xml;
          await initViewer(xml);
        } catch(e) {
          state.errorMsg = e.message;
          console.error("hello-bpmn:", e);
        }
      }
    }, {
      "flow.id": "hello-bpmn",
      "flowType": "service-flow",
      "channels": ["business-channel-web"]
    });
  }

  stop(_context) { /* bundle tear-down: engine service is unregistered by Pandino */ }
}
