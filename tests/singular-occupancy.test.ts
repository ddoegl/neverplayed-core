import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { BEING_SERVICE, SESSION_SERVICE } from "core-types";

async function main() {
    console.log("🧬 Starting Singular Spatial Occupancy & Perspectival Shunts Integration Test...");
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
        "bundles/org.neverplayed.stratum-core/manifest.json"
    ]);

    // Wait for services to settle
    await new Promise<void>(r => setTimeout(r, 500));

    // Get instances of our target services
    // deno-lint-ignore no-explicit-any
    const session: any = await harness.getService(SESSION_SERVICE);
    // deno-lint-ignore no-explicit-any
    const beingService: any = await harness.getService(BEING_SERVICE);

    assertExists(session, "Session service should be available");
    assertExists(beingService, "Being service should be available");

    // Register a standard Being so we can test synthesis
    beingService.registerBeings([
        {
            id: "rob",
            label: "Rob Physical",
            email: "rob@cli.local",
            initial: {
                surrogate: "observer"
            }
        }
    ]);

    const targetScope = "org.neverplayed.realm.habitat";

    // -------------------------------------------------------------
    // Test Case 1: Standard Login (Physical Presence)
    // -------------------------------------------------------------
    console.log("🧪 Test 1: Logging in as naked baseline 'rob' in platonic lobby...");
    await session.login("rob", "platonic");

    console.log("🧪 Test 1.5: Logging in as naked baseline 'rob' in spatial scope...");
    await session.login("rob", targetScope);
    
    const stack = session.scopedUsers[targetScope];
    assertExists(stack, "Stack for target scope must exist");
    
    // Assert exactly one active user in the stack
    const occupants = Object.keys(stack).filter(key => key !== 'guest' && key !== '__activeId__');
    assertEquals(occupants.length, 1, "Should have exactly one occupant");
    assertEquals(occupants[0], "rob", "Occupant must be 'rob'");
    assertEquals(stack.__activeId__, "rob");
    assertEquals(session.activeBeingId, "rob", "Active focus should be baseline 'rob'");

    const stratum: any = await harness.getService("org.neverplayed.stratum.StratumService");
    assertExists(stratum, "Stratum service should be available");
    assertEquals(stratum.identityId, "rob", "Stratum identity ID should reflect physical 'rob' baseline");

    // -------------------------------------------------------------
    // Test Case 2: Somatic Mind Shunt (being:rob)
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Toggling Mind Shunt (being:rob) in same spatial scope...");
    await session.login("being:rob", targetScope);

    const stackAfterBeing = session.scopedUsers[targetScope];
    const occupantsAfterBeing = Object.keys(stackAfterBeing).filter(key => key !== 'guest' && key !== '__activeId__');
    
    assertEquals(occupantsAfterBeing.length, 1, "Should STILL have exactly one occupant after prefix login");
    assertEquals(occupantsAfterBeing[0], "rob", "Physical presence key must remain the raw base ID 'rob'");
    assertEquals(stackAfterBeing.__activeId__, "rob", "Active resident key must remain raw 'rob'");
    
    // Viewport focus shifted
    assertEquals(session.activeBeingId, "being:rob", "Cognitive focus should shift to viewport shunt 'being:rob'");
    assertEquals(stratum.identityId, "being:rob", "Stratum identity ID should reflect 'being:rob' shunt");

    // -------------------------------------------------------------
    // Test Case 3: Grounding DECUPLED and Orthogonal
    // -------------------------------------------------------------
    console.log("🧪 Test 3: Verifying Grounding Orthogonality (decoulped from prefixes)...");
    
    // Shift grounding to realist
    session.shiftGrounding("realist", targetScope);
    assertEquals(session.currentUser.grounding, "realist", "Grounding should shift to realist");
    assertEquals(session.activeBeingId, "being:rob", "Viewport focus remains 'being:rob'");

    // Shift grounding to idealist
    session.shiftGrounding("idealist", targetScope);
    assertEquals(session.currentUser.grounding, "idealist", "Grounding should shift to idealist");
    assertEquals(session.activeBeingId, "being:rob", "Viewport focus remains 'being:rob'");

    // -------------------------------------------------------------
    // Test Case 4: Perspectival Body Shunt (realm:rob)
    // -------------------------------------------------------------
    console.log("🧪 Test 4: Toggling Body Shunt (realm:rob) in same spatial scope...");
    await session.login("realm:rob", targetScope);

    const stackAfterRealm = session.scopedUsers[targetScope];
    const occupantsAfterRealm = Object.keys(stackAfterRealm).filter(key => key !== 'guest' && key !== '__activeId__');

    assertEquals(occupantsAfterRealm.length, 1, "Should STILL have exactly one occupant");
    assertEquals(occupantsAfterRealm[0], "rob", "Physical presence key remains raw 'rob'");
    assertEquals(session.activeBeingId, "realm:rob", "Viewport focus shifted to 'realm:rob'");
    assertEquals(stratum.identityId, "realm:rob", "Stratum identity ID should reflect 'realm:rob' shunt");

    console.log("✅ Singular spatial occupancy and independent shunting verified.");

    // Restore fetch
    globalThis.fetch = originalFetch;
    await harness.stop();
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
