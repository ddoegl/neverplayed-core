# Architecture Patterns: The Knowledge Hub

This document has been restructured to support a **Layered Documentation Architecture**. Architectural wisdom is now distributed between overarching platform standards and bundle-specific implementation details.

---

## 🏛️ Platform-Wide Patterns
General laws and reactive standards that apply to all inhabitants of the Never Played ecosystem.
👉 **[docs/platform-patterns.md](./platform-patterns.md)**

### Key Areas:
- **Reactivity**: `$watch` sync, Alpine/OSGi bridging.
- **Services**: Resilient retrieval, Constant compliance.
- **Data**: Tiered persistence, Defensive normalization.
- **Security**: Namespace isolation, Zombie guards.

---

## 🧩 Bundle-Specific Patterns
Detailed implementation guides and "How to use" patterns for specific core services.

| Bundle | Key Pattern | Location |
| :--- | :--- | :--- |
| **Config Admin** | Fragment Shadowing | [README](../../public/bundles/org.neverplayed.config-admin/README.md) |
| **Action Registry** | ENTITY_ACTION Convention | [README](../../public/bundles/org.neverplayed.action-registry/README.md) |
| **Realm Manager** | Flow Registration & Discovery | [README](../../public/bundles/org.neverplayed.realm-manager/README.md) |
| **Visual Editor** | Tri-View Synchronization | [README](../../public/bundles/org.neverplayed.visual-editor/README.md) |

---

## 📜 Architectural Decision Records (ADRs)
The foundational decisions that established these patterns.
👉 **[docs/adr/](./adr/)**

---

> [!NOTE]
> All new Core/Foundation bundles MUST adhere to the [Bundle Documentation Specification](./bundle-readme-spec.md) and reference both the ADRs and the Platform Patterns.
