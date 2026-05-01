# Ideation: Areal Stigmergy & The Governance View

## 🪐 1. Areal Buckets (Stigmergic Persistence)
The storage layer evolves from flat K-V to **Shared Environmental Traces**.

### The Stigmergy Loop
- **Action**: An identity stashes a blueprint in the `shared:realm` bucket.
- **Trace**: The persistence layer stores this with a radius of visibility for all realm residents.
- **Stimulus**: Another identity enters the realm, detects the new trace, and modifies their behavior (e.g., updates a related component).
- **Result**: Coordination emerges without direct Peer-to-Peer communication.

### Storage Radii
- `stash:private` [Identity]: Private cognition.
- `stash:shared` [Realm]: Institutional stigmergy (The Commons).
- `stash:global` [Tenant]: Bedrock infrastructure.

---

## 🏛️ 2. The Governance View (Person Registry)
The **Person Registry** is refactored from a standalone client into a **Forensic Lens** on the Community Realm.

### The Concept
- **Community (The Soil)**: Identities exist as raw entities with basic properties.
- **Governance (The Law)**: Imports these identities and wraps them in "Professional Personas." This realm "registers" them, assigning titles, privileges, and institutional weights.

### Sovereignty & Impersonation
- **Aperture**: `persona.html` serves as the primary surface for identity-switching. 
- **Impersonation**: Entering a persona is an "Act of Representation." I am not just "John"; I am "John in the role of Auditor."

---

## 🚀 3. Proposed Migration Path
- Move `system-clients/person-registry` to `org.neverplayed.governance-registry`.
- Refactor the registry to use the `STRATUM_SERVICE` to scan "Inhabitants" (Forensic) and "Residents" (Local).
- Use `persona.html` as the interactive node in the Stratographer/Dashboard for jumping between these roles.

---

## 🏗️ 4. Action Plan: Implementing Storage Radius Control

To allow an identity to explicitly control their "Storage Radius" (shifting from private isolation to institutional shared memory), we need to ensure the persistence pipelines and command-line interfaces are fully aware of **Areal Directives**.

### 1. Where & How Identities Control the Radius
- **The Stigmergic Prefix**: Identities (via UI or CLI) will prefix keys to indicate intent. 
  - `shared:keyName` -> Promotes data to the `realm` scope (accessible by all recognized inhabitant of the realm).
  - `global:keyName` -> Promotes data to the `tenant` level (accessible cross-realm).
  - `private:keyName` (or no prefix) -> Isolated to the identity's private space.
- **The Selector Interceptor (Already Present)**: The `PersistenceSelector` automatically detects these prefixes (`shared:`/`global:`), strips them, and injects `scope: "shared"` or `scope: "global"` into the `options` parameter passed to the underlying Persistence Providers.
- **The Local Storage Provider (Needs Update)**: While Firebase respects the scope option (`realm-shared`), the `persistence-localstorage` is currently "Radius Blind". It strictly vaults based on `tenantId:realmId:identityId`. It must be updated to replace the `identityId` with a reserved identifier (e.g., `*` or `__shared__`) when `options.scope === "shared"`.

### 2. Explorative Testing using `stratum` CLI
We will use the `/stratum` CLI command as our interactive lab. 
1. **Extend `stratum stash`**:
   - Currently, `stash` only allows writing (`/stratum stash key val`).
   - We will modify or split it to allow **reading** when the value is omitted (e.g., `/stratum stash shared:test-message`).
2. **The Explorative Loop**:
   - Impersonate **Alice**.
   - Write: `> /stratum stash shared:manifesto "Let there be light!"`
   - Switch persona to **Bob**.
   - Read: `> /stratum stash shared:manifesto` -> Expected: Bob sees Alice's message.
   - Read: `> /stratum stash manifesto` -> Expected: Nothing (private).

### 3. TDD Strategy (Automated Assurance)
Once explorative testing proves the radius works locally, we will formalize it:
- Scaffold the empty `org.neverplayed.test.persistence` bundle.
- Build an OSGi test runner within this bundle that automatically runs on boot.
- **Test Matrix**:
  - `testPrivateWriteRead()`
  - `testSharedRadiusCrossIdentity()` (Write as Identity A, fetch as Identity B).
  - `testGlobalRadiusCrossRealm()` (Write in Realm A, fetch in Realm B).
- The test bundle will output its results directly to the System Logger for automated CI observation.

---

## 🏛️ 5. Architectural Decision: Simulated Buckets vs. True Buckets
During ideation, the language favored "Bucket Objects" (discrete storage modules). However, the implementation pursues **Simulated Buckets (Flat Keys with Prefix Sharding)** for the local environment.

### 1. Simulated Buckets (Flat Keys) - *Chosen Path for Local Storage*
Keys are prefixed to simulate namespaces (e.g., `np:v1:tenant:realm:__shared__:key`).
- **Pros**: Read/write of tiny values is instantaneous. Highly resilient against race conditions locally (Identity A and B won't overwrite each other's keys). Easy Alpine `$watch` binding.
- **Cons**: Semantic impurity. Harder to generate fully encapsulated dumps/backups of a specific realm state without string pattern matching.

### 2. True Bucket Objects (The Vault) - *Active in Firebase*
A single massive JSON object represents the Realm Bucket.
- **Pros**: Architectural purity. Portability (a realm is exactly one object).
- **Cons**: Overwrite Risk locally. Modifying one key requires parsing, modifying, and stringifying the entire bucket, causing memory bloat and race conditions without strict merging queues.

**The Hybrid Reality**: Our Firebase provider behaves like True Buckets natively (merging fields into a single `realm-shared` document), while our LocalStorage provider behaves like Simulated Buckets (Flat Keys) to ensure performance and prevent local asynchronous race conditions. The `PersistenceSelector` acts as the translator between these two structural realities.
