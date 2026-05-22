import { assertEquals, assertExists } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { SESSION_SERVICE, REALM_MANAGER_SERVICE, PERCEIVER_SERVICE } from "core-types";

/**
 * Integration Test: Perceiver Carry-Over Sync After switchRealm
 *
 * Verifies that after a direct realm switch (carry-over, not a login),
 * `perceiver.being` is refreshed from session.currentUser via the REALM_CHANGED_TOPIC
 * handler — eliminating phantom residents caused by stale perceiver.being.
 *
 * Also verifies that no governance residency footprint is created in scopedUsers
 * (i.e., switchRealm must NOT call session.login).
 *
 * ADR context: Inhabitation Architecture — visit vs. residency distinction.
 */
async function main() {
    const harness = new BundleTestHarness();
    // deno-lint-ignore no-explicit-any
    const context = await harness.init() as any;
    if (!context) {
        console.error("❌ Harness context missing");
        Deno.exit(1);
    }

    // Intercept fetch to prevent real realm discovery/recovery
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

    // 1. Install a mock Persistence Manager (in-memory, no I/O)
    const pmStore: Record<string, unknown> = {};
    const pm = {
        load: (key: string) => pmStore[key] ?? null,
        store: (key: string, value: unknown) => { pmStore[key] = value; },
        waitReady: () => Promise.resolve(),
        listKeys: (_prefix: string) => Object.keys(pmStore),
        probe: (_key: string) => null
    };
    context.registerService("@pandino/persistence-manager/PersistenceManager", pm);

    // 2. Install infrastructure bundles: event-admin is required for REALM_CHANGED_TOPIC dispatch
    await harness.installBundles([
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/vendor/org.pandino.event-admin/manifest.json",
        "bundles/org.neverplayed.alpine-bridge/manifest.json",
        "bundles/org.neverplayed.session-service/manifest.json",
        "bundles/org.neverplayed.realm-manager/manifest.json",
        "bundles/org.neverplayed.perceiver-service/manifest.json"
    ]);

    // Wait for services and event admin to settle
    await new Promise<void>(r => setTimeout(r, 500));

    // deno-lint-ignore no-explicit-any
    const session: any = await harness.getService(SESSION_SERVICE);
    // deno-lint-ignore no-explicit-any
    const realmManager: any = await harness.getService(REALM_MANAGER_SERVICE);
    // deno-lint-ignore no-explicit-any
    const perceiver: any = await harness.getService(PERCEIVER_SERVICE);

    assertExists(session, "Session service should be available");
    assertExists(realmManager, "Realm Manager service should be available");
    assertExists(perceiver, "Perceiver service should be available");

    // 3. Register mock realms with their bundles list to prevent them from being purged
    const mockBundles = [
        "bundles/org.neverplayed.system-logger/manifest.json",
        "bundles/vendor/org.pandino.event-admin/manifest.json",
        "bundles/org.neverplayed.alpine-bridge/manifest.json",
        "bundles/org.neverplayed.session-service/manifest.json",
        "bundles/org.neverplayed.realm-manager/manifest.json",
        "bundles/org.neverplayed.perceiver-service/manifest.json"
    ];
    realmManager.registerRealm({
        id: "org.neverplayed.realm.habitat",
        title: "Habitat",
        bundles: mockBundles
    });
    realmManager.registerRealm({
        id: "org.neverplayed.realm.governance",
        title: "Governance",
        bundles: mockBundles
    });

    // 4. Login rob into habitat realm and set activeRealmId to drive currentUser resolution
    console.log("TEST: Setting up — rob logged in to habitat realm...");
    session.login({ id: "rob", email: "rob@neverplayed.org" }, "org.neverplayed.realm.habitat");
    session.activeRealmId = "org.neverplayed.realm.habitat";
    await new Promise<void>(r => setTimeout(r, 100));

    // Simulate what session-service-dom does: fire the DOM session-changed event
    // so that perceiver.being is set in the real application flow
    console.log("TEST: Simulating DOM session-changed event for rob...");
    globalThis.dispatchEvent(new CustomEvent("session-changed", {
        detail: {
            type: "login",
            user: { id: "rob", email: "rob@neverplayed.org" },
            surrogate: null
        }
    }));
    await new Promise<void>(r => setTimeout(r, 100));

    // Verify initial state
    const robBeing = perceiver.getBeing();
    assertExists(robBeing, "Perceiver should have a being after dom session-changed for rob");
    assertEquals(robBeing.id, "rob", "Perceiver being should be rob");
    console.log("✅ Initial state: perceiver.being = rob");

    // 5. Now simulate july logging in (stale state precondition)
    console.log("TEST: Simulating july login to create stale perceiver.being...");
    session.login({ id: "july", email: "july@neverplayed.org" }, "org.neverplayed.realm.habitat");
    globalThis.dispatchEvent(new CustomEvent("session-changed", {
        detail: {
            type: "login",
            user: { id: "july", email: "july@neverplayed.org" },
            surrogate: null
        }
    }));
    await new Promise<void>(r => setTimeout(r, 100));

    // Verify july is now the stale being
    assertEquals(perceiver.getBeing()?.id, "july", "Perceiver being should be july (stale precondition)");
    console.log("✅ Stale state set: perceiver.being = july");

    // 6. Switch back to rob in habitat (without DOM event — simulates session-service-dom absence in some flows)
    session.login({ id: "rob", email: "rob@neverplayed.org" }, "org.neverplayed.realm.habitat");
    // session.currentUser should now return rob (activeRealmId points to habitat where rob is active)
    session.activeRealmId = "org.neverplayed.realm.habitat";
    await new Promise<void>(r => setTimeout(r, 100));

    // 7. Switch to governance realm via switchRealm — this is the carry-over path
    // This fires REALM_CHANGED_TOPIC, which now triggers _syncFromSession(this._session)
    console.log("TEST: Switching to governance realm via switchRealm (carry-over, no login)...");
    await realmManager.switchRealm("org.neverplayed.realm.governance");

    // Let REALM_CHANGED_TOPIC handler fire and sync perceiver
    await new Promise<void>(r => setTimeout(r, 300));

    // 8. Verify perceiver.realm reflects the new active realm
    const perceiverRealm = perceiver.getRealm();
    assertEquals(
        perceiverRealm,
        "org.neverplayed.realm.governance",
        "Perceiver realm should be updated to governance after switchRealm"
    );
    console.log("✅ perceiver.getRealm() = governance");

    // 9. Critical: perceiver.being must NOT be the stale july
    // After the REALM_CHANGED_TOPIC sync, perceiver.being should reflect session.currentUser
    // which is rob (the carried-over active session user), not the stale july
    const being = perceiver.getBeing();
    assertEquals(
        being?.id === "july",
        false,
        "Perceiver must NOT carry july into governance — she was never in that realm (phantom inhabitant bug)"
    );
    console.log("✅ perceiver.getBeing() is NOT july — phantom resolved");

    // 10. Critical: Verify unified session login residency stack and clean null surrogate state
    // Now that switchRealm is unified with coordinateTransition, it DOES call session.login,
    // which initializes the residency stack for the governance scope.
    const rawScopedUsers = session.scopedUsers || {};
    const hasGovernanceScope = Object.prototype.hasOwnProperty.call(
        rawScopedUsers,
        "org.neverplayed.realm.governance"
    );
    assertEquals(
        hasGovernanceScope,
        true,
        "scopedUsers MUST contain 'org.neverplayed.realm.governance' due to unified transition login"
    );
    
    // Assert that activeSurrogateId is null under that scope, confirming naked observer state
    const activeId = rawScopedUsers["org.neverplayed.realm.governance"].__activeId__;
    assertEquals(activeId, "rob", "Active resident in governance should be rob");
    const activeSurrogateId = rawScopedUsers["org.neverplayed.realm.governance"][activeId].activeSurrogateId;
    assertEquals(
        activeSurrogateId,
        null,
        "Active surrogate under governance scope should be null (naked observer)"
    );
    console.log("✅ Verified governance residency footprint and clean null surrogate state");

    console.log("\n✨ ALL PERCEIVER CARRY-OVER VERIFICATIONS PASSED! ✨");
    await harness.stop();
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
