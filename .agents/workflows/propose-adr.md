---
description: Captures and drafts a new ADR based on chat discussions.
---
# Propose-ADR Workflow

This workflow standardizes the creation of new Architectural Decision Records (ADRs).

1. **Capture Idea**: Summarize the new pattern or architectural decision discussed in the current session.
2. **Draft ADR**: Create a new `.md` file in `docs/adr/` using the Nygard template (ID, Title, Status, Context, Decision, Consequences).
3. **Set Initial State**:
   - **Status**: Set to `Proposed`.
   - **ID**: Auto-increment the ID based on existing files in `docs/adr/`.
4. **Linkage**: Ensure the new ADR is linked to any relevant existing ADRs it might supplement or depend on.
5. **Yield to User**: Ask the user to review the drafted ADR for "Accepted" status conversion.
