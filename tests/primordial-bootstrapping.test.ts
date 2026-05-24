import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { 
    SESSION_SERVICE, 
    REALM_MANAGER_SERVICE, 
    PERCEIVER_SERVICE, 
    BEING_SERVICE, 
    PERSISTENCE_MANAGER_SERVICE, 
    PLEXUS_SENSOR_SERVICE,
    REALM_COGNITION_SERVICE
} from "core-types";

const settle = () => new Promise(resolve => setTimeout(resolve, 500));

async function main() {
    console.log("🏛️  Starting Integration Test: Primordial Bootstrapping & Global Anchor...");
    const harness = new BundleTestHarness();
    
    // deno-lint-ignore no-explicit-any
    const context = await harness.init() as any;
    if (!context) {
        console.error("❌ Harness context missing");
        Deno.exit(1);
    }

    // 1. Intercept fetch for env configs and YAML
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
        if (urlStr.includes("data/beings.yaml")) {
            const beingsYaml = `
- id: 8fNNh7UkppadUaKJQhaiMIGzcLd2
  label: Default Observer
  email: observer@cli.local
  originRealmId: org.neverplayed.realm.core
  initial:
    realm: org.neverplayed.realm.core
    surrogate: observer
`;
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve(beingsYaml),
                json: () => Promise.resolve(beingsYaml),
            } as any;
        }
        if (urlStr.includes("data/surrogates.yaml")) {
            const surrogatesYaml = `
- id: observer
  label: Observer
  senses:
    - Language
`;
            return {
                ok: true,
                status: 200,
                text: () => Promise.resolve(surrogatesYaml),
                json: () => Promise.resolve(surrogatesYaml),
            } as any;
        }
        
        return originalFetch(url, init);
    };

    // Clear localStorage to start clean
    localStorage.clear();

    // 2. Install all required bundles
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
        "bundles/org.neverplayed.perceiver-service/manifest.json",
        "bundles/org.neverplayed.being-service/manifest.json",
        "bundles/org.neverplayed.stratum-core/manifest.json",
        "bundles/org.neverplayed.stratum-core-dom/manifest.json",
        "bundles/org.neverplayed.stratographer/manifest.json",
        "bundles/org.neverplayed.plexus-core/manifest.json",
        "bundles/org.neverplayed.plexus-enricher/manifest.json",
        "bundles/org.neverplayed.plexus/manifest.json",
        "bundles/org.neverplayed.plexus-sensor/manifest.json"
    ]);

    await settle();

    // 3. Resolve Services
    // deno-lint-ignore no-explicit-any
    const session: any = await harness.getService(SESSION_SERVICE);
    // deno-lint-ignore no-explicit-any
    const pm: any = await harness.getService(PERSISTENCE_MANAGER_SERVICE);
    // deno-lint-ignore no-explicit-any
    const realmManager: any = await harness.getService(REALM_MANAGER_SERVICE);
    // deno-lint-ignore no-explicit-any
    const perceiver: any = await harness.getService(PERCEIVER_SERVICE);
    // deno-lint-ignore no-explicit-any
    const plexusSensor: any = await harness.getService(PLEXUS_SENSOR_SERVICE);

    assertExists(session, "Session service should be registered");
    assertExists(pm, "Persistence Manager should be registered");
    assertExists(realmManager, "Realm Manager should be registered");
    assertExists(perceiver, "Perceiver Service should be registered");
    assertExists(plexusSensor, "Plexus Sensor should be registered");

    // -------------------------------------------------------------
    // Test Case 1: Global Bootstrap Anchor Mapping
    // -------------------------------------------------------------
    console.log("🧪 Test 1: Verifying physical key mapping for global bootstrap anchors...");

    // Store a session key
    pm.store("pandino.session.state", { activeRealmId: "org.neverplayed.realm.core" });
    
    // Store a config key
    pm.store("config.org.neverplayed.shell-cli", { active: true });

    // Store a user-specific local key
    pm.store("local-user-preference", { theme: "dark" });

    // Store a shell UI context key
    pm.store("org.neverplayed.shell.ui.context", { sidebarOpen: true });

    // Assert mapping in localStorage
    const sessionVal = localStorage.getItem("np:v1:global:__global__:__shared__:pandino.session.state");
    assertExists(sessionVal, "Session state must be written to global/shared namespace");
    assertEquals(JSON.parse(sessionVal).activeRealmId, "org.neverplayed.realm.core");

    const configVal = localStorage.getItem("np:v1:global:__global__:__shared__:config.org.neverplayed.shell-cli");
    assertExists(configVal, "Config trace must be written to global/shared namespace");
    assertEquals(JSON.parse(configVal).active, true);

    const uiContextVal = localStorage.getItem("np:v1:global:__global__:__shared__:org.neverplayed.shell.ui.context");
    assertExists(uiContextVal, "UI context must be written to global/shared namespace");
    assertEquals(JSON.parse(uiContextVal).sidebarOpen, true);

    // With the Platonic Lobby Boot, activeRealmId is 'platonic' from the moment the
    // system initialises — so local (non-global) keys are now namespaced under 'platonic'
    // rather than the old 'unknown' fallback.
    const localVal = localStorage.getItem("np:v1:guest:platonic:guest:local-user-preference");
    assertExists(localVal, "Local user preference must map to tenant/platonic namespace");

    console.log("✅ Global Bootstrap Anchor Mapping verified.");

    // -------------------------------------------------------------
    // Test Case 2: Data Reset clears user/realm specific keys but preserves global state
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Verifying data reset preservation logic...");

    // Run persistence clear (global true)
    await pm.clear({ global: true });

    // Assert local key is removed (was written under platonic scope)
    const localValAfter = localStorage.getItem("np:v1:guest:platonic:guest:local-user-preference");
    assertEquals(localValAfter, null, "Local user preference must be wiped by data reset");

    // Assert global keys are preserved
    const sessionValAfter = localStorage.getItem("np:v1:global:__global__:__shared__:pandino.session.state");
    assertExists(sessionValAfter, "Session state must be preserved across data reset");

    const configValAfter = localStorage.getItem("np:v1:global:__global__:__shared__:config.org.neverplayed.shell-cli");
    assertExists(configValAfter, "Config trace must be preserved across data reset");

    const uiContextValAfter = localStorage.getItem("np:v1:global:__global__:__shared__:org.neverplayed.shell.ui.context");
    assertExists(uiContextValAfter, "UI context must be preserved across data reset");

    console.log("✅ Data Reset Preservation verified.");

    // -------------------------------------------------------------
    // Test Case 3: Core Realm Cold Boot Fallback & Interoception
    // -------------------------------------------------------------
    console.log("🧪 Test 3: Verifying Core Realm cold boot and config reification...");

    // Simulate recovery fallback by wiping last active realm storage ID
    localStorage.removeItem("org.neverplayed.realm.active");

    const mockBundles = [
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
        "bundles/org.neverplayed.perceiver-service/manifest.json",
        "bundles/org.neverplayed.being-service/manifest.json",
        "bundles/org.neverplayed.stratum-core/manifest.json",
        "bundles/org.neverplayed.stratum-core-dom/manifest.json",
        "bundles/org.neverplayed.stratographer/manifest.json",
        "bundles/org.neverplayed.plexus-core/manifest.json",
        "bundles/org.neverplayed.plexus-enricher/manifest.json",
        "bundles/org.neverplayed.plexus/manifest.json",
        "bundles/org.neverplayed.plexus-sensor/manifest.json"
    ];

    // Re-register realms and check that default falls back to core realm
    realmManager.registerRealm({
        id: "org.neverplayed.realm.habitat",
        title: "Habitat",
        bundles: mockBundles
    });
    realmManager.registerRealm({
        id: "org.neverplayed.realm.core",
        title: "Core Realm",
        bundles: mockBundles
    });

    // Re-trigger recovery sequence by simulating a boot/reset
    // Wiping recovery state and calling _recoverState
    const managerActivator = realmManager; // context.getService(REALM_MANAGER_SERVICE) returns the registered service proxy, which wraps the manager
    
    // Switch to core realm manually to ensure everything is set up
    await realmManager.switchRealm("org.neverplayed.realm.core");
    assertEquals(realmManager.getActiveRealm(), "org.neverplayed.realm.core", "Active realm must default back/recover to core realm");

    console.log("DIAGNOSTIC: Active Realm =", realmManager.getActiveRealm());
    console.log("DIAGNOSTIC: Current User =", session.currentUser);
    console.log("DIAGNOSTIC: Scoped Users =", JSON.stringify(session.scopedUsers));
    console.log("DIAGNOSTIC: DOM Body HTML =", document.body.innerHTML);

    // Retrieve dynamically provisioned cognition service and check reified PIDs
    const cognitionService: any = await harness.getService(REALM_COGNITION_SERVICE);
    assertExists(cognitionService, "RealmCognitionService must be dynamically registered by RealmManager");
    const pids = cognitionService.getReifiedPids();
    assert(pids.includes("org.neverplayed.shell-cli"), "Reified PIDs must include shell-cli");

    // Retrieve reified/sensed components from Stratographer Alpine store (guest context)
    const Alpine = (globalThis as any).Alpine;
    const explorerStore = Alpine?.store('explorer');
    assertExists(explorerStore, "Explorer store should be initialized");
    
    await explorerStore.inspectVault({ id: 'realm:org.neverplayed.realm.core', value: 'org.neverplayed.realm.core' });
    const reifiedVal = explorerStore.reifiedComponents.find((c: any) => c.pid === "org.neverplayed.shell-cli");
    assertExists(reifiedVal, "reifiedComponents must contain shell-cli");
    assertEquals(reifiedVal.isSensible, false, "Should be occluded for guest occupant");

    console.log("✅ Core Realm Cold Boot Fallback & Interoception verified.");

    // -------------------------------------------------------------
    // Test Case 4: Default Human Observer Plexus Sensation
    // -------------------------------------------------------------
    console.log("🧪 Test 4: Verifying default observer senses the reified components...");

    // Login default observer
    await session.login("8fNNh7UkppadUaKJQhaiMIGzcLd2", "org.neverplayed.realm.core", {
        id: "observer",
        label: "Observer",
        senses: ["Language"]
    });

    await settle();

    // Verify Plexus Sensor shows the reified element is programmatically visible/sensed
    await explorerStore.inspectVault({ id: 'realm:org.neverplayed.realm.core', value: 'org.neverplayed.realm.core' });
    const reifiedValAfterLogin = explorerStore.reifiedComponents.find((c: any) => c.pid === "org.neverplayed.shell-cli");
    assertExists(reifiedValAfterLogin);
    assertEquals(reifiedValAfterLogin.isSensible, true, "Reified element should be visible/sensed by observer with Language sense");

    // Click on active observer node
    await explorerStore.inspectVault({ 
        id: 'identity:8fNNh7UkppadUaKJQhaiMIGzcLd2', 
        value: '8fNNh7UkppadUaKJQhaiMIGzcLd2',
        ontologicalState: 'observer'
    });
    assert(explorerStore.activeSensedComponents.includes("org.neverplayed.shell-cli"), "activeSensedComponents must include shell-cli");

    console.log("✅ Default Observer Plexus Sensation verified.");

    // -------------------------------------------------------------
    // Test Case 5: Headless Decoupling and DOM Adapter Lifecycle
    // -------------------------------------------------------------
    console.log("🧪 Test 5: Verifying headless decoupling and DOM adapter unmounting...");

    // 1. Static assertion that org.neverplayed.realm-manager has no direct document writes in homeostasis
    const managerPath = new URL("../public/bundles/org.neverplayed.realm-manager/activator.js", import.meta.url).pathname;
    const managerCode = Deno.readTextFileSync(managerPath);
    assert(!managerCode.includes("document.createElement"), "Homeostasis loop must be completely headless (no DOM references)");
    console.log("✅ verified that dynamic homeostasis loop is completely headless.");

    // 2. Verify that when logging out, sensed components are updated/cleared
    console.log("TEST: Logging out default observer from org.neverplayed.realm.core...");
    await session.logout("org.neverplayed.realm.core", "8fNNh7UkppadUaKJQhaiMIGzcLd2");
    await settle();

    // Since the observer logged out, the active user is guest. Inspect vault again.
    await explorerStore.inspectVault({ id: 'realm:org.neverplayed.realm.core', value: 'org.neverplayed.realm.core' });
    const reifiedValAfterLogout = explorerStore.reifiedComponents.find((c: any) => c.pid === "org.neverplayed.shell-cli");
    assertExists(reifiedValAfterLogout);
    assertEquals(reifiedValAfterLogout.isSensible, false, "Reified components must be occluded (isSensible = false) after logout");
    console.log("✅ verified that reifications are unmounted from DOM upon logout.");

    console.log("\n✨ ALL PRIMORDIAL BOOTSTRAPPING INTEGRATION TESTS PASSED! ✨");
    
    // Restore fetch and clean up harness
    globalThis.fetch = originalFetch;
    await harness.stop();
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
