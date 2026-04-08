import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { SESSION_SERVICE, SELECTION_SERVICE } from "../public/core-types.js";

Deno.test("Harmonization: Selection Service Resets on Session Logout", async () => {
    const harness = new BundleTestHarness();
    const context = await harness.init();
    if (!context) throw new Error("Harness context missing");

    // 1. Install Persistence Manager Mock (required by Session Service)
    const pm = {
        load: () => null,
        store: () => {},
        waitReady: () => Promise.resolve()
    };
    context.registerService("@pandino/persistence-manager/PersistenceManager", pm);

    // 2. Install Infrastructure and Services
    await harness.installBundles([
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/org.neverplayed.alpine-bridge/manifest.json",
        "bundles/org.neverplayed.session-service/manifest.json",
        "bundles/org.neverplayed.selection-service/manifest.json"
    ]);

    // deno-lint-ignore no-explicit-any
    const session: any = await harness.getService(SESSION_SERVICE);
    // deno-lint-ignore no-explicit-any
    const selection: any = await harness.getService(SELECTION_SERVICE);

    // 3. Setup Initial State (Login and Select)
    session.activeFlowId = "business"; // Engage the business scope reactive track
    session.login({ id: "user-123", email: "test@neverplayed.com" }, "business");
    selection.setSelection({ currentLicenseId: "lic-456" }, "business");

    assertEquals(selection.getSelection("business").currentLicenseId, "lic-456", "Initial selection should be set.");

    // 4. Perform Logout
    console.log("TEST: Performing logout...");
    session.logout("business");

    // 5. Verify Coordination (Reactive Reset)
    // We wait a tick for Alpine effect to propagate
    await new Promise<void>(r => setTimeout(r, 100));

    const finalSelection = selection.getSelection("business");
    assertEquals(finalSelection.currentLicenseId, null, "Selection should be reset to null after logout.");
    
    console.log("✅ Harmonization Sync Test PASSED.");
    await harness.stop();
});
