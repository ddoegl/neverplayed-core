# Live Data Readiness Assessment: "Zero Seed Data" Target State

This document assesses the current architecture's dependency on static seed
files (YAML) versus its capability to operate on 100% dynamic live data.

## Current State Analysis

### 1. Identity & Authority (Users/Licenses)

- **Dependency**: High. Currently, the `backoffice-licenses` bundle seeds the
  entire user and license directory from `licenses.yaml`.
- **Live Readiness**: 60%. We already use `infrastructure.companies.data`
  (Registry) and `infrastructure.persons.data` to augment users.
- **Gap**: We lack a "Person-to-License" live mapping service. The
  `backoffice-evaluation` orchestrator still treats `licenses.yaml` as the
  primary list of evaluation targets.

### 2. Matching Logic (Rules & Strategies)

- **Dependency**: Medium. While the `poc-evaluator` and
  `backoffice-capabilities` bundles initialize from seeds, they use the
  `PersistenceManager` (PM) to store "Live" versions after editing.
- **Live Readiness**: 80%. The `MatcherEngine` is already generic. It accepts
  any rule-set passed to it.
- **Gap**: The system still "reverts" to seeds if PM data is missing. A
  production-ready system would fetch these from a Centralized Strategy Service
  or Database on demand.

### 3. Context Normalization

- **Dependency**: Low. We recently refactored `normalizeContext` to remove
  hardcoded magic.
- **Live Readiness**: 90%. It now dynamically derives roles by cross-referencing
  the `registry` (Legal Reps) and `roleAliases`.
- **Gap**: It still accepts a `license` object as an argument. In a true live
  state, it should resolve the license context automatically via the
  `EntityLinker` or `ContractService`.

## Critical Gaps to "Zero Seed" State

| Component         | Gap Description                                                                                                      | Priority |
| :---------------- | :------------------------------------------------------------------------------------------------------------------- | :------- |
| **Identity**      | Move from `licenses.yaml` to a live `PersonService` + `LicenseService`.                                              | CRITICAL |
| **Persistence**   | Decouple bundle start-up from filesystem-based `fetch()` calls for seeds.                                            | MEDIUM   |
| **Bootstrapping** | Implement a "System Initialize" flow that populates the DB once, instead of bundles seeding themselves individually. | MEDIUM   |
| **Registry**      | Expand the Registry to include all "Scopeable" entities (Tenants, Folders, etc.), not just Companies.                | LOW      |

## Summary

The system is **65% Ready** for a zero-seed state. The core evaluation engine is
already "blind" to the data source, which is the hardest part. The remaining
work is purely structural: replacing filesystem-based data providers (the
`.yaml` seeders) with live API/Service providers.

> [!IMPORTANT]
> The biggest risk currently is the "Dual Truth" scenario where
> `normailzeContext` derives something from the registry that conflicts with
> what was manually entered in a seed file.
