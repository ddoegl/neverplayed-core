import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Secret will be injected from GCP Secret Manager
const MCP_SECRET_KEY = "MCP_API_SECRET";

export const mcpApi = onRequest({ cors: true, region: "europe-west4", secrets: [MCP_SECRET_KEY] }, async (req, res) => {
    // 1. Unified Authorization (Secret OR Token)
    const secretFromHeader = req.headers["x-mcp-secret"];
    const secretFromEnv = process.env[MCP_SECRET_KEY];
    const idToken = req.headers["x-mcp-token"] as string;

    const isSecretValid = Boolean(secretFromHeader && secretFromHeader === secretFromEnv);
    
    // If NO secret AND NO token, reject immediately
    if (!isSecretValid && !idToken) {
        res.status(401).json({ error: "Unauthorized: Invalid Secret AND missing ID Token" });
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

            // SECURITY: Authorization Matrix
            // 1. Secret Path (Superuser Agent)
            if (isSecretValid) {
                console.log(`[MCP API] (Update) Authorized via Admin Secret for UID: ${uid}`);
            } 
            // 2. Token Path (User Self-Service or Sub-Admin)
            else {
                try {
                    const decodedToken = await admin.auth().verifyIdToken(idToken);
                    const callerUid = decodedToken.uid;
                    const isAdmin = decodedToken["neverplayed-admin"] === true;

                    // A. Permitted if updating self
                    if (uid === callerUid) {
                        console.log(`[MCP API] (Update) Authorized via ID Token (Self): ${uid}`);
                    } 
                    // B. Permitted if Admin
                    else if (isAdmin) {
                        console.log(`[MCP API] (Update) Authorized via ID Token (Admin): targeting ${uid}`);
                    } 
                    // C. Otherwise Forbidden
                    else {
                        res.status(403).json({ error: "Forbidden: Insufficient permissions for targeting another user" });
                        return;
                    }
                } catch (err: any) {
                    res.status(401).json({ error: `Unauthorized: Token verification failed: ${err.message}` });
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

        if (action === "getConfig") {
            const { uid } = payload;
            
            if (!uid) {
                res.status(400).json({ error: "Bad Request: uid required" });
                return;
            }

            // SECURITY: Authorization Matrix (Mirror of Update)
            if (isSecretValid) {
                console.log(`[MCP API] (Get) Authorized via Admin Secret for UID: ${uid}`);
            } else {
                try {
                    const decodedToken = await admin.auth().verifyIdToken(idToken);
                    const callerUid = decodedToken.uid;
                    const isAdmin = decodedToken["neverplayed-admin"] === true;

                    if (uid !== callerUid && !isAdmin) {
                        res.status(403).json({ error: "Forbidden: Insufficient permissions for reading another user's state" });
                        return;
                    }
                    console.log(`[MCP API] (Get) Authorized via ID Token for UID: ${uid}`);
                } catch (err: any) {
                    res.status(401).json({ error: `Unauthorized: Token verification failed: ${err.message}` });
                    return;
                }
            }

            const db = admin.firestore();
            const snap = await db.collection("persistence").doc(uid).get();
            
            if (!snap.exists) {
                res.status(200).json({ data: {} });
            } else {
                res.status(200).json({ data: snap.data() || {} });
            }
            return;
        }

        res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
        console.error("MCP API Error:", err);
        res.status(500).json({ error: err.message });
    }
});
