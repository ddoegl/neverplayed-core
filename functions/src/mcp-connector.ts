import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Secret will be injected from GCP Secret Manager
const MCP_SECRET_KEY = "MCP_API_SECRET";

export const mcpApi = onRequest({ cors: true, region: "europe-west4", secrets: [MCP_SECRET_KEY] }, async (req, res) => {
    // 1. Validate Secret from environment
    const authHeader = req.headers["x-mcp-secret"];
    const secret = process.env[MCP_SECRET_KEY];

    if (!authHeader || authHeader !== secret) {
        res.status(401).json({ error: "Unauthorized: Invalid or missing MCP Secret" });
        return;
    }

    const { action, payload } = req.body;
    const token = req.headers["x-mcp-token"] as string;

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

            // SECURITY: If targeting a different UID, require a valid Admin ID Token
            if (uid !== "mcp-agent-mcp") {
                if (!token) {
                    res.status(403).json({ error: "Forbidden: Admin token required for cross-user targeting" });
                    return;
                }
                const decodedToken = await admin.auth().verifyIdToken(token);
                if (!decodedToken["neverplayed-admin"] && decodedToken.uid !== "mcp-agent-mcp") {
                    res.status(403).json({ error: "Forbidden: Insufficient permissions for targeting" });
                    return;
                }
            }

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
