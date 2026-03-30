import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const MCP_SECRET = "NEVERPLAYED_MCP_API_SECRET_2026";

export const mcpApi = onRequest({ cors: true, region: "europe-west4" }, async (req, res) => {
    // 1. Validate Secret
    const authHeader = req.headers["x-mcp-secret"];
    if (authHeader !== MCP_SECRET) {
        res.status(401).json({ error: "Unauthorized: Invalid MCP Secret" });
        return;
    }

    const { action, payload } = req.body;

    if (!action) {
        res.status(400).json({ error: "Bad Request: Action required" });
        return;
    }

    try {
        if (action === "mintToken") {
            const email = payload?.email || "agent-mcp@neverplayed.org";
            const uid = `mcp-${email.split('@')[0]}`;
            
            // Mint custom token with admin rights
            const customToken = await admin.auth().createCustomToken(uid, {
                "neverplayed-admin": true
            });

            res.status(200).json({ token: customToken, uid });
            return;
        }

        if (action === "updateConfig") {
            const { pid, properties, uid } = payload;
            
            if (!pid || !properties || !uid) {
                res.status(400).json({ error: "Bad Request: pid, properties, and uid required" });
                return;
            }

            // Write statelessly to the specific user's persistence cloud document
            const db = admin.firestore();
            const configKey = `config.${pid}`;
            await db.collection("persistence").doc(uid).set(
                { [configKey]: properties },
                { merge: true }
            );

            res.status(200).json({ success: true, message: `Cloud Function patched config for ${pid}` });
            return;
        }

        res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
        console.error("MCP API Error:", err);
        res.status(500).json({ error: err.message });
    }
});
