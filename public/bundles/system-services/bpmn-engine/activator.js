import { BPMN_ENGINE_SERVICE } from "../../../shared-types.js";

export default class Activator {
  start(context) {

    /**
     * Micro BPMN 2.0 Execution Engine
     * Parses BPMN XML via DOMParser and executes a single-token process.
     * Supports: StartEvent, EndEvent, UserTask, ServiceTask, ExclusiveGateway, SequenceFlow.
     */
    const BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

    function parseBpmn(xmlString) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "application/xml");
      const process = doc.getElementsByTagNameNS(BPMN_NS, "process")[0]
                   || doc.querySelector("process");

      if (!process) throw new Error("BPMN: No <process> element found in definition.");

      const nodes = {};
      const flows = {};

      // Parse all flow elements
      for (const el of process.children) {
        const localName = el.localName;
        const id = el.getAttribute("id");
        if (!id) continue;

        if (["startEvent","endEvent","userTask","serviceTask","exclusiveGateway","parallelGateway"].includes(localName)) {
          nodes[id] = {
            id,
            type: localName,
            name: el.getAttribute("name") || id,
            outgoing: [...el.querySelectorAll(":scope > outgoing")].map(o => o.textContent.trim()),
            incoming: [...el.querySelectorAll(":scope > incoming")].map(i => i.textContent.trim()),
            // For UserTask: extract form fields from extension elements
            formFields: [...el.querySelectorAll("formField")].map(f => ({
              id: f.getAttribute("id"),
              label: f.getAttribute("label") || f.getAttribute("id"),
              type: f.getAttribute("type") || "string",
              defaultValue: f.getAttribute("defaultValue") || ""
            })),
            // For ServiceTask: handler reference
            handlerRef: el.getAttribute("camunda:expression")
                     || el.getAttributeNS("http://camunda.org/schema/1.0/bpmn","expression")
                     || el.getAttribute("implementation") || null
          };
        } else if (localName === "sequenceFlow") {
          const condEl = el.querySelector("conditionExpression");
          flows[id] = {
            id,
            source: el.getAttribute("sourceRef"),
            target: el.getAttribute("targetRef"),
            name: el.getAttribute("name") || null,
            condition: condEl ? condEl.textContent.trim() : null
          };
        }
      }

      const startNode = Object.values(nodes).find(n => n.type === "startEvent");
      if (!startNode) throw new Error("BPMN: No startEvent found.");

