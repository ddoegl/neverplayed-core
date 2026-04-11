# Never Played Scripts Arsenal 🏺🦕

This directory contains the platform's automation, testing, and native inhabitation toolchain.

## Deno Native Layer
Established to enable headless inhabitation, architectural auditing, and local development synchronization.

- **[pandeno.ts](./pandeno.ts)**: The primary CLI entry point for the Deno-native Pandino environment. Automatically handles manifest discovery and bundle installation.
- **[deno-loader-configuration.ts](./deno-loader-configuration.ts)**: Shared Pandino loader configuration for Deno, mapping browser URLs to local filesystem paths.
- **[deno-bundle-server.ts](./deno-bundle-server.ts)**: Minimal HTTP server for serving bundles to the local Deno instance, facilitating true cross-tier bundle loading.
- **[mcp-server.ts](./mcp-server.ts)**: The Model Context Protocol bridge, exposing OSGi services and Antigravity Agent tools to AI Assistants.

## Test Harnesses
- **Headless Boot**: [headless-boot.ts](./headless-boot.ts)
- **Forensic Verification**: [headless-boot-fs.ts](./headless-boot-fs.ts)
- **Deno-native Lifecycle**: [deno-bundle-lifecycle.test.ts](./deno-bundle-installer/tests/deno-bundle-lifecycle.test.ts) (Referenced in bundle tests)

## Architectural Governance
- **[lint-arch.ts](./lint-arch.ts)**: The primary architectural linter. Scans for manifest drift, Documentation Health patterns, and magic string violations.
- **[audit-identifiers.ts](./audit-identifiers.ts)**: Deep-scan for magic string drift across activators and templates.
