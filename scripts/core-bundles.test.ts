import { assertEquals, assertExists } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";
import { 
    AUTH_SHIELD_SERVICE, 
    LIMES_SERVICE, 
    CONFIG_ADMIN_SERVICE,
    SHELL_CLI_SERVICE,
    PERSISTENCE_MANAGER_SERVICE
} from "core-types";

Deno.test({
    name: "Core Bundles Regression Suite",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async (t) => {
    // 1. Setup Global Mocks BEFORE Harness Init
    (globalThis as unknown as { NEVERPLAYED_HEADLESS_USER: unknown }).NEVERPLAYED_HEADLESS_USER = {
        email: "admin@neverplayed.io",
        uid: "admin-uid",
        isSuperuser: true,
        authorized: true
    };

    const harness = new BundleTestHarness();
    const _context = await harness.init();

    await t.step("Prerequisite: Install Core Bundles", async () => {
        try {
            await harness.installBundles([
                "bundles/org.neverplayed.persistence-deno/manifest.json",
                "bundles/org.neverplayed.system-logger/manifest.json",
                "bundles/system-services/yaml-service/manifest.json",
                "bundles/org.neverplayed.auth-shield/manifest.json",
                "bundles/org.neverplayed.persistence-firebase/manifest.json",
                "bundles/org.neverplayed.limes/manifest.json",
                "bundles/org.neverplayed.config-admin/manifest.json",
                "bundles/org.neverplayed.shell-cli/manifest.json"
            ]);
        } catch (e) {
            console.error("INSTALL BUNDLES FAILED:", e);
            throw e;
        }
    });

    await t.step("AuthShield: Identity & Attributes", async () => {
        const auth = await harness.getService(AUTH_SHIELD_SERVICE);
        const user = auth.getCurrentUser();
        
        assertEquals(user.email, "admin@neverplayed.io");
        assertEquals(user.attributes['neverplayed-admin'], true, "Should have neverplayed-admin attribute");
    });

    await t.step("Firebase Persistence: Cloud-Backed State", async () => {
        const pm = await harness.getService(PERSISTENCE_MANAGER_SERVICE);
        assertExists(pm, "Persistence service should be registered");

        if (typeof pm.waitReady === 'function') {
            await pm.waitReady();
        }

        // Test in-memory behavior (Firebase fallback if no app)
        pm.store("test.key", "test.value");
        assertEquals(pm.load("test.key"), "test.value");
    });

    await t.step("Limes: ABAC Enforcement", async () => {
        const limes = await harness.getService(LIMES_SERVICE);
        assertExists(limes, "Limes service should be registered");
        
        // Wait for strategies to load (background task in activator)
        let attempts = 0;
        while (limes.getStrategies().length === 0 && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        assertExists(limes.getStrategies().find((s: { id: string }) => s.id === "SYSTEM_ADMIN_REQUIRED"), "Should have ADMIN strategy");
        
        // Non-admin check
        const guestUser = { email: "guest@neverplayed.io", attributes: {} };
        const allowed = await limes.isAllowed(guestUser, "SYSTEM_ADMIN_REQUIRED");
        assertEquals(allowed, false, "Guest should be denied admin tasks");

        // Admin check
        const adminUser = { email: "admin@neverplayed.io", attributes: { 'neverplayed-admin': true } };
        const adminAllowed = await limes.isAllowed(adminUser, "SYSTEM_ADMIN_REQUIRED");
        assertEquals(adminAllowed, true, "Admin should be allowed admin tasks");
    });

    await t.step("ConfigAdmin: Persistence", async () => {
        const ca = await harness.getService(CONFIG_ADMIN_SERVICE);
        assertExists(ca, "ConfigAdmin service should be registered");

        const config = ca.getConfiguration("test.bundle");
        await config.update({ foo: "bar" });
        
        const props = config.getProperties();
        assertEquals(props.foo, "bar");
    });

    await t.step("Shell CLI: Command Execution", async () => {
        const shell = await harness.getService(SHELL_CLI_SERVICE);
        assertExists(shell, "Shell CLI service should be registered");

        await shell.execute("/help");
        const history = shell.getHistory();
        
        // Check if ANY entry contains the target text
        const found = history.some((h: { type: string; content?: { text?: string } }) => 
            h.type === 'output' && h.content?.text?.includes("Available Commands:")
        );
        assertEquals(found, true, "Help output should contain 'Available Commands:'");
    });

    // Cleanup
    await harness.stop();
    }
});
