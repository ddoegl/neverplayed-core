import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { BEING_SERVICE, SESSION_SERVICE, REALM_COGNITION_SERVICE } from "core-types";

async function main() {
    console.log("🧬 Starting Realm as a Being & TAME Homeostasis Integration Test...");
    const harness = new BundleTestHarness();
    
    // deno-lint-ignore no-explicit-any
    const context = await harness.init() as any;
    if (!context) {
        console.error("❌ Harness context missing");
        Deno.exit(1);
    }

    // 1. Setup global fetch mock to prevent remote network requests during bundle loading
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
        "bundles/org.neverplayed.realm-manager/manifest.json"
    ]);

    // Wait for services and event admin to settle
    await new Promise<void>(r => setTimeout(r, 500));

    // Get instances of our target services
    // deno-lint-ignore no-explicit-any
    const session: any = await harness.getService(SESSION_SERVICE);
    // deno-lint-ignore no-explicit-any
    const beingService: any = await harness.getService(BEING_SERVICE);
    // deno-lint-ignore no-explicit-any
    const realmManager: any = await harness.getService("org.neverplayed.realm.RealmManager");

    assertExists(session, "Session service should be available");
    assertExists(beingService, "Being service should be available");
    assertExists(realmManager, "Realm Manager service should be available");

    // Register org.neverplayed.realm.core realm to activate its cognition service dynamically
    await realmManager.registerRealm({
        id: "org.neverplayed.realm.core",
        title: "Institutional Core Infrastructure",
        bundles: []
    });

    // Retrieve dynamically provisioned cognition service for the core realm specifically
    let cognitionService: any = null;
    const startFind = Date.now();
    while (!cognitionService && Date.now() - startFind < 5000) {
        const refs = context.getServiceReferences(REALM_COGNITION_SERVICE) || [];
        for (const ref of refs) {
            if (ref.getProperty("realm.id") === "org.neverplayed.realm.core") {
                cognitionService = context.getService(ref);
                break;
            }
        }
        if (!cognitionService) await new Promise(r => setTimeout(r, 100));
    }
    assertExists(cognitionService, "Realm Cognition service should be dynamically provisioned for core realm");

    // -------------------------------------------------------------
    // Test Case 1: Dynamic Realm-Being Identity Synthesis
    // -------------------------------------------------------------
    console.log("🧪 Test 1: Verifying dynamic synthesis of realm beings...");
    
    const coreRealmBeing = beingService.getBeing("realm:org.neverplayed.realm.core");
    assertExists(coreRealmBeing, "Synthesized realm being should exist");
    assertEquals(coreRealmBeing.id, "realm:org.neverplayed.realm.core");
    assertEquals(coreRealmBeing.label, "Realm Mind (core)");
    assertEquals(coreRealmBeing.email, "org.neverplayed.realm.core@neverplayed.realm");
    assertEquals(coreRealmBeing.originRealmId, "org.neverplayed.realm.core");
    assertEquals(coreRealmBeing.isRealmBeing, true);
    assert(coreRealmBeing.surrogates.includes("sovereign-guard"), "Should contain sovereign-guard surrogate");
    assert(coreRealmBeing.surrogates.includes("system-collector"), "Should contain system-collector surrogate");

    // Test dynamic synthesis for another/custom realm
    const customRealmBeing = beingService.getBeing("realm:org.neverplayed.realm.custom");
    assertExists(customRealmBeing, "Synthesized custom realm being should exist");
    assertEquals(customRealmBeing.label, "Realm Mind (custom)");
    assertEquals(customRealmBeing.originRealmId, "org.neverplayed.realm.custom");

    // Test getKnownBeings includes realm beings
    const knownBeings = beingService.getKnownBeings();
    const realmBeings = knownBeings.filter((b: any) => b.isRealmBeing);
    assert(realmBeings.length >= 5, "Should include standard synthesized realm beings");
    const foundCore = realmBeings.some((b: any) => b.id === "realm:org.neverplayed.realm.core");
    assert(foundCore, "Known beings list must contain core realm being");

    console.log("✅ Dynamic Realm-Being Identity Synthesis verified.");

    // -------------------------------------------------------------
    // Test Case 2: L1 Being-Driven Homeostasis & Platonic Lobby Fallback
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Verifying L1 individual being homeostasis loop and self-eviction...");

    // Set the active realm on session
    session.activeRealmId = "org.neverplayed.realm.core";

    // Setup EventAdmin references
    const eventAdminRef = context.getServiceReference("@pandino/event-admin/EventAdmin");
    const eventAdmin = context.getService(eventAdminRef);
    const eventFactoryRef = context.getServiceReference("@pandino/event-admin/EventFactory");
    const eventFactory = context.getService(eventFactoryRef);

    // Let's login a resident
    session.login("rob", "org.neverplayed.realm.core");
    const userInStack = session.scopedUsers["org.neverplayed.realm.core"]["rob"];
    assertExists(userInStack, "rob should be in the scoped users stack for org.neverplayed.realm.core");
    assertEquals(userInStack.loggedIn, true, "rob should be logged in");
    assertExists(userInStack.lastActiveTime, "rob should have lastActiveTime set");

    // Artificially make rob stale (31 seconds inactive)
    userInStack.lastActiveTime = Date.now() - 31000;

    // Track if logout is called correctly and driven by SessionService
    let logoutCalledWith: [string, string] | null = null;
    const originalLogout = session.logout;
    session.logout = (scope: string, userId: string) => {
        logoutCalledWith = [scope, userId];
        originalLogout.call(session, scope, userId);
    };

    // Trigger homeostasis step by sending a session changed event
    console.log("⚡ Dispatching SESSION_CHANGED event to trigger L1 homeostasis...");
    const sessionChangedEvent = eventFactory.build("org/neverplayed/session/CHANGED", {});
    eventAdmin.postEvent(sessionChangedEvent);

    // Wait for the microtask to execute homeostasisStep()
    await new Promise(r => setTimeout(r, 100));

    // Assert that active inference / logout was called by SessionService (L1)
    assertExists(logoutCalledWith, "L1 active inference should have triggered session.logout");
    assertEquals(logoutCalledWith[0], "org.neverplayed.realm.core", "Logout should be called for active realm");
    assertEquals(logoutCalledWith[1], "rob", "Logout should prune stale user rob");

    // Verify rob is no longer logged in
    assertEquals(userInStack.loggedIn, false, "rob should be self-evicted/logged out");

    // Verify active realm fell back to 'platonic' staging lobby
    assertEquals(session.activeRealmId, "platonic", "activeRealmId should fall back to 'platonic' after active observer eviction");

    // Verify L2 prediction error remains at 0.0 (completely decoupled)
    const predError = cognitionService.getPredictionError();
    assertEquals(predError, 0.0, "L2 prediction error should remain 0.0 as occupant pruning is decoupled");

    // Restore original logout method
    session.logout = originalLogout;

    console.log("✅ L1 Being Homeostasis and Platonic Staging Lobby Fallback verified.");

    // -------------------------------------------------------------
    // Test Case 3: Manifest compliance with ADR-0022
    // -------------------------------------------------------------
    console.log("🧪 Test 3: Verifying manifest compliance with ADR-0022...");

    const manifestPath = new URL("../public/bundles/org.neverplayed.realm-manager/manifest.json", import.meta.url).pathname;
    const manifestContent = await Deno.readTextFile(manifestPath);
    const manifest = JSON.parse(manifestContent);

    assertExists(manifest["Bundle-SymbolicName"], "Manifest must have Bundle-SymbolicName");
    assertEquals(manifest["Bundle-SymbolicName"], "org.neverplayed.realm-manager", "Bundle-SymbolicName must match specification");
    assertExists(manifest["Bundle-Version"], "Manifest must have Bundle-Version");
    assertExists(manifest["Bundle-Name"], "Manifest must have Bundle-Name");
    assertExists(manifest["Bundle-Description"], "Manifest must have Bundle-Description");
    assertExists(manifest["Bundle-Activator"], "Manifest must have Bundle-Activator");
    assertEquals(manifest["Bundle-Activator"], "activator.js", "Bundle-Activator must be activator.js");
    
    // Verify BSN matching directory name
    const bsn = manifest["Bundle-SymbolicName"];
    const pathParts = manifestPath.split("/");
    const dirName = pathParts[pathParts.length - 2];
    assertEquals(dirName, bsn, "Directory name must match Bundle-SymbolicName exactly");

    console.log("✅ Manifest compliance with ADR-0022 verified.");

    // -------------------------------------------------------------
    // Test Case 4: Coupled Homeostasis & Attention Resonance
    // -------------------------------------------------------------
    console.log("🧪 Test 4: Verifying Coupled Homeostasis & Attention Resonance (Stigmergic Coupling)...");

    // 1. Setup shared active spatial realm
    session.activeRealmId = "org.neverplayed.realm.core";

    // 2. Login two spatial occupants ('rob' and 'july')
    session.login("rob", "org.neverplayed.realm.core");
    session.login("july", "org.neverplayed.realm.core");

    const robUser = session.scopedUsers["org.neverplayed.realm.core"]["rob"];
    const julyUser = session.scopedUsers["org.neverplayed.realm.core"]["july"];

    assertExists(robUser, "rob should be in the scoped stack");
    assertExists(julyUser, "july should be in the scoped stack");

    // Equip them both with compatible surrogates
    robUser.surrogates = {
        "person": {
            id: "person",
            senses: ["Language"]
        }
    };
    robUser.activeSurrogateId = "person";

    julyUser.surrogates = {
        "person": {
            id: "person",
            senses: ["Language"]
        }
    };
    julyUser.activeSurrogateId = "person";

    // 3. Login a control user in the 'platonic' staging lobby stack
    session.login("annie", "platonic");
    const annieUser = session.scopedUsers["platonic"]["annie"];
    assertExists(annieUser, "annie should be in the platonic stack");
    annieUser.surrogates = {
        "person": {
            id: "person",
            senses: ["Language"]
        }
    };
    annieUser.activeSurrogateId = "person";

    // Drain attention for july and annie to 25s elapsed (5s remaining)
    const testNow = Date.now();
    julyUser.lastActiveTime = testNow - 25000;
    annieUser.lastActiveTime = testNow - 25000;

    // Set the active resident focus to rob in the spatial realm
    session.scopedUsers["org.neverplayed.realm.core"].__activeId__ = "rob";
    assertEquals(session.currentUser.id, "rob", "rob should be the active spatial resident");

    // 4. Simulate a workspace/UI interaction trigger by rob
    session.registerInteraction();

    // 5. Assertions
    const expectedBoost = (session.attentionSpanMs || 30000) * 0.4;
    
    // Rob (the active user) should have their lastActiveTime reset to 100% (now)
    assert(Math.abs(robUser.lastActiveTime - testNow) < 500, "rob's lastActiveTime should be reset to current time");

    // July should be boosted
    assert(julyUser.lastActiveTime > testNow - 25000, "july's lastActiveTime should have been pushed forward by the boost");
    const expectedJulyTime = Math.min(testNow, testNow - 25000 + expectedBoost);
    // Allow small delta/tolerance for Date.now() evaluations during execution
    assert(Math.abs(julyUser.lastActiveTime - expectedJulyTime) < 500, "july's boosted time should match expected value");

    // Annie (in platonic lobby) should NOT be boosted (isolated from spatial resonance)
    assertEquals(annieUser.lastActiveTime, testNow - 25000, "annie's attention should remain untouched (insulated from spatial resonance)");

    console.log("✅ Coupled Homeostasis & Attention Resonance verified.");

    console.log("\n✨ ALL REALM AS A BEING INTEGRATION TESTS PASSED! ✨");
    
    // Restore fetch
    globalThis.fetch = originalFetch;
    await harness.stop();
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
