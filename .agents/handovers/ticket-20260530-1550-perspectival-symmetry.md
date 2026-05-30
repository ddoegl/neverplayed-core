# Handover Ticket: Perspectival Symmetry in Virtual Being-Realm URI Parsing

**Ticket ID:** TICKET-20260530-1550-PERSPECTIVAL-SYMMETRY  
**From:** Cognitive Architect & Forensic Analyst  
**To:** Development Engineer  
**Status:** COMPLETED ✅  
**Completed At:** 2026-05-30T16:51:00+02:00  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Ontological Context & Problem Statement

Under the scale-free **Indra's Net** principles, we recently integrated **Sovereign Being-Realms** (`being:<beingId>`) as virtual realms. When a user with a Realist Grounding (or a carry-over identity) logs in, the Stratum's active perspective shifts to `realist`, formatting coordinates as `np://${tenantId}/${realmId}/${identityId}/${flowId}` (e.g. `np://8fNNh7UkppadUaKJQhaiMIGzcLd2/being:8fNNh7UkppadUaKJQhaiMIGzcLd2/rob/shell`).

However, this introduces an elegant structural collision inside the exteroceptive boundary when navigating:
1. **URI Parser Perspective Fallback:** Inside `stratum-core/activator.js`, the URI parser `jump(uri)` currently only looks for `${NEVERPLAYED_PREFIX}realm` (i.e. `org.neverplayed.realm.`) to determine if a URI is in the realist perspective. It does not recognize the virtual realm prefixes `being:` or `tenant:`.
2. **Resulting Parse Error:** When parsing a realist Being-Realm URI (like `np://daniel/being:daniel/rob/shell`), the parser falls back to the `idealist` layout. It extracts `being:daniel` as the Identity and `rob` as the Realm, leading to a failed jump because the spatial manager tries to switch to the non-existent realm `"rob"`.
3. **Occupant Transition Failure:** When in a realist Being-Realm, clicking on another occupant (e.g. `daniel`) constructs a jump target like `np://daniel/being:daniel/daniel/shell`. Since the parser defaults to idealist, it parses `daniel` as the target realm instead of `being:daniel`, triggering:
   `Jump Failed: Realm 'daniel' not found.`

This ticket outlines the objectives to remediate this parser blindspot and restore complete perspectival symmetry across all virtual, spatial, and occupant dimensions.

---

## 2. Technical Objectives

### Objective 1: Upgrade `stratum-core` URI Parser to Support Virtual Realism
*   **File:** [stratum-core/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratum-core/activator.js) (around lines 168–176)
*   **Logic:**
    *   Enhance the perspective detector inside `jump(uri)` to recognize that if the first path segment starts with `being:` or `tenant:`, the URI is in the **realist** perspective.
    *   Example logic adjustment:
        ```javascript
        if (segments[0]?.startsWith(`${NEVERPLAYED_PREFIX}realm`) || segments[0]?.startsWith('being:') || segments[0]?.startsWith('tenant:')) {
            realm = segments[0];
            identity = segments[1];
            perspective = 'realist';
        } else {
            identity = segments[0];
            realm = segments[1];
            perspective = 'idealist';
        }
        ```

### Objective 2: Harmonize Stratographer Occupant Jump Coordinates
*   **File:** [stratographer/templates/dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html) (around line 156)
*   **Logic:**
    *   Ensure that clicking on an occupant dynamically normalizes the target realm. If the target occupant `id` corresponds to a sovereign being and we are jumping to their presence, the system should jump to their sovereign Being-Realm coordinate (`being:${id}`) instead of their raw Being ID (`id`).
    *   Alternatively, the click handler should leverage the active perspective or build a clean virtual coordinate that the updated parser can flawlessly ingest regardless of active perspective.
    *   **Snippet to inspect / fix:**
        ```html
        @click="jumpTarget = `np://${tenantId}/${realmId}/${id}/shell?tier=${tier}`; jump()"
        ```
        If `realmId` is a Being-Realm or Tenant-Realm, the transition target should maintain the virtual prefix to avoid targeting raw being IDs as physical rooms.

---

## 3. Verification Plan

### Automated Deno Suite:
*   Add a test case in [tests/being-realms.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/being-realms.test.ts) or create [tests/perspectival-symmetry.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/perspectival-symmetry.test.ts) to verify:
    1.  A realist URI containing a Being-Realm prefix (e.g. `np://daniel/being:daniel/rob/shell`) is correctly parsed with `identityId = "rob"` and `realmId = "being:daniel"`.
    2.  A realist URI containing a Tenant-Realm prefix (e.g. `np://daniel/tenant:daniel/rob/shell`) is correctly parsed with `identityId = "rob"` and `realmId = "tenant:daniel"`.
    3.  Verify that `deno test -A tests/run-all.ts` passes cleanly without regression.

### Manual Verification:
1.  Run the sequence in the browser:
    *   Reset data.
    *   Go to: `np://8fNNh7UkppadUaKJQhaiMIGzcLd2/8fNNh7UkppadUaKJQhaiMIGzcLd2/being:8fNNh7UkppadUaKJQhaiMIGzcLd2/shell?tier=local`
    *   Log in as `rob` via the header switcher.
    *   In the **Other Occupants** pane, click on the occupant `8fNNh7UkppadUaKJQhaiMIGzcLd2`.
2.  **Expected Result:** The jump completes successfully without throwing "Realm not found" and cleanly transitions focus or maintains residency in the target Being-Realm.
