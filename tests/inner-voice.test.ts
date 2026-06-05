import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { SESSION_SERVICE, REALM_MANAGER_SERVICE } from "core-types";

const settle = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("🪐 Starting Inner Voice & World Model Compaction Integration Test...");
    const harness = new BundleTestHarness();

    // 1. Initialize harness
    const context = await harness.init() as any;
    assertExists(context, "Harness context should be available");

    // 2. Setup global fetch mock to simulate local Ollama LLM responses and seed configs
    const originalFetch = globalThis.fetch;
    let mockLlmResponse = "I think, therefore I am Daniela.";
    let generateCallCount = 0;

    // deno-lint-ignore no-explicit-any
    globalThis.fetch = async (url: string | URL, init?: any) => {
        const urlStr = url instanceof URL ? url.toString() : url;
        if (urlStr.includes("11434/api/generate")) {
            generateCallCount++;
            return {
                ok: true,
                status: 200,
                json: () => Promise.resolve({ response: mockLlmResponse }),
                text: () => Promise.resolve(JSON.stringify({ response: mockLlmResponse }))
            } as any;
        }
        if (urlStr.includes("realms/index.json") || urlStr.includes("env.json")) {
            return { ok: true, status: 200, json: () => Promise.resolve([]) } as any;
        }
        if (urlStr.includes("habitat/beings.yaml")) {
            const beingsYaml = `
- id: rob
  label: Rob Richter
  email: rob@cli.local
  originRealmId: org.neverplayed.realm.habitat
  initial:
    realm: org.neverplayed.realm.habitat
    surrogate: person
`;
            return { ok: true, status: 200, text: () => Promise.resolve(beingsYaml) } as any;
        }
        if (urlStr.includes("habitat/surrogates.yaml")) {
            const surrogatesYaml = `
- id: person
  label: Person
  senses:
    - ToolUse
    - Language
    - Primordial
    - SelfAwareness
`;
            return { ok: true, status: 200, text: () => Promise.resolve(surrogatesYaml) } as any;
        }
        return originalFetch(url, init);
    };

    try {
        localStorage.clear();

        // 3. Install OSGi bundles
        await harness.installBundles([
            "bundles/org.neverplayed.system-logger/manifest.json",
            "bundles/vendor/org.pandino.event-admin/manifest.json",
            "bundles/org.neverplayed.yaml-service/manifest.json",
            "bundles/org.neverplayed.alpine-bridge/manifest.json",
            "bundles/org.neverplayed.persistence-localstorage/manifest.json",
            "bundles/org.neverplayed.persistence-resolver/manifest.json",
            "bundles/org.neverplayed.persistence-selector/manifest.json",
            "bundles/org.neverplayed.session-service/manifest.json",
            "bundles/org.neverplayed.session-service-dom/manifest.json",
            "bundles/org.neverplayed.realm-manager/manifest.json",
            "bundles/org.neverplayed.stratum-core/manifest.json",
            "bundles/org.neverplayed.perceiver-service/manifest.json",
            "bundles/org.neverplayed.llm.gemma-provider/manifest.json",
            "bundles/org.neverplayed.llm.inner-voice/manifest.json"
        ]);

        await settle(500);

        // 4. Resolve required services
        const session = await harness.getService<any>(SESSION_SERVICE);
        const realmManager = await harness.getService<any>(REALM_MANAGER_SERVICE);
        const innerVoice = await harness.getService<any>("org.neverplayed.llm.InnerVoiceService");
        const eventAdmin = await harness.getService<any>("@pandino/event-admin/EventAdmin");
        const eventFactory = await harness.getService<any>("@pandino/event-admin/EventFactory");

        assertExists(session, "Session service should be available");
        assertExists(realmManager, "Realm Manager service should be available");
        assertExists(innerVoice, "Inner Voice service should be available");
        assertExists(eventAdmin, "EventAdmin service should be available");
        assertExists(eventFactory, "EventFactory service should be available");

        // 5. Register habitat and platonic realms
        realmManager.registerRealm({
            id: "org.neverplayed.realm.habitat",
            title: "Habitat",
            bundles: [],
            seedData: {
                beings: "./realms/data/habitat/beings.yaml",
                surrogates: "./realms/data/habitat/surrogates.yaml"
            }
        });
        realmManager.registerRealm({
            id: "platonic",
            title: "Platonic Lobby",
            bundles: []
        });
        await settle(100);

        // 6. Establish Daniela as Tenant, logged in to Platonic staging lobby, then shunted to Habitat as rob
        console.log("TEST: Establishing daniela as Grounding Soul...");
        session.login({ id: "daniela", email: "daniela@neverplayed.org" }, "platonic");
        session.activeRealmId = "platonic";
        await settle(50);

        session.login(
            { id: "rob", email: "rob@cli.local" },
            "org.neverplayed.realm.habitat",
            { id: "person", label: "Person", senses: ["ToolUse", "Language", "Primordial", "SelfAwareness"] }
        );
        session.activeRealmId = "org.neverplayed.realm.habitat";
        await settle(200);

        // Test Proprioceptive compilation
        console.log("TEST: Verifying Proprioceptive Compilation...");
        const selfMark = {
            id: "mark-self",
            type: "language",
            source: "rob",
            payload: "I am thinking about the code",
            matchers: [{ type: "matchSense", value: "Language" }]
        };
        const pmRef = context.getServiceReference("@pandino/persistence-manager/PersistenceManager");
        const pm = pmRef ? context.getService(pmRef) : null;
        if (pm) {
            await pm.store(`realm.mark:org.neverplayed.realm.habitat:mark-self`, selfMark);
        }

        const compiledEnvelope = await innerVoice.getSensoryEnvelope("rob", "org.neverplayed.realm.habitat");
        console.log("Compiled envelope lines:", compiledEnvelope);
        assert(compiledEnvelope.includes('[Auditory Sensation] I hear the echo of my own voice: "I am thinking about the code"'), "Should translate self-language mark to proprioceptive first-person");
        assert(compiledEnvelope.includes('[Proprioception] I am present in this space.'), "Should compile self-occupancy to proprioceptive presence statement");


        // 7. Test compilation and reflection triggers
        console.log("TEST: Depositing mark to trigger reflection...");
        const mark = {
            id: "mark-1",
            type: "language",
            source: "guest",
            payload: "Whispers of the code",
            matchers: [{ type: "matchSense", value: "Language" }]
        };

        const event = eventFactory.build("org/neverplayed/world/mark-deposited", {
            realmId: "org.neverplayed.realm.habitat",
            mark
        });
        eventAdmin.postEvent(event);
        await settle(300);

                // Verify thought was generated and stored in history
        const robThoughts = innerVoice.thoughtHistory.get("rob");
        assertExists(robThoughts, "Thought history should exist for rob");
        assert(robThoughts.length > 0, "Rob should have generated at least one thought");
        assertEquals(robThoughts[robThoughts.length - 1], "I think, therefore I am Daniela.");
        assertEquals(generateCallCount, 1, "LLM should have been called exactly once");

        // 8. Verify Refractory Dampening: depositing another mark immediately should skip LLM call
        console.log("TEST: Depositing second mark immediately to verify refractory cooldown...");
        const mark2 = {
            id: "mark-2",
            type: "language",
            source: "guest",
            payload: "Echoes in the dark",
            matchers: [{ type: "matchSense", value: "Language" }]
        };
        const event2 = eventFactory.build("org/neverplayed/world/mark-deposited", {
            realmId: "org.neverplayed.realm.habitat",
            mark: mark2
        });
        eventAdmin.postEvent(event2);
        await settle(300);

        assertEquals(generateCallCount, 1, "LLM call count should still be 1 (refractory cooldown active)");

        // 9. Compaction on Sleep: Trigger sleep transition via coordinateTransition
        console.log("TEST: Triggering sleep transition to platonic lobby...");
        mockLlmResponse = "Compacted seed of Rob.";
        await realmManager.coordinateTransition({
            realmId: "platonic",
            identityId: "rob",
            perspective: "idealist",
            aperture: "shell",
            tenantId: "daniela"
        });
        await settle(500);

        // Check if morphic seed was saved to private Being-Realm localstorage key
        const expectedLocalStorageKey = "np:v1:daniela:being:rob:being:rob:morphic-seed.json";
        const seedJsonStr = localStorage.getItem(expectedLocalStorageKey);
        assertExists(seedJsonStr, "Morphic seed should be saved to LocalStorage");
        const seedData = JSON.parse(seedJsonStr);
        assertEquals(seedData.seed, "Compacted seed of Rob.");
        console.log("✅ Compaction verified successfully!");

        // Verify that volatile thought history is cleared
        const robThoughtsAfterCompaction = innerVoice.thoughtHistory.get("rob");
        assertEquals(robThoughtsAfterCompaction.length, 0, "Volatile thought history should be cleared after compaction");

        // 10. Reconstruction on Awakening: Trigger transition back to habitat
        console.log("TEST: Triggering transition back to habitat to trigger reconstruction...");
        await realmManager.coordinateTransition({
            realmId: "org.neverplayed.realm.habitat",
            identityId: "rob",
            perspective: "idealist",
            aperture: "shell",
            tenantId: "daniela"
        });
        await settle(500);

        const robThoughtsAfterReconstruction = innerVoice.thoughtHistory.get("rob");
        assert(robThoughtsAfterReconstruction.length > 0, "Rob should have reconstructed thoughts");
        assertEquals(robThoughtsAfterReconstruction[0], "[Morphic Seed Memory] Compacted seed of Rob.");
        console.log("✅ Reconstruction verified successfully!");

        // 11. Test Empty History / Immediate Logout Seed Conservation & Baseline creation
        console.log("TEST: Verifying baseline seed creation on immediate logout (empty history)...");
        // Establish guest / rob login in habitat, but do not generate any thoughts
        session.login(
            { id: "rob_empty", email: "rob_empty@cli.local" },
            "org.neverplayed.realm.habitat",
            { id: "person", label: "Person", senses: ["ToolUse", "Language", "Primordial", "SelfAwareness"] }
        );
        session.activeRealmId = "org.neverplayed.realm.habitat";
        await settle(200);

        // Volatile history for rob_empty should be empty
        const robEmptyThoughts = innerVoice.thoughtHistory.get("rob_empty") || [];
        assertEquals(robEmptyThoughts.length, 0, "Rob Empty thought history should be empty initially");

        // Immediately logout to platonic
        await realmManager.coordinateTransition({
            realmId: "platonic",
            identityId: "rob_empty",
            perspective: "idealist",
            aperture: "shell",
            tenantId: "daniela"
        });
        await settle(400);

        // Check if baseline morphic seed was created
        const expectedEmptyLocalStorageKey = "np:v1:daniela:being:rob_empty:being:rob_empty:morphic-seed.json";
        const emptySeedJsonStr = localStorage.getItem(expectedEmptyLocalStorageKey);
        assertExists(emptySeedJsonStr, "Baseline Morphic seed should be saved to LocalStorage for empty history");
        const emptySeedData = JSON.parse(emptySeedJsonStr);
        assertEquals(emptySeedData.seed, "Initial state of rob_empty.");
        console.log("✅ Baseline seed creation verified successfully!");

        console.log("\n✨ ALL INNER VOICE INTEGRATION TESTS PASSED! ✨");
        await harness.stop();
        Deno.exit(0);
    } catch (err) {
        console.error("❌ Test failed with uncaught error:", err);
        globalThis.fetch = originalFetch;
        Deno.exit(1);
    }
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
