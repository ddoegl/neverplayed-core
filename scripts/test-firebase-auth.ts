import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
  console.warn("Test: .env.mcp not found. Token fetch might fail.");
}

const MCP_API_URL = "https://europe-west4-cladmin-bc594.cloudfunctions.net/mcpApi";
const MCP_SECRET = mcpSecret;

async function testAuth() {
  console.log("🚀 Starting Isolated Auth Test...");

  // 1. Fetch Custom Token
  console.log("1. Requesting Custom Token from Cloud Function...");
  try {
    const res = await fetch(MCP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
      body: JSON.stringify({ action: "mintToken", payload: { email: "agent-mcp@neverplayed.org" } })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Token Minting Failed (${res.status}):`, errorText);
      return;
    }

    const { token, uid } = await res.json();
    console.log(`✅ Token received for UID: ${uid}`);

    // 2. Sign in with Token
    console.log("2. Signing in with Custom Token...");
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const userCredential = await signInWithCustomToken(auth, token);
    console.log(`✅ Signed in as: ${userCredential.user.uid}`);

    // 3. Test Firestore Access
    console.log("3. Testing Firestore Access (Write)...");
    const db = getFirestore(app);
    const testDoc = doc(db, "persistence", uid);
    await setDoc(testDoc, { lastTest: new Date().toISOString() }, { merge: true });
    console.log("✅ Firestore Write Successful!");

    const snap = await getDoc(testDoc);
    console.log("✅ Firestore Read Successful:", snap.data());

  } catch (err) {
    console.error("💥 Test Crashed:", err);
  }
}

testAuth();
