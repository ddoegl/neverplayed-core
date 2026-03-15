# Neverplayed Universe: Operational Bootstrap Guide

This guide covers the core infrastructure and daily operations for the Neverplayed fellowship.

---

## 1. Firebase Infrastructure & Deployment
The universe runs on Firebase (Hosting + Functions) in the `europe-west4` (Netherlands) region.

### How to Deploy
Whenever you change the web client or internal function logic, run:
```bash
cd /Users/ddoegl/speckit/neverplayed
firebase deploy
```

---

## 2. Managing the Access Shield (Allowlist)
The Secure Access Shield ensures only invited fellows can sign in. The allowlist is managed via **Firebase Remote Config**.

### How to add new emails to the Access List:
1.  Go to the [Firebase Console](https://console.firebase.google.com/) for project `cladmin-bc594`.
2.  Navigate to **Release & Monitor** > **Remote Config**.
3.  Find the parameter `authorized_emails`.
4.  Edit the value by adding the new email address (comma-separated).
5.  **Important**: Click **Save** and then **Publish Changes**.

---

## 3. Invitation Service
We use Mailjet to send fellowship invitations.

### Sending Invites from the Neverplayed CLI (In-App)
1.  Login to [neverplayed.web.app](https://neverplayed.web.app).
2.  Open the **Shell CLI** (<i class="fas fa-terminal"></i>) from the sidebar.
3.  Type: `/invite [email_address]`
4.  Success is confirmed in the terminal output with a `MessageID`.

### Sending Invites from the Firebase Functions Shell (Local)
Use this if you need to bypass the UI or for system maintenance:
```bash
cd /Users/ddoegl/speckit/neverplayed/functions
firebase functions:shell
```
Once the shell is ready, run:
```javascript
sendInvitation({ data: { targetEmail: "fellow@example.com" } })
```

---

## 4. Troubleshooting
- **CORS Errors**: Ensure the function has `allUsers` invoker permissions:
  `gcloud functions add-iam-policy-binding [functionName] --member="allUsers" --role="roles/cloudfunctions.invoker" --region="europe-west4"`
- **Mailjet Blocks**: If you see a `401` error in the logs, log in to the [Mailjet App](https://app.mailjet.com/) to unblock your account (common for new accounts).
