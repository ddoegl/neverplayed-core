import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as nodemailer from "nodemailer";

// Define secrets
const NEVERPLAYED_EMAIL_USER = defineSecret("NEVERPLAYED_EMAIL_USER");
const NEVERPLAYED_EMAIL_APP_PASSWORD = defineSecret(
  "NEVERPLAYED_EMAIL_APP_PASSWORD"
);
const NEVERPLAYED_EMAIL_ALIAS = defineSecret("NEVERPLAYED_EMAIL_ALIAS");

/**
 * Sends a premium invitation email to a fellow using Nodemailer (Gmail).
 * Requires the recipient's email as an argument.
 */
export const sendInvitationNodemailer = onCall(
  {
    cors: true,
    secrets: [
      NEVERPLAYED_EMAIL_USER,
      NEVERPLAYED_EMAIL_APP_PASSWORD,
      NEVERPLAYED_EMAIL_ALIAS,
    ],
  },
  async (request) => {
    // 1. Admin/Auth check (Optional: Limit who can send invites)
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }

    const {targetEmail} = request.data;
    if (!targetEmail) {
      throw new HttpsError("invalid-argument", "Missing targetEmail.");
    }

    // Configure the Gmail transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: NEVERPLAYED_EMAIL_USER.value(),
        pass: NEVERPLAYED_EMAIL_APP_PASSWORD.value(),
      },
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

    const mailOptions = {
      from: `"Neverplayed" <${NEVERPLAYED_EMAIL_ALIAS.value()}>`,
      to: targetEmail,
      subject: "Invitation to become part of the Neverplayed Universe",
      html: htmlContent,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(
        "Invitation sent successfully via Nodemailer to:",
        targetEmail
      );
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error("Nodemailer send failed:", error);
      throw new HttpsError("internal", "Failed to send email.");
    }
  }
);
