/**
 * Verification Test for Lean Activator Pattern (Anti-Deadlock)
 * 
 * Simulates a circular dependency scenario where a high-level service (Limes)
 * depends on the PersistenceSelector, while the Selector depends on late-starting
 * providers.
 */

console.log("🚀 Starting Lean Activator & Deadlock Test...");

let passed = 0;

// 1. Mock Pandino Context & Registry
class MockRegistry {
  // deno-lint-ignore no-explicit-any
  services: Map<string, { service: any; props: Record<string, any> }> = new Map();
  // deno-lint-ignore ban-types
  trackers: Array<{ filter: string; callback: Function }> = [];

  // deno-lint-ignore no-explicit-any
  registerService(id: string, service: any, props: Record<string, any>) {
    console.log(`[Registry] Registered: ${id}`);
    this.services.set(id, { service, props });
    this.trackers.forEach(t => {
      if (t.filter.includes(id)) t.callback(service, props);
    });
  }

  // deno-lint-ignore no-explicit-any
  trackService(filter: string, optionsOrFn: any) {
    console.log(`[Registry] Tracking: ${filter}`);
    const addingService = typeof optionsOrFn === 'function' ? optionsOrFn : optionsOrFn.addingService;
    const tracker = { filter, callback: addingService };
    this.trackers.push(tracker);
    // Check existing
    this.services.forEach((val, key) => {
      // deno-lint-ignore no-explicit-any
      if (key === filter || filter.includes(key)) (addingService as any)(val.service, val.props);
    });
    return { open: () => {} };
  }
}

const registry = new MockRegistry();

// 2. Mock Persistence Selector (The Lean Activator)
class PersistenceSelector {
  _readyPromise: Promise<void>;
  // deno-lint-ignore ban-types
  _resolveReady!: Function;
  // deno-lint-ignore no-explicit-any
  _providers: any[] = [];

  constructor() {
    this._readyPromise = new Promise(resolve => {
      this._resolveReady = resolve;
    });
  }

  // deno-lint-ignore require-await no-explicit-any
  async start(_ctx: any) {
    console.log("[Selector] start() called (Non-blocking)");
    // Register IMMEDIATELY without awaiting tracking
    registry.registerService("@neverplayed/persistence-manager", this, { implementation: "selector-proxy" });
    
    // Background tracking
    // deno-lint-ignore no-explicit-any
    registry.trackService("@persistence-provider", (svc: any, _props: any) => {
      console.log("[Selector] Provider discovered!");
      this._providers.push(svc);
      if (this._providers.length > 0) this._resolveReady();
    });
    return Promise.resolve();
  }

  waitReady() {
    return this._readyPromise;
  }
}

// 3. Mock High-Level Service (Limes - The Dependent)
class LimesService {
  isStarted = false;

  // deno-lint-ignore require-await no-explicit-any
  async start(_ctx: any) {
    console.log("[Limes] start() called... waiting for PM");
    // deno-lint-ignore no-explicit-any
    registry.trackService("@neverplayed/persistence-manager", async (pm: any) => {
      await pm.waitReady();
      console.log("[Limes] PM Ready! Finishing boot.");
      this.isStarted = true;
    });
    return Promise.resolve();
  }
}

// --- TEST EXECUTION ---

(async () => {
  const selector = new PersistenceSelector();
  const limes = new LimesService();

  // A. Start Selector (Must not block)
  let selectorStartFinished = false;
  const _selectorStartOp = selector.start({}).then(() => { selectorStartFinished = true; });
  
  await new Promise(r => setTimeout(r, 10)); // Yield
  if (selectorStartFinished) {
    passed++;
    console.log("✅ Selector Start is non-blocking.");
  } else {
    console.error("❌ Selector Start blocked!");
  }

  // B. Start Limes (Must wait for PM)
  await limes.start({});
  if (!limes.isStarted) {
    passed++;
    console.log("✅ Limes is correctly awaiting PM readiness.");
  }

  // C. Register Provider (Must unblock Limes)
  registry.registerService("@persistence-provider", { type: "mock" }, { type: "provider" });
  
  await new Promise(r => setTimeout(r, 50)); // Yield
  if (limes.isStarted) {
    passed++;
    console.log("✅ Limes finished boot after Provider registration.");
  } else {
    console.error("❌ Limes still pending after Provider registration!");
  }

  console.log(`\nTest Finished: ${passed}/3 passed.`);
  if (passed === 3) {
    console.log("🎊 Lean Activator Pattern Verified! Deadlock hazard eliminated.");
  } else {
    Deno.exit(1);
  }
})();
