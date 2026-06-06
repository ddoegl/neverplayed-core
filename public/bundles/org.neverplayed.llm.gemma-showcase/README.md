# 🌟 Gemma LLM Showcase
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


Demonstrates synchronous service consumption and asynchronous event-driven whiteboard patterns with local Gemma 4 models (Layer 4.2).

## 🏛️ Architecture & Implementation

Exposes a CLI command to query Gemma synchronously and post events to the platform's EventAdmin service, reacting asynchronously to outputs.

- **Sync Command**: Offers `/gemma ask <prompt>` for immediate LLM inference.
- **Asynchronous Loop**: Offers `/gemma event <prompt>` that routes requests on the event bus.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements CLI showcase commands.
- **[ADR-0004: Decoupled Cross-Flow Communication](../../docs/adr/0004-decoupled-cross-flow-communication.md)**: Details asynchronous whiteboard communication patterns.

## 🚀 Future Road

- Support streaming token responses back to the CLI shell.

### 🏺 Institutional ADRs

- [ADR-0023](../../docs/adr/0023-bundle-documentation-standard.md) - Bundle Documentation Standard.


### Referenced Constants:
- `SHELL_COMMAND_SERVICE`
- `EVENT_ADMIN_SERVICE`
- `EVENT_FACTORY_SERVICE`
- `LLM_SERVICE`
