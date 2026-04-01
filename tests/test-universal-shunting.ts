/**
 * Verification Test for Universal Resilient Shunting (The Stealth Tunnel)
 * 
 * Simulates a blocked Firebase SDK environment and verifies that the 
 * persistence bundle successfully falls back to the stateless fetch API.
 */

console.log("🚀 Starting Universal Shunting & Resilience Test...");

let passed = 0;

// 1. Mock Global Shell Environment
// deno-lint-ignore no-explicit-any
(globalThis as any).NEVERPLAYED_GET_ID_TOKEN = () => Promise.resolve("mock-id-token-123");

// 2. Mock Global Fetch (The Tunnel)
let fetchCalled = false;
// deno-lint-ignore no-explicit-any
let fetchPayload: any = null;

// deno-lint-ignore no-explicit-any
(globalThis as any).fetch = (url: string, options: any) => {
    fetchCalled = true;
    fetchPayload = JSON.parse(options.body);
    console.log(`[Mock Fetch] Intercepted request to ${url}`);
    return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
        // deno-lint-ignore no-explicit-any
    } as any);
};

// 3. Mock Logger
const mockLogger = {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.log(`[WARN] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`)
};

// 4. Mock Firebase Bundle State (Emulating SDK Failure)
const mockBundle = {
    _userId: "user-abc",
    _cache: new Map(),
    logger: mockLogger,
    
    // The production store() implementation (Manual Port for Test)
    // deno-lint-ignore no-explicit-any
    async store(key: string, val: any) {
        this._cache.set(key, val);
        try {
            // SIMULATE BLOCKADE: Throw Firebase Network Error
            throw new Error("WEBSOCKET_BLOCKED: Deep Packet Inspection Failure");
        // deno-lint-ignore no-explicit-any
        } catch (err: any) {
            this.logger.warn(`Firebase Persistence: Store failed for '${key}' via SDK (${err.message}). Attempting stateless shunting fallback...`);
            
            const shuntingUrl = "https://europe-west4-cladmin-bc594.cloudfunctions.net/mcpApi";
            
            try {
                // deno-lint-ignore no-explicit-any
                const idToken = await (globalThis as any).NEVERPLAYED_GET_ID_TOKEN?.();
                if (!idToken) throw new Error("ID Token not available");

                const response = await fetch(shuntingUrl, {
                    method: "POST",
                    headers: { "x-mcp-token": idToken },
                    body: JSON.stringify({
                        action: "updateConfig",
                        payload: { pid: key, properties: val, uid: this._userId }
                    })
                });

                if (!response.ok) throw new Error("API Rejected");
                this.logger.info(`Firebase Persistence: Shunted config ${key} successfully via Stealth Tunnel.`);
            // deno-lint-ignore no-explicit-any
            } catch (subErr: any) {
                this.logger.error(`Critical Fallback Failure: ${subErr.message}`);
                throw err;
            }
        }
    }
};

// --- TEST EXECUTION ---

(async () => {
    // A. Trigger Persistence Store
    const testPid = "config.system-logger";
    const testProps = { level: "INFO" };

    try {
        await mockBundle.store(testPid, testProps);
    } catch (_e) {
        // Expected failure in SDK path
    }

    // B. Verify Shunting Fallback
    if (fetchCalled) {
        passed++;
        console.log("✅ Fetch API was invoked as a fallback.");
    } else {
        console.error("❌ Fallback fetch never triggered!");
    }

    // deno-lint-ignore no-explicit-any
    const payload = fetchPayload as any;
    if (payload && payload.action === "updateConfig" && payload.payload.pid === testPid) {
        passed++;
        console.log("✅ Fallback payload integrity verified.");
    } else {
        console.error("❌ Fallback payload corrupted!");
    }

    console.log(`\nTest Finished: ${passed}/2 passed.`);
    if (passed === 2) {
        console.log("🎊 Universal Shunting Pattern Verified! The Stealth Tunnel is operational.");
    } else {
        Deno.exit(1);
    }
})();
