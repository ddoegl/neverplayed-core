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

/**
 * Core access check logic.
 * Accepts a logger (defaults to console).
 */
export async function checkAccess(logger = console) {
    // 0. Headless / Terminal Fallback
    if (globalThis.NEVERPLAYED_HEADLESS_USER) {
        logger.info("Auth Shield: Headless mode detected. Using provided user context.");
        const user = globalThis.NEVERPLAYED_HEADLESS_USER;
        user.attributes = user.attributes || {};
        user.attributes['neverplayed-admin'] = user.isSuperuser || user.isAdmin || false;
        return Promise.resolve(user);
    }

    logger.info("Auth Shield: Initializing check...");
    
    // 1. Check for incoming redirect results first
    if (globalThis.location?.href) {
        try {
            isHandlingRedirect = true;
            const result = await getRedirectResult(auth);
            if (result?.user) {
                logger.info(`Auth Shield: Handling redirect result for ${result.user.email}`);
            } else {
                isHandlingRedirect = false;
            }
        } catch (error) {
            isHandlingRedirect = false;
            logger.error("Auth Shield: Redirect result error", error);
            if (error.code === 'auth/admin-restricted-operation') {
                if (globalThis.alert) alert("Access Denied: Your account must be pre-registered by an administrator.");
                return Promise.reject("Unauthorized");
            }
        }
    }

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                unsubscribe();
                logger.debug(`Auth Shield: Authenticated as ${user.email} - checking authorization...`);
                
                try {
                    const checkUserAccess = httpsCallable(functions, 'checkUserAccess');
                    const accessResult = await checkUserAccess();
                    
                    if (accessResult.data.authorized) {
                        logger.info(`Auth Shield: Access granted for ${user.email}`);
                        user.isSuperuser = accessResult.data.isSuperuser;
                        
                        // CRITICAL FIX: Ensure attributes are present for ABAC
                        user.attributes = user.attributes || {};
                        user.attributes['neverplayed-admin'] = user.isSuperuser || false;
                        
                        resolve(user);
                    } else {
                        logger.warn(`Auth Shield: Access denied for ${user.email}`, accessResult.data);
                        if (globalThis.alert) alert(`Unauthorized: ${user.email} is not on the access list.`);
                        if (globalThis.signOut) signOut(auth).then(() => { if (globalThis.location) location.reload(); });
                        reject("Unauthorized");
                    }
                } catch (error) {
                    logger.error("Auth Shield: Authorization check failed", error);
                    if (globalThis.alert) alert(`Authorization system error: ${error.message || 'Unknown error'}`);
                    reject(error);
                }
            } else {
                if (!globalThis.location?.href) {
                    logger.warn("Auth Shield: No interactive login possible in this environment.");
                    reject("NoSession");
                    return;
                }

                if (isHandlingRedirect) {
                    logger.info("Auth Shield: Still processing redirect, waiting...");
                    return;
                }

                const isLocal = globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1';
                
                const lastAttempt = globalThis.sessionStorage?.getItem('last_login_attempt');
                if (lastAttempt && (Date.now() - parseInt(lastAttempt)) < 5000) {
                    logger.warn("Auth Shield: Login attempt too frequent. Cooling down...");
                    return;
                }
                if (globalThis.sessionStorage) sessionStorage.setItem('last_login_attempt', Date.now().toString());

                logger.info(`Auth Shield: No user session found. Requesting login (${isLocal ? 'Popup' : 'Redirect'})...`);
                const provider = new GoogleAuthProvider();
                
                if (isLocal) {
                    import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then(({ signInWithPopup }) => {
                        signInWithPopup(auth, provider).catch(err => {
                            logger.error("Auth Shield: Popup failed", err);
                        });
                    });
                } else {
                    isHandlingRedirect = true;
                    signInWithRedirect(auth, provider).catch(err => {
                        isHandlingRedirect = false;
                        logger.error("Auth Shield: Redirect failed", err);
                        reject(err);
                    });
                }
            }
        });
    });
}

export async function sendInvitationRequest(targetEmail) {
    const invite = httpsCallable(functions, 'sendInvitationNodemailer');
    const result = await invite({ targetEmail });
    return result.data;
}

export { auth, signOut };
