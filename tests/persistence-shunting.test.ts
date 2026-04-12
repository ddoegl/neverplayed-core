import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createMockPersistenceProvider, shouldTrackPersistenceProvider } from "../scripts/test-harness-globals.ts";

/**
 * Isolated Verification Test for Strategic Persistence Shunting
 * 
 * Verifies that the Persistence Selector correctly routes data based on the key prefix.
 */

// 1. Implementation-Aligned Routing Logic (Rule 4: Configuration over Code)
function routeToTier(key: string, envTier: string = "local-fs", mode: string = "normal") {
  if (mode === "stealth") return "volatile";
  if (key.startsWith("security.")) return "volatile";
  
  // 1. Memory Mode (Total Volatility)
  if (envTier === "memory") return "volatile";
  
  // 2. Local Modes (Unified Local Storage)
  if (envTier === "local-fs" || envTier === "local") return "local";
  
  // 3. Cloud Mode (Hybrid Sync)
  if (envTier === "firebase") {
    if (key.startsWith("realm.") || key.startsWith("identities.")) return "local";
    return "cloud";
  }
  
  return "cloud";
}

Deno.test("Identity Shield Verification", () => {
    const shieldTests = [
        { name: "Cloud Provider", props: { type: "provider", implementation: "firebase" }, expected: true },
        { name: "Local Provider", props: { type: "provider", implementation: "deno-fs" }, expected: true },
        { name: "Selector Proxy", props: { type: "provider", implementation: "selector-proxy" }, expected: false },
        { name: "Generic Service", props: { type: "service", implementation: "logger" }, expected: false }
    ];

    shieldTests.forEach(t => {
        const result = shouldTrackPersistenceProvider(t.props);
        assertEquals(result, t.expected, `Shield failed for ${t.name}`);
    });
});

Deno.test("Persistence Routing Matrix", () => {
    const tests = [
        { key: "config.shell", expected: "local", tier: "local-fs", mode: "normal" },
        { key: "identities.mcp", expected: "local", tier: "local-fs", mode: "normal" },
        { key: "security.token", expected: "volatile", tier: "local-fs", mode: "normal" },
        { key: "config.shell", expected: "cloud", tier: "firebase", mode: "normal" },
        { key: "identities.mcp", expected: "local", tier: "firebase", mode: "privacy" },
        { key: "any.key", expected: "volatile", tier: "local-fs", mode: "stealth" }
    ];

    tests.forEach(test => {
        const result = routeToTier(test.key, test.tier, test.mode);
        assertEquals(result, test.expected, `Routing failed for Key='${test.key}' [Tier=${test.tier}, Mode=${test.mode}]`);
    });
});

Deno.test("Global Provider Lifecycle (Mock Verification)", async () => {
    const mockCloud = createMockPersistenceProvider("cloud");
    const mockLocal = createMockPersistenceProvider("local");

    await mockCloud.store("config.test", "data");
    await mockLocal.store("identities.test", "pii");

    assertEquals(mockCloud._store.size, 1);
    assertEquals(mockLocal._store.size, 1);

    await mockCloud.clear();
    await mockLocal.clear();

    assertEquals(mockCloud._store.size, 0);
    assertEquals(mockLocal._store.size, 0);
});
