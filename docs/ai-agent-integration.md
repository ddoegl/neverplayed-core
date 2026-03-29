# Ideation: Agentic Operation of Never Played 🛰️🤖

This document explores the strategy for making Never Played's OSGi ecosystem accessible to AI agents via **MCP (Model Context Protocol)** and **Genkit**.

## 1. Objective

Enable autonomous or semi-autonomous agents to "operate" the project by:
- Navigating and launching UI flows.
- Inspecting and calling service methods.
- Modifying configurations via `ConfigAdmin`.
- Monitoring system logs and state.

## 2. Architectural Bridge

To connect the browser-based (or Deno-headless) OSGi registry with an AI agent, we need a bridge that translates agentic intent into OSGi service calls.

### A. The MCP Server (Model Context Protocol)
Best for general-purpose agent integration (e.g., Claude, Gemini, IDE extensions).

- **Server**: A Deno-based MCP server that runs alongside (or inside) the OSGi environment.
- **Tools**:
    - `osgi_list_services`: List all registered services and their capabilities.
    - `osgi_call_method`: Invoke a method on a service (using our new `/call` logic).
    - `osgi_get_config`: Retrieve current bundle configurations.
    - `osgi_update_config`: Push new configuration properties.
    - `osgi_launch_flow`: Trigger a `flow.launch()` for a specific capability.

### B. Genkit Integration (Firebase/Google Cloud)
Best for custom-built "Ops Agents" or internal automation flows.

- **Genkit Tools**: Define a set of Genkit actions that wrap the `shell-cli` commands.
- **Flows**: Create Genkit flows for "System Health Check" or "Auto-Deployment Verification" that iterate through the OSGi registry.

## 3. Tool Definitions (Spec)

### `service_call`
**Description**: Invokes a functional method on a registered OSGi service.
- `serviceId`: The URI of the service (e.g., `@neverplayed/shell-cli/service`).
- `method`: The method name.
- `args`: JSON-encoded argument list.

### `flow_navigator`
**Description**: Discovers and triggers UI transitions.
- `capability`: The capability to launch (e.g., `biz:dashboard`).
- `context`: Optional data payload for the flow.

### `config_manager`
**Description**: Adjusts system parameters in real-time.
- `pid`: The configuration PID.
- `properties`: The key-value pairs to update.

## 4. Implementation Strategy

### Phase 1: The Headless Bridge
Leverage `scripts/headless-boot-fs.ts` to expose the OSGi registry to a local MCP server. Since Deno can import the activators directly via the filesystem, the MCP server can act as a "Kernel" for the project.

### Phase 2: Remote Event Bridging
Use the `EventAdmin` bridge to allow an external agent to "listen" to the system in real-time (e.g., getting notified when a new flow is registered or a config changes).

### Phase 3: Limes Security Integration
Ensure that agents are subject to the same **Limes** authorization checks as human users. Every MCP tool call should carry a `userId` context that is verified against the project's security policies.

## 5. User-Centric Use Cases (Examples)

### A. "Robby's Personal Assistant" (Flow Moderation)
**User Intent**: *"Invite 'Fellow X' to the 'Team Y' as an Admin."*

**Agent Operations**:
1.  **Identity Resolution**: Call `selection_service.findUser("Fellow X")` to get the unique ID.
2.  **Context Discovery**: Call `selection_service.findTeam("Team Y")` to get the team context.
3.  **Execution**: Call `invitation_service.createInvite({ userId, teamId, role: "admin" })`.
4.  **Lifecycle Monitoring**: Subscribe to `EventAdmin` for the `invite.accepted` topic.
5.  **Confirmation**: Send a summary back to Robby: *"Invite sent! I'll notify you when they accept."*

### B. "The Governance Sentry" (Autonomous Oversight)
**User Intent**: *"Ensure all security configurations follow the Project Constitution."*

**Agent Operations**:
1.  **Monitoring**: Listen for `config-updated` events targeting the `auth:` namespace.
2.  **Validation**: Inspect the new properties via `ConfigAdmin`.
3.  **Correction**: If a violation is detected (e.g., public signup enabled on a private tenant), call `update_config` to revert the change.
4.  **Reporting**: Log the intervention to the `sys:logger` with a constitutional reference.

### C. "Reactive Onboarding Moderator"
**User Intent**: *"Help a new company get started."*

**Agent Operations**:
1.  **Flow Orchestration**: Call `osgi_launch_flow("biz:onboarding")`.
2.  **Data Pre-filling**: Pull data from the user's CRM/Profile and push it into the onboarding service.
3.  **Navigation Assistance**: If the user gets stuck on a step for too long, the agent can call `methods` on the active flow service to identify the blocker and offer help.

---

## 6. Deployment Architectures

