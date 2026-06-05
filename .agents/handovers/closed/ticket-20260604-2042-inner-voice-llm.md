# Handover Ticket: Gemma LLM Inner Voice & World Model Compaction

**Ticket ID:** TICKET-20260604-2042-INNER-VOICE-LLM  
**From:** Cognitive Architect  
**To:** Development Engineer  
**Status:** CLOSED  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Ontological Context & Problem Statement

We want to leverage the local Gemma LLM (`gemma4:e2b`) sandbox to give L1 Beings (like Rob) an **Inner Voice**. The LLM acts as the Being's narrative synthesizer: it reads the Being's sense-filtered exteroceptive inputs (stigmergic traces on the soil) and translates them into a subjective internal world model.

To realize this safely without degrading UI performance or triggering infinite feedback loops under gap-junction somatic coupling, the implementation must incorporate:
1.  **Sense-Filtered Sensory Compiler:** Only inputs matching the Being's active senses (`Language`, `ForensicVision`, `Primordial`) are compiled into its prompt envelope.
2.  **Morphic Seed Compaction:** When the Being falls asleep (attention exhaustion), its session memories are compacted into a high-density Morphic Seed (`morphic-seed.json`) inside its private Being-Realm (its *Interior Castle*). This seed acts as the generative prior to reconstruct the world model upon reawakening.
3.  **Runaway Loop Dampening:** Enforces refractory periods and attenuated shock decay to prevent two coupled Beings from continuously waking each other up in an infinite echo loop of mutual attention shocks.
4.  **Non-Blocking Execution Queue:** Queues LLM calls in a background microtask queue to protect the UI loop.

---

## 2. Technical Objectives

### Objective 1: Implement the Sensory Envelope Compiler
*   **File:** `public/bundles/org.neverplayed.llm.inner-voice/compiler.js` [NEW]
*   **Logic:**
    *   Query `PerceiverService` for the active Being's enriched senses.
    *   Filter occupants and database/DOM marks. A Being can only perceive marks matching its active senses.
    *   Compile visible items into a text-based, structured description (the Sensory Envelope).

### Objective 2: Create the `InnerVoiceService` OSGi Bundle
*   **Files:** 
    *   `public/bundles/org.neverplayed.llm.inner-voice/manifest.json` [NEW]
    *   `public/bundles/org.neverplayed.llm.inner-voice/activator.js` [NEW]
*   **Logic:**
    *   Register the `org.neverplayed.llm.InnerVoiceService` interface.
    *   Track the Ollama `com.roleplay.service.LLMService`.
    *   Register as an EventAdmin `EventHandler` listening to `org/neverplayed/world/mark-deposited` and `org/neverplayed/session/CHANGED`.
    *   Upon trigger, check the active Being focus and lazily evaluate `reflect(beingId)`.

### Objective 3: Implement World Model Compaction & Reconstruction
*   **Logic:**
    *   **Compaction:** Intercept the logout/sleep transition. Before logging out, compile the volatile session thought history, invoke Gemma to summarize it, and save the result as a `morphic-seed.json` string to its private Being-Realm storage: `np://tenant/being:id/being:id/`. Clear the thought history.
    *   **Reconstruction:** Upon dynamic login (ingression), load `morphic-seed.json` if present and feed it to Gemma as the starting cognitive context.

### Objective 4: Implement Runaway Loop Dampening & Refractory Period
*   **Logic:**
    *   **Refractory Phase:** Once shocked back to 100% alertness by an external trace, the Being enters a 60-second refractory period where subsequent environmental updates do not trigger new LLM queries or reset the homeostat.
    *   **Attenuation:** Scale attention shocks by $\Delta E_{shock} = E_{baseline} \cdot 0.5^k$ (where $k$ is the propagation depth).
    *   **Microtask Throttling:** Debounce reflection triggers and run generation tasks sequentially through a background queue.

### Objective 5: Dashboard UI Integration
*   **File:** [dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html)
*   **Logic:**
    *   Under the Somatic HUD pane, render the *Inner Voice Monitor* card.
    *   Display the compiled Sensory Envelope and the active thought stream in a glassmorphic card.

---

## 3. Verification Plan

### Deno Integration Test
*   **File:** `tests/inner-voice.test.ts` [NEW]
*   **Logic:**
    *   Mock fetch to intercept and simulate Ollama model generation calls.
    *   Install the provider and the inner-voice bundles in the test harness.
    *   Post `org/neverplayed/world/mark-deposited` events and assert that:
        1.  The compiler correctly filters marks based on active senses.
        2.  The `InnerVoiceService` triggers a prompt containing the expected Sensory Envelope.
        3.  The refractory period correctly blocks subsequent calls within the refractory window.
        4.  Falling asleep triggers the generation and storage of the `morphic-seed.json`.
    *   Verify the test runs and passes via:
        ```bash
        deno test -A tests/run-all.ts
        ```

### Manual Verification
1.  Enter the `habitat` realm.
2.  Deposit a public text mark (marked with `senses: ["Language"]`).
3.  Observe the *Inner Voice Monitor* HUD card: the mark should show in the Perceptual Envelope, and Gemma should print its internal reflection monologue.
4.  Verify that subsequent rapid updates do not crash performance or loop indefinitely.
