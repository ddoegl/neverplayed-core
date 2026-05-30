import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { BEING_SERVICE, SESSION_SERVICE } from "core-types";

async function main() {
    console.log("🧬 Starting Scale-Free Being-Realms & Tenant Cosmic Envelopes Integration Test...");
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

    // Wait for services to settle
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

    // Register a standard Being so we can test synthesis
    beingService.registerBeings([
        {
            id: "daniel",
            label: "Daniela Mind",
            email: "daniel@cli.local",
            initial: {
                surrogate: "observer"
            }
        }
    ]);

    // -------------------------------------------------------------
    // Test Case 1: Dynamic Virtual Registration
    // -------------------------------------------------------------
    console.log("🧪 Test 1: Verifying dynamic synthesis and virtual registration...");
    
    const realms = realmManager.getRealms();
    assert(realms.length > 0, "Realms list should not be empty");
    
    const beingRealm = realms.find((r: any) => r.id === "being:daniel");
    assertExists(beingRealm, "Synthesized virtual Being-Realm 'being:daniel' must exist in getRealms()");
    assertEquals(beingRealm.title, "Being Mind (daniel)");
    assert(beingRealm.recognizedSurrogates.includes("observer"), "Should include observer surrogate");
    assertEquals(beingRealm.bundles.length, 0, "Virtual realms should contain no dynamic bundles");

    const tenantRealm = realms.find((r: any) => r.id === "tenant:global");
    assertExists(tenantRealm, "Synthesized virtual Tenant-Realm 'tenant:global' must exist in getRealms()");
    assertEquals(tenantRealm.title, "Tenant Cosmic Envelope");

    console.log("✅ Dynamic virtual registration verified.");

    // -------------------------------------------------------------
    // Test Case 2: Pure Ingress Transition (Zero-Surge)
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Verifying Pure Ingress transition (Zero-Surge)...");
    
    // Switch to being:daniel
    console.log("⚡ Switching to virtual Being-Realm 'being:daniel'...");
    const transitionResult = await realmManager.switchRealm("being:daniel");
    assertEquals(transitionResult.status, "COMPLETE");
    assertEquals(realmManager.getActiveRealm(), "being:daniel");

    // Verify resolve hierarchy returned []
    const hierarchy = await realmManager.getHierarchy("being:daniel");
    assertEquals(hierarchy.length, 0, "Virtual realm hierarchy must be empty to prevent surges");

    console.log("✅ Pure Ingress transition verified.");

    // -------------------------------------------------------------
    // Test Case 3: Headless BeingCognitionService Provisioning
    // -------------------------------------------------------------
    console.log("🧪 Test 3: Verifying BeingCognitionService registration & data model...");

    let beingCognitionService: any = null;
    const refs = context.getServiceReferences("org.neverplayed.realm.BeingCognitionService") || [];
    for (const ref of refs) {
        if (ref.getProperty("realm.id") === "being:daniel") {
            beingCognitionService = context.getService(ref);
            break;
        }
    }
    
    assertExists(beingCognitionService, "BeingCognitionService should be registered for scope 'being:daniel'");
    assertEquals(beingCognitionService.getPredictionError(), 0.0);
    
    const reifiedPids = beingCognitionService.getReifiedPids();
    assert(reifiedPids.includes("being.daniel.surrogates"), "Exposed PIDs must include surrogates config");
    assert(reifiedPids.includes("being.daniel.attributes"), "Exposed PIDs must include attributes config");
    
    console.log("✅ BeingCognitionService provisioning verified.");

    // -------------------------------------------------------------
    // Test Case 4: Headless TenantCognitionService Provisioning & Telemetry
    // -------------------------------------------------------------
    console.log("🧪 Test 4: Verifying TenantCognitionService telemetry...");

    // Switch to tenant:global
    console.log("⚡ Switching to virtual Tenant-Realm 'tenant:global'...");
    await realmManager.switchRealm("tenant:global");
    assertEquals(realmManager.getActiveRealm(), "tenant:global");

    let tenantCognitionService: any = null;
    const tRefs = context.getServiceReferences("org.neverplayed.realm.TenantCognitionService") || [];
    for (const ref of tRefs) {
        if (ref.getProperty("realm.id") === "tenant:global") {
            tenantCognitionService = context.getService(ref);
            break;
        }
    }
    
    assertExists(tenantCognitionService, "TenantCognitionService should be registered for scope 'tenant:global'");
    
    const tPids = tenantCognitionService.getReifiedPids();
    assert(tPids.includes("tenant.global.realms"), "Exposed PIDs must include realms list");
    assert(tPids.includes("tenant.global.telemetry"), "Exposed PIDs must include telemetry");

    const telemetry = tenantCognitionService.getGlobalTelemetry();
    assertExists(telemetry, "Telemetry stats should exist");
    assert(telemetry.activeBundles > 0, "Should count active bundles");
    assertEquals(telemetry.registeredRealms, realms.length, "Should match synthesized realms size");

    console.log("✅ TenantCognitionService & Telemetry verified.");

    // -------------------------------------------------------------
    // Test Case 5: Exit & Cleanup Resilience
    // -------------------------------------------------------------
    console.log("🧪 Test 5: Verifying context exit and dynamic service cleanup...");

    // Switch back to platonic
    console.log("⚡ Returning to platonic lobby...");
    await realmManager.switchRealm("platonic");
    assertEquals(realmManager.getActiveRealm(), "platonic");

    // Assert that tenant:global services are unregistered
    const cleanedRefs = context.getServiceReferences("org.neverplayed.realm.TenantCognitionService") || [];
    const foundTenantService = cleanedRefs.some((ref: any) => ref.getProperty("realm.id") === "tenant:global");
    assert(!foundTenantService, "TenantCognitionService should have been cleaned up and unregistered upon exit");

    console.log("✅ Context exit and dynamic service cleanup verified.");

    // -------------------------------------------------------------
    // Test Case 6: Perspectival Symmetry URI Parsing & Jump Coordinates
    // -------------------------------------------------------------
    console.log("🧪 Test 6: Verifying Perspectival Symmetry URI parsing & jump coordinates...");

    await harness.installBundles([
        "bundles/org.neverplayed.stratum-core/manifest.json"
    ]);

    // Wait for services to settle
    await new Promise<void>(r => setTimeout(r, 200));

    const stratum: any = await harness.getService("org.neverplayed.stratum.StratumService");
    assertExists(stratum, "Stratum service should be available");

    // Test parser for being: prefix (realist)
    const resultBeing = await stratum.jump("np://daniel/being:daniel/rob/shell?tier=local");
    assertEquals(resultBeing.perspective, "realist");
    assertEquals(resultBeing.realm, "being:daniel");
    assertEquals(resultBeing.identity, "rob");

    // Test parser for tenant: prefix (realist)
    const resultTenant = await stratum.jump("np://daniel/tenant:daniel/rob/shell?tier=local");
    assertEquals(resultTenant.perspective, "realist");
    assertEquals(resultTenant.realm, "tenant:daniel");
    assertEquals(resultTenant.identity, "rob");

    console.log("✅ Parser perspectival symmetry verified.");

    console.log("\n✨ ALL BEING & TENANT REALM INTEGRATION TESTS PASSED! ✨");
    
    // Restore fetch
    globalThis.fetch = originalFetch;
    await harness.stop();
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
