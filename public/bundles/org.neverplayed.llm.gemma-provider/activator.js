/**
 * @file Activator for org.neverplayed.llm.gemma-provider
 * @module domain/bundles/org.neverplayed.llm.gemma-provider
 *
 * Implements the OSGi Activator for the Gemma LLM provider, exposing
 * the LLM Service and responding asynchronously to game world events.
 */

import { 
    LLM_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_TOPIC
} from "core-types";


class Gemma2Provider {
  ollamaUrl = "http://localhost:11434/api/generate";
  modelName = "gemma4:e2b"; 
  async generate(prompt, options) {
    const response = await fetch(this.ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        prompt: prompt,
        stream: false,
        options: { temperature: options?.temperature ?? 0.8 }
      }),
    });
    
    const data = await response.json();
    return data.response;
  }
}

export default class Activator {
  start(context) {
    console.log("[GemmaBundle] Activating Local LLM Bundle...");
    
    const gemmaService = new Gemma2Provider();

    // 1. Register as an OSGi Service for direct sync calls
    context.registerService(LLM_SERVICE, gemmaService, {
      "model.type": "text",
      "model.name": "gemma4:e2b",
      "service.ranking": 100
    });

    // 2. Consume OSGi EventAdmin style topics (e.g., via Pandino Event Admin bundle)
    // Here we register a whiteboard listener for game events
    context.registerService(EVENT_HANDLER_INTERFACE, {
      handleEvent(event) {
        if (event.topic === "game/world/event") {
          const payload = event.properties;
          console.log(`[GemmaBundle] Asynchronously reacting to: ${payload.action}`);
          
          // Trigger generation off the back of the event asynchronously
          gemmaService.generate(payload.prompt).then(response => {
            const eaRef = context.getServiceReferences(EVENT_ADMIN_SERVICE)?.[0];
            const efRef = context.getServiceReferences(EVENT_FACTORY_SERVICE)?.[0];
            if (eaRef && efRef) {
              const ea = context.getService(eaRef);
              const ef = context.getService(efRef);
              const responseEvent = ef.build("game/llm/response", {
                text: response,
                sourceEventId: payload.id
              });
              ea?.postEvent(responseEvent);
            }
          });
        }
      }
    }, {
      [EVENT_TOPIC]: ["game/world/event"]
    });
  }

  stop(_context) {
    console.log("[GemmaBundle] Stopping LLM Bundle, cleaning up hooks.");
    // Pandino handles service unregistration automatically upon bundle stop
  }
};