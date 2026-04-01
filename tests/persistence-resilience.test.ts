import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";

// Shared mock setup for shunting verification
function setupShuntMock(_harness: BundleTestHarness) {
    let shuntProcessed = false;
    // deno-lint-ignore no-explicit-any
    const originalFetch = (globalThis as any).fetch;
    
    // deno-lint-ignore no-explicit-any
    (globalThis as any).fetch = async (url: string | URL, init?: any) => {
        const urlStr = url.toString();
        if (urlStr.includes("mcpapi")) {
            shuntProcessed = true;
            return {
                ok: true,
                json: () => Promise.resolve({ success: true, data: {} })
            };
        }
        return await originalFetch(url, init);
    };

    return {
        getProcessed: () => shuntProcessed,
        reset: () => { shuntProcessed = false; },
        // deno-lint-ignore no-explicit-any
        restore: () => { (globalThis as any).fetch = originalFetch; }
    };
}

Deno.test("Persistence Resilience: Sanity Scrubbing (Architecture Violation Protection)", async () => {
    const harness = new BundleTestHarness();
    await harness.init();
    const mock = setupShuntMock(harness);
    
    // 1. Install Persistence Firebase
    await harness.installBundles(["bundles/org.neverplayed.persistence-firebase/manifest.json"]);
    
    // deno-lint-ignore no-explicit-any
    const pm = await harness.getService("@pandino/persistence-manager/PersistenceManager") as any;
    
    // 2. Attempt to store an object with a function (Violation)
    const payload = {
        id: "test-item",
        callback: () => console.log("I am a function"),
        metadata: {
            nested: () => "I am also a function",
            data: "I am serializable"
        }
    };
    
    // 3. Store and Verify
    await pm.store("violation-test", payload);
    const loaded = await pm.load("violation-test");
    
    assertEquals(typeof loaded.callback, "undefined", "Function should have been stripped.");
    assertEquals(typeof loaded.metadata.nested, "undefined", "Nested function should have been stripped.");
    assertEquals(loaded.metadata.data, "I am serializable", "Data should remain intact.");
    
    console.log("✅ Sanity Scrubbing PASSED.");
    mock.restore();
    await harness.stop();
});

Deno.test("Persistence Resilience: Store & Forward (Early Boot Shunting)", async () => {
    const harness = new BundleTestHarness();
    await harness.init();
    const mock = setupShuntMock(harness);
    
    // 1. Mock AuthShield to start in UNAUTHENTICATED mode
    // deno-lint-ignore no-explicit-any
    (globalThis as any).NEVERPLAYED_GET_ID_TOKEN = () => Promise.resolve(null);
    
    await harness.installBundles(["bundles/org.neverplayed.persistence-firebase/manifest.json"]);
    // deno-lint-ignore no-explicit-any
    const pm = await harness.getService("@pandino/persistence-manager/PersistenceManager") as any;
    
    // 2. Trigger a store (SDK failure mocked by harness's lack of Firebase)
    await pm.store("deferred-test", { status: "pending" });
    
    // 3. Verify it's in the volatile cache
    assertEquals((await pm.load("deferred-test")).status, "pending");
    
    // 4. Mock identity establishment
    // deno-lint-ignore no-explicit-any
    (globalThis as any).NEVERPLAYED_GET_ID_TOKEN = () => Promise.resolve("mock-valid-token");
    
    // 5. Wait for the queue processor
    let attempts = 0;
    while (!mock.getProcessed() && attempts < 30) {
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
    
    assertEquals(mock.getProcessed(), true, "Shunt should have been eventually processed after identity was established.");
    
    console.log("✅ Store & Forward Shunting PASSED.");
    mock.restore();
    await harness.stop();
});
