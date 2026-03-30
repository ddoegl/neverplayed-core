/**
 * ROOT AUTH SHIELD PROXY
 * This file is maintained for backward compatibility with index.html.
 * Core logic has been moved to: ./bundles/org.neverplayed.auth-shield/src/firebase-auth.js
 */

import { 
    checkAccess as coreCheckAccess, 
    signOut as coreSignOut, 
    sendInvitationRequest as coreSendInvitationRequest 
} from "./bundles/org.neverplayed.auth-shield/src/firebase-auth.js";

/**
 * Standard access check for root-level entry points.
 * Uses console fallback as LOG_SERVICE is not available before OSGi boot.
 */
export function checkAccess() {
    return coreCheckAccess(console);
}

export function sendInvitationRequest(targetEmail) {
    return coreSendInvitationRequest(targetEmail);
}

export const signOut = coreSignOut;
export const auth = null; // Explicitly hidden to encourage service usage
