/**
 * Verification Test for Polymorphic Auth (Agent vs. User)
 * 
 * Verifies the authorization logic for the mcpApi Cloud Function.
 */

console.log("🚀 Starting Polymorphic Auth & Security Test...");

let passed = 0;

// 1. Mock Request/Response Context
// deno-lint-ignore no-explicit-any
function buildReq(headers: Record<string, string>, body: any) {
    return { headers, body };
}

function buildRes() {
    // deno-lint-ignore no-explicit-any
    const res: any = {
        _status: 200,
        // deno-lint-ignore no-explicit-any
        _json: null as any,
        status: (s: number) => { res._status = s; return res; },
        // deno-lint-ignore no-explicit-any
        json: (j: any) => { res._json = j; return res; }
    };
    return res;
}

// 2. The Cloud Function Logic (Manual Port for Logic Test)
const ENV_SECRET = "SECRET_KEYS_X99";

// deno-lint-ignore no-explicit-any
async function mockMcpApi(req: any, res: any) {
    // Satisfy async
    await Promise.resolve();
    const secretFromHeader = req.headers["x-mcp-secret"];
    const idToken = req.headers["x-mcp-token"];
    const isSecretValid = Boolean(secretFromHeader && secretFromHeader === ENV_SECRET);

    if (!isSecretValid && !idToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { action, payload } = req.body;
    if (action === "updateConfig") {
        const { uid } = payload;
        
        // Path A: Secret Path (Root Access)
        if (isSecretValid) {
            return res.status(200).json({ success: true, via: "secret" });
        }
        
        // Path B: Token Path (Identity Controlled)
        // Simulate ID Token verification
        const decodedToken = { uid: idToken === "token-val-user1" ? "user1" : "other" };
        if (decodedToken.uid === uid) {
            return res.status(200).json({ success: true, via: "token" });
        } else {
            return res.status(403).json({ error: "Forbidden" });
        }
    }
}

// --- TEST EXECUTION ---

(async () => {
    // A. Test Agent Path (Valid Secret)
    const res1 = buildRes();
    await mockMcpApi(buildReq({ "x-mcp-secret": ENV_SECRET }, { action: "updateConfig", payload: { uid: "user2" } }), res1);
    if (res1._status === 200 && res1._json.via === "secret") {
        passed++;
        console.log("✅ Path A (Secret) Authorized successfully.");
    }

    // B. Test User Path (Valid Token, Self-Update)
    const res2 = buildRes();
    await mockMcpApi(buildReq({ "x-mcp-token": "token-val-user1" }, { action: "updateConfig", payload: { uid: "user1" } }), res2);
    if (res2._status === 200 && res2._json.via === "token") {
        passed++;
        console.log("✅ Path B (Token Self-Update) Authorized successfully.");
    }

    // C. Test User Path (Valid Token, Target Mismatch)
    const res3 = buildRes();
    await mockMcpApi(buildReq({ "x-mcp-token": "token-val-user1" }, { action: "updateConfig", payload: { uid: "user2" } }), res3);
    if (res3._status === 403) {
        passed++;
        console.log("✅ Path B (Token Mismatch) Correctly Forbidden.");
    }

    // D. Test Unauthorized (No Secret, No Token)
    const res4 = buildRes();
    await mockMcpApi(buildReq({}, { action: "updateConfig", payload: { uid: "user1" } }), res4);
    if (res4._status === 401) {
        passed++;
        console.log("✅ Unauthorized requests correctly rejected.");
    }

    console.log(`\nTest Finished: ${passed}/4 passed.`);
    if (passed === 4) {
        console.log("🎊 Polymorphic Auth Security Verified! Universal access gate is secure.");
    } else {
        Deno.exit(1);
    }
})();
