import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setupGlobalEnvironment, setupHeadlessUser } from "../../../../scripts/test-harness-globals.ts";
import { PandinoHarness } from "../../../../scripts/pandino-test-harness.ts";

/**
 * Core Realm Test Harness (Refactored)
 * 
 * Verifies that the institutional core infrastructure (foundational bundles)
 * can be correctly loaded and activated using the shared TDD Harness utilities.
 */

// 1. Setup Virtual Browser Environment (Shared Utility)
setupGlobalEnvironment();

// 2. Setup Headless User for Auth Shield bypass
setupHeadlessUser({
    email: "test-harness@neverplayed.dev",
    uid: "test-harness-uid",
    isSuperuser: true,
    attributes: { "neverplayed-admin": true }
});

Deno.test({
  name: "Core Realm Harness: Foundation Activation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // 1. Initialize Harness
    const harness = new PandinoHarness();
    const context = await harness.init();

    // 2. Sequential Installation and Activation
    console.log(`\n--- Starting Core Realm Orchestration ---`);
    await harness.bootRealms([
        "./public/realms/core.json",
        "./public/realms/foundation.json"
    ]);

    // TDD Enhancement: Inject LocalStorage Provider and Antigravity Agent
    await context.installBundle("./org.neverplayed.persistence-deno-localstorage/manifest.json");
    await context.installBundle("./org.neverplayed.agent.antigravity/manifest.json");

    const bundles = context.getBundles();
    console.log(`\nInfrastructure report: ${bundles.length} bundles present.`);

    // 4. State Verification
    let activeCount = 0;
    for (const bundle of bundles) {
      const bsn = bundle.getSymbolicName();
      const state = bundle.getState();
      
      // State 32 is ACTIVE in OSGi
      if (state === 'ACTIVE') {
        activeCount++;
      } else {
        console.warn(`[STATE ${state}] ${bsn} is NOT active!`);
      }
      
      assertEquals(state, 'ACTIVE', `Bundle ${bsn} must be ACTIVE`);
    }

    console.log(`Success: ${activeCount}/${bundles.length} bundles verified as ACTIVE.`);
    
    // --- INTEGRATION: CLI & Persistence Protocol ---
    console.log("\n--- Starting Integration Test: CLI & Persistence ---");
    
    const SHELL_CLI_SERVICE = "org.neverplayed.shell.ShellCLI";
    const PERSISTENCE_MANAGER_SERVICE = "@pandino/persistence-manager/PersistenceManager";
    
    // 1. CLI Discovery Check
    const shellRef = context.getServiceReference(SHELL_CLI_SERVICE);
    if (!shellRef) throw new Error(`${SHELL_CLI_SERVICE} not found`);
    // deno-lint-ignore no-explicit-any
    const shell = context.getService(shellRef) as any;
    
    console.log("Executing CLI command: /services");
    await shell.execute("/services");
    
    const history = shell.getHistory();
    // deno-lint-ignore no-explicit-any
    const hasServices = history.some((h: any) => 
        h.type === 'output' && h.content?.includes("Registered Services")
    );
    assertEquals(hasServices, true, "Shell history should contain service listing");
    console.log("CLI Handshake: SUCCESS");
    
    // 2. Persistence Layer Check
    const pmRefs = context.getServiceReferences(PERSISTENCE_MANAGER_SERVICE, "(implementation=deno-localstorage)");
    if (!pmRefs || pmRefs.length === 0) throw new Error(`${PERSISTENCE_MANAGER_SERVICE} not found`);
    assertEquals(pmRefs.length > 0, true, "LocalStorage persistence provider should be present");
    
    // deno-lint-ignore no-explicit-any
    const pm = context.getService(pmRefs[0]) as any;
    const testData = { tdd: "verified", timestamp: Date.now() };
    
    console.log("Testing PersistenceManager.store()...");
    pm.store("tdd.integration.test", testData);
    
    const loaded = pm.load("tdd.integration.test");
    assertEquals(loaded.tdd, "verified", "PersistenceManager should load stored data");
    
    // 3. Shadow Memory Verification (LocalStorage)
    console.log("Verifying shadow storage (HappyDOM localStorage)...");
    const raw = globalThis.localStorage.getItem("tdd.integration.test");
    const shadow = JSON.parse(raw!);
    assertEquals(shadow.tdd, "verified", "Browser localStorage should hold serialized data");
    console.log("Persistence Roundtrip: SUCCESS");
    
    // --- COMPLEX: BLUEPRINT & INSTANCE LIFECYCLE ---
    console.log("\n--- Starting Complex Test: Blueprint & Instance Lifecycle ---");
    
    const ATOMIC_SPEC_INGESTION_SERVICE = "org.neverplayed.atomic.SpecIngestion";
    const DOMAIN_OBJECT_REGISTRY_SERVICE = "org.neverplayed.domain.Registry";
    const INSTANCE_SERVICE = "org.neverplayed.domain.Instance";
    
    // 1. Blueprint Fabrication (Simulated Visual Editor Save)
    const ingestionRef = context.getServiceReference(ATOMIC_SPEC_INGESTION_SERVICE);
    if (!ingestionRef) throw new Error(`${ATOMIC_SPEC_INGESTION_SERVICE} not found`);
    // deno-lint-ignore no-explicit-any
    const ingestion = context.getService(ingestionRef) as any;
    
    const blueprintId = "tdd-complex-blueprint";
    const blueprintSpec = {
        id: blueprintId,
        label: "TDD Complex Flow",
        ui: {
            steps: {
                start: { title: "Initial Step", parts: {
                    welcome: { type: "text", value: "Hello from TDD!" }
                } }
            }
        },
        domainObject: {
            strategyId: "LOCAL_STRATEGY"
        }
    };
    
    console.log(`Ingesting blueprint [${blueprintId}]...`);
    ingestion.ingest(blueprintSpec, { persist: true, source: 'tdd-harness' });
    
    // SPOP Sync Pulse: Wait for async persistence (PersistenceSelector is async!)
    await new Promise(r => setTimeout(r, 50));
    
    // Debug: Check which PM is active
    const pmRefActual = context.getServiceReference(PERSISTENCE_MANAGER_SERVICE);
    if (!pmRefActual) throw new Error(`${PERSISTENCE_MANAGER_SERVICE} not found`);
    // deno-lint-ignore no-explicit-any
    const pmSvc = context.getService(pmRefActual) as any;
    console.log(`Debug: Active PM implementation: ${pmRefActual.getProperty("implementation")}`);
    
    // Check shadow persistence
    const designKey = `realm.design.blueprints_${blueprintId}`;
    const pmValue = pmSvc.load(designKey);
    const storageValue = globalThis.localStorage.getItem(designKey);
    
    const persistedBlueprint = pmValue || (storageValue ? JSON.parse(storageValue) : null);
    assertEquals(persistedBlueprint?.id, blueprintId, "Blueprint should be persisted in design bucket");
    console.log("Phase 1 (Fabrication): SUCCESS");
    
    // 2. Registry Handshake
    const registryRef = context.getServiceReference(DOMAIN_OBJECT_REGISTRY_SERVICE);
    if (!registryRef) throw new Error(`${DOMAIN_OBJECT_REGISTRY_SERVICE} not found`);
    // deno-lint-ignore no-explicit-any
    const registry = context.getService(registryRef) as any;
    
    console.log("Verifying Registry discovery...");
    // SPOP Sync Pulse: Wait for Orchestrator -> Registry handshake
    await new Promise(r => setTimeout(r, 250));
    
    await shell.execute(`/do:list`);
    const registryHistory = shell.getHistory();
    // Get last 15 lines of history (enough for do:list output)
    // deno-lint-ignore no-explicit-any
    const commandOutput = registryHistory.slice(-15).map((h: any) => typeof h.content === 'object' ? JSON.stringify(h.content) : h.content).join("\n");
    console.log(`Debug: /do:list output:\n${commandOutput}`);
    
    const containsBlueprint = commandOutput.includes(blueprintId);
    assertEquals(containsBlueprint, true, "Registry should track the new blueprint");
    console.log("Phase 2 (Registry Handshake): SUCCESS");
    
    // 3. The Gravity Cycle (Instantiation)
    console.log(`Instantiating blueprint [${blueprintId}]...`);
    
    const DOMAIN_STRATEGY_SERVICE = "org.neverplayed.domain.Strategy";
    const strategyRefs = context.getServiceReferences(DOMAIN_STRATEGY_SERVICE, "(id=LOCAL_STRATEGY)");
    if (!strategyRefs || strategyRefs.length === 0) throw new Error(`${DOMAIN_STRATEGY_SERVICE} not found`);
    const strategyRef = strategyRefs[0];
    // deno-lint-ignore no-explicit-any
    const strategy = context.getService(strategyRef) as any;
    
    // Instantiate via Strategy
    const inst = strategy.createInstance(blueprintSpec);
    assertEquals(!!inst, true, "Instantiation should return an instance object");
    const instanceId = inst.id;
    console.log(`Instance created: ${instanceId}`);
    
    // SPOP Sync Pulse: Instantiation persists async
    await new Promise(r => setTimeout(r, 50));
    
    // Phase 3: Verification
    const instanceRefs = context.getServiceReferences(INSTANCE_SERVICE, `(instance.id=${instanceId})`);
    const instanceRef = instanceRefs ? instanceRefs[0] : null;
    assertEquals(!!instanceRef, true, "Instance should be registered as an OSGi service");
    
    const instanceBucket = `realm.do.instances_${instanceId}`;
    const persistedInstanceRaw = globalThis.localStorage.getItem(instanceBucket);
    const persistedInstance = persistedInstanceRaw ? JSON.parse(persistedInstanceRaw) : pmSvc.load(instanceBucket);
    
    assertEquals(persistedInstance?.id, instanceId, "Instance should be persisted in storage bucket");
    assertEquals(persistedInstance?.blueprintId, blueprintId, "Instance should reference correct blueprint");
    console.log("Phase 3 (Gravity Cycle): SUCCESS");
    
    // 5. Liquidation (Cleanup)
    console.log(`Liquidating instance [${instanceId}]...`);
    registry.removeInstance(instanceId);
    
    // SPOP Sync Pulse: Removal is async
    await new Promise(r => setTimeout(r, 50));
    
    const purgedRefs = context.getServiceReferences(INSTANCE_SERVICE, `(instance.id=${instanceId})`);
    const purgedRef = purgedRefs ? purgedRefs[0] : null;
    assertEquals(!!purgedRef, false, "Instance service should be unregistered after removal");
    
    const purgedBucket = globalThis.localStorage.getItem(instanceBucket);
    console.log(`Debug: Purged bucket value: [${purgedBucket}]`);
    // Note: JSON.stringify(null) is "null", and some PMs might store it as a string
    const isActuallyPurged = purgedBucket === null || purgedBucket === "null";
    assertEquals(isActuallyPurged, true, "Instance storage bucket should be purged");
    console.log("Phase 4 (Liquidation): SUCCESS");

    // --- PHASE 6: AGENT RESIDENCY VERIFICATION ---
    console.log("\n--- Starting Phase 6: Agent Residency Verification ---");
    const AGENT_SERVICE = "org.neverplayed.agent.AgentService";
    
    // 1. Service Discovery
    const agentRef = context.getServiceReference(AGENT_SERVICE);
    if (!agentRef) throw new Error(`${AGENT_SERVICE} not found`);
    // deno-lint-ignore no-explicit-any
    const agent = context.getService(agentRef) as any;
    console.log("[Harness] Antigravity Agent discovered in the Core Realm.");

    // 2. Telemetry Check
    const status = agent.status();
    console.log(`[Agent Telemetry] Bundles: ${status.bundleMetrics.active}/${status.bundleMetrics.total} ACTIVE`);
    assertEquals(status.healthy, true, "Agent should report healthy system state");

    // 3. Audit Check
    const report = agent.audit();
    console.log(`[Agent Audit] findings: ${report.findings.length}`);
    assertEquals(report.findings.length, 0, "Initial foundation should have zero architectural violations");

    // 4. Persistence Check
    const agentBucket = "realm.agent.antigravity_audit_log";
    const auditLogRaw = globalThis.localStorage.getItem(agentBucket);
    const auditLog = auditLogRaw ? JSON.parse(auditLogRaw) : [];
    assertEquals(auditLog.length > 0, true, "Agent should have recorded its first audit");
    console.log("Phase 6 (Agent Residency): SUCCESS");

    console.log("\n--- ALL COMPLEX INTEGRATION STEPS PASSED ---");

    // 6. Shutdown
    await harness.stop();
  },
});
