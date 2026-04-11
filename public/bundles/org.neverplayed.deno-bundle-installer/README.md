# org.neverplayed.deno-bundle-installer 🦕

![Documentation Health](https://img.shields.io/badge/Documentation-Healthy-green)
![Bundle Version](https://img.shields.io/badge/Version-1.0.0-blue)

Low-level bootstrap service for installing bundles directly into the Deno/Pandino native environment. This bundle is essential for headlessly booting the Perpetual OS and its institutional residents.

## 🏛️ The Patterns
This bundle implements the **Deno Native Inhabitation** pattern. It provides a bridge between the filesystem and the OSGi runtime specifically for environments where standard browser discovery is unavailable.

For core platform standards, see [platform-patterns.md](../../docs/platform-patterns.md).

### Mandatory ADR Compliance
- **Identity**: [ADR-0025](../../docs/adr/0025-identity-injection-id-tokens.md)
- **Versioning**: [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)
- **Quality**: [ADR-0028](../../docs/adr/0028-tiered-bundle-testing-strategy.md)

## 🏛️ Architecture & Implementation
The `InstallerService` manages the lifecycle of bundles in the Deno context. 

- **Bootstrap**: Handles the initial injection of core realm bundles.
- **Deno-Native**: Specialized for the Deno/v8 environment, bypassing browser-specific APIs (DOM, fetch) in favor of local `Deno` APIs where necessary.
- **Service Provision**: Advertises the `org.neverplayed.deno.InstallerService` for use by other headless utilities (like `pandeno.ts`).

### Mandatory ADR Compliance
- **Identity**: [ADR-0025](../../docs/adr/0025-identity-injection-id-tokens.md)
- **Versioning**: [ADR-0027](../../docs/adr/0027-semantic-bundle-versioning-strategy.md)
- **Quality**: [ADR-0028](../../docs/adr/0028-tiered-bundle-testing-strategy.md)

## Future Road
- [ ] Implement remote bundle streaming for distributed Deno clusters.
- [ ] Add integrity checksum verification for manifest artifacts.
