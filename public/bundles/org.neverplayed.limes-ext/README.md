# 🔒 Limes Extensions
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


The **Limes Extensions** bundle provides advanced cryptographic and security capabilities that extend the base **Limes Security Kernel**.

## 🏛️ Architecture & Implementation

- **Secret Management**: Provides secure storage and retrieval of API keys and system secrets.
- **Stealth Tunneling**: Implements the logic for "Headless Secret Ingress," allowing agents to authenticate via `x-mcp-secret` and transition to standard ID tokens.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements **Headless Secret Ingress** and **Stealth Tunneling** (Pattern 9/11).
- **[ADR-0025: Identity Injection & ID Tokens](../../docs/adr/0025-identity-injection-id-tokens.md)**: Standardizes secret-to-token transition protocols.

## 🚀 Future Road

- **Rotational Secrets**: Automated rotation of infrastructure keys.
- **Identity Proxy**: Multi-provider support for external enterprise identity systems.


### Referenced Constants:
- `LIMES_SERVICE`
