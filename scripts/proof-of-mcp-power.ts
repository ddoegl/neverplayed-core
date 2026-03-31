import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDrLEIk-Azde5Nod8bxZLvuvPqOODELn-A",
  authDomain: "neverplayed.web.app",
  projectId: "cladmin-bc594",
  storageBucket: "cladmin-bc594.firebasestorage.app",
  messagingSenderId: "27160798303",
  appId: "1:27160798303:web:318361b13047fc06d167ea"
};

// Load secret from .env.mcp if it exists
let mcpSecret = "PLACEHOLDER";
try {
  const envText = Deno.readTextFileSync("./.env.mcp");
  const match = envText.match(/MCP_API_SECRET=(.*)/);
  if (match) mcpSecret = match[1].trim();
} catch (_e) {
  console.warn("Proof: .env.mcp not found. Fallback might fail.");
}

const MCP_API_URL = "https://europe-west4-cladmin-bc594.cloudfunctions.net/mcpApi";
const MCP_SECRET = mcpSecret;
const USER_UID = "8fNNh7UkppadUaKJQhaiMIGzcLd2"; // daniel.doegl@doegl.info

async function main() {
  console.log("🚀 Power Proof (Hardened): Initializing Admin MCP Bridge...");

  // 1. Mint Token
  console.log("1. Minting Custom Token...");
  const mintRes = await fetch(MCP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
    body: JSON.stringify({ action: "mintToken", payload: { email: "agent-mcp@neverplayed.org" } })
  });
  const { token } = await mintRes.json();

  // 2. Auth & Get ID Token
  console.log("2. Signing in and fetching ID Token...");
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const cred = await signInWithCustomToken(auth, token);
  const idToken = await cred.user.getIdToken();
  console.log("✅ ID Token acquired.");

  // 3. Command the Fallback via the MCP Server logic (simulated)
  console.log(`\n🛡️  Targeting User UID: ${USER_UID} (Admin Mode)`);
  console.log("⚙️  Setting system-logger to INFO via Hardened Cloud Fallback...");

  const fallbackRes = await fetch(MCP_API_URL, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "x-mcp-secret": MCP_SECRET,
        "x-mcp-token": idToken
    },
    body: JSON.stringify({ 
        action: "updateConfig", 
        payload: { 
            pid: "@neverplayed/system-logger", 
            properties: { "log-level": "INFO" },
            uid: USER_UID
        } 
    })
  });

  const result = await fallbackRes.json();
  console.log("\n📊 Execution Result:");
  console.log(JSON.stringify(result, null, 2));

  if (fallbackRes.ok) {
    console.log("\n✅ PROOF COMPLETE. The hardened bridge verified your ID Token and allowed the cross-user write.");
  } else {
    console.error("\n❌ PROOF FAILED: Bridge rejected the token or there's a logic error.");
  }
}

main().catch(console.error);
