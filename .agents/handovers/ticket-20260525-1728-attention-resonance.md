# Developer Handover: Attention Sensation Resonance (Stigmergic Homeostasis Coupling)

- **From:** Cognitive Architect
- **To:** Development Engineer
- **Context:** 
  We have formalized the metaphysics of **Attention Sensation Resonance (Stigmergic Coupling)** in our Project Constitution. When multiple Beings occupy a shared spatial realm, their Markov Blankets become coupled through the medium. An action performed by Being A excites the medium, creating a sensory surprise that acts as a homeostatic "caffeine shot" for Being B, extending Being B's spatial attention span by an attenuated factor and keeping them awake.

---

## Actionable Objectives

### 1. Session Service Refactoring (Attention Resonance Engine)
* **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js)
* **Actions:**
  - Locate the window interaction event listeners (clicks, keypresses, mouse movements) that trigger `_scheduleHomeostasis()`.
  - Refactor the action triggers to implement **Stigmergic Sensation Resonance**:
    - Identify the active Being triggering the interaction (`currentUser.id`).
    - Identify the active spatial scope (`activeRealmId`).
    - Scan all other occupants logged in to the *same* spatial scope:
      ```javascript
      const currentRealm = this.activeRealmId;
      if (currentRealm && currentRealm !== 'platonic') {
          const stack = this.scopedUsers[currentRealm] || {};
          const now = Date.now();
          const currentUserId = this.currentUser?.id;
          
          for (const [userId, user] of Object.entries(stack)) {
              if (userId === '__activeId__' || userId === 'guest' || userId === currentUserId) continue;
              if (user && user.loggedIn) {
                  // Ontological Sense Constraint: Sensed by compatible senses
                  const activeSurrogateId = user.activeSurrogateId;
                  const activeSurrogate = user.surrogates?.[activeSurrogateId];
                  const senses = activeSurrogate?.senses || ['Language']; // fallback
                  
                  if (senses.includes('Language') || senses.includes('ToolUse')) {
                      // Boost attention span by 40% of maximum attention span
                      const boostAmount = this.attentionSpanMs * 0.4;
                      user.lastActiveTime = Math.min(now, (user.lastActiveTime || 0) + boostAmount);
                      logger?.info(`Session: Stigmergic coupling boosted attention for occupant '${userId}' in scope '${currentRealm}' by ${boostAmount}ms.`);
                  }
              }
          }
      }
      ```
    - This ensures that active Beings dynamically stimulate their surrounding inhabitants, extending their spatial anchors and preventing premature sleep.

### 2. Integration Test Verification
* **File:** [realm-as-being.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/realm-as-being.test.ts)
* **Actions:**
  - Add a dedicated integration test case **"Test Case 4: Coupled Homeostasis & Attention Resonance"**:
    - Register two spatial occupants (e.g. `rob` and `july` possessing `person` surrogates with `Language` sense) in the Habitat realm.
    - Artificially drain `july`'s attention span by setting her `lastActiveTime` to `now - 25000` (5 seconds left before temporal decay eviction).
    - Simulate an interaction trigger by `rob` (updating `rob.lastActiveTime = now`).
    - Assert that `july`'s `lastActiveTime` has been successfully pushed forward by the attenuated boost factor (40% of the attention span), moving her safely away from the eviction threshold.
    - Assert that a non-spatial user in the platonic lobby is untouched by this resonance.
  - Execute the regression suite to ensure all 15/15 integration tests return 100% green:
    ```bash
    deno task test --no-check
    ```

---

## Relevant References & Memory Anchors
- **Ecosystem Constitution:** Section 11 in [.agents/memory/ontology.md](file:///Users/ddoegl/speckit/neverplayed/.agents/memory/ontology.md) establishes the formal biosemiotics.
