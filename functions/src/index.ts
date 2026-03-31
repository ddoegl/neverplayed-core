/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Initialize Admin SDK with the explicit identity of this 2nd Gen Function
admin.initializeApp({
  serviceAccountId: "27160798303-compute@developer.gserviceaccount.com"
});

// Limit instances and set region
setGlobalOptions({
  maxInstances: 10,
  region: "europe-west4",
});

/**
 * Validates if the currently signed-in user is authorized for universe access
 * and checks for superuser promotion eligibility.
 */
export const checkUserAccess = onCall({cors: true}, async (request) => {
  // 1. Authenticated check
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const userEmail = request.auth.token.email;
  if (!userEmail) {
    throw new HttpsError(
      "invalid-argument",
      "User email is missing from the authentication token."
    );
  }

  try {
    // 2. Fetch Remote Config template
    console.log("Fetching Remote Config template...");
    const template = await admin.remoteConfig().getTemplate();
    // Helper to parse comma-separated emails from RC parameters
    const getAllowlist = (paramName: string) => {
      const param = template.parameters[paramName];
      if (!param) return [];
      const defaultValue = param.defaultValue as { value?: string } | undefined;
      const val = defaultValue?.value || "";
      // Handle potential JSON string or plain CSV
      let list: string[] = [];
      try {
        const parsed = JSON.parse(val);
        list = Array.isArray(parsed) ? parsed : [val];
      } catch {
        list = val.split(",").map((e: string) => e.trim());
      }
      return list.map((e) => e.toLowerCase()).filter((e) => e.length > 0);
    };

    const authorizedEmails = getAllowlist("authorized_emails");
    const superuserEmails = getAllowlist("superuser_promotion_emails");

    const email = userEmail.toLowerCase();

    // 3. Level 1: Universe Authorization
    const isAuthorized = authorizedEmails.includes(email) ||
      authorizedEmails.some((pattern) => {
        if (pattern.startsWith("*@")) {
          return email.endsWith(pattern.substring(1));
        }
        return email === pattern;
      });

    // 4. Level 2: Superuser Promotion
    const isSuperuser = superuserEmails.includes(email);

    console.log(
      `Auth result for ${email}: ` +
      `authorized=${isAuthorized}, isSuperuser=${isSuperuser}`
    );

    return {
      authorized: isAuthorized,
      isSuperuser: isSuperuser,
      email: userEmail,
    };
  } catch (error) {
    console.error("Authorization check failed:", error);
    throw new HttpsError("internal", "Failed to verify access permissions.");
  }
});

export * from "./mailjet";
export * from "./google-mail";
export * from "./mcp-connector";
