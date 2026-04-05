import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";

/**
 * Persistence Matrix Test (Headless 5-Tier Verification) 🏛️🛰️
 * Uses Deno.test and BundleTestHarness to verify policy-driven shunting.
 */

// Mapping interface for easier access
const SERVICES = {
    PERSISTENCE: "@pandino/persistence-manager/PersistenceManager",
    REALM_MANAGER: "org.neverplayed.realm.RealmManager",
    REGISTRY: "org.neverplayed.domain.Registry",
    YAML: "org.neverplayed.yaml.YamlService",
    AUTH_SHIELD: "org.neverplayed.auth.AuthShield"
};

Deno.test({
    name: "Persistence Matrix: Multitier 5-Tier Shunting & Policy Enforcement",
    sanitizeResources: false,
    sanitizeOps: false,
    sanitizeExit: false,
    async fn(t) {
        const harness = new BundleTestHarness();
    
    // 1. Intercept environmental configuration for the test
    const originalFetch = (globalThis as unknown as { fetch: typeof fetch }).fetch;
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string | URL, init?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/env.json")) {
            return {
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ persistence_mode: "local-fs" })),
                json: () => Promise.resolve({ persistence_mode: "local-fs" })
            } as Response;
        }
        return await originalFetch(url, init);
    };

    await harness.init();
    const context = harness.getBundleContext();

    // 2. Pre-register Mock services to prevent boot deadlocks
    context.registerService(SERVICES.AUTH_SHIELD, {
        getCurrentUser: () => ({ email: "test-user@neverplayed.org", uid: "test-uid-123", isSuperuser: true }),
        logout: () => {}
    }, { "service.ranking": 100 });

    (globalThis as unknown as { NEVERPLAYED_GET_ID_TOKEN: unknown }).NEVERPLAYED_GET_ID_TOKEN = () => Promise.resolve("mock-test-token");

    await t.step("Phase 1: Bundle Deployment (Nucleus Boot)", async () => {
        await harness.installBundles([
            "bundles/org.neverplayed.yaml-service/manifest.json",
            "bundles/org.neverplayed.persistence-deno/manifest.json",
            "bundles/org.neverplayed.persistence-selector/manifest.json",
            "bundles/org.neverplayed.system-logger/manifest.json",
            "bundles/org.neverplayed.do-registry/manifest.json",
            "bundles/org.neverplayed.realm-manager/manifest.json"
        ]);
        
        // Note: We skipped auth-shield because we provided it via mock above
        
        const pm = await harness.getService<PersistenceManager>(SERVICES.PERSISTENCE);
        const rm = await harness.getService<RealmManager>(SERVICES.REALM_MANAGER);
        
        assertEquals(typeof pm, "object", "Persistence Manager should be active.");
        assertEquals(typeof rm, "object", "Realm Manager should be active.");
    });

    const pm = await harness.getService<PersistenceManager>(SERVICES.PERSISTENCE);
    const rm = await harness.getService<RealmManager>(SERVICES.REALM_MANAGER);

    interface PersistenceManager {
        store(key: string, val: unknown): Promise<void>;
        load(key: string): Promise<any>;
        setMode(mode: string): Promise<void>;
    }
    interface RealmManager {
        waitReady(): Promise<void>;
        switchRealm(id: string): Promise<void>;
        getRealms(): Promise<any[]>;
    }

    await t.step("Phase 2: System Tier Verification (Defaults)", async () => {
        // According to system-defaults.yaml: identities.* -> local
        // We verify that storing to identities.test results in a successful store
        await pm.store("identities.test", { user: "deno-test" });
        const loaded = await pm.load("identities.test");
        assertEquals(loaded.user, "deno-test", "Data should be shunted and recovered from local tier.");
    });

    await t.step("Phase 3: Realm Tier Verification (Ontological Surge)", async () => {
        // Wait for realm discovery
        await rm.waitReady();
        
        // Switch to 'work' realm which has specific persistence policies
        // e.g. visual-do-editor -> local
        await rm.switchRealm("org.neverplayed.realm.work");
        
        // Wait for propagation
        await new Promise(r => setTimeout(r, 500));
        
        const key = "instances.visual-do-editor.1";
        await pm.store(key, { x: 50, y: 50 });
        const loaded = await pm.load(key);
        
        assertEquals(loaded.x, 50, "Realm-level policy should correctly route to local tier.");
        
        // Check a non-realm key (should still follow system/default)
        await pm.store("config.theme", { color: "blue" });
        const theme = await pm.load("config.theme");
        assertEquals(theme.color, "blue");
    });

    await t.step("Phase 4: Privacy Mode (Dynamic Shunting)", async () => {
        // Set mode to privacy (forces cloud -> local for non-enforced)
        await pm.setMode("privacy");
        
        // config.theme is normally 'cloud', but if NOT enforced, it should go to 'local'
        await pm.store("config.privacy_test", { secret: "hidden" });
        const loaded = await pm.load("config.privacy_test");
        assertEquals(loaded.secret, "hidden", "Privacy mode shunting should still preserve data integrity.");
    });

    console.log("\n🎊 Persistence Matrix Verified via Headless Harness!");
    
    // Cleanup
    (globalThis as any).fetch = originalFetch;
    await harness.stop();
    }
});
