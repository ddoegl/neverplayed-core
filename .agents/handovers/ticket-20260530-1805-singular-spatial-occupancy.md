# Handover Ticket: Singular Spatial Occupancy & Perspectival Shunts (Path B)

**Ticket ID:** TICKET-20260530-1805-SINGULAR-SPATIAL-OCCUPANCY  
**From:** Cognitive Architect & Forensic Analyst  
**To:** Development Engineer  
**Status:** OPEN ⭕  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Ontological Context & Problem Statement

Under Path B (Sovereign Shunts), we must prevent **Ontological Bilocation Violations** inside spatial realms. Currently, logging in as `rob` (naked), `being:rob` (awareness), and `realm:rob` (experience) inside a spatial scope (like `habitat`) registers **three distinct, concurrent visitor occupant sessions** in the `session.scopedUsers[scope]` stack. This populates the realist environment pane with three distinct "Robs", which is a category error—disassociating mind and body into separate spatial ghosts.

A Being must have exactly **one native physical presence** in any given space. The coordinates `being:<id>` and `realm:<id>` should never register as separate occupant nodes. Instead, they should function purely as **Somatic/Perspectival Shunts (viewports)** that refract the observer's cognitive lens through the singular baseline occupant `<id>`.

---

## 2. Technical Objectives

### Objective 1: Prevent Bilocation / Enforce Singular Occupant Registration
*   **File:** [session-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.session-service/activator.js) (inside the `login(user, scope)` function)
*   **Logic:**
    *   When an identity ID is submitted for login inside a spatial scope (any scope other than `'platonic'`), detect if the ID has a `being:` or `realm:` prefix.
    *   If a prefix is present:
        1.  Extract the raw base identity ID (e.g. `rob` from `being:rob` or `realm:rob`).
        2.  Enforce that only the raw base identity ID (`rob`) is added as the active occupant/visitor inside `this.scopedUsers[targetScope]`.
        3.  Do NOT create separate occupant records for `being:rob` or `realm:rob` in the visitor list.
        4.  Shift the active session's cognitive viewport/focus parameter to represent the active refraction without spawning separate spatial ghosts.

### Objective 2: Clean up the Realist Environment Pane (Stratographer)
*   **File:** [stratographer/templates/dashboard.html](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/templates/dashboard.html) / [stratographer/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.stratographer/activator.js)
*   **Logic:**
    *   Ensure the dynamic inhabitants / occupants list uses the singular base identity ID (e.g., `rob`) to represent presence in the list.
    *   Ensure that switching between Rob's Awareness and Rob's Experience functions as a **viewport shunt change** (updating the active URI/aperture/grounding) rather than spawning new visitor nodes in the environment.

---

## 3. Verification Plan

### Deno Integration Test:
*   Create an integration test in [tests/singular-occupancy.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/singular-occupancy.test.ts) or append to [tests/being-realms.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/being-realms.test.ts):
    1.  Log in as `rob` in `habitat`.
    2.  Subsequently trigger login for `being:rob` in the same `habitat` scope.
    3.  Assert that `session.scopedUsers["org.neverplayed.realm.habitat"]` contains exactly **one** occupant node representing Rob (the base ID `"rob"`).
    4.  Assert that separate spatial occupant nodes are **not** created for `being:rob` or `realm:rob`.
    5.  Verify the entire suite runs successfully:
        ```bash
        deno test -A tests/run-all.ts
        ```

### Manual Verification:
1.  Enter `habitat`.
2.  Log in as `rob`, `being:rob`, and `realm:rob`.
3.  **Expected Result:** The realist environment pane only lists a single occupant `rob`. You can successfully toggle/navigate between the `being:` and `realm:` viewports, but your spatial presence remains singular.
