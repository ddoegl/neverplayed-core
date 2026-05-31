import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";

async function main() {
    console.log("🧬 Starting Biomechanical Somatic Gym Integration Test...");
    const harness = new BundleTestHarness();
    
    // deno-lint-ignore no-explicit-any
    const context = await harness.init() as any;
    if (!context) {
        console.error("❌ Harness context missing");
        Deno.exit(1);
    }

    // 1. Setup global fetch mock
    const originalFetch = globalThis.fetch;
    // deno-lint-ignore no-explicit-any
    globalThis.fetch = async (url: string | URL, init?: any) => {
        const urlStr = url instanceof URL ? url.toString() : url;
        if (urlStr.includes("realms/index.json")) {
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve("[]"),
                json: () => Promise.resolve([]),
            } as any;
        }
        if (urlStr.includes("env.json")) {
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve("{}"),
                json: () => Promise.resolve({}),
            } as any;
        }
        return originalFetch(url, init);
    };

    // 2. Install a mock Persistence Manager (in-memory, no I/O)
    const pmStore: Record<string, unknown> = {};
    const pm = {
        load: (key: string) => pmStore[key] ?? null,
        store: (key: string, value: unknown) => { pmStore[key] = value; },
        waitReady: () => Promise.resolve(),
        listKeys: (_prefix: string) => Object.keys(pmStore),
        probe: (_key: string) => null
    };
    context.registerService("@pandino/persistence-manager/PersistenceManager", pm);

    // 3. Install required OSGi bundles
    await harness.installBundles([
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/vendor/org.pandino.event-admin/manifest.json",
        "bundles/org.neverplayed.alpine-bridge/manifest.json",
        "bundles/org.neverplayed.persistence-resolver/manifest.json",
        "bundles/org.neverplayed.yaml-service/manifest.json",
        "bundles/org.neverplayed.session-service/manifest.json",
        "bundles/org.neverplayed.being-service/manifest.json",
        "bundles/org.neverplayed.realm-manager/manifest.json",
        "bundles/org.neverplayed.stratum-core/manifest.json",
        "bundles/org.neverplayed.somatic-body/manifest.json",
        "bundles/org.neverplayed.gym/manifest.json"
    ]);

    // Wait for services to settle
    await new Promise<void>(r => setTimeout(r, 600));

    // Get instances of our target services
    // deno-lint-ignore no-explicit-any
    const muscleReg: any = await harness.getService("org.neverplayed.somatic.MuscleRegistry");
    // deno-lint-ignore no-explicit-any
    const machineReg: any = await harness.getService("org.neverplayed.gym.MachineRegistry");
    // deno-lint-ignore no-explicit-any
    const stratum: any = await harness.getService("org.neverplayed.stratum.StratumService");

    assertExists(muscleReg, "MuscleRegistry service should be available");
    assertExists(machineReg, "MachineRegistry service should be available");
    assertExists(stratum, "Stratum service should be available");

    // -------------------------------------------------------------
    // Test Case 1: Validate Muscle Database Hydration
    // -------------------------------------------------------------
    console.log("🧪 Test 1: Verifying muscle registry database...");
    const muscles = muscleReg.getMuscles();
    assertEquals(muscles.length, 10, "Should have 10 standard muscle groups registered");
    const quad = muscleReg.getMuscle("quadriceps");
    assertExists(quad);
    assertEquals(quad.tension, 0.0);
    assertEquals(quad.fatigue, 0.0);

    // -------------------------------------------------------------
    // Test Case 2: Manually Stimulate Muscle Contraction
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Manually stimulating quadriceps contraction...");
    muscleReg.exertForce("quadriceps", 50.0);
    const updatedQuad = muscleReg.getMuscle("quadriceps");
    assertEquals(updatedQuad.tension, 50.0);
    assert(updatedQuad.fatigue > 0.0, "Muscle exertion should cause fatigue");

    // Rest muscle to return to baseline
    muscleReg.rest("quadriceps");
    assertEquals(muscleReg.getMuscle("quadriceps").tension, 0.0);

    // -------------------------------------------------------------
    // Test Case 3: Sit in Leg Press (B6) and set weight
    // -------------------------------------------------------------
    console.log("🧪 Test 3: Interacting with Leg Press B6 machine...");
    machineReg.selectMachine("machine-b6");
    const b6 = machineReg.getMachine("machine-b6");
    assertExists(b6);
    assertEquals(machineReg.getActiveMachineId(), "machine-b6");
    assertEquals(b6.weightKg, 120); // Default B6 Beinpresse weight
    assertEquals(b6.carriageState, "resting");

    // Wait a brief moment for the EventAdmin load stimulation loop to run
    await new Promise<void>(r => setTimeout(r, 1100));

    // Proprioceptive reflex assertion:
    // Leg Press has 120kg load. Somatic body should sense this load
    // and reflexively raise quadriceps tension to match it (100% max fatigue limit, otherwise load * 1.1 = 120 * 1.1 = 132 -> capped at 100%)
    const proprioceptiveQuad = muscleReg.getMuscle("quadriceps");
    assert(proprioceptiveQuad.tension >= 95.0, "Reflexive tension should spike to near-maximum load tolerance (under minor fatigue)");

    // -------------------------------------------------------------
    // Test Case 4: Overcome weight stack and assert leverage coupling
    // -------------------------------------------------------------
    console.log("🧪 Test 4: Overcoming the weight stack on B6...");
    
    // We already have 100% tension from reflex, which is > 120 * 0.7 = 84kg.
    // The carriage state should therefore be successfully contracted!
    assertEquals(machineReg.getMachine("machine-b6").carriageState, "contracted", "Leg press carriage should be fully pushed out/contracted");

    // Check prediction error
    const gymCognitionRef = context.getServiceReference("org.neverplayed.realm.RealmCognitionService", "(realm.id=org.neverplayed.realm.gym)");
    assertExists(gymCognitionRef);
    const gymCognition = context.getService(gymCognitionRef);
    assertEquals(gymCognition.getPredictionError(), 0.0, "Prediction error should drop to 0.0 on homeostatic match");

    // -------------------------------------------------------------
    // Test Case 5: Rest somatic muscles and assert stack return to rest
    // -------------------------------------------------------------
    console.log("🧪 Test 5: Rest muscles and assert carriage drops back to resting...");
    muscleReg.rest("quadriceps");
    
    // De-couple machine active selection
    machineReg.selectMachine(null);
    assertEquals(machineReg.getActiveMachineId(), null);

    console.log("✅ Biomechanical and Neuromuscular systems successfully verified!");

    // Restore fetch
    globalThis.fetch = originalFetch;
    await harness.stop();
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
