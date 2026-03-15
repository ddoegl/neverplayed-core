# Deployment Strategy: OSGi Core & Firebase Hosting

This document outlines the steps to extract the OSGi core into a dedicated repository and deploy it to Firebase Hosting with restricted access via Google Authentication and an email allowlist.

### Current Repository Structure (Post-Extraction)

The repository has been restructured to align with Firebase Hosting standards. The `osgi/` directory was renamed to `public/` and configuration files were moved to the root.

**Structure:**
```
/
  firebase.json       # Firebase configuration
  .firebaserc          # Firebase project aliases
  deno.json           # Deno configuration
  serve-osgi.ts       # Local dev server
  docs/               # Documentation (extracted from public)
  public/             # Assets served by Firebase (formerly 'osgi')
    runtime.js
    bundles/
    ...
```

**Key Advantages:**
1.  **Security**: Config files are outside the `public/` folder and won't be served.
2.  **Convention**: Firebase Hosting defaults to serving from `public/`.
3.  **Clean Paths**: Imports are now relative to the site root (e.g., `/runtime.js`).

---

## 2. Firebase Project Setup

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create (or select) the project **cladmin-bc594**.
2.  **Initialize Firebase CLI**:
    ```bash
    firebase login
    firebase init hosting
    ```
    - Select project **cladmin-bc594**.
    - Set the public directory (e.g., `public`).
    - Configure as a single-page app: **No** (unless you want standard SPA routing).
3.  **Enable Authentication**:
    - In the Firebase Console, go to **Authentication** > **Sign-in method**.
    - Enable **Google** as a provider.

---

## 3. Firebase Project Architecture: Shared vs. Isolated

### Can I have multiple apps in one project?
Yes. You can register multiple Web, iOS, and Android apps within a single Firebase project. This is ideal when these apps represent different parts of a single ecosystem (e.g., a Backoffice and a Customer Portal) that share the same data and users.

### Can I separate Authentication between apps?
**No, not natively.** Firebase Authentication is scoped at the **Project level**, not the App level.
- **Shared User Pool**: All apps in the same project share the same list of users.
- **Shared Settings**: You cannot enable "Google Auth" for App A and "Email/Password" for App B if they share a project; the settings apply to the entire project.

### Recommendation: Isolation Strategies

| Strategy | When to use | Pros/Cons |
| :--- | :--- | :--- |
| **Separate Projects** | Total security isolation required. | ✅ Full isolation. ❌ Multiple configs to manage. |
| **Code-Level Shield** | Logical separation (e.g., this OSGi core). | ✅ Simple setup. ❌ Users exist in the same pool. |
| **Identity Platform** | Large scale multi-tenancy. | ✅ Native multi-tenancy. ❌ Higher cost/complexity. |

---

## 4. Deep Dive: Google Cloud Identity Platform

Google Cloud Identity Platform is the enterprise upgrade for Firebase Authentication. If you find the "shared user pool" of standard Firebase Auth too limiting, this is the solution.

### Core Capability: Multi-Tenancy
Multi-tenancy allows you to create **isolated silos** within a single Firebase project.
- Each tenant has its own sets of users.
- Each tenant has its own sign-in methods (e.g., Tenant A uses Google Auth, Tenant B uses SAML).
- Users in Tenant A cannot sign into App B unless specifically allowed.

### Key Enterprise Features
- **SAML & OIDC**: Connect to corporate identity providers (Azure AD, Okta, etc.).
- **Multi-Factor Authentication (MFA)**: SMS or TOTP based.
- **Blocking Functions**: Custom Cloud Functions that run *during* the auth flow (e.g., to verify if an email is on a dynamic allowlist in a database before letting them sign in).
- **Activity Logs**: Detailed audit trails of who signed in and when.

### Transitioning from Firebase Auth
1.  In the Google Cloud Console, enable the **Identity Platform API**.
2.  Enable **Multi-tenancy** in the Identity Platform settings.
3.  Your existing Firebase Auth users are automatically moved to the "Default Tenant."

### Pricing Note
Standard Firebase Auth is free for up to 50k Monthly Active Users (MAU). Enabling Identity Platform features (like Multi-tenancy or SAML) switches the project to a **usage-based tier** (often starting after the first 50k free MAU, but check current GCP pricing for specific features).

---

## 5. Access Shield (Authentication & Authorization)

To shield the folder without public registration, we implement a "Gatekeeper" pattern.

### Step 1: Implementation of the Auth Shield
The main `index.html` (the OSGi bootstrapper) should not load any bundles until the user is authenticated and authorized.

```javascript
/* auth-shield.js */
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = { /* Your Config */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// The list of allowed emails
const ALLOWLIST = [
    "user1@example.com",
    "admin@yourcompany.com"
];

export function checkAccess() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                if (ALLOWLIST.includes(user.email)) {
                    resolve(user);
                } else {
                    alert("Unauthorized: Your email is not on the access list.");
                    auth.signOut();
                    reject("Unauthorized");
                }
            } else {
                const provider = new GoogleAuthProvider();
                signInWithPopup(auth, provider).catch(reject);
            }
        });
    });
}
```

### Step 2: Integrating with the OSGi Loader
Update your `index.html` to wait for the shield:

```html
<script type="module">
  import { checkAccess } from './auth-shield.js';
  
  checkAccess().then(() => {
    // START PANDINO / OSGi BOOTSTRAP
    import('./runtime.js').then(m => m.start());
  }).catch(err => {
    console.error("Access Denied", err);
  });
</script>
```

---

## 4. Deployment Workflow

1.  **Local Dev**: Use `deno task start` (using `serve-osgi.ts`).
2.  **Deploy**:
    ```bash
    # Ensure all bundles are in the 'public' or target folder
    firebase deploy --only hosting
    ```

> [!IMPORTANT]
> Since there is no registration, you must manually manage the `ALLOWLIST`. For a more scalable approach, you could fetch this list from a private Firebase Remote Config parameter or a locked-down Firestore collection.
