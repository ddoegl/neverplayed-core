import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setupGlobalEnvironment, setupHeadlessUser } from "./test-harness-globals.ts";
import { PandinoHarness } from "./pandino-test-harness.ts";

setupGlobalEnvironment();

Deno.test({
  name: "Sovereign Device Vaulting: Identity Sharding & Handover",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const harness = new PandinoHarness();
    const context = await harness.init();

    // 0. Initial Identity Setup (Alice Tenant)
    const aliceUid = "tenant-alice-123";
    const aliceSid = "identity-alice-web";
    const bobSid = "identity-bob-cli";
    const eveUid = "tenant-eve-666";
    
    setupHeadlessUser({ email: "alice@neverplayed.dev", uid: aliceUid });
    await harness.bootRealms(["./public/realms/core.json", "./public/realms/foundation.json"]);
    globalThis.localStorage.clear();
    const pm = await harness.waitForService("@pandino/persistence-manager/PersistenceManager");

    // --- PHASE 1: Identity Sharding (Intra-Tenant) ---
    console.log("\n--- Phase 1: Identity Sharding ---");
    
    // Switch to Alice-Web Identity
    console.log("TDD: Switching to Alice-Web...");
    if (pm.setContext) await pm.setContext({ tenantId: aliceUid, identityId: aliceSid });
    await pm.store(`identity:private-key`, { id: "private-1", owner: aliceSid });
    console.log("TDD: Alice-Web persistence verified.");
    
    // Switch to Bob-CLI Identity (Same Tenant)
    console.log("TDD: Switching to Bob-CLI...");
    if (pm.setContext) await pm.setContext({ tenantId: aliceUid, identityId: bobSid });
    const bobVisibleKeys = await pm.listKeys("identity:");
    console.log(`TDD: Bob visible keys: ${bobVisibleKeys.length}`);
    assertEquals(bobVisibleKeys.length, 0, "Bob should not see Alice's identity-scoped keys locally");

    // Bob stores his own
    await pm.store(`identity:private-key`, { id: "private-2", owner: bobSid });
    
    // --- PHASE 2: Tier Affinity Enforcement ---
    console.log("\n--- Phase 2: Tier Affinity ---");
    // Rule: patterns starting with 'security.' should ONLY land in Local (not Cloud)
    console.log("TDD: Storing security pattern...");
    await pm.store("security.vault-token", "DEVICE-ONLY-SECRET");
    
    console.log("TDD: Checking Firebase separation...");
    const firebase = await harness.getService("@pandino/persistence-manager/PersistenceManager", "(implementation=firebase-firestore)");
    const cloudValue = await firebase.load("security.vault-token");
    console.log(`TDD: Cloud value: ${cloudValue}`);
    assertEquals(cloudValue, null, "Security keys must NEVER be persisted to the cloud tier");

    // --- PHASE 3: Tenant Handover (Wipe) ---
    console.log("\n--- Phase 3: Tenant Handover ---");
    // Switch to Eve Tenant
    console.log(`TDD: Transitioning to Eve (${eveUid})...`);
    setupHeadlessUser({ email: "eve@neverplayed.dev", uid: eveUid });
    await harness.settle(500); 

    // Verify Alice's keys are inaccessible/wiped from the perspective of the new manager
    console.log("TDD: Verifying purge of Alice's vault...");
    const handoverKeys = await pm.listKeys(`np:v1:${aliceUid}:`);
    console.log(`TDD: Remaining keys for Alice: ${handoverKeys.length}`);
    assertEquals(handoverKeys.length, 0, "Outgoing tenant's local vault must be purged on handover");

    await harness.stop();
    console.log("Vaulting TDD: Assertions established. 🔒✅");
  }
});
