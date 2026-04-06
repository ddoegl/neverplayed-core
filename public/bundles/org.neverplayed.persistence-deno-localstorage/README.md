# 🗄️ Persistence Deno (LocalStorage)

The **Persistence Deno LocalStorage** bundle provides a Deno-native implementation of the persistence interface using the `localStorage` API (available in Deno 1.x+).

## 🏛️ Architecture & Implementation

- **Browser-API Compatibility**: Allows Deno-based inhabitants to use the same logic as browser-based inhabitants.
- **Device Scoping**: Stores data in the Deno-managed local storage directory (platform-specific).

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Tiered Persistence Strategy** (ADR-0003).
- **[Foundational ADRs](../../docs/adr/)**: Governs the core architectural decisions for this layer.

## 🚀 Future Road

- **Unified Mocking**: Shared test suite across browser `localStorage` and Deno `localStorage`.
