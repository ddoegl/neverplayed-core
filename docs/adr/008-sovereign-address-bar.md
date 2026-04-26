# ADR 008: Sovereign Address Bar & Perspective-Aware Navigation

## Status
Accepted

## Context
The Never Played OS employs a multidimensional coordinate system (Stratum) consisting of WHO (Tenant/Identity), WHERE (Realm), HOW (Persistence Tier), and WHAT (Perspective/Aperture). Navigating this space previously relied on disjointed HUDs and sidebars. To achieve high-fidelity observability, we need a unified navigational index that functions predictably across both the Command Line and the Graphical Dashboard.

## Decision
We shall adopt the **"Sovereign Address Bar"** as the primary navigational metaphor for the system.

1.  **Canonical URI Standard**:
    -   The Stratum URI must follow the 4-segment segment order: `np://[TENANT]/[SEG1]/[SEG2]/[APERTURE]?tier=[TIER]`.
    -   **Idealist Stance**: `np://tenant/identity/realm/aperture` (World projects from the Identity).
    -   **Realist Stance**: `np://tenant/realm/identity/aperture` (Identity inhabits the Realm).

2.  **Top Bar Cockpit**:
    -   The `stratographer` dashboard shall house a central address bar in the top bar.
    -   The address bar must reactively update to reflect every transition (Context Shift or Perspective Shift).
    -   Manual input (Jump) must support both Realist and Idealist URI formats, with the system deducing the target stance based on segment structure (e.g., segments starting with `org.neverplayed.realm.` denote a Realist path).

3.  **Sovereignty Guard**:
    -   The **Tenant ID** represents the physical operatorsubstrate and must remain persistent across identity-level logouts and switches.
    -   Navigation/Jump operations must ensure that the Tenant ID is never purged unless a deep platform logout is performed.

## Consequences
-   **Observability**: The state of the system is always linkable and shareable via a single canonical URI.
-   **Flexibility**: The system fluently adapts its data structure based on the user's cognitive perspective (Idealist vs. Realist).
-   **Stability**: The "Sovereignty Guard" prevents accidental data loss or session fragmentation during identity pivots.
-   **Complexity**: URI parsers in the CLI and UI must become "Cognitive" (detecting segment orders) rather than relying on fixed index mappings.
