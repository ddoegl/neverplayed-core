import { assertEquals, assertExists } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "../../../../tests/test-harness.ts";
import { STRATUM_SERVICE, SESSION_SERVICE, REALM_MANAGER_SERVICE } from "core-types";

Deno.test({
    name: "Stratum Core DOM Adapter Integration Suite",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async (t) => {
        // Mock headless user BEFORE harness init to bypass Firebase redirect
        // deno-lint-ignore no-explicit-any
        (globalThis as any).NEVERPLAYED_HEADLESS_USER = {
            email: "admin@neverplayed.org",
            uid: "admin-uid",
            isSuperuser: true,
            authorized: true
        };

        let activeRealm = "unknown";
        const harness = new BundleTestHarness();
        // deno-lint-ignore no-explicit-any
        const context = await harness.init() as any;
        if (!context) throw new Error("Harness context missing");

        // Dynamically import Alpine now that harness.init() has populated Happy DOM globals (window, MutationObserver)
        const AlpineModule = await import("alpinejs");
        // deno-lint-ignore no-explicit-any
        const Alpine: any = (AlpineModule as any).Alpine || (AlpineModule as any).default?.Alpine || (AlpineModule as any).default || AlpineModule;

        // Register mock Realm Manager
        context.registerService(REALM_MANAGER_SERVICE, {
            getActiveRealm: () => activeRealm,
            getHierarchy: (id: string) => Promise.resolve([id])
        });

        await t.step("Install Prerequisite Bundles", async () => {
            const bundles = [
                "bundles/org.neverplayed.persistence-deno/manifest.json",
                "bundles/org.neverplayed.persistence-selector/manifest.json",
                "bundles/org.neverplayed.system-logger/manifest.json",
                "bundles/org.neverplayed.session-service/manifest.json",
                "bundles/org.neverplayed.perceiver-service/manifest.json",
                "bundles/org.neverplayed.plexus-core/manifest.json",
                "bundles/org.neverplayed.plexus-enricher/manifest.json",
                "bundles/org.neverplayed.auth-shield/manifest.json",
                "bundles/org.neverplayed.limes/manifest.json",
                "bundles/vendor/org.pandino.event-admin/manifest.json",
                "bundles/org.neverplayed.stratum-core/manifest.json",
                "bundles/org.neverplayed.stratum-core-dom/manifest.json"
            ];
            await harness.installBundles(bundles);
            // Settle services
            await new Promise(r => setTimeout(r, 1000));
        });

        await t.step("Alpine Store Registration", () => {
            // deno-lint-ignore no-explicit-any
            const store = Alpine.store('stratum') as any;
            assertExists(store, "Alpine store 'stratum' should be registered");
            // The headless user is automatically logged in during auth-shield startup
            assertEquals(store.tenantId, "admin-uid");
            assertEquals(store.identityId, "admin-uid");
        });

        await t.step("State Synchronization from Stratum Core Service", async () => {
            // deno-lint-ignore no-explicit-any
            const stratumSvc: any = await harness.getService(STRATUM_SERVICE);
            assertExists(stratumSvc, "Stratum headless service should exist");

            // Shift mock realm and log into session to update state
            activeRealm = "realm-789";
            
            // deno-lint-ignore no-explicit-any
            const session: any = await harness.getService(SESSION_SERVICE);
            assertExists(session, "Session service should exist");
            session.login("identity-456", "global");

            // Also mutate perspective (which has a setter on the Stratum core service)
            stratumSvc.perspective = "realist";

            // Settle event delivery and reactive loops
            await new Promise(r => setTimeout(r, 300));

            // deno-lint-ignore no-explicit-any
            const store = Alpine.store('stratum') as any;
            assertEquals(store.tenantId, "identity-456");
            assertEquals(store.identityId, "identity-456");
            assertEquals(store.realmId, "realm-789");
            assertEquals(store.perspective, "realist");
        });

        await harness.stop();
    }
});
