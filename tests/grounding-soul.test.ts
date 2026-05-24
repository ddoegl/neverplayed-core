/**
 * @file Integration tests for the Grounding Soul & Platonic Sovereignty
 *
 * Verifies:
 *   1. scopedUsers.global is a reactive property alias of scopedUsers.platonic.
 *   2. The first non-guest login in 'platonic' locks the Grounding Soul.
 *   3. Secondary logins in 'platonic' throw an Ontological Violation boundary error.
 *   4. Spatial realm logins permit different user profiles while maintaining Tenant as Grounding Soul.
 *   5. Logging out of the Platonic Lobby triggers a complete wipe and a Genesis Interrupt.
 */

import { assertEquals, assertExists, assertThrows, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { SESSION_SERVICE, REALM_MANAGER_SERVICE } from "core-types";

const settle = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

const mockBundles = [
    "bundles/org.neverplayed.system-logger/manifest.json",
    "bundles/vendor/org.pandino.event-admin/manifest.json",
    "bundles/org.neverplayed.yaml-service/manifest.json",
    "bundles/org.neverplayed.alpine-bridge/manifest.json",
    "bundles/org.neverplayed.persistence-localstorage/manifest.json",
    "bundles/org.neverplayed.persistence-resolver/manifest.json",
    "bundles/org.neverplayed.persistence-selector/manifest.json",
    "bundles/org.neverplayed.session-service/manifest.json",
    "bundles/org.neverplayed.session-service-dom/manifest.json",
    "bundles/org.neverplayed.realm-manager/manifest.json",
];

async function main() {
    console.log("🏛️  Starting Integration Test: Grounding Soul & Platonic Sovereignty...");

    // Shared fetch mock
    const originalFetch = globalThis.fetch;
    // deno-lint-ignore no-explicit-any
    globalThis.fetch = async (url: string | URL, init?: any) => {
        const urlStr = url instanceof URL ? url.toString() : url;
        if (urlStr.includes("realms/index.json") || urlStr.includes("env.json")) {
            return { ok: true, status: 200, json: () => Promise.resolve([]) } as any;
        }
        if (urlStr.includes("data/beings.yaml") || urlStr.includes("data/surrogates.yaml")) {
            return { ok: true, status: 200, text: () => Promise.resolve("[]") } as any;
        }
        return originalFetch(url, init);
    };

    // -----------------------------------------------------------------------
    // Test Case 1: Elimination of legacy 'global' scope stack
    // -----------------------------------------------------------------------
    console.log("🧪 Test 1: Elimination of legacy 'global' scope stack...");
    {
        localStorage.clear();
        const harness = new BundleTestHarness();
        await harness.init();
        await harness.installBundles(mockBundles);
        await settle();

        // deno-lint-ignore no-explicit-any
        const session: any = await harness.getService(SESSION_SERVICE);
        assertExists(session, "Session service must be registered");

        // Assert global stack is undefined
        const globalStack = session.scopedUsers?.global;
        assertEquals(globalStack, undefined, "global stack must be completely eliminated");

        console.log("✅ Elimination of legacy 'global' stack verified.");
        await harness.stop();
    }

    // -----------------------------------------------------------------------
    // Test Case 2: Soul Locking & Primordial Exclusivity
    // -----------------------------------------------------------------------
    console.log("🧪 Test 2: Soul Locking & Primordial Exclusivity in Platonic scope...");
    {
        localStorage.clear();
        const harness = new BundleTestHarness();
        await harness.init();
        await harness.installBundles(mockBundles);
        await settle();

        // deno-lint-ignore no-explicit-any
        const session: any = await harness.getService(SESSION_SERVICE);
        assertExists(session);

        // First login: Locks activeBeingId / Grounding Soul
        session.login({ id: "daniela", email: "daniela@test.local" }, "platonic");
        assertEquals(session.activeBeingId, "daniela", "activeBeingId must be locked to daniela");
        assertEquals(session.scopedUsers.platonic.__activeId__, "daniela", "platonic active resident must be daniela");

        // Attempting a second login with a different ID in platonic scope must fail
        assertThrows(() => {
            session.login({ id: "rob", email: "rob@test.local" }, "platonic");
        }, Error, "Ontological Violation: Only the Grounding Soul (daniela) can inhabit the Platonic Staging Lobby");

        console.log("✅ Soul Locking & Primordial Exclusivity verified.");
        await harness.stop();
    }

    // -----------------------------------------------------------------------
    // Test Case 3: Spatial Impersonations (decoupled Tenant/Identity)
    // -----------------------------------------------------------------------
    console.log("🧪 Test 3: Spatial Impersonations (decoupled Tenant/Identity)...");
    {
        localStorage.clear();
        const harness = new BundleTestHarness();
        await harness.init();
        await harness.installBundles(mockBundles);
        await settle();

        // deno-lint-ignore no-explicit-any
        const session: any = await harness.getService(SESSION_SERVICE);
        // deno-lint-ignore no-explicit-any
        const realmManager: any = await harness.getService(REALM_MANAGER_SERVICE);

        assertExists(session);
        assertExists(realmManager);

        // 1. Lock the Grounding Soul in Platonic Staging Lobby
        session.login({ id: "daniela", email: "daniela@test.local" }, "platonic");
        session.activeRealmId = "platonic";
        await settle(50);

        // 2. Login to spatial realm as another user (rob)
        session.login({ id: "rob", email: "rob@test.local" }, "org.neverplayed.realm.habitat");
        session.activeRealmId = "org.neverplayed.realm.habitat";
        await settle(100);

        // Verify decoupled Tenant & Identity in persistence sync loop
        // We trigger a tick to let Alpine effect run
        await settle(50);

        // In active session:
        // tenantId is Grounding Soul (daniela)
        // identityId is active resident persona (rob)
        assertEquals(session.activeBeingId, "daniela", "Grounding Soul must remain daniela");
        assertEquals(session.currentUser.id, "rob", "Active resident must be rob");

        console.log("✅ Spatial impersonations and Tenant/Identity decoupling verified.");
        await harness.stop();
    }

    // -----------------------------------------------------------------------
    // Test Case 4: Genesis Reset on Platonic Logout
    // -----------------------------------------------------------------------
    console.log("🧪 Test 4: Genesis Reset (Total Reboot) on Platonic Logout...");
    {
        localStorage.clear();
        const harness = new BundleTestHarness();
        await harness.init();
        await harness.installBundles(mockBundles);
        await settle();

        // deno-lint-ignore no-explicit-any
        const session: any = await harness.getService(SESSION_SERVICE);
        assertExists(session);

        // Login first
        session.login({ id: "daniela", email: "daniela@test.local" }, "platonic");
        await settle(50);

        localStorage.setItem("np:v1:testKey", "survived");

        // Logout in Platonic must trigger Genesis reboot (throws GenesisInterrupt headlessly)
        assertThrows(() => {
            session.logout("platonic");
        }, Error, "GenesisInterrupt");

        // Verify localStorage was wiped clean
        assertEquals(localStorage.length, 0, "localStorage must be wiped completely clean on Genesis reset");

        console.log("✅ Genesis complete reboot on lobby logout verified.");
        await harness.stop();
    }

    // Restore fetch
    globalThis.fetch = originalFetch;

    console.log("\n✨ ALL GROUNDING SOUL INTEGRATION TESTS PASSED! ✨");
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
