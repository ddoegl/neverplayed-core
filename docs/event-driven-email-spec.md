# Event-Driven Email Integration (Option A)

This document outlines an event-driven architecture for handling system emails, specifically focusing on user invitations and welcome messages. This pattern leverages Firebase Cloud Functions reacting to Firestore document creations.

## Concept
Instead of invoking an email sending function directly via an HTTP call (e.g., from a CLI or a client app), the system writes a document representing the intent (e.g., a new user record or an invitation intent) to Firestore. A Cloud Function listens for this creation event (`onDocumentCreated`) and handles the actual email dispatch.

## Core Flow
1. **Trigger Origin**: An actor (CLI, admin panel, automated system) writes a new document to a specific Firestore collection (e.g., `/users/{userId}` or `/invitations/{inviteId}`).
2. **Cloud Function Activation**: The Firebase Cloud Function `sendWelcomeEmail` (or similar), configured with `onDocumentCreated`, is triggered automatically by the database write.
3. **Data Extraction**: The function reads necessary data from the created document (recipient email, name, contextual data).
4. **Email Dispatch**: The function uses a configured transport (like Nodemailer with Gmail, or a dedicated service like SendGrid) to send the email.
5. **(Optional) State Update**: The function updates a field on the document to reflect the operation's outcome (e.g., `status: 'sent'` or `error: 'Auth Failure'`).

## Pros
- **Decoupling**: The system initiating the action does not need to know about the email infrastructure. It simply states the intent by saving data.
- **Resilience**: If the email service is temporarily unavailable, the "intent" document still exists in Firestore. A retry mechanism can be built around these documents.
- **Auditability**: Every email sent originates from a persistent database record, creating an automatic audit trail of who was invited and when.
- **Extensibility**: Other backend processes (like analytics or logging) can also listen to the same document creation event without interfering with the email logic.

## Cons
- **Asynchronous Feedback**: The actor initiating the process does not get immediate, synchronous feedback about whether the email was successfully sent or bounced. They only know the database write succeeded.
- **Complexity Overhead**: Requires managing Firestore rules to secure who can create these intent documents, and potentially requires managing the state of the document (pending, sent, failed) if retry logic is implemented.

## Implementation Guide (using `nodemailer` & `firebase-functions/v2`)
See `functions/src/google-mail.ts` for an example implementation of `onDocumentCreated` listening to `/users/{userId}`. To utilize this:
1. Ensure the Google Workspace account and App Passwords are correct.
2. Store them as Firebase Secrets (`NEVERPLAYED_EMAIL_USER`, `NEVERPLAYED_EMAIL_APP_PASSWORD`).
3. Deploy the function.
4. Have your client/CLI simply write a document to the `users` collection.
