import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithRedirect, 
    getRedirectResult,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFunctions, 
    httpsCallable 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyDrLEIk-Azde5Nod8bxZLvuvPqOODELn-A",
    authDomain: "neverplayed.web.app",
    databaseURL: "https://cladmin-bc594.firebaseio.com",
    projectId: "cladmin-bc594",
    storageBucket: "cladmin-bc594.firebasestorage.app",
    messagingSenderId: "27160798303",
    appId: "1:27160798303:web:318361b13047fc06d167ea",
    measurementId: "G-9V7NP9D3ED"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, "europe-west4");

let isHandlingRedirect = false;

export async function checkAccess() {
    console.log("Auth Shield: Initializing check...");
    
    // 1. Check for incoming redirect results first
    try {
        isHandlingRedirect = true;
        const result = await getRedirectResult(auth);
        if (result?.user) {
            console.log("Auth Shield: Handling redirect result for", result.user.email);
            // Result found, onAuthStateChanged will soon fire with the user
        } else {
            console.log("Auth Shield: No redirect result found.");
            isHandlingRedirect = false;
        }
    } catch (error) {
        isHandlingRedirect = false;
        console.error("Auth Shield: Redirect result error", error);
        if (error.code === 'auth/admin-restricted-operation') {
            alert("Access Denied: Your account must be pre-registered by an administrator.");
            return Promise.reject("Unauthorized");
        }
    }

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                unsubscribe();
                console.log("Auth Shield: Authenticated as", user.email, "- checking authorization...");
                
                try {
                    const checkUserAccess = httpsCallable(functions, 'checkUserAccess');
                    const accessResult = await checkUserAccess();
                    
                    if (accessResult.data.authorized) {
                        console.log("Auth Shield: Access granted for", user.email);
                        user.isSuperuser = accessResult.data.isSuperuser;
                        resolve(user);
                    } else {
                        console.error("Auth Shield: Access denied for", user.email, accessResult.data);
                        alert(`Unauthorized: ${user.email} is not on the access list.`);
                        signOut(auth).then(() => location.reload());
                        reject("Unauthorized");
                    }
                } catch (error) {
                    console.error("Auth Shield: Authorization check failed", error);
                    alert(`Authorization system error: ${error.message || 'Unknown error'}`);
                    reject(error);
                }
            } else {
                // IMPORTANT: If we are still "processing" a redirect, don't trigger another one!
                if (isHandlingRedirect) {
                    console.log("Auth Shield: Still processing redirect, waiting...");
                    return;
                }

                const isLocal = globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1';
                
                // Anti-loop guard: Only attempt login if we haven't failed recently in this session
                const lastAttempt = sessionStorage.getItem('last_login_attempt');
                if (lastAttempt && (Date.now() - parseInt(lastAttempt)) < 5000) {
                    console.warn("Auth Shield: Login attempt too frequent. Cooling down...");
                    return;
                }
                sessionStorage.setItem('last_login_attempt', Date.now().toString());

                console.log(`Auth Shield: No user session found. Requesting login (${isLocal ? 'Popup' : 'Redirect'})...`);
                const provider = new GoogleAuthProvider();
                
                if (isLocal) {
                    import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then(({ signInWithPopup }) => {
                        signInWithPopup(auth, provider).catch(err => {
                            console.error("Auth Shield: Popup failed", err);
                        });
                    });
                } else {
                    isHandlingRedirect = true;
                    signInWithRedirect(auth, provider).catch(err => {
                        isHandlingRedirect = false;
                        console.error("Auth Shield: Redirect failed", err);
                        reject(err);
                    });
                }
            }
        });
    });
}

/**
 * Convenience wrapper for the Cloud Function (Nodemailer)
 */
export async function sendInvitationRequest(targetEmail) {
    const invite = httpsCallable(functions, 'sendInvitationNodemailer');
    const result = await invite({ targetEmail });
    return result.data;
}

export { auth, signOut };
