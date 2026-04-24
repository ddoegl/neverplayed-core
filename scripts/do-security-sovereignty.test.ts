import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setupGlobalEnvironment, setupHeadlessUser } from "./test-harness-globals.ts";
import { PandinoHarness } from "./pandino-test-harness.ts";

/**
 * DO Security Sovereignty Test (SDN-0140)
 * 
 * Verifies that the Sovereign Shield correctly enforces ownership-based 
 * isolation and identity injection for Domain Objects.
 */

// 1. Setup Virtual Browser Environment
setupGlobalEnvironment();

Deno.test({
  name: "DO Security: Sovereign Shield Isolation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // 0. Setup Initial Identity (Alice) before boot (Certified Primary)
    setupHeadlessUser({ email: "alice@neverplayed.dev", uid: "alice-123", primary: true });

    const harness = new PandinoHarness();
    const context = await harness.init();

    // 1. Boot Core Realm
    console.log(`\n--- Booting Core Realm for Security TDD ---`);
    await harness.bootRealms([
        "./public/realms/core.json",
        "./public/realms/foundation.json"
    ]);

    // 2. Extra Bundles for DO Lifecycle
    await context.installBundle("./org.neverplayed.persistence-deno-localstorage/manifest.json");
    await context.installBundle("./org.neverplayed.shared-domain-strategies/manifest.json");

    const REGISTRY_SERVICE = "org.neverplayed.domain.Registry";
    const INGESTION_SERVICE = "org.neverplayed.atomic.SpecIngestion";
    const STRATEGY_SERVICE = "org.neverplayed.domain.Strategy";

    // Rule 28: Identity Synchronization Pulse (SDN-0140)
    // Ensure Session Service has Alice before we create anything
    const session = await harness.waitForService("org.neverplayed.auth.Session");
    for (let i = 0; i < 20; i++) {
        if (session.currentUser?.id === "alice-123") break;
        await harness.settle(50);
    }
    console.log(`Harness: Identity Confirmed: ${session.currentUser?.id}`);

    // --- PHASE 1: ALICE ADVENT ---
    console.log("\n--- Phase 1: Alice Ingests Blueprint ---");

    const ingestion = await harness.waitForService(INGESTION_SERVICE);
    const blueprintId = "alice-sovereign-flow";
    const aliceSpec = {
        id: blueprintId,
        label: "Alice's Sovereign Flow",
        domainObject: { strategyId: "LOCAL_STRATEGY" }
    };

    ingestion.ingest(aliceSpec, { persist: true });
    await harness.settle(100);

    // Instantiate as Alice
    const strategy = harness.getService(STRATEGY_SERVICE, "(id=LOCAL_STRATEGY)");
    const inst = strategy.createInstance(aliceSpec);
    const aliceInstanceId = inst.id;
    console.log(`Instance created by Alice: ${aliceInstanceId} (Owner: ${inst.ownerId})`);
    
    // TDD ASSERTION 1: Identity Injection
    assertEquals(inst.ownerId, "alice-123", "Instance must be stamped with progenitor ownerId");

    // --- PHASE 2: BOB ADVENT ---
    console.log("\n--- Phase 2: Bob Scans the Realm ---");
    setupHeadlessUser({ email: "bob@neverplayed.dev", uid: "bob-456" });
    await harness.settle(250); // WAIT FOR REACTIVE SHIELD TO HYDRATE
    
    const registry = harness.getService(REGISTRY_SERVICE);
    
    // Trigger Refresh via getInstances (which calls refreshMaster)
    const instances = await registry.getInstances();
    console.log(`Bob discovered ${Object.keys(instances).length} instances.`);
    
    // TDD ASSERTION 2: Sovereign Isolation
    const hasAliceInstance = (Object.values(instances) as Array<{ id?: string }>).some((i) => i.id === aliceInstanceId);
    assertEquals(hasAliceInstance, false, "Bob must NOT see Alice's private instances");

    // --- PHASE 3: BOB ATTEMPTS LIQUIDATION ---
    console.log("\n--- Phase 3: Bob Attempts Liquidation ---");
    const result = registry.removeInstance(aliceInstanceId);
    
    // TDD ASSERTION 3: Archival Guard
    assertEquals(result, false, "Registry must block liquidation of non-owned instances");

    // --- PHASE 4: CLI STRING-LOGIN SIMULATION ---
    console.log("\n--- Phase 4: CLI String-Login (Alice) ---");
    session.login("alice-cli");
    await harness.settle(250);

    const cliInstance = strategy.createInstance({ id: "cli-flow", label: "CLI Flow" });
    console.log(`Instance created via CLI login: ${cliInstance.id} (Owner: ${cliInstance.ownerId})`);
    assertEquals(cliInstance.ownerId, "alice-cli", "CLI string-login must result in correct ownerId stamping");

    // --- PHASE 5: IDENTITY RESTORATION ---
    console.log("\n--- Phase 5: Identity Restoration ---");
    console.log(`Current before logout: ${session.currentUser?.id}`);
    session.logout();
    await harness.settle(250);
    console.log(`Current after logout: ${session.currentUser?.id}`);

    // TDD ASSERTION 5: Primary Identity Re-Assertion
    // Logout should revert to the certified Alice-123, not guest
    assertEquals(session.currentUser?.id, "alice-123", "Logout must revert to primary certified identity");

    // --- PHASE 6: SUPERUSER BYPASS VERIFICATION ---
    console.log("\n--- Phase 6: Superuser Bypass Verification ---");
    setupHeadlessUser({ 
        email: "admin@neverplayed.dev", 
        uid: "admin-789", 
        attributes: { "realm-admin": true } 
    });
    await harness.settle(250);

    // Toggle Show All in Registry State via Method (Triggering Refresh)
    const adminRegistry = await harness.waitForService("org.neverplayed.domain.Registry");
    if (adminRegistry.state) {
        await adminRegistry.state.toggleShowAllDOs();
    }
    await harness.settle(100);
    
    // Trigger re-discovery as Admin
    const adminInstances = await adminRegistry.getInstances();
    // Use the aliceInstanceId captured in Phase 1
    
    console.log(`Admin discovered ${Object.keys(adminInstances).length} instances.`);
    // Since I can't easily capture the dynamic ID here, I'll use a property check or check for existence
    const adminFoundAlice = Object.values(adminInstances).some((i: any) => i.id?.startsWith("alice-sovereign-flow"));
    assertEquals(adminFoundAlice, true, "Superuser with showAll enabled MUST see Alice's instances");

    await harness.stop();
  },
});
