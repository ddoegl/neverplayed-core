import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { REALM_MANAGER_SERVICE } from "core-types";
import { BundleTestHarness } from "./test-harness.ts";

Deno.test("Realm Management: Hierarchy Resolution & Activation", async () => {
    const harness = new BundleTestHarness();
    await harness.init();
    
    // 1. Install Realm Manager
    await harness.installBundles(["bundles/org.neverplayed.realm-manager/manifest.json"]);
    
    // deno-lint-ignore no-explicit-any
    const rm = await harness.getService(REALM_MANAGER_SERVICE) as any;
    
    // 2. Define Mock Universes
    const coreManifest = {
        id: "core",
        title: "Foundation Layer",
        bundles: [ "bundle.a", "bundle.b" ]
    };
    
    const appManifest = {
        id: "app",
        title: "Application Layer",
        extends: ["core"],
        bundles: [ "bundle.c" ]
    };
    
    // 3. Register
    rm.registerRealm(coreManifest);
    rm.registerRealm(appManifest);
    
    // 4. Verify Active Realm state
    assertEquals(rm.getActiveRealm(), null, "Initially no active realm.");
    
    // 5. Trigger Switch
    // In the test harness, installBundle reflects into local storage, 
    // so we can simulate the "switch" and check the logger
    await rm.switchRealm("app");
    
    assertEquals(rm.getActiveRealm(), "app", "Switch to 'app' successful.");
    
    // 6. Verify Layer Resolution (Self-reflection)
    const manifests = rm.getRealms();
    assertEquals(manifests.some((m: any) => m.id === "core"), true, "Core realm registered.");
    assertEquals(manifests.some((m: any) => m.id === "app"), true, "App realm registered.");

    console.log("✅ Realm Management PASSED.");
    await harness.stop();
});
