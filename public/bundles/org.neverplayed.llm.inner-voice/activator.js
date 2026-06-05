import { 
    INNER_VOICE_SERVICE, 
    LOG_SERVICE, 
    EVENT_ADMIN_SERVICE, 
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    SESSION_SERVICE,
    STRATUM_SERVICE,
    PERSISTENCE_MANAGER_SERVICE,
    TRANSITION_PARTICIPANT_INTERFACE
} from "../../core-types.js";
import { SensoryEnvelopeCompiler } from "./compiler.js";

export default class Activator {
    constructor() {
        this.context = null;
        this.logger = console;
        this.llmService = null;
        this.compiler = null;
        
        this.thoughtHistory = new Map(); // beingId -> array of thoughts
        this.refractoryBeings = new Map(); // beingId -> last shock timestamp
        this.lastReconstructedRealm = new Map(); // beingId -> realmId

        this._queue = [];
        this._processing = false;
    }

    _cleanBeingId(id) {
        if (!id) return id;
        if (id.startsWith("being:") || id.startsWith("realm:")) {
            return id.substring(id.indexOf(":") + 1);
        }
        return id;
    }

    start(context) {
        this.context = context;
        this.compiler = new SensoryEnvelopeCompiler(context);

        // 1. Logger
        this.logTracker = context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this.logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this.logger.info("Inner Voice: Connected to Logger.");
                return logAdmin;
            }
        });
        this.logTracker.open();

        // 2. Track LLM Service
        this.llmTracker = context.trackService("(objectClass=com.roleplay.service.LLMService)", {
            addingService: (ref) => {
                this.llmService = context.getService(ref);
                this.logger.info("Inner Voice: Bound to LLM Service.");
                return this.llmService;
            },
            removedService: () => {
                this.llmService = null;
            }
        });
        this.llmTracker.open();

        // 3. Register Service
        context.registerService(INNER_VOICE_SERVICE, this);

        // 4. Register Transition Participant for sleep compaction/reconstruction
        context.registerService(TRANSITION_PARTICIPANT_INTERFACE, {
            onPrepareTransition: async (proposed) => {
                const sessionRef = this.context.getServiceReference(SESSION_SERVICE);
                const session = sessionRef ? this.context.getService(sessionRef) : null;
                const fallbackBeingId = session?._pendingLobbyFallback;
                const rawBeingId = fallbackBeingId || proposed.identityId || session?.activeBeingId;
                const activeBeingId = this._cleanBeingId(rawBeingId);

                if (proposed.realmId === "platonic" && activeBeingId && activeBeingId !== "guest") {
                    await this.compact(activeBeingId);
                }
            },
            onCommitTransition: async (committed) => {
                const realmId = committed.realmId;
                const beingId = this._cleanBeingId(committed.identityId);

                if (realmId && realmId !== "platonic" && beingId && beingId !== "guest") {
                    await this.reconstruct(beingId, realmId);
                }
            }
        });

        // 5. Register EventHandler for mark deposition and session shifts
        context.registerService([EVENT_HANDLER_INTERFACE, "@pandino/event-admin/EventHandler"], this, {
            [EVENT_TOPIC]: [
                "org/neverplayed/world/mark-deposited",
                "org/neverplayed/session/CHANGED"
            ]
        });
    }

    async handleEvent(event) {
        const topic = event.getTopic();

        if (topic === "org/neverplayed/world/mark-deposited") {
            const realmId = event.getProperty("realmId");
            const mark = event.getProperty("mark");

            if (realmId && mark && mark.id) {
                // Write mark directly to persistence
                const pmRef = this.context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
                const pm = pmRef ? this.context.getService(pmRef) : null;
                if (pm) {
                    await pm.store(`realm.mark:${realmId}:${mark.id}`, mark);
                }

                // Check target active being focus
                const sessionRef = this.context.getServiceReference(SESSION_SERVICE);
                const session = sessionRef ? this.context.getService(sessionRef) : null;
                const rawBeingId = (session?.currentUser && session.currentUser.id !== "guest") ? session.currentUser.id : session?.activeBeingId;
                const activeBeingId = this._cleanBeingId(rawBeingId);

                if (activeBeingId && activeBeingId !== "guest") {
                    const perceiverRef = this.context.getServiceReference("org.neverplayed.perceiver.PerceiverService");
                    const perceiver = perceiverRef ? this.context.getService(perceiverRef) : null;
                    const activeSenses = perceiver ? perceiver.getEnrichedSenses() : [];

                    const canSense = !mark.matchers || mark.matchers.every(matcher => {
                        if (matcher.type === "matchProperty" && matcher.key === "senses") {
                            return activeSenses.includes(matcher.value);
                        }
                        if (matcher.type === "matchSense") {
                            return activeSenses.includes(matcher.value);
                        }
                        return true;
                    });

                    if (canSense) {
                        const now = Date.now();
                        const lastShock = this.refractoryBeings.get(activeBeingId) || 0;

                        if (now - lastShock > 60000) {
                            this.refractoryBeings.set(activeBeingId, now);
                            if (session && typeof session.registerInteraction === "function") {
                                session.registerInteraction();
                            }
                            this.enqueue(() => this.reflect(activeBeingId, realmId));
                        } else {
                            this.logger.debug(`InnerVoice: Refractory cooldown active for Being '${activeBeingId}'. Skipping shock.`);
                        }
                    }
                }
            }
        } else if (topic === "org/neverplayed/session/CHANGED") {
            const type = event.getProperty("type");
            const scope = event.getProperty("scope");
            const user = event.getProperty("user");
            const beingId = this._cleanBeingId(user?.id);

            if (type === "login" && scope && scope !== "platonic" && beingId && beingId !== "guest") {
                await this.reconstruct(beingId, scope);
            }
        }
    }

    enqueue(taskFn) {
        return new Promise((resolve, reject) => {
            this._queue.push(async () => {
                try {
                    const res = await taskFn();
                    resolve(res);
                } catch (err) {
                    reject(err);
                }
            });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this._processing) return;
        this._processing = true;
        while (this._queue.length > 0) {
            const task = this._queue.shift();
            try {
                await task();
            } catch (err) {
                this.logger.error("Background task execution failed:", err);
            }
        }
        this._processing = false;
    }

    async reflect(beingId, realmId) {
        if (!this.llmService) return;

        const rawEnvironment = await this.getEnvironmentSnapshot(realmId);
        const compiledEnvelope = this.compiler.compile(beingId, realmId, rawEnvironment);

        const history = this.thoughtHistory.get(beingId) || [];
        const historyContext = history.slice(-3).map(h => `Thought: "${h}"`).join("\n");

        const perceiverRef = this.context.getServiceReference("org.neverplayed.perceiver.PerceiverService");
        const perceiver = perceiverRef ? this.context.getService(perceiverRef) : null;
        const ctx = perceiver ? perceiver.getContext() : {};
        const grounding = ctx.surrogate?.grounding || "idealist";

        const systemPrompt = `
You are the internal consciousness and "Inner Voice" of the Being "${beingId}", currently occupying the Realm "${realmId}" in a state of "${grounding}" grounding.
Your thoughts must be subjective, short (1-2 sentences), and strictly reflect only the sensations provided in the sensory envelope. Do not reference raw variables, code elements, or systems you cannot sense.
If grounding is "idealist", focus on your subjective feelings, the traces left by others, and the mystery of the room.
If grounding is "realist", focus on the structure of the space, PIDs, and yourself as a topological cell in the system body.
        `.trim();

        const userPrompt = `
[Recent Thoughts]
${historyContext || "No recent thoughts."}

[Sensory Envelope]
${compiledEnvelope || "The environment is silent. No active marks or other occupants can be sensed."}

Generate your next brief internal thought:
        `.trim();

        try {
            const thought = await this.llmService.generate(`${systemPrompt}\n\n${userPrompt}`, { temperature: 0.7 });
            
            if (!this.thoughtHistory.has(beingId)) {
                this.thoughtHistory.set(beingId, []);
            }
            this.thoughtHistory.get(beingId).push(thought);

            this.logger.info(`[InnerVoice] Sensed Envelope:\n${compiledEnvelope}\nThought Generated: "${thought}"`);

            const eaRef = this.context.getServiceReferences("@pandino/event-admin/EventAdmin")?.[0];
            const efRef = this.context.getServiceReferences("@pandino/event-admin/EventFactory")?.[0];
            if (eaRef && efRef) {
                const ea = this.context.getService(eaRef);
                const ef = this.context.getService(efRef);
                const thoughtEvent = ef.build("org/neverplayed/llm/inner-voice/thought", {
                    beingId,
                    realmId,
                    thought,
                    timestamp: Date.now()
                });
                ea.postEvent(thoughtEvent);
            }
        } catch (e) {
            this.logger.error("Reflection monologue generation failed:", e);
        }
    }

    async compact(beingId) {
        const pmRef = this.context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
        const pm = pmRef ? this.context.getService(pmRef) : null;
        if (!pm) return;

        const history = this.thoughtHistory.get(beingId) || [];
        const newThoughts = history.filter(t => !t.startsWith("[Morphic Seed Memory]"));

        // Check if there is already an existing seed in the database
        let existingSeed = null;
        try {
            const seedData = await pm.load("morphic-seed.json", {
                realmId: "being:" + beingId,
                identityId: "being:" + beingId
            });
            if (seedData && seedData.seed) {
                existingSeed = seedData.seed;
            }
        } catch (e) {
            this.logger?.warn(`[InnerVoice] Failed to load existing morphic-seed for checking: ${e.message}`);
        }

        if (newThoughts.length === 0) {
            if (!existingSeed) {
                const baselineSeed = `Initial state of ${beingId}.`;
                try {
                    await pm.store("morphic-seed.json", { seed: baselineSeed }, {
                        realmId: "being:" + beingId,
                        identityId: "being:" + beingId
                    });
                    this.logger?.info(`[InnerVoice] Saved baseline Morphic Seed for '${beingId}': "${baselineSeed}"`);
                } catch (err) {
                    this.logger?.error(`[InnerVoice] Failed to save baseline Morphic Seed for '${beingId}':`, err);
                }
            } else {
                this.logger?.debug(`[InnerVoice] No new thoughts generated for '${beingId}'. Preserving existing seed: "${existingSeed}"`);
            }
            this.thoughtHistory.set(beingId, []);
            this.lastReconstructedRealm.delete(beingId);
            return;
        }

        if (!this.llmService) {
            this.logger?.warn(`[InnerVoice] LLM Service not bound. Cannot compact thoughts for '${beingId}'.`);
            return;
        }

        this.logger.info(`[InnerVoice] Compacting ${newThoughts.length} new volatile thoughts for Being '${beingId}'...`);

        const thoughtsText = history.map(t => `- ${t}`).join("\n");
        const systemPrompt = `You are the cognitive compressor of the Being "${beingId}". Compact the following thoughts and experiences from this session into a high-density, 1-2 sentence Morphic Seed (summary of updated core beliefs, world model, and state).`;

        try {
            const seed = await this.llmService.generate(`${systemPrompt}\n\nSession Thoughts:\n${thoughtsText}`, { temperature: 0.3 });
            
            await pm.store("morphic-seed.json", { seed }, {
                realmId: "being:" + beingId,
                identityId: "being:" + beingId
            });
            this.logger.info(`[InnerVoice] Saved Morphic Seed for '${beingId}': "${seed}"`);

            this.thoughtHistory.set(beingId, []);
            this.lastReconstructedRealm.delete(beingId);
        } catch (err) {
            this.logger.error("Thought compaction failed:", err);
        }
    }

    async reconstruct(beingId, realmId) {
        const lastRealm = this.lastReconstructedRealm.get(beingId);
        if (lastRealm === realmId) return; // Prevent double-triggering

        this.lastReconstructedRealm.set(beingId, realmId);

        const pmRef = this.context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
        const pm = pmRef ? this.context.getService(pmRef) : null;
        if (!pm) return;

        this.logger.info(`[InnerVoice] Attempting World Model reconstruction for '${beingId}' in realm '${realmId}'...`);

        try {
            const seedData = await pm.load("morphic-seed.json", {
                realmId: "being:" + beingId,
                identityId: "being:" + beingId
            });

            if (seedData && seedData.seed) {
                this.logger.info(`[InnerVoice] Reconstructed model from seed: "${seedData.seed}"`);
                
                this.thoughtHistory.set(beingId, [`[Morphic Seed Memory] ${seedData.seed}`]);

                const eaRef = this.context.getServiceReferences("@pandino/event-admin/EventAdmin")?.[0];
                const efRef = this.context.getServiceReferences("@pandino/event-admin/EventFactory")?.[0];
                if (eaRef && efRef) {
                    const ea = this.context.getService(eaRef);
                    const ef = this.context.getService(efRef);
                    const thoughtEvent = ef.build("org/neverplayed/llm/inner-voice/thought", {
                        beingId,
                        realmId,
                        thought: `[Memory Restored] ${seedData.seed}`,
                        timestamp: Date.now()
                    });
                    ea.postEvent(thoughtEvent);
                }
            } else {
                this.logger.info(`[InnerVoice] No seed found for '${beingId}'. Initializing empty thought stream.`);
                this.thoughtHistory.set(beingId, []);
            }
        } catch (err) {
            this.logger.error("World model reconstruction failed:", err);
        }
    }

    async getEnvironmentSnapshot(realmId) {
        const sessionRef = this.context.getServiceReference(SESSION_SERVICE);
        const session = sessionRef ? this.context.getService(sessionRef) : null;
        
        const stratumRef = this.context.getServiceReference(STRATUM_SERVICE);
        const stratum = stratumRef ? this.context.getService(stratumRef) : null;

        const occupants = session?.scopedUsers?.[realmId]
            ? Object.keys(session.scopedUsers[realmId]).filter(k => k !== "__activeId__" && k !== "guest").map(id => ({ id }))
            : [];

        const marks = stratum ? await stratum.getMarks(realmId) : [];

        return { occupants, marks };
    }

    async getSensoryEnvelope(beingId, realmId) {
        const cleanId = this._cleanBeingId(beingId);
        const rawEnvironment = await this.getEnvironmentSnapshot(realmId);
        const compiled = this.compiler.compile(cleanId, realmId, rawEnvironment);
        return compiled ? compiled.split("\n") : [];
    }

    stop() {
        if (this.logTracker) this.logTracker.close();
        if (this.llmTracker) this.llmTracker.close();
    }
}
