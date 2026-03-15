# License Bootstrap: From Unbound to Sovereign Governance

The **License Bootstrap** process is a specialized lifecycle stage for newly
provisioned licenses. It allows for a transitionary period where a "Virtual
Organization" exists without a formal owner, enabling initial setup before
binding the license to a sovereign human identity.

---

## 🚀 The User Journey

### Phase 1: The Unbound State (Bootstrap Mode)

When a license is first created, it has no formal `owner` or `holder`.

- **The User**: A temporary administrative user is created with
  `scaStrategy: 'bootstrap'`.
- **The Experience**: Upon login, the user sees an **Unbound Dashboard**.
  Navigation is restricted to prevent unauthorized user management, and a
  prominent banner invites the user to **"Bind Identity"**.
- **Re-entry**: If the user logs out before completion, they can re-enter using
  a one-time security code (SCA Bypass for bootstrap sets).

### Phase 2: Governance Initiation

To exit the bootstrap state, the administrator must initiate a **Governance
Invitation**.

- **Action**: Clicking "Bind Identity" launches the `invitation-admin` flow in
  `modal` mode.
- **The Invitation**: A specialized `owner-binding` invitation is sent to the
  person intended to be the legal license holder.
- **Terminology**: The UI shifts from standard "Fellowship" language to
  "Administrative Governance" and "License Binding".

### Phase 3: Identity Redemption

The invitee (e.g., "July") receives the invitation and redeems it via a
specialized channel (Email or Retail Portal).

- **verification**: The system captures the invitee's `personData` (Name, Email,
  Phone).
- **State Change**: The invitation status moves to `redeemed`. The original
  admin sees the progress in real-time via the **Activation Journey** checklist
  on their dashboard.

### Phase 4: Formal Admission & Signature Case

The administrator reviews the redeemed identity and "Admits" it.

- **The Case**: Admission does not immediately bind the license. Instead, it
  creates a formal **Governance Case** in the `CASE_SERVICE`.
- **Targeting**: The case is targetted specifically to the redeemer's identity
  (`targetPersonId`), making it visible in their **Signature Tasks** section in
  the Case Center.

### Phase 5: Binding Conclusion (Sovereignty)

The future owner signs the governance case, accepting legal responsibility for
the license.

- **The Signature**: The `signing` flow handles the secure verification.
- **The Binding**: Upon successful signature, the `invitation-admin` triggers
  `concludeBinding`.
- **Updates**:
  1. The License `owner` and `holder` are set to the person's ID.
  2. The User's `scaStrategy` is upgraded to `modern-swtoken-only`.
  3. The License `USERS` list is updated with formal names.

### Phase 6: Full Operations

The bootstrap journey is complete. The user is automatically transitioned to the
standard **Business Dashboard**. All features (User Management, etc.) are now
unlocked based on the newly established sovereign permissions.

---

## 🛠️ Implementation Details

### Configuration over Code

The bootstrap flow leverages the **Plexus Evaluator** and **Bundle
Configuration** to dynamically hide/show UI elements based on the `scaStrategy`.

### Key Service Interactions

| Service                | Role                                                                   |
| :--------------------- | :--------------------------------------------------------------------- |
| `INVITATION_SERVICE`   | Manages the `owner-binding` lifecycle and event signaling.             |
| `LICENSE_DATA_SERVICE` | Handles the formal update of the license record upon binding.          |
| `CASE_SERVICE`         | Manages the legal "Governance Case" required for ownership acceptance. |
| `SELECTION_SERVICE`    | Tracks the "Virtual Organization" context during the unbound state.    |

### Event Signaling

The system uses `EventAdmin` topics for real-time dashboard reactivity:

- `backoffice/invitations/added`: Triggers the "Invitation Sent" state.
- `backoffice/invitations/updated`: Signals redemption or admission for the UI
  checklist.
- `backoffice/cases/updated`: Informs the dashboard when the binding case is
  signed.

### Terminology Resolution

To ensure a premium "Organization First" experience, the `invitation-admin` flow
resolves the organization name using the following priority:

1. `inv.companyName` (if explicitly provided).
2. `lic.metadata.primaryOrgName` (from the target license).
3. `targetLicenseId` (fallback to ID).

---

## 🔐 Security & SCA

Bootstrap users are restricted to the `retail-root-container` or
`business-root-container` only if they possess a valid session. The transition
from `bootstrap` SCA to `modern-swtoken-only` ensures that once a license is
bound, its security posture is immediately elevated to professional standards.

⚖️🏗️🚢⚖️
