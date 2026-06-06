/**
 * @file Activator for org.neverplayed.llm.gemma-showcase
 * @module domain/bundles/org.neverplayed.llm.gemma-showcase
 *
 * Demonstrates synchronous service consumption and asynchronous event-driven
 * whiteboard patterns using the local Gemma 4 model.
 */

import { 
    SHELL_COMMAND_SERVICE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    LLM_SERVICE
} from "core-types";

export default class Activator {
    start(context) {
        this.context = context;
        this.eventAdmin = null;
        this.eventFactory = null;
        this.pendingCliEvents = new Map();
        
        // Track EventAdmin
        this.eventAdminTracker = context.trackService(`(objectClass=${EVENT_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                this.eventAdmin = context.getService(ref);
                return this.eventAdmin;
            },
            removedService: () => { this.eventAdmin = null; }
        });
        this.eventAdminTracker.open();

        // Track EventFactory
        this.eventFactoryTracker = context.trackService(`(objectClass=${EVENT_FACTORY_SERVICE})`, {
            addingService: (ref) => {
                this.eventFactory = context.getService(ref);
                return this.eventFactory;
            },
            removedService: () => { this.eventFactory = null; }
        });
        this.eventFactoryTracker.open();

        // 1. Register CLI command service
        this.commandReg = context.registerService(SHELL_COMMAND_SERVICE, {
            name: "gemma",
            description: "Interact with the local Ollama Gemma 4 LLM",
            execute: async (args, _ctx, log) => {
                const sub = args[0];
                if (sub === "ask") {
                    const prompt = args.slice(1).join(" ");
                    if (!prompt.trim()) {
                        return log("Usage: /gemma ask <prompt>", "error");
                    }
                    log({ text: `🧠 Querying Gemma 4 (Sync service call) with prompt: "${prompt}"...`, color: "cyan" });
                    
                    const llmRef = context.getServiceReference(LLM_SERVICE);
                    if (!llmRef) {
                        return log(`Error: Gemma LLM Service (${LLM_SERVICE}) is not active in this realm.`, "red");
                    }
                    
                    const llm = context.getService(llmRef);
                    try {
                        const response = await llm.generate(prompt);
                        log({ text: `\n✨ Gemma 4 Response:\n`, color: "green", bold: true });
                        log({ text: response, color: "slate" });
                    } catch (e) {
                        log({ text: `Error generating response: ${e.message}`, color: "red" });
                    }
                } else if (sub === "event") {
                    const prompt = args.slice(1).join(" ");
                    if (!prompt.trim()) {
                        return log("Usage: /gemma event <prompt>", "error");
                    }
                    
                    if (!this.eventAdmin || !this.eventFactory) {
                        return log("Error: Event Admin/Factory not available.", "red");
                    }
                    
                    const eventId = `cli-${Math.random().toString(36).substring(7)}`;
                    log({ text: `✉️ Posting game/world/event [ID: ${eventId}] onto event bus...`, color: "cyan" });
                    
                    this.pendingCliEvents.set(eventId, { prompt, log });

                    const event = this.eventFactory.build("game/world/event", {
                        id: eventId,
                        action: "CLI Event Demo",
                        prompt: prompt
                    });
                    this.eventAdmin.postEvent(event);
                } else {
                    log("Usage: /gemma <ask|event> <prompt>");
                }
            }
        });

        // 2. Register EventHandler to display async results from the event bus (whiteboard pattern)
        this.eventHandlerReg = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                const text = event.getProperty("text");
                const sourceId = event.getProperty("sourceEventId");
                
                if (this.pendingCliEvents.has(sourceId)) {
                    const { prompt, log } = this.pendingCliEvents.get(sourceId);
                    this.pendingCliEvents.delete(sourceId);
                    
                    log({ text: `\n📬 Received async Event Response for [ID: ${sourceId}]:`, color: "cyan", bold: true });
                    log({ text: `Original Prompt: "${prompt}"`, color: "gray" });
                    log({ text: `\n✨ Gemma 4 Async Response:\n`, color: "green", bold: true });
                    log({ text: text, color: "slate" });
                } else {
                    console.log(`[GemmaShowcase] Heard game/llm/response: "${text?.substring(0, 50)}..."`);
                }
            }
        }, {
            [EVENT_TOPIC]: ["game/llm/response"]
        });
    }

    stop(_context) {
        if (this.eventAdminTracker) this.eventAdminTracker.close();
        if (this.eventFactoryTracker) this.eventFactoryTracker.close();
        if (this.commandReg) {
            try { this.commandReg.unregister(); } catch(_e) { /* ignore */ }
        }
        if (this.eventHandlerReg) {
            try { this.eventHandlerReg.unregister(); } catch(_e) { /* ignore */ }
        }
    }
}
