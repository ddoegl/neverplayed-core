import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { REALM_MANAGER_SERVICE } from "core-types";
import { BundleTestHarness } from "./test-harness.ts";

Deno.test("Remote Realm Ingestion: Base URL Normalization & Seed Data Resolution", async () => {
    const harness = new BundleTestHarness();
    await harness.init();

    // 1. Install Realm Manager
    await harness.installBundles(["bundles/org.neverplayed.realm-manager/manifest.json"]);

    // deno-lint-ignore no-explicit-any
    const rm = await harness.getService(REALM_MANAGER_SERVICE) as any;
    if (rm.waitReady) await rm.waitReady();

    // 2. Define a Remote Realm Manifest with relative bundles and seed data
    const remoteManifest = {
        id: "org.neverplayed.realm.remote-habitat",
        title: "Remote Habitat",
        bundles: [
            "./bundles/org.neverplayed.being-service/manifest.json",
            "./bundles/org.neverplayed.llm.inner-voice/manifest.json"
        ],
        seedData: {
            beings: "./realms/data/habitat/beings.yaml",
            surrogates: "./realms/data/habitat/surrogates.yaml"
        }
    };

    const remoteOrigin = "http://localhost:8009/realms/habitat.json";

    // 3. Register with Base URL
    await rm.registerRealm(remoteManifest, { baseUrl: remoteOrigin });

    // 4. Inspect registered universe in Realm Manager
    const registered = rm.getRealms().find((r: any) => r.id === "org.neverplayed.realm.remote-habitat");
    assertEquals(!!registered, true, "Remote realm should be registered.");
    assertEquals(registered._baseUrl, remoteOrigin, "Base URL should be preserved on manifest.");

    // 5. Verify Normalized Bundle URLs
    assertEquals(
        registered.bundles[0],
        "http://localhost:8009/bundles/org.neverplayed.being-service/manifest.json",
        "Bundle 0 URL should be normalized against remote origin."
    );
    assertEquals(
        registered.bundles[1],
        "http://localhost:8009/bundles/org.neverplayed.llm.inner-voice/manifest.json",
        "Bundle 1 URL should be normalized against remote origin."
    );

    // 6. Verify Normalized Seed Data URLs
    assertEquals(
        registered.seedData.beings,
        "http://localhost:8009/realms/data/habitat/beings.yaml",
        "Seed data 'beings' should be normalized against remote origin."
    );
    assertEquals(
        registered.seedData.surrogates,
        "http://localhost:8009/realms/data/habitat/surrogates.yaml",
        "Seed data 'surrogates' should be normalized against remote origin."
    );

    // 7. Test Transition to the Remote Realm
    await rm.switchRealm("org.neverplayed.realm.remote-habitat");
    assertEquals(rm.getActiveRealm(), "org.neverplayed.realm.remote-habitat", "Switch to remote realm should succeed.");

    console.log("✅ Remote Realm Ingestion PASSED.");
    await harness.stop();
});

Deno.test("Remote Realm Ingestion: Index Discovery (discoverFromIndex)", async () => {
    const harness = new BundleTestHarness();
    await harness.init();

    await harness.installBundles(["bundles/org.neverplayed.realm-manager/manifest.json"]);
    const rm = await harness.getService(REALM_MANAGER_SERVICE) as any;
    if (rm.waitReady) await rm.waitReady();

    // Test discovery from local index
    const registered = await rm.discoverFromIndex("http://localhost/realms/index.json");
    assertEquals(Array.isArray(registered), true, "discoverFromIndex should return an array.");
    assertEquals(registered.includes("org.neverplayed.realm.empty"), true, "Empty realm should be discovered.");

    console.log("✅ Index Discovery PASSED.");
    await harness.stop();
});

