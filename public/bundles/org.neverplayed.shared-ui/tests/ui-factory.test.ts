import { assertEquals, assertExists } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { BundleTestHarness } from "../../../../tests/test-harness.ts";
import { 
    UI_REGISTRY_SERVICE 
} from "core-types";

/**
 * Component-level test for the UIFactory using Happy DOM.
 * This verifies ADR-0026 (Reactive Resolution) and general component stability.
 */
Deno.test({
    name: "UIFactory: Component Lifecycle & Reactive Hydration",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async (t) => {
        const harness = new BundleTestHarness();
        const context = await harness.init();
        const doc = harness.getDocument();

        await t.step("Prerequisite: Install UI Dependencies", async () => {
            await harness.installBundles([
                "bundles/org.neverplayed.system-logger/manifest.json",
                "bundles/org.neverplayed.alpine-bridge/manifest.json",
                "bundles/org.neverplayed.shared-ui/manifest.json"
            ]);
        });

        const testSpec = {
            id: "test-flow",
            ui: {
                initialStep: "welcome",
                steps: {
                    "welcome": {
                        title: "Welcome ${userName}",
                        parts: { "p1": { kind: "text", content: "??" } }
                    }
                }
            }
        };

        await t.step("UIFactory: Rendering & Initial State", async () => {
            // deno-lint-ignore no-explicit-any
            const uif = doc.createElement("ui-factory") as any;
            uif.setAttribute("data-uif-id", "test-uif-1");
            doc.body.appendChild(uif);

            if (uif.setBundleContext) uif.setBundleContext(context);
            
            // Set params BEFORE spec to ensure they are available at first render
            uif.setParams({ userName: "Initial User" });
            uif.setSpec(testSpec);

            // Wait for Alpine hydration loop in Happy DOM
            await new Promise<void>(r => setTimeout(r, 600));
            const title = doc.querySelector(".uif-step-title") as unknown as { textContent: string | null };
            assertExists(title, "Step title should be rendered");
            assertEquals(title.textContent?.trim(), "Welcome Initial User", "Should resolve initial userName");
        });

        await t.step("UIFactory: Reactive Update (ADR-0026)", async () => {
            // deno-lint-ignore no-explicit-any
            const factoryEl = doc.querySelector("ui-factory") as any;
            factoryEl.setParams({ userName: "Reactively Updated User" });

            // Wait for Alpine reactive loop
            await new Promise<void>(r => setTimeout(r, 600));

            const title = doc.querySelector(".uif-step-title");
            assertEquals(title?.textContent?.trim(), "Welcome Reactively Updated User", "DOM should update reactively");
        });

        await t.step("UIFactory: Pattern 21 (Retroactive Injection)", async () => {
            // 1. Create a "naked" factory in the DOM BEFORE installing the bundle
            // deno-lint-ignore no-explicit-any
            const naked = doc.createElement("ui-factory") as any;
            naked.setAttribute("data-uif-id", "naked-1");
            doc.body.appendChild(naked);

            // 2. Install/Start the Shared UI Bundle (Already installed in this test, 
            // so we simulate the injection logic call or rely on the fact it was done)
            // In the test harness, we can just check if it has the context now.
            assertExists(naked.setBundleContext, "Naked element should have setBundleContext method");
            
            // 3. Verify it's functional
            naked.setParams({ userName: "Naked User" });
            naked.setSpec(testSpec);
            await new Promise<void>(r => setTimeout(r, 600));
            
            const nakedTitle = doc.querySelectorAll(".uif-step-title")[1]; // Second one
            assertExists(nakedTitle, "Naked step title should be rendered");
            assertEquals(nakedTitle.textContent?.trim(), "Welcome Naked User", "Naked factory should be hydrated");
        });

        await t.step("UIFactory: UI Registry Service", async () => {
            interface UIFactoryRegistry {
                // deno-lint-ignore no-explicit-any
                getAll(): Record<string, any>;
                // deno-lint-ignore no-explicit-any
                get(id: string): any;
            }
            // deno-lint-ignore no-explicit-any
            const registry = await harness.getService<UIFactoryRegistry>(UI_REGISTRY_SERVICE as any);
            assertExists(registry, "UI Registry Service should be discoverable");
            
            // deno-lint-ignore no-explicit-any
            const allStates = (registry as any).getAll();
            assertExists(allStates["test-uif-1"], "Registry should contain the first factory state");
            assertExists(allStates["naked-1"], "Registry should contain the naked factory state");
            
            assertEquals(allStates["naked-1"].uifValues.userName, "Naked User", "Registry should reflect current state values");
        });

        await harness.stop();
    }
});