      return { nodes, flows, startNodeId: startNode.id };
    }

    // Simple condition evaluator: supports ${varName === 'value'} and ${varName == true} etc.
    function evalCondition(expression, variables) {
      if (!expression) return true;
      try {
        // Strip BPMN ${...} wrapper
        const expr = expression.replace(/^\$\{|\}$/g, "").trim();
        // Evaluate with variables in scope
        const fn = new Function(...Object.keys(variables), `return !!(${expr});`);
        return fn(...Object.values(variables));
      } catch(e) {
        console.warn("BPMN Engine: condition eval failed:", expression, e);
        return false;
      }
    }

    class ProcessInstance {
      constructor(id, definition, serviceHandlers) {
        this.id = id;
        this.definition = definition;
        this.serviceHandlers = serviceHandlers; // Map<handlerRef, fn(vars)>
        this.currentNodeId = null;
        this.variables = {};
        this.status = "idle"; // idle | running | waiting | complete | error
        this.history = [];    // [{nodeId, nodeName, type, ts}]
        this._listeners = {}; // event -> [fn]
      }

      on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
        return this;
      }

      emit(event, payload) {
        (this._listeners[event] || []).forEach(fn => fn(payload));
      }

      async start(initialVariables = {}) {
        this.variables = { ...initialVariables };
        this.status = "running";
        this.emit("process:start", { instanceId: this.id, variables: this.variables });
        await this._advance(this.definition.startNodeId);
      }

      // Called by the UI to complete a UserTask
      async completeUserTask(outputVariables = {}) {
        if (this.status !== "waiting") {
          console.warn("BPMN Engine: completeUserTask called but not waiting.");
          return;
        }
        Object.assign(this.variables, outputVariables);
        this.status = "running";
        const node = this.definition.nodes[this.currentNodeId];
        this.emit("task:complete", { nodeId: node.id, variables: this.variables });
        await this._followOutgoing(node);
      }

      async _advance(nodeId) {
        const node = this.definition.nodes[nodeId];
        if (!node) throw new Error(`BPMN Engine: node not found: ${nodeId}`);

        this.currentNodeId = nodeId;
        this.history.push({ nodeId, nodeName: node.name, type: node.type, ts: Date.now() });
        this.emit("token:moved", { nodeId, node, variables: this.variables, history: this.history });

        if (node.type === "startEvent") {
          await this._followOutgoing(node);

        } else if (node.type === "endEvent") {
          this.status = "complete";
          this.emit("process:complete", { instanceId: this.id, variables: this.variables, history: this.history });

        } else if (node.type === "userTask") {
          this.status = "waiting";
          this.emit("task:user", {
            instanceId: this.id,
            nodeId: node.id,
            nodeName: node.name,
            formFields: node.formFields,
            variables: this.variables
          });
          // Execution pauses here; resumes via completeUserTask()

        } else if (node.type === "serviceTask") {
          this.status = "running";
          this.emit("task:service", { nodeId: node.id, nodeName: node.name, variables: this.variables });
          try {
            const handler = this.serviceHandlers.get(node.handlerRef) || this.serviceHandlers.get(node.id);
            if (handler) {
              const result = await handler(this.variables);
              if (result && typeof result === "object") Object.assign(this.variables, result);
            } else {
              console.warn(`BPMN Engine: No handler for serviceTask [${node.id}] ref=${node.handlerRef}`);
            }
          } catch(e) {
            this.status = "error";
            this.emit("process:error", { nodeId: node.id, error: e });
            return;
          }
          await this._followOutgoing(node);

        } else if (node.type === "exclusiveGateway") {
          // Pick first outgoing flow whose condition is true (or default if none match)
          const candidates = node.outgoing.map(fid => this.definition.flows[fid]).filter(Boolean);
          let chosen = candidates.find(f => f.condition && evalCondition(f.condition, this.variables));
          if (!chosen) chosen = candidates.find(f => !f.condition); // default (no condition)
          if (!chosen && candidates.length > 0) chosen = candidates[0];   // last resort
          if (chosen) {
            await this._advance(chosen.target);
          } else {
            this.status = "error";
            this.emit("process:error", { nodeId, error: new Error("Gateway: no outgoing path matched.") });
          }
        }
      }

      async _followOutgoing(node) {
        if (!node.outgoing || node.outgoing.length === 0) return;
        const flowId = node.outgoing[0]; // single-token: take first outgoing
        const flow = this.definition.flows[flowId];
        if (!flow) { console.error("BPMN Engine: flow not found:", flowId); return; }
        await this._advance(flow.target);
      }
    }

    // The engine service
    let instanceCounter = 0;
    const engine = {
      _serviceHandlers: new Map(), // handlerRef -> async fn(vars) => vars

      registerHandler(ref, fn) {
        this._serviceHandlers.set(ref, fn);
        console.log("BPMN Engine: Handler registered:", ref);
      },

      createInstance(bpmnXml, initialVariables = {}) {
        const definition = parseBpmn(bpmnXml);
        const id = `instance-${++instanceCounter}-${Date.now()}`;
        const instance = new ProcessInstance(id, definition, this._serviceHandlers);
        instance._initialVariables = initialVariables;
        console.log("BPMN Engine: Instance created:", id, "definition nodes:", Object.keys(definition.nodes));
        // NOTE: does NOT call start() — caller must attach listeners then call instance.start()
        return instance;
      },

      parseOnly(bpmnXml) {
        return parseBpmn(bpmnXml);
      }
    };

    context.registerService(BPMN_ENGINE_SERVICE, engine);
    console.log("BPMN Engine: Service registered.");
  }

  stop(_context) {
    console.log("BPMN Engine: Stopping.");
  }
}
