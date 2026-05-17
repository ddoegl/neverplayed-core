---
description: Package the current context, findings, and pending objectives into a structured handover ticket for another agent to execute.
---

1. **Identify Target Persona:** Map the parameter provided by the user (e.g.,
   `/handover dev`) to the target role (`development-engineer`,
   `cognitive-architect`, `forensic-analyst`).
2. **Compile Payload:** Review the current conversation and extract:
   - The core problem or finding.
   - Required actions or implementation steps.
   - Relevant files, ADRs, or previous context.
3. **Write Ticket:** Create a new file at
   `.agents/handovers/ticket-<timestamp>-<target-role>.md` using the following
   structure:
   - **From:** [Your Role]
   - **To:** [Target Role]
   - **Context:** [Brief background]
   - **Objectives:** [Actionable checklist]
   - **Relevant Files:** [List of paths]
4. **Confirm:** Notify the user that the ticket is created. Advise them to open
   a new chat, restore the target agent, and instruct it to read the ticket
   (e.g., `/accept-handover <ticket-filename>`).
