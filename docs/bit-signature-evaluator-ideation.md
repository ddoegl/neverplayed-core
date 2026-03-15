# Ideation: High-Performance Bit-Signature Evaluator in Plexus 🧠🔢⚡

Building on the
[Bit-Signature Evaluator Architecture](file:///Users/ddoegl/speckit/prototyper/osgi/docs/high-performance-bit-signature-evaluator.md),
this document explores how to integrate this "hot loop" optimization into the
Plexus engine to achieve near-instantaneous permission gating and content
targeting.

## 1. The Core Concept: "Evaluation at Change" 🔄💎

Instead of running the full `evaluateDynamic` matcher tree every time a UI
component requests a permission check (e.g.,
`hasPermissions(userId, 'cap:admin')`), we shift the heavy lifting to the
**Profile Update Phase**.

### The Flow:

1. **User/License Modified**: An OSGi event triggers a "Signature Re-gen".
2. **Plexus Signer**: Runs once, mapping the user's properties, roles, and
   features into a **Bitset**.
3. **Storage**: The `Bit-Signature` is stored in the `GlobalState` next to the
   user profile.
4. **Hot Path**: UI components perform a simple bitwise `AND` against the
   signature.

---

## 2. Technical Scrutiny & Challenges 🛠️🔍

### 2.1 Bitmask Size (The 31-bit Barrier)

JavaScript's bitwise operators (`|`, `&`, `~`) operate on **32-bit signed
integers** (effectively 31 bits + 1 sign bit).

- **Small Scale**: Fine for simple roles/flags (~30 properties).
- **Enterprise Scale**: For 100+ capabilities, we must use `BigInt` (supports
  arbitrary length) or `Uint8Array` (manual bit manipulation).
- **Recommendation**: Standardize on **BigInt** for bitmasks to support infinite
  scalability without architectural changes.

### 2.2 Property Map Consistency

The most critical component is the **Property Registry**.

- **Challenge**: Every bundle must agree that `Bit 5` means
  `role:ADMINISTRATOR`.
- **Solution**: A central `PlexusRegistry` service that maintains a versioned
  mapping of `Key -> Index`. This registry must be persistent and synced across
  the cluster.

### 2.3 Non-Boolean Logic

Bitwise operations are naturally binary.

- **Problem**: How to handle `age > 18` or `region: 'EU'`?
- **Solution**: "Sintering". During the signing phase, Plexus evaluates these
  expressions and converts them into boolean flags: `isOver18`, `isRegionEU`.
  The bitmask only stores the _result_ of these predicates.

---

## 3. Proposed Integration with Plexus 🧩🏗️

### A. The "Plexus Signer" Service

A new internal service inside the `plexus` bundle that:

- Listens for `CONFIG_ADMIN` updates or `GlobalState` changes.
- Uses the `PlexusRegistry` to generate `BigInt` signatures.
- Exposes a `check(signature, mask)` method.

### B. Updated `hasPermissions`

The `hasPermissions` method in `backoffice-evaluation` would be updated to:

```javascript
// Current: Object-based lookup
const hasCap = entry.grantedKeys[reqId];

// Future: Bitwise lookup
const mask = registry.getMask(reqId);
const hasCap = (entry.signature & mask) === mask;
```

---

## 4. Why This Matters 🏁🚀

1. **Performance**: Bitwise checks are ~100x faster than Map lookups and
   ~10,000x faster than recursive matcher scanning.
2. **Deterministic UI**: Eliminates "jumpy" UI where components wait for async
   evaluation to complete.
3. **Server-Side Scaling**: In a headless environment (Node/Firebase),
   bit-signatures allow for sub-millisecond request authorized gating, even with
   thousands of active rules.

## 5. Next Steps 🛤️

- [ ] Implement a `BigInt`-based `BitSigner` utility in the `plexus` bundle.
- [ ] Create a prototype `PlexusRegistry` to manage property-to-bit mapping.
- [ ] Benchmarking: Compare current Map-based `hasPermissions` with a Bitmask
      implementation.

---

> [!NOTE]
> This is a "Big Bang" optimization. While not strictly required for current POC
> scale, it prepares Plexus for production workloads involving complex
> entitlements and real-time content delivery.
