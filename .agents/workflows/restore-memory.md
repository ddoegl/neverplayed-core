---
description: Anchor the new conversation to your specific agent profile and restore your namespaced session memory.
---

1. **Identify Persona:** Based on the parameter provided by the user (e.g.,
   `/restore-memory dev`), map the acronym to the target role:
   - `dev` -> `.agents/rules/agent-development-engineer.md` /
     `dev-session-state.md`
   - `cog` -> `.agents/rules/agent-cognitive-architect.md` /
     `cog-session-state.md`
   - `ana` -> `.agents/rules/agent-forensic-analyst.md` / `ana-session-state.md`
2. **Anchor Role:** Read the corresponding rules file to re-establish your
   system constraints and Markov Blanket. Acknowledge your role.
3. **Restore State:** Read the contents of your specific state file at
   `.agents/memory/<role>-session-state.md` to ingest the previous context.
4. **Resume Operations:** Output a brief summary of the restored context
   (Current Goal, Pending Items). Ask the user for permission to proceed with
   the next pending item or if there is a new direction for the current scope.
