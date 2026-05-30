# Handover Ticket: Scale-Free Being-Realms and Tenant Cosmic Envelopes

**Ticket ID:** TICKET-20260530-1123-BEING-REALMS  
**From:** Forensic Analyst & Cognitive Architect  
**To:** Development Engineer  
**Status:** COMPLETED ✅  
**Completed At:** 2026-05-30T12:20:00+02:00  
**Ecosystem Branch:** `architectural-cleanup-1`  

---

## 1. Ontological Context & Problem Statement

Under the scale-free **Indra's Net** principles established in Section 12 of `ontology.md`, every L1 Being functions structurally as an L2 Realm containing nested sub-agents (its dynamic surrogates and persona states), and the L0 Tenant functions as the absolute Cosmic Envelope containing all spatial sub-realms. 

Currently, requesting a transition into these coordinates (e.g. `np://tenantId/identityId/identityId/flowId` or `np://tenantId/tenantId/identityId/flowId`) fails with a `Jump Failed` error because the `RealmManager` only recognizes concrete spatial realms registered in `realms/index.json`.

This ticket details the objectives to dynamically register Being-Realms (the *Interior Castle*) and Tenant-Realms (the *Cosmic Envelope*) inside the platform, enabling pure, zero-surge ingress and headless cognition provisioning.

---

## 2. Technical Objectives

### Objective 1: Dynamic Synthesis & Virtual Registration of Being and Tenant Realms
*   **Files:** [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js), [being-service/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.being-service/activator.js)
*   **Logic:**
    *   Update `RealmManager.getRealms()` to dynamically synthesize and include virtual realms:
        *   For every registered Being ID (except `guest`), synthesize a Being-Realm with ID `being:<identityId>` (e.g. `being:daniel`).
        *   Synthesize a Tenant-Realm with ID `tenant:<tenantId>` (e.g. `tenant:8fNNh7UkppadUaKJQhaiMIGzcLd2` or `tenant:global`).
    *   Synthesized virtual realms should declare the following baseline configurations:
        *   `recognizedSurrogates: ["observer", "sovereign-guard", "system-collector"]` (universally active primordial surrogates).
        *   `bundles: []` (no dynamic spatial bundle surges).
        *   `title: "Being Mind (beingId)"` or `"Tenant Cosmic Envelope"`.

### Objective 2: Handle Transition and Pure Ingress (Zero-Surge) for Virtual Scopes
*   **File:** [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
*   **Logic:**
    *   In `_resolveHierarchy(realmId)`, if the target `realmId` starts with `being:` or `tenant:`, return an empty hierarchy array `[]` (representing the bare primordial plane layer without dynamic custom additions).
    *   This naturally ensures that standard spatial bundle uninstallation/installation surges are bypassed (Pure Ingress) during transitioning, keeping the framework's core organs (Stratographer, Event Admin, Session Service) fully intact without loading custom files.

### Objective 3: Provision Headless `BeingCognitionService` & `TenantCognitionService`
*   **File:** [realm-manager/activator.js](file:///Users/ddoegl/speckit/neverplayed/public/bundles/org.neverplayed.realm-manager/activator.js)
*   **Logic:**
    *   When transitioning into a virtual realm, instead of standard `RealmCognitionService`, dynamically provision:
        *   A `BeingCognitionService` for `being:*` scopes.
        *   A `TenantCognitionService` for `tenant:*` scopes.
    *   **Service Receptors:** Register these services in the OSGi registry, binding them to their respective scopes.
    *   **Data Models:** 
        *   `BeingCognitionService` must headlessly track the Being's active surrogates, attributes, and private configurations as active reified PIDs.
        *   `TenantCognitionService` must track the list of all registered spatial realms and global telemetry stats, exposing them programmatically to the Plexus sensors and Stratographer dashboard without injecting physical files into the browser DOM.

---

## 3. Verification & Compliance Plan

Create a Deno integration test inside [tests/being-realms.test.ts](file:///Users/ddoegl/speckit/neverplayed/tests/being-realms.test.ts).

### Test cases to verify:
1.  **Dynamic Virtual Registration:** Confirm `RealmManager.getRealms()` contains virtual realms `being:daniel` and `tenant:global`.
2.  **Pure Ingress Transition:** Assert transitioning into `being:daniel` succeeds, and that no new bundle surges or uninstallations are triggered.
3.  **Headless Service Provisioning:** Assert that `BeingCognitionService` registers successfully in the OSGi Service Registry under the active scope and exposes the Being's surrogates as reified PIDs.
4.  **UI Compliance:** Verify that Deno test runner executes cleanly:
    ```bash
    deno test -A tests/run-all.ts
    ```

---

## 4. Architectural Rules

*   **Zero DOM Side-Effects:** All virtual cognition services must remain purely headless, exposing state programmatically rather than mutating DOM structures.
*   **Primordial Protection:** Ensure that entering virtual realms never impacts the lifecycle of the primordial plane bundles.
