# 17. Contextual Provider Injection

Date: 2026-04-06

## Status

Accepted

## Context

Core realm manifests (e.g., `org.neverplayed.realm.core`) are static JSON files. However, infrastructure needs (like persistence providers) vary based on the environment configuration (`env.json`).

## Decision

The `RealmManager` implements a **Contextual Patching** strategy during the discovery phase.

1. Before registering the core realm, the Manager resolves `env.json` to identify the active `persistence_mode`.
2. Based on the mode, the Manager dynamically injects the appropriate persistence bundles (e.g., `firebase` vs `local-fs`) into the core realm's manifest.
3. This "patches" the universe definition at runtime, ensuring the correct infrastructure is provisioned without multiple static manifest variants.

## Consequences

*   **Environment Agnostic Manifests**: Core realm definitions remain generic across different deployments.
*   **Dynamic Provisioning**: Infrastructure is correctly shunted based on boot-time configuration.
*   **Runtime Mutation**: Realm manifests are modified in memory before discovery, which must be clearly logged for debugging.
