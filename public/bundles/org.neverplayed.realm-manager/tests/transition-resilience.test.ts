import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Realm Manager Transition Resilience Test
 * Verifies that 'startupFlow' policies wait for their services to arrive.
 */
Deno.test({
  name: "[org.neverplayed.realm-manager] Resilience: Startup Flow Delay",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // 1. Mock Environment
    const flows = new Map();
    let launchCalled = false;

    // @ts-ignore
    globalThis.document = {
      getElementById: (id: string) => ({ id }),
      dispatchEvent: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    // @ts-ignore
    globalThis.CustomEvent = class { constructor(n: string, d: any) { this.detail = d?.detail; } };
    // @ts-ignore
    globalThis.dispatchEvent = () => {};
    // @ts-ignore
    globalThis.location = { origin: "http://localhost" };
    // @ts-ignore
    globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) });

    const { default: Activator } = await import("../activator.js");
    const activator = new Activator();

    // 2. Mock OSGi Context
    let flowTrackerHooks: any = null;
    const mockContext = {
      getBundle: () => ({ 
          getSymbolicName: () => "test.bundle",
          getHeaders: () => ({}),
          getLocation: () => "/test.bundle",
          getState: () => 32
      }),
      getBundles: () => [],
      trackService: (filter: string, hooks: any) => {
        if (filter.includes("FlowService")) {
            flowTrackerHooks = hooks;
            return { open: () => {
                // Register a dummy flow to trigger _flowService synthesis
                flowTrackerHooks.addingService({
                    getProperty: (p: string) => p === "flow.id" ? "bootstrap-flow" : null,
                    id: "bootstrap-flow",
                    launch: () => {}
                });
            }, close: () => {} };
        }
        return { open: () => {}, close: () => {} };
      },
      registerService: (name: string, svc: any) => {
          return { unregister: () => {}, setProperties: () => {} };
      },
      getService: (ref: any) => ref,
      getServiceReference: () => null
    };

    // 3. Start Manager
    // @ts-ignore
    await activator.start(mockContext);
    
    // 4. Register a Realm with a Startup Flow
    const testRealm = {
        id: "test-realm",
        title: "Test Realm",
        startupFlow: "test-flow",
        bundles: []
    };
    // @ts-ignore
    await activator._registerRealm(testRealm);

    // 5. Trigger Switch
    // @ts-ignore
    const transitionPromise = activator._switchRealm(mockContext, "test-realm");
    
    // 6. Simulate Late Arrival of Flow Service (after 500ms)
    setTimeout(() => {
        flowTrackerHooks.addingService({
            getProperty: (p: string) => p === "flow.id" ? "test-flow" : null,
            id: "test-flow",
            launch: () => { launchCalled = true; }
        });
    }, 500);

    await transitionPromise;
    
    // Wait for the background launch to complete
    let attempts = 0;
    while (!launchCalled && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    assertEquals(launchCalled, true, "Startup flow should be launched after service arrives");
  }
});
