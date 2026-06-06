# 🤖 Gemma LLM Provider
![Documentation Health](https://img.shields.io/badge/Documentation-Stable-green) ![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)


Domain service that wraps the local Ollama Gemma 4 model API, exposing it as an OSGi service (Layer 4.2).

## 🏛️ Architecture & Implementation

Wraps http fetch calls to Ollama on `http://localhost:11434/api/generate` and exposes the `org.neverplayed.LLMService` service interface.

- **Generative Capability**: Implements `generate(prompt, options)`.
- **Whiteboard Integration**: Asynchronously consumes and responds to game events posted to the EventAdmin bus.

## 🏛️ The Patterns (The State)

- **[Platform Alignment](../../docs/platform-patterns.md)**: Implements LLM text generation capabilities.
- **[ADR-0005: Resilient Service Retrieval](../../docs/adr/0005-resilient-service-retrieval.md)**: Exposes the LLM service with service rankings for resilient usage.

## 🚀 Future Road

- Support automatic fallback to mock LLM generators when Ollama is offline.

### 🏺 Institutional ADRs

- [ADR-0023](../../docs/adr/0023-bundle-documentation-standard.md) - Bundle Documentation Standard.


### Referenced Constants:
- `LLM_SERVICE`
- `EVENT_ADMIN_SERVICE`
- `EVENT_FACTORY_SERVICE`
