# Ideation: Headless Matcher Engine & Distributed Evaluation 🧠📡

## 1. Vision

Transform the current **Matcher Engine** from a browser-bound component into a
universal, runtime-agnostic evaluation service. This enables consistent
authorization and targeting across the entire stack—from CI/CD pipelines to
server-side rendering and API gateways.

## 2. Core Drivers

- **Headless Test Harness**: Running thousands of evaluation scenarios in
  milliseconds via Deno/Node.js without a browser DOM.
- **Client/Server Parity**: Ensuring that a mobile app (client-side) and a
  backend worker (server-side) derive the exact same permissions from the same
  YAML spec.
- **Zero-Latency Authorization**: Pre-calculating capabilities at the edge or
  during deployment.

---

## 3. Architectural Evolution

### Phase A: Decoupling the Core Logic

The current `poc-evaluator/evaluator.js` is already 95% portable. To reach 100%,
we should:

- **Abstract Logging**: Use a dependency-injected logger instead of
  `console.log` or specific bundle loggers.
- **Isolate Fetching**: Move the "DataLoader" (fetching YAMLs) into the
  Activator, passing raw objects to the Engine.
- **Deno-First**: Ensure the engine runs perfectly as a standalone Deno module
  (`engine.ts`).

### Phase B: Headless Test Harness

Implement a `test-evaluator.ts` script that:

1. Loads a directory of `*.yaml` strategies.
2. Loads a suite of `*.test.yaml` scenarios (Context + Expected Keys).
3. Reports failures in TAP or JUnit format for GitHub Actions/GitLab CI.

```yaml
# Example Test Scenario (jw-test.yaml)
context:
  userId: "6532478"
  activeBusinessFunction: ["PRIVATEREP"]
expectations:
  grantedKeys: ["DOCUMENTS_MANAGE_ALLOWED"]
  matchers:
    PRIVATEREP_CAPS: true
```

### Phase C: Distributed Evaluator (Server-Side)

Wrap the engine in a lightweight Deno/Oak or Hono server:

- **Input**: POST `/evaluate` with `context` and `strategySet`.
- **Output**: The `StructuredResult` we recently stabilized.
- **Caching**: Bloom filters or LRU caches for frequent user/strategy pairs.

---

## 4. Integration Scenarios

### Scenario 1: Edge Computing (Cloudflare Workers / Vercel Edge)

Deploy the Matcher Engine as an Edge Function. When a user requests a resource,
the Edge Function evaluates their roles against the YAML strategies (stored in
KV or Durable Objects) and injects permissions into the request headers.

### Scenario 2: Legacy Bridge (Client/Server)

- **Browser**: Continues to use the engine for real-time UI masking.
- **Backend (Deno)**: Uses the _same module_ via import to validate requests.
- **Synchronization**: A central "Strategy Registry" service pushes YAML updates
  to all nodes via WebSockets or MQTT.

---

## 5. Potential Challenges

- **Registry Synchronization**: In a headless environment, we need a way to mock
  or provide the "Company Registry" data that is currently handled by OSGi
  services.
- **State Management**: Avoiding "evaluation drift" if the server has a slightly
  older version of the YAML than the client.

## 6. Next Steps

1. **Extract `engine.js`**: Move the core evaluation logic to a shared
   `shared/logic/matcher-engine.js` that can be imported by both the OSGi bundle
   and standalone scripts.
2. **CLI Evaluator**: Build a small Deno CLI tool to run benchmarks and test
   cases.
3. **Hono Wrapper**: Create a POC server-side evaluation endpoint.

---

_This document serves as a blueprint for evolving the evaluation system into a
first-class citizen of a distributed, modern architecture._ 🏗️🚀🛰️
