# Ideation: The Governance Identity Pivot (SDN-0180)

## 🏛️ 1. The Forensic Separation
We are moving from "Simulation" to "Governance."

- **Community Realm (Soil)**: Where raw identities (`np://tenant/identity`) reside. This is the chaotic, lived experience of the system.
- **Governance Realm (Law)**: The institutional layer that provides structure to the Community. It "recognizes" identities and elevates them to the status of a "Person."

## 🏮 2. Transmigrated Person Registry
The `system-clients/person-registry` is refactored into `org.neverplayed.governance-registry`.

### From Data List to Identity Authority
- **Old Model**: A list of data objects in a YAML file.
- **New Model**: An observer service that:
    1.  Scans `STRATUM_SERVICE` for inhabitants (Current residents).
    2.  Resolves these inhabitants against a "Registry of Recognized Persons."
    3.  Allows for the **Act of Impersonation**: Toggling your active persona within a coordinate.

## 👁️ 3. The Persona Surface (`persona.html`)
The `persona.html` template becomes the **Official Institutional Record**.

### Features:
- **Residency Status**: Shows which realms this person currently inhabits.
- **Institutional Links**: Pulls "Customer" and "Fellow" data from the institutional stashes of the Governance realm.
- **Impersonation Shunt**: The "Enter Environment" buttons are refactored to use `stratum.jump()`, shunting the user's navigational state into the persona's context.

## 🪐 4. The Stigmergy Integration
- **Shared Personas**: If two identities are registered to the same "Person" object, they might share a `stash:private` bucket (The Persona Stash), allowing for "Memory Continuity" across different credentials.
- **Stigmergic Traces**: When a person performs an "Official Act" (Governance), it is stashed in the `stash:shared` bucket of the Governance realm, visible to all other institutional residents.

## 🚀 Migration Roadmap (Future)
1.  Initialize `org.neverplayed.governance-registry` bundle.
2.  Import logic from `system-clients/person-registry`.
3.  Bridge `STRATUM_SERVICE` and `PERSONS_SERVICE`.
4.  Redirect the `persona.html` UI to the new Governance View.
