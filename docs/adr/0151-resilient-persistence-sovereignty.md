# ADR 0151: Resilient Persistence Sovereignty

## Status

Proposed (Target State for SDN-0151 Reset)

## Context

Recent attempts to stabilize "Absolute Sovereignty" (SDN-0150) introduced
cumulative boot delays and recursive deadlocks. We observed:

- **Thundering Herd**: High-concurrency I/O at boot time for a missing cloud
  provider caused multiple 1-5s stalls.
- **Activation Deadlock**: Async CDN imports in `onStart` blocked the entire
  OSGi registry.
- **Policy Drift**: Metadata overrides in Domain Objects occasionally bypassed
  intended environment constraints.

## Proposed Healthy State

### 1. The Sovereignty Ceiling (`env.json`)

The `env.json` file at the root of the application acts as the **Absolute
Ceiling**.

- **Rule**: If `persistencePolicy.tier` is set to `local` or `local-fs`, the Global
  Persistence Selector MUST NOT attempt cloud communication, even if a Domain
  Object blueprint's metadata requests `tier: "cloud"`.
- **Enforcement**: This prevents "Forced Volatile Fallback" spam in environments
  where cloud access is intentionally disabled or restricted.

### 2. The Global Provisioning Gate

To solve the "Thundering Herd" problem, the Persistence Selector must implement
a unified **Provisioning Gate**.

- **Rule**: Every `load` or `store` call for a missing tier must join a shared
  `Promise`.
- **Benefit**: 50 concurrent boot requests will result in exactly **one** 2-5
  second wait for the provider, followed by an immediate "burst" execution of
  all queued I/O.

### 3. Decoupled Activation (Swift Handshake)

All persistence providers must adhere to the **Register-First-Hydrate-Second**
pattern.

- **onStart Implementation**:
  1. Synchronously register the `PersistenceManager` service.
  2. Delegate all `import()`, `fetch()`, and `Auth` handshakes to a background
     task (Non-blocking).
- **waitReady Implementation**:
  - Callers must await `waitReady()` for deterministic hydration.
  - `waitReady()` must resolve automatically if no user is found within a
    specific timeout (Pre-Auth Tolerance).

### 4. Canonical Tier Hierarchy

We will use strictly literal, case-sensitive tier names:

- `volatile`: Memory-only.
- `local`: Web LocalStorage.
- `local-fs`: Deno Filesystem Sync.
- `cloud`: Multi-provider Cloud Storage (e.g. Firebase).

### 5. TDD Certification

No implementation code will be written without a corresponding **Audit Test** in
`scripts/sdn-0151-sovereignty.test.ts`.

- Tests must simulate "Cold Boot" (missing providers) and "Burst I/O"
  (concurrent requests).
- Tests must verify the **Ceiling Enforcement** (By mocking `env.json` behavior
  in the harness).

## Learnings to Institutionalize

- **No Recursive Logging**: Selector logs must use `console` to avoid
  `LogService` -> `PersistenceSelector` -> `LogService` recursion.
- **Literal Integrity**: Dotted keys (e.g. `realm.agent.log`) must be stored as
  flat strings in Firestore (Escaped Document keys via backticks).
- **Silent Fallback**: Infrastructure-critical keys (like `managed-keys`) should
  silently shadow to LocalStorage to ensure "Fail-Safe" booting even when the
  cloud is warming up.

## Open Questions

- Should the `env.json` ceiling be strictly immutable after boot, or can it be
  updated by the `Privacy Mode` command? ANSWER: for the time being it is
  immutable after boot.
