Architecture Design: High-Performance Bit-Signature Evaluator

1. Overview

The Bit-Signature Evaluator is a declarative pattern matching engine designed to
replace complex, branched if-else logic with high-speed bitwise operations. By
encoding a multi-property JavaScript context into a single bitset (the
"Signature"), we can evaluate thousands of rules per millisecond using CPU-level
logical gates (AND, NOT).

2. Core Components

2.1 The Property Map (Schema)

A static registry that maps human-readable property keys to specific bit
indices.

Input: ['isLoggedIn', 'isAdmin', 'hasSubscription', ...]

Output: A Map { 'isLoggedIn' => 0, 'isAdmin' => 1, ... }

2.2 The Context Signer (Encoder)

A transformation layer that converts a dynamic JavaScript Object into a
Signature.

Mechanism: Iterates through the object once. For every true value, it performs a
bitwise OR (|) at the mapped index.

Storage: * Small scale (<32 props): A standard 32-bit Integer.

Large scale (32+ props): A Uint8Array or BigUint64Array.

2.3 The Rule Store (Dual-Masking)

Rules are stored as pairs of bitmasks to support both positive and negative
constraints:

Requirement Mask (Inclusion): Bits that must be 1.

Exclusion Mask (Forbidden): Bits that must be 0.

2.4 The Evaluator (Hot Loop)

The engine iterates through the Rule Store. For each rule, it performs two
checks:

Valid = (Signature & InclusionMask) === InclusionMask

Allowed = (Signature & ExclusionMask) === 0

3. Implementation Examples

3.1 The Encoder Class

This class handles the mapping of keys and the generation of the bit signature.

class BitSigner { constructor(keys) { this.keyMap = new Map(keys.map((key,
index) => [key, index])); }

encode(context) { let signature = 0; for (const [key, value] of
Object.entries(context)) { if (value && this.keyMap.has(key)) { // Set the bit
at the mapped index signature |= (1 << this.keyMap.get(key)); } } // Return as
unsigned 32-bit integer return signature >>> 0; } }

3.2 The High-Speed Rule Engine

Using TypedArrays to store rules in contiguous memory for cache efficiency.

class BitRuleEngine { constructor(keys, rules) { this.signer = new
BitSigner(keys); this.count = rules.length;

    // Contiguous memory allocation
    this.includeMasks = new Uint32Array(this.count);
    this.excludeMasks = new Uint32Array(this.count);
    this.outcomes = new Array(this.count);

    rules.forEach((rule, i) => {
      this.includeMasks[i] = this.signer.encode(rule.where);
      this.excludeMasks[i] = this.signer.encode(rule.not);
      this.outcomes[i] = rule.outcome;
    });

}

match(context) { const sig = this.signer.encode(context); const len =
this.count;

    // The "Hot Loop"
    for (let i = 0; i < len; i++) {
      if ((sig & this.includeMasks[i]) === this.includeMasks[i] && 
          (sig & this.excludeMasks[i]) === 0) {
        return this.outcomes[i];
      }
    }
    return null;

} }

4. Data Layout (Memory Optimization)

To achieve maximum performance, rules are stored in Contiguous Memory Buffers
(TypedArrays) rather than JavaScript Objects.

Index

Inclusion Buffer (Uint32)

Exclusion Buffer (Uint32)

Outcome Pointer

0

00000001

00000010

JSON_REF_A

1

00000100

00000000

JSON_REF_B

This layout ensures the CPU can utilize L1/L2 cache pre-fetching, as rule data
is physically adjacent in RAM.

5. Technical Constraints & Trade-offs

Feature

Bit-Signature Approach

Traditional Imperative (if/else)

Execution Speed

O(N) where N is number of rules (extremely fast).

O(D) where D is depth of logic tree.

Complexity

Excellent for Booleans/Enums.

Better for Ranges (> 50) or Strings.

Memory

Fixed, predictable footprint.

Variable, heap-intensive.

Debugging

Requires "mask-to-string" utilities.

Native stack traces.

6. Performance Expectations

Throughput: ~100,000,000 evaluations per second on modern V8 engines.

Latency: Sub-microsecond response time for rule sets under 5,000 items.

Garbage Collection: Near-zero impact as no new objects are created during the
matching phase.

---

igh-Performance Bitwise Evaluator Implementation

This document provides a clean, production-ready implementation of the Bitwise
Rule Engine discussed in the architecture.

1. Core Logic

/**

- BitSigner: Encodes a JavaScript object into an unsigned 32-bit integer. */
  class BitSigner { constructor(keys) { // Mapping human-readable keys to
  specific bit positions (0-31) this.keyMap = new Map(keys.map((key, index) =>
  [key, index])); }

encode(context) { let signature = 0; for (const [key, value] of
Object.entries(context)) { if (value && this.keyMap.has(key)) { // Use OR to
flip the bit at the mapped index to 1 signature |= (1 << this.keyMap.get(key));
} } // Convert to unsigned 32-bit for consistency in JS engines return signature
>>> 0; } }

/**

- BitRuleEngine: Evaluates signatures against a set of rules using
- contiguous memory buffers for maximum performance. */ class BitRuleEngine {
  constructor(keys, rules) { this.signer = new BitSigner(keys); this.count =
  rules.length;

  // Allocate contiguous buffers to improve CPU cache hits this.includeMasks =
  new Uint32Array(this.count); this.excludeMasks = new Uint32Array(this.count);
  this.outcomes = new Array(this.count);

  // Pre-process rules into masks rules.forEach((rule, i) => {
  this.includeMasks[i] = this.signer.encode(rule.where || {});
  this.excludeMasks[i] = this.signer.encode(rule.not || {}); this.outcomes[i] =
  rule.outcome; }); }

/**

- Scans all rules to find the first match.
- @param {Object} context The current state object.
- @returns {*} The outcome of the first matching rule, or null. */
  match(context) { const sig = this.signer.encode(context); const len =
  this.count;

    // The "Hot Loop": Optimized for zero object allocations
    for (let i = 0; i < len; i++) {
      const mustHave = this.includeMasks[i];
      const mustNotHave = this.excludeMasks[i];

      // 1. (sig & mustHave) === mustHave: Checks if all required bits are 1
      // 2. (sig & mustNotHave) === 0: Checks if all forbidden bits are 0
      if ((sig & mustHave) === mustHave && (sig & mustNotHave) === 0) {
        return this.outcomes[i];
      }
    }
    return null;

} }

2. Usage Example

const properties = [ 'isLoggedIn', 'isPremium', 'isMobile', 'hasPriorOrders' ];

const rules = [ { // New Customer Promo: Logged in AND NOT have prior orders
where: { isLoggedIn: true }, not: { hasPriorOrders: true }, outcome: { discount:
0.20, message: 'Welcome code: NEW20' } }, { // Premium Mobile User where: {
isPremium: true, isMobile: true }, outcome: { discount: 0.10, message:
'Exclusive Mobile Reward' } } ];

const engine = new BitRuleEngine(properties, rules);

// Evaluation const user = { isLoggedIn: true, hasPriorOrders: false, isMobile:
true }; const result = engine.match(user);

console.log(result); // { discount: 0.20, message: 'Welcome code: NEW20' }

3. Best Practices

Pre-calculate Masks: Always generate BitRuleEngine once at startup.

Priority Matters: The engine returns the first match. Place more specific rules
at the top of the array.

Normalization: Ensure non-boolean data (like age or price) is converted to
booleans (e.g., isOver18) before calling match.
