import {onCall, HttpsError} from "firebase-functions/v2/https";
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
            Subject: "Invitation to become part of the Neverplayed Universe",
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
