import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import Pandino from "npm:@pandino/pandino";
import loaderConfiguration from "../../../../scripts/deno-loader-configuration.ts";
import { Window } from "npm:happy-dom";

/**
 * Core Realm Test Harness
 * 
 * This test verifies that the institutional core infrastructure (foundational bundles)
 * can be correctly loaded and activated in a Deno-native OSGi environment with 
 * a simulated browser context (HappyDOM + Alpine.js).
 */

// 1. Setup Virtual Browser Environment
const window = new Window();
const document = window.document;

// 2. Map Globals (Must happen BEFORE importing Alpine)
// deno-lint-ignore no-explicit-any
const g = globalThis as any;
const originalFetch = g.fetch;
const originalDispatchEvent = g.dispatchEvent;

Object.assign(g, {
  window,
  document,
  location: { href: "http://localhost/" },
  Node: window.Node,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  HTMLSpanElement: window.HTMLSpanElement,
  HTMLButtonElement: window.HTMLButtonElement,
  MutationObserver: window.MutationObserver,
  CustomEvent: window.CustomEvent,
  ShadowRoot: window.ShadowRoot,
  DocumentFragment: window.DocumentFragment,
  NodeList: window.NodeList,
  HTMLCollection: window.HTMLCollection,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  navigator: window.navigator,
  self: window,
  customElements: window.customElements,
  localStorage: window.localStorage,
  // deno-lint-ignore no-explicit-any
  CSSStyleSheet: (window as any).CSSStyleSheet,

  // Fix: Some bundles use globalThis.dispatchEvent which can clash in Deno
  // We prioritize the virtual window but fallback to Deno's native dispatcher for lifecycle events
  dispatchEvent: (event: Event) => {
    try {
        // deno-lint-ignore no-explicit-any
        const result = window.dispatchEvent(event as any);
        // If HappyDOM handled it or returned true, we are good
        if (result) return result;
    } catch (_e) {
        // Fallback for non-standard or native Deno event objects (like beforeunload)
    }
    return originalDispatchEvent?.call(g, event);
  },

  // Polyfill fetch to handle relative and absolute-looking URLs in headless mode
  fetch: async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    
    // Ignore real external URLs
    if (url.startsWith('http') && !url.startsWith('http://localhost/')) {
        return originalFetch(input, init);
    }

    // Normalize path for filesystem resolution
    let path = url;
    if (path.startsWith('http://localhost/')) {
        path = path.slice('http://localhost/'.length);
    }
    // Strip leading ./ or /
    path = path.startsWith('./') ? path.slice(2) : path;
    if (path.startsWith('/')) path = path.slice(1);

    // Candidates for file resolution
    const candidates = [
        Deno.cwd() + "/public/" + path,
        Deno.cwd() + "/public/bundles/" + path,
        Deno.cwd() + "/public/domain-objects/" + path,
    ];

    for (const fullPath of candidates) {
        try {
            const info = await Deno.stat(fullPath);
            if (!info.isFile) continue;

            const content = await Deno.readTextFile(fullPath);
            let contentType = 'text/plain';
            if (url.endsWith('.json')) contentType = 'application/json';
            else if (url.endsWith('.yaml') || url.endsWith('.yml')) contentType = 'text/yaml';
            else if (url.endsWith('.js')) contentType = 'application/javascript';
            
            return new Response(content, { 
                status: 200, 
                headers: { 'content-type': contentType } 
            });
        } catch (_e) {
            // Not found in this candidate, try next
        }
    }

    // console.warn(`Harness fetch: 404 - ${url}`);
    return new Response("Not Found", { status: 404 });
  }
});

// 2.1 Setup Headless User for Auth Shield bypass
g.NEVERPLAYED_HEADLESS_USER = {
    email: "test-harness@neverplayed.dev",
    uid: "test-harness-uid",
    isSuperuser: true,
    attributes: {
        "neverplayed-admin": true
    }
};

// 3. Initialize Alpine.js
const AlpineModule = await import("npm:alpinejs");
const Alpine = AlpineModule.Alpine || AlpineModule.default?.Alpine || AlpineModule.default || AlpineModule;
Alpine.start();

const MY_DEPLOY_ROOT = Deno.cwd() + "/public/bundles";

Deno.test({
  name: "Core Realm Harness: Foundation Activation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // 1. Load Realm Specification
    console.log("Loading realm: public/realms/core.json");
    const coreText = await Deno.readTextFile("./public/realms/core.json");
    const core = JSON.parse(coreText);  


    console.log("Loading realm: public/realms/foundation.json");
    const foundationText = await Deno.readTextFile("./public/realms/foundation.json");
    const foundation = JSON.parse(foundationText);
    
    // Normalize paths: realm uses "./bundles/..." while deployment root is "public/bundles"
    const bundlePaths = [...core.bundles,...foundation.bundles ].map((path: string) => {
        return path.replace(/^\.\/bundles\//, "./");
    });
    
    // TDD Enhancement: Inject LocalStorage Provider and Antigravity Agent
    bundlePaths.unshift("./org.neverplayed.persistence-deno-localstorage/manifest.json");
    bundlePaths.push("./org.neverplayed.agent.antigravity/manifest.json");

    // 2. Initialize Pandino
    const pandino = new Pandino({
      ...loaderConfiguration,
      "pandino.deployment.root": MY_DEPLOY_ROOT,
    });

    await pandino.init();
    await pandino.start();

    const context = pandino.getBundleContext();

    // 3. Sequential Installation and Activation
    console.log(`\n--- Starting Core Realm: ${core.title} ---`);
    console.log(core.description);
    
    for (const path of bundlePaths) {
        try {
            await context.installBundle(path);
        } catch (e) {
            console.error(`ERROR: Failed to install/start bundle at ${path}`);
            throw e;
        }
    }

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
    await pandino.stop();
  },
});