To make the agent available in the browser-based version, we explore two primary
models:

### A. The "Satellite" Model (Client-Side Bridge)
The agent acts as a "Satellite" to the active browser session.

- **How it works**: A specialized OSGi bundle (`sys:agent-bridge`) runs in the
  browser and opens a secure WebSocket connection to an external MCP server or
  Genkit backend.
- **Pros**: Zero server-side state needed; full access to the user's specific
  browser session and UI state.
- **Cons**: Requires the browser tab to be open for the agent to work.

### B. The "Digital Twin" Model (Server-Side Registry) - RECOMMENDED
The agent and the user share a synchronized "Digital Twin" of the OSGi
environment.

- **How it works**: A headless version of the project runs on the server (using
  `deno` + `persistence-deno`). The browser and server registries synchronize
  state via `EventAdmin` and a shared persistence layer.
- **Pros**: The agent can perform background tasks (e.g., "Tell me when the team
  accepts the invite") even when the user's browser is closed.
- **Cons**: More complex state synchronization and conflict resolution.

### C. The "Local-First" Model (Hybrid)
Best for local development or privacy-conscious users.

- **How it works**: The MCP server runs locally on the user's machine (e.g., via
  Claude Desktop). It talks to the browser via a local WebSocket or even a
  shared filesystem (leveraging our `headless-boot-fs.ts` logic).
- **Pros**: Maximum privacy, very low latency, and zero cloud dependency.

---

## 7. Transport Layer Flexibility

WebSockets are the standard for real-time reactivity, but Never Played's "OSGi
over Anything" philosophy allows for fallback transports in restricted
environments.

### A. SSE (Server-Sent Events) + HTTP Post 📡
Ideal for environments where WebSockets are blocked but real-time notifications
are still required.

- **Downlink**: The browser/agent listens to a `GET /events` (SSE) stream for
  asynchronous OSGi updates (EventAdmin).
- **Uplink**: Commands are sent via standard `POST /call` requests.
- **Pros**: Proxy-friendly, works on almost all corporate networks.

### B. Shared Filesystem (FS-Mirror) 📂
Best for our headless Deno environment.

- **How it works**: The agent and the OSGi registry communicate by reading/writing
  to a namespaced `/tmp/.osgi-bridge` directory.
- **Pros**: Zero network dependency; completely bypasses firewall/proxy issues.

### C. Standard HTTP Polling (Fallback) 🐌
A final fallback where even SSE is restricted.

---

## 8. Firebase Real-time Bridge (Production Backplane) 🛡️🔥

For production environments on Firebase, we can leverage **Firestore** or **Realtime Database (RTDB)** as the high-availability "Backplane" for OSGi-Agent communication.

### A. The State Mirror (RTDB)
OSGi registry metadata (services, capabilities, configs) are mirrored to a dedicated RTDB node.

- **Sync Logic**: A specialized OSGi service (`sys:firebase-mirror`) subscribes to the registry and pushes changes to `/users/{uid}/osgi/registry`.
- **Agent View**: The AI agent (potentially running in a **Firebase Cloud Function** via Genkit) listens to this node to stay up-to-date with the "Digital Twin."

### B. The Command Queue (Reactive Pipeline)
Agentic intent is managed via a reactive queue.

1.  **Intent**: The agent writes a command to `/users/{uid}/osgi/commands/{cmdId}`.
2.  **Execution**: The browser (or headless OSGi) listens for new commands, executes them via the `shell-cli` service, and updates the node with the `result` or `error`.
3.  **Observation**: The agent waits for the `result` field to appear on the node.

### C. Event Streaming
`EventAdmin` topics are mapped directly to Firebase topics or RTDB paths, allowing the agent to "react" to system events (e.g., `/events/invite/accepted`).

### Benefits
- **Zero WebSocket Management**: Firebase handles the complex real-time plumbing.
- **Security-First**: Integrated with **Firebase Auth** and **Limes**, ensuring only authorized agents can operate the registry.
- **Serverless Automation**: Use **Genkit** in Cloud Functions to respond to OSGi events even when the user is offline.

---

## 9. Potential Implementation Roadmap

1.  **Autonomous Debugging**: "Hey Agent, identify why the session service isn't returning methods." -> Agent calls `/methods` and `/caps`.
2.  **Auto-Configuration**: "Update the log level of all `sys:` bundles to DEBUG." -> Agent iterates through PIDs and updates ConfigAdmin.
3.  **Process Automation**: "Launch the 'Invite' flow and pre-fill the email with `test@example.com`." -> Agent triggers the flow and calls the invite service.

---
> [!NOTE]
> By leveraging our **Core Types** and **Capability-Based Discovery**, Never Played is uniquely positioned for agentic integration: the system is already "Head-Less First."
