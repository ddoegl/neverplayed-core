import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setupGlobalEnvironment } from "./test-harness-globals.ts";
import { PandinoHarness } from "./pandino-test-harness.ts";

/**
 * Persistence Multi-Tier Discovery Test
 * 
 * Verifies that the Persistence Selector can aggregate keys from 
 * multiple tiers (Memory, Local, Cloud) while maintaining
 * resolution authority for load/store.
 */

setupGlobalEnvironment();

interface PersistenceManager {
    waitReady?(key?: string): Promise<void>;
    load(key: string): any; // Using any here temporarily for the data payload, but let's see if we can use unknown
    store(key: string, val: any): Promise<void>;
    listKeys(prefix: string): Promise<string[]> | string[];
}

interface PersistenceResolver {
    resolve(context: { key: string }): { tier: string } | string;
    registerPolicy(pattern: string, policy: { tier: string }): void;
}

Deno.test({
  name: "Persistence: Multi-Tier key aggregation (Discovery)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const harness = new PandinoHarness();
    const context = await harness.init();

    // 1. Install Persistence Selector & Resolver
    await context.installBundle("./org.neverplayed.persistence-resolver/manifest.json");
    await context.installBundle("./org.neverplayed.persistence-selector/manifest.json");
    
    // 2. Mock Providers (Cloud and Local)
    // We register them as services with different tiers
    const cloudMock = {
        load: (key: string) => ({ id: key, source: 'cloud' }),
        store: () => Promise.resolve(),
        listKeys: (prefix: string) => [prefix + "cloud-item-1"]
    };

    const localMock = {
        load: (key: string) => ({ id: key, source: 'local' }),
        store: () => Promise.resolve(),
        listKeys: (prefix: string) => [prefix + "local-item-1"]
    };

    context.registerService("@pandino/persistence-manager/PersistenceManager", cloudMock, {
        "persistence.tier": "cloud",
        "implementation": "mock-cloud"
    });

    context.registerService("@pandino/persistence-manager/PersistenceManager", localMock, {
        "persistence.tier": "local",
        "implementation": "mock-local"
    });

    const selector = (await harness.waitForService("@pandino/persistence-manager/PersistenceManager", "(implementation=selector-proxy)")) as unknown as PersistenceManager;
    const resolver = (await harness.waitForService("org.neverplayed.persistence.Resolver")) as unknown as PersistenceResolver;

    // Give the tracker a moment to pick up the mocks
    await harness.settle(200);

    const prefix = "realm.test.discovery_";
    
    console.log("\n--- TDD: Checking for Multi-Tier Aggregation ---");
    const keys = await selector.listKeys(prefix);
    console.log(`Discovered Keys: ${JSON.stringify(keys)}`);

    // ASSERTION 1: AGGREGATION (Expected to FAIL before fix)
    const hasCloud = keys.includes(prefix + "cloud-item-1");
    const hasLocal = keys.includes(prefix + "local-item-1");
    
    // Currently, listKeys only looks at the "Preferred Tier"
    // If env.json isn't loaded, default is 'cloud' or 'local' based on code fallback.
    // In many environments, it defaults to 'cloud'.
    
    assertEquals(hasCloud && hasLocal, true, "Discovery MUST aggregate keys from ALL tiers (Cloud & Local)");

    // ASSERTION 2: DEDUPLICATION
    // Register a key that exists in both
    const dupePrefix = "realm.test.dupe_";
    (cloudMock as unknown as PersistenceManager).listKeys = (p: string) => p === dupePrefix ? [p + "shared"] : [];
    (localMock as unknown as PersistenceManager).listKeys = (p: string) => p === dupePrefix ? [p + "shared"] : [];
    
    const dupeKeys = await selector.listKeys(dupePrefix);
    assertEquals(dupeKeys.length, 1, "Discovered keys MUST be deduplicated across tiers");

    // ASSERTION 3: STRICT AUTHORITY (Resolver wins)
    console.log("\n--- TDD: Checking Strict Authority ---");
    const sharedKey = dupePrefix + "shared";
    
    // Policy: This key belongs to CLOUD
    resolver.registerPolicy(sharedKey, { tier: 'cloud' });
    
    const loaded = await selector.load(sharedKey);
    assertEquals(loaded.source, 'cloud', "Selector MUST load from the tier specified by the Resolver policy");

    // ASSERTION 4: OPPORTUNISTIC FALLBACK (Lax Read)
    console.log("\n--- TDD: Checking Opportunistic Fallback ---");
    const localOnlyKey = "realm.test.local_only";
    // Policy directs to cloud, but it only exists in local
    resolver.registerPolicy(localOnlyKey, { tier: 'cloud' });
    
    // Clear cloud mock response for this key
    (cloudMock as unknown as PersistenceManager).load = (k: string) => k === localOnlyKey ? null : { id: k, source: 'cloud' };
    
    const fallbackLoaded = await selector.load(localOnlyKey);
    assertEquals(fallbackLoaded?.source, 'local', "Selector SHOULD fallback to local if cloud returns null for a discovered key.");

    await harness.stop();
  },
});
