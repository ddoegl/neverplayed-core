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

// Initialize Admin SDK
admin.initializeApp();

// Limit instances and set region
setGlobalOptions({
  maxInstances: 10,
  region: "europe-west4",
});

/**
 * Validates if the currently signed-in user is on the allowlist.
 * Now fetches from Firebase Remote Config for easier management.
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
    // 2. Fetch Allowlist from Remote Config
    console.log("Fetching Remote Config template...");
    const template = await admin.remoteConfig().getTemplate();
    const parameterKeys = Object.keys(template.parameters);
    console.log(`Available RC keys: ${parameterKeys.join(", ")}`);

    const emailsParam = template.parameters["authorized_emails"];

    if (!emailsParam) {
      console.error("Param 'authorized_emails' not found in Remote Config.");
      return {authorized: false, error: "Configuration missing"};
    }

    const defaultValue = emailsParam.defaultValue as
      | { value?: string }
      | undefined;
    const allowlistStr = defaultValue?.value || "";
    const allowlist = allowlistStr
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.length > 0);

    console.log(`Allowlist (from RC): ${JSON.stringify(allowlist)}`);
    console.log(`Checking user: ${userEmail.toLowerCase()}`);

    // 3. Authorization check
    const isAuthorized = allowlist.includes(userEmail.toLowerCase());
    console.log(`Authorization Result: ${isAuthorized}`);

    return {
      authorized: isAuthorized,
      email: userEmail,
    };
  } catch (error) {
    console.error("Remote Config fetch failed:", error);
    throw new HttpsError("internal", "Failed to fetch authorization list.");
  }
});

import {defineSecret} from "firebase-functions/params";
import Mailjet from "node-mailjet";

// Define secrets for Mailjet
const MAILJET_API_KEY = defineSecret("MAILJET_API_KEY");
const MAILJET_API_SECRET = defineSecret("MAILJET_API_SECRET");

/**
 * Sends a premium invitation email to a fellow.
 * Requires the recipient's email as an argument.
 */
export const sendInvitation = onCall(
  {cors: true, secrets: [MAILJET_API_KEY, MAILJET_API_SECRET]},
  async (request) => {
    // 1. Admin/Auth check (Optional: Limit who can send invites)
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }

    const {targetEmail} = request.data;
    if (!targetEmail) {
      throw new HttpsError("invalid-argument", "Missing targetEmail.");
    }

    const mailjet = new Mailjet({
      apiKey: MAILJET_API_KEY.value(),
      apiSecret: MAILJET_API_SECRET.value(),
    });

    const htmlContent = `
      <div style="font-family:sans-serif;background:#0d0d0d;
        color:#fff;padding:40px;">
        <h1 style="color:#4f46e5;">Neverplayed</h1>
        <p>Hello Fellow,</p>
        <p>The stars have aligned. You are invited to the bootstrap of the
          <strong>Neverplayed Universe</strong>.</p>
        <div style="margin:30px 0;">
          <a href="https://neverplayed.web.app" 
            style="background:#4f46e5;color:#fff;padding:12px 24px;
            text-decoration:none;font-weight:bold;">Initialize Connection</a>
        </div>
        <p style="font-size:12px;color:#666;">Note: Access requires 
          Google Auth with this email.</p>
      </div>`;

    try {
      const response = await mailjet.post("send", {version: "v3.1"}).request({
        Messages: [
          {
            From: {
              Email: "fellowship@neverplayed.org",
              Name: "Neverplayed Invitation Service",
            },
            To: [{Email: targetEmail}],
            Subject: "[Priority] You've been invited to the Fellowship",
            HTMLPart: htmlContent,
          },
        ],
      });

      const body = response.body as {
        Messages: Array<{
          To: Array<{ MessageID: string }>;
        }>;
      };

      console.log("Invitation sent successfully to:", targetEmail);
      return {
        success: true,
        messageId: body.Messages[0].To[0].MessageID,
      };
    } catch (error) {
      console.error("Mailjet send failed:", error);
      throw new HttpsError("internal", "Failed to send email.");
    }
  }
);
