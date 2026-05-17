---
description: Condense the current implementation context into a persistent memory file so the session can be safely restarted without losing context.
---

1. **Identify Persona:** Determine your current active agent role based on the
   parameter provided:
   - `dev` -> `development-engineer`
   - `cog` -> `cognitive-architect`
   - `ana` -> `forensic-analyst`
2. **Analyze Context:** Review the conversation to identify the current scope,
   completed tasks, pending objectives, and recent ecosystem events.
3. **Persist State:** Write a highly condensed summary to
   `.agents/memory/<role>-session-state.md` (e.g., `dev-session-state.md`).
   Format it cleanly with sections for:
   - Current Goal
   - Completed Items
   - Pending Items
   - Key Decisions & Context
4. **Confirm:** Notify the user that the memory has been saved to your
   namespaced file and the session can be safely closed.
