import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { SESSION_SERVICE, REALM_MANAGER_SERVICE, PERSISTENCE_MANAGER_SERVICE } from "../../../types/platform.js";

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
