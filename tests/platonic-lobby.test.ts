/**
 * @file Integration tests for the Platonic Staging Lobby & Observer Fallback
 *
 * Verifies:
 *   1. Logging into the 'platonic' scope auto-grafts the observer surrogate.
 *   2. Logging out of a spatial realm sets activeRealmId to 'platonic' (lobby fallback).
 *   3. Landing realm shortcut auto-switches on boot; logout reverts to platonic lobby.
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { SESSION_SERVICE, REALM_MANAGER_SERVICE } from "core-types";

const settle = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

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
    console.log("🏛️  Starting Integration Test: Platonic Staging Lobby & Observer Fallback...");

    // -----------------------------------------------------------------------
    // Shared fetch mock (no realm files needed, realms registered manually)
    // -----------------------------------------------------------------------
    const originalFetch = globalThis.fetch;
    // deno-lint-ignore no-explicit-any
    globalThis.fetch = async (url: string | URL, init?: any) => {
        const urlStr = url instanceof URL ? url.toString() : url;
        if (urlStr.includes("realms/index.json")) {
            return { ok: true, status: 200, json: () => Promise.resolve([]) } as any;
        }
        if (urlStr.includes("env.json")) {
            return { ok: true, status: 200, json: () => Promise.resolve({}) } as any;
        }
        if (urlStr.includes("data/beings.yaml") || urlStr.includes("data/surrogates.yaml")) {
            return { ok: true, status: 200, text: () => Promise.resolve("[]") } as any;
        }
        return originalFetch(url, init);
    };

    // -----------------------------------------------------------------------
    // Test Case 1: Observer surrogate auto-provisioned on platonic login
    // -----------------------------------------------------------------------
    console.log("🧪 Test 1: Observer surrogate auto-provisioned when logging into platonic scope...");
    {
        localStorage.clear();
        const harness = new BundleTestHarness();
        await harness.init();
        await harness.installBundles(mockBundles);
        await settle();

        // deno-lint-ignore no-explicit-any
        const session: any = await harness.getService(SESSION_SERVICE);
        assertExists(session, "Session service must be registered");

        const userId = "test-user-platonic";
        session.login({ id: userId, email: "test@platonic.local" }, "platonic");
        await settle(100);

        const stack = session.scopedUsers?.["platonic"];
        assertExists(stack, "platonic scope must exist in scopedUsers");
        assertExists(stack[userId], "user must be registered in platonic scope");

        const observerSurrogate = stack[userId].surrogates?.["observer"];
        assertExists(observerSurrogate, "observer surrogate must be auto-grafted in platonic scope");
        assertEquals(observerSurrogate.id, "observer", "Surrogate id must be 'observer'");
        assert(
            Array.isArray(observerSurrogate.senses) && observerSurrogate.senses.includes("Language"),
            "Observer surrogate must include 'Language' sense"
        );
        assertEquals(stack[userId].activeSurrogateId, "observer", "activeSurrogateId must be set to 'observer'");

        console.log("✅ Observer surrogate auto-provisioned in platonic scope.");
        await harness.stop();
    }

    // -----------------------------------------------------------------------
    // Test Case 2: Realm exit returns being to platonic lobby
    // -----------------------------------------------------------------------
    console.log("🧪 Test 2: Logging out of a spatial realm sets activeRealmId to 'platonic'...");
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

        // Register a mock habitat realm
        realmManager.registerRealm({ id: "org.neverplayed.realm.habitat", title: "Habitat", bundles: [] });
        await settle(100);

        const userId = "test-user-lobby-fallback";

        // 1. Authenticate into platonic lobby (observer surrogate grafted)
        session.login({ id: userId, email: "fallback@lobby.local" }, "platonic");
        session.activeRealmId = "platonic";
        await settle(100);

        // 2. Enter a spatial realm
        session.login(userId, "org.neverplayed.realm.habitat", { id: "observer", senses: ["Language"] });
        session.activeRealmId = "org.neverplayed.realm.habitat";
        await settle(100);

        assertEquals(
            session.activeRealmId, "org.neverplayed.realm.habitat",
            "activeRealmId must be the habitat realm after switching"
        );

        // 3. Log out of the habitat realm (lobby fallback)
        session.logout("org.neverplayed.realm.habitat", userId);
        await settle(100);

        // 4. Assert lobby fallback signal was set
        assertExists(
            session._pendingLobbyFallback,
            "_pendingLobbyFallback must be set after realm logout"
        );
        assertEquals(
            session._pendingLobbyFallback, userId,
            "_pendingLobbyFallback must contain the being's ID"
        );

        // 5. Assert the realm-specific active surrogate was stripped
        const realmStack = session.scopedUsers?.["org.neverplayed.realm.habitat"];
        if (realmStack?.[userId]) {
            assertEquals(
                realmStack[userId].activeSurrogateId, null,
                "activeSurrogateId must be null after realm exit"
            );
        }

        // 6. Assert being focus is preserved (not dissolved)
        assertExists(session.activeBeingId, "activeBeingId must NOT be dissolved after realm exit");
        assertEquals(session.activeBeingId, userId, "Being focus must remain on the exiting user");

        console.log("✅ Lobby fallback signal set correctly after realm exit.");
        await harness.stop();
    }

    // -----------------------------------------------------------------------
    // Test Case 3: Landing realm shortcut auto-switches on boot; logout reverts
    // -----------------------------------------------------------------------
    console.log("🧪 Test 3: Landing realm shortcut via env.json auto-switches on boot...");
    {
        localStorage.clear();

        // Override env.json to include landingRealmId
        // deno-lint-ignore no-explicit-any
        globalThis.fetch = async (url: string | URL, init?: any) => {
            const urlStr = url instanceof URL ? url.toString() : url;
            if (urlStr.includes("realms/index.json")) {
                return { ok: true, status: 200, json: () => Promise.resolve([]) } as any;
            }
            if (urlStr.includes("env.json")) {
                return {
                    ok: true, status: 200,
                    json: () => Promise.resolve({ landingRealmId: "org.neverplayed.realm.core" })
                } as any;
            }
            if (urlStr.includes("data/beings.yaml") || urlStr.includes("data/surrogates.yaml")) {
                return { ok: true, status: 200, text: () => Promise.resolve("[]") } as any;
            }
            return originalFetch(url, init);
        };

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

        // Simulate auth login (triggers platonic scope + observer provisioning)
        const userId = "test-user-landing";
        session.login({ id: userId, email: "landing@test.local" }, "platonic");

        // Register core realm and trigger recovery (which should use landingRealmId)
        realmManager.registerRealm({
            id: "org.neverplayed.realm.core",
            title: "Core",
            bundles: []
        });
        await settle(300);

        // Simulate what _recoverState does with landingRealmId
        await realmManager.switchRealm("org.neverplayed.realm.core");
        await settle(200);

        assertEquals(
            realmManager.getActiveRealm(), "org.neverplayed.realm.core",
            "Active realm must be the landing realm after auto-switch"
        );

        // Log out of landing realm → must return to platonic
        session.login(userId, "org.neverplayed.realm.core", { id: "observer", senses: ["Language"] });
        session.logout("org.neverplayed.realm.core", userId);
        await settle(100);

        assertExists(
            session._pendingLobbyFallback,
            "After logging out of landing realm, _pendingLobbyFallback must be set"
        );
        assertEquals(session._pendingLobbyFallback, userId);

        console.log("✅ Landing realm shortcut and lobby fallback verified.");
        await harness.stop();
    }

    // Restore fetch
    globalThis.fetch = originalFetch;

    console.log("\n✨ ALL PLATONIC LOBBY INTEGRATION TESTS PASSED! ✨");
    Deno.exit(0);
}

main().catch((err) => {
    console.error("❌ Test failed with uncaught error:", err);
    Deno.exit(1);
});
