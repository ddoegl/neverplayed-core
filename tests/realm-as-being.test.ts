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

    // deno-lint-ignore no-explicit-any
    const cognitionService: any = await harness.getService(REALM_COGNITION_SERVICE);
    assertExists(cognitionService, "Realm Cognition service should be dynamically provisioned");

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
    // Test Case 2: Lazy Homeostasis / Stale Occupant Pruning & Prediction Error
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Verifying lazy homeostasis loop and active inference...");

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

    // Check prediction error immediately: should be 0.0 because rob is fresh
    let predError = cognitionService.getPredictionError();
    assertEquals(predError, 0.0, "Prediction error should be 0.0 for a fresh occupant");

    // Artificially make rob stale (31 seconds inactive)
    userInStack.lastActiveTime = Date.now() - 31000;

    // Track if logout is called correctly and intercept predictionError state
    let logoutCalledWith: [string, string] | null = null;
    let predictionErrorCapturedAtLogout: number | null = null;
    const originalLogout = session.logout;
    session.logout = (scope: string, userId: string) => {
        logoutCalledWith = [scope, userId];
        // Capture prediction error from cognitionService before logout resets it
        predictionErrorCapturedAtLogout = cognitionService.getPredictionError();
        originalLogout.call(session, scope, userId);
    };

    // Trigger homeostasis step by sending a session changed event
    console.log("⚡ Dispatching SESSION_CHANGED event to trigger homeostasis...");
    const sessionChangedEvent = eventFactory.build("org/neverplayed/session/CHANGED", {});
    eventAdmin.postEvent(sessionChangedEvent);

    // Wait for the microtask to execute homeostasisStep()
    await new Promise(r => setTimeout(r, 100));

    // Assert that active inference / logout was called
    assertExists(logoutCalledWith, "Active inference should have triggered session.logout");
    assertEquals(logoutCalledWith[0], "org.neverplayed.realm.core", "Logout should be called for active realm");
    assertEquals(logoutCalledWith[1], "rob", "Logout should prune stale user rob");
    assertEquals(predictionErrorCapturedAtLogout, 0.5, "Prediction error should have peaked at 0.5 during active inference");

    // Verify rob is no longer logged in
    assertEquals(userInStack.loggedIn, false, "rob should be pruned/logged out");

    // Verify prediction error returned to 0.0 (restored homeostasis)
    predError = cognitionService.getPredictionError();
    assertEquals(predError, 0.0, "Prediction error should return to 0.0 after active inference");

    // Restore original logout method
    session.logout = originalLogout;

    console.log("✅ Lazy Homeostasis and Active Inference verified.");

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
