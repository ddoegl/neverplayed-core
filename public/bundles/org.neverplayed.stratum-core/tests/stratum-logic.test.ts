import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { SESSION_SERVICE, REALM_MANAGER_SERVICE, PERSISTENCE_MANAGER_SERVICE } from "../../../types/platform.js";
import { StratumServiceImpl } from "../activator.js";

/**
 * Stratum Logic Test Suite
 * Validates the multi-facet aggregation and URI generation of the Stratum Service.
 */

Deno.test("Stratum Service: Should aggregate facets into a canonical URI", async () => {
    // 1. Mock Dependencies
    const mockSession = {
        currentUser: { id: "sid-123" },
        scopedUsers: { global: { id: "tenant-456" } },
        activeFlowId: "retail-flow"
    };

    const mockRealmManager = {
        getActiveRealm: () => "org.neverplayed.realm.core"
    };

    const mockPersistenceManager = {
        getContext: () => ({ tier: "cloud" })
    };

    // 2. Mock Stratum Service Logic (Phase 1: Pure Logic)
    // In our real activator, this will be bound to reactive trackers.
    const aggregateStratum = (session, realm, pm) => {
        const tenantId = session.scopedUsers?.global?.id || "guest";
        const identityId = session.currentUser?.id || tenantId;
        const realmId = realm.getActiveRealm() || "unknown";
        const tier = pm.getContext?.().tier || "local";
        const flowId = session.activeFlowId || "shell";

        return {
            tenantId,
            identityId,
            realmId,
            tier,
            flowId,
            toURI: () => `np://${tenantId}/${identityId}/${realmId}/${flowId}?tier=${tier}`
        };
    };

    // 3. Execution
    const stratum = aggregateStratum(mockSession, mockRealmManager, mockPersistenceManager);

    // 4. Assertions
    assertEquals(stratum.tenantId, "tenant-456");
    assertEquals(stratum.identityId, "sid-123");
    assertEquals(stratum.realmId, "org.neverplayed.realm.core");
    assertEquals(stratum.toURI(), "np://tenant-456/sid-123/org.neverplayed.realm.core/retail-flow?tier=cloud");
});

Deno.test("Stratum Service: Should handle guest fallback correctly", () => {
    const mockGuestSession = {
        currentUser: { id: "guest" },
        scopedUsers: { global: { id: "guest" } }
    };
    const mockRealm = { getActiveRealm: () => "core" };
    const mockPM = { getContext: () => ({ tier: "local" }) };

    const aggregateStratum = (session, realm, pm) => {
        const tenantId = session.scopedUsers?.global?.id || "guest";
        const identityId = session.currentUser?.id || tenantId;
        const realmId = realm.getActiveRealm() || "unknown";
        const flowId = session.activeFlowId || "shell";
        const tier = pm.getContext?.().tier || "local";

        return {
            toURI: () => `np://${tenantId}/${identityId}/${realmId}/${flowId}?tier=${tier}`
        };
    };

    const stratum = aggregateStratum(mockGuestSession, mockRealm, mockPM);
    assertEquals(stratum.toURI(), "np://guest/guest/core/shell?tier=local");
});

Deno.test("Stratum Service: Should aggregate inhabitants correctly with scope isolation", async () => {
    // 1. Instantiate StratumServiceImpl
    const service = new StratumServiceImpl(console);
    
    // 2. Mock Realm Manager to return a specific active realm
    let activeRealm = "org.neverplayed.realm.governance";
    service._sourceRealm = {
        getActiveRealm: () => activeRealm
    };

    // Mock the session with scopedUsers stack structure
    service._sourceSession = {
        currentUser: { id: "guest" }, // Set to guest so we isolate stack and PM probes
        scopedUsers: {
            global: {
                __activeId__: "alice",
                guest: { id: "guest" },
                alice: { id: "alice", email: "alice@cli.local" }
            },
            "org.neverplayed.realm.governance": {
                __activeId__: "rob",
                guest: { id: "guest" },
                rob: { id: "rob", email: "rob@cli.local" }
            }
        }
    };

    // Mock Persistence Manager with keys containing context details (to verify DB Scan Isolation)
    service._sourcePM = {
        listKeys: async () => ["session-state", "probe-charles", "probe-david"],
        probe: async (key) => {
            if (key === "probe-charles") {
                return { context: { identityId: "charles", realmId: "org.neverplayed.realm.governance" } };
            }
            if (key === "probe-david") {
                return { context: { identityId: "david", realmId: "global" } };
            }
            return null;
        }
    };

    // Active Realm: org.neverplayed.realm.governance
    // Inhabitants should contain:
    // - "rob" (from active session scope stack)
    // - "charles" (from PM probe in active realm)
    // - Should exclude: "alice" (from global stack), "david" (from global PM probe), "guest"
    let inhabitants = await service.getInhabitants();
    assertEquals(inhabitants.includes("rob"), true);
    assertEquals(inhabitants.includes("charles"), true);
    assertEquals(inhabitants.includes("alice"), false);
    assertEquals(inhabitants.includes("david"), false);
    assertEquals(inhabitants.includes("guest"), false);
    assertEquals(inhabitants.length, 2);

    // Switch Active Realm to global
    activeRealm = "global";
    // Inhabitants should contain:
    // - "alice" (from active global session stack)
    // - "david" (from PM probe in active global realm)
    // - Should exclude: "rob", "charles", "guest"
    inhabitants = await service.getInhabitants();
    assertEquals(inhabitants.includes("alice"), true);
    assertEquals(inhabitants.includes("david"), true);
    assertEquals(inhabitants.includes("rob"), false);
    assertEquals(inhabitants.includes("charles"), false);
    assertEquals(inhabitants.includes("guest"), false);
    assertEquals(inhabitants.length, 2);
});
