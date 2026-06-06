import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { BundleTestHarness } from "./test-harness.ts";

Deno.test("Gemma LLM Sandbox: Service and Showcase Event Flow", async () => {
    const harness = new BundleTestHarness();
    const context = await harness.init();

    // 1. Intercept fetch to mock local Ollama calls
    const originalFetch = globalThis.fetch;
    // deno-lint-ignore no-explicit-any
    globalThis.fetch = async (url: any, init?: any) => {
        const urlStr = url.toString();
        if (urlStr.includes("11434/api/generate")) {
            return {
                ok: true,
                status: 200,
                json: () => Promise.resolve({ response: "I am Gemma 4, localized and responsive." })
                // deno-lint-ignore no-explicit-any
            } as any;
        }
        return await originalFetch(url, init);
    };

    try {
        // 2. Install required bundles including EventAdmin
        await harness.installBundles([
            "bundles/org.neverplayed.system-logger/manifest.json",
            "bundles/vendor/org.pandino.event-admin/manifest.json",
            "bundles/org.neverplayed.llm.gemma-provider/manifest.json",
            "bundles/org.neverplayed.llm.gemma-showcase/manifest.json"
        ]);

        // Wait for services to settle
        await new Promise(r => setTimeout(r, 100));

        // 3. Verify Direct OSGi Service registration
        const llmService = await harness.getService("org.neverplayed.LLMService");
        assertExists(llmService, "org.neverplayed.LLMService must be registered.");

        // deno-lint-ignore no-explicit-any
        const response = await (llmService as any).generate("Identify yourself");
        assertEquals(response, "I am Gemma 4, localized and responsive.");

        // 4. Verify CLI Command registration
        // We will fetch all SHELL_COMMAND_SERVICE instances and find the "gemma" command
        const refs = context.getServiceReferences("org.neverplayed.shell.Command");
        assertExists(refs, "Shell commands must exist.");
        
        // deno-lint-ignore no-explicit-any
        let gemmaCmd: any = null;
        for (const ref of refs) {
            const svc = context.getService(ref);
            if (svc && svc.name === "gemma") {
                gemmaCmd = svc;
                break;
            }
        }
        assertExists(gemmaCmd, "'gemma' CLI command must be registered.");

        // 5. Test Synchronous CLI call '/gemma ask'
        const loggedText: string[] = [];
        const logger = (msg: string | { text: string }) => {
            if (typeof msg === "object") {
                loggedText.push(msg.text);
            } else {
                loggedText.push(msg);
            }
        };

        await gemmaCmd.execute(["ask", "Identify yourself"], null, logger);
        
        // Wait briefly for promises to resolve
        await new Promise(r => setTimeout(r, 100));

        const syncLogs = loggedText.join("\n");
        assertEquals(syncLogs.includes("localized and responsive"), true, `Sync response should print. Logs: ${syncLogs}`);

        // 6. Test Asynchronous Event Flow '/gemma event'
        loggedText.length = 0; // Clear logs
        await gemmaCmd.execute(["event", "Trigger async joke generation"], null, logger);

        // Wait for asynchronous event cycle to complete
        await new Promise(r => setTimeout(r, 200));

        const asyncLogs = loggedText.join("\n");
        assertEquals(asyncLogs.includes("📬 Received async Event Response"), true, `Async response should trigger handler. Logs: ${asyncLogs}`);
        assertEquals(asyncLogs.includes("localized and responsive"), true, `Async response content should print.`);

        console.log("✅ Gemma LLM Sandbox Test PASSED.");
    } finally {
        // Restore original fetch
        globalThis.fetch = originalFetch;
        await harness.stop();
    }
});
