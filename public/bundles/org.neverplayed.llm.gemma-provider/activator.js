// type.ts (Exported by your api-bundle)
export const LLM_SERVICE = "com.roleplay.service.LLMService";


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
    context.registerService(["org.osgi.service.event.EventHandler", "@pandino/event-admin/EventHandler"], {
      handleEvent(event) {
        if (event.topic === "game/world/event") {
          const payload = event.properties;
          console.log(`[GemmaBundle] Asynchronously reacting to: ${payload.action}`);
          
          // Trigger generation off the back of the event asynchronously
          gemmaService.generate(payload.prompt).then(response => {
            const eaRef = context.getServiceReferences("@pandino/event-admin/EventAdmin")?.[0]
              || context.getServiceReferences("org.osgi.service.event.EventAdmin")?.[0];
            const efRef = context.getServiceReferences("@pandino/event-admin/EventFactory")?.[0]
              || context.getServiceReferences("org.osgi.service.event.EventFactory")?.[0];
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
      "event.topics": ["game/world/event"]
    });
  }

  stop(_context) {
    console.log("[GemmaBundle] Stopping LLM Bundle, cleaning up hooks.");
    // Pandino handles service unregistration automatically upon bundle stop
  }
};