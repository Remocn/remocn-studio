---
"remocn-studio": patch
---

Each provider is now told to plan a pipeline stage with the tool its own runtime has — `update_plan` on Codex, `todo_write` on Grok, its own planning tool on Copilot — instead of Claude's TaskCreate, and a stage moved mid-turn points the agent at the video's own documents folder. A missing command-line tool now fails the turn the same way on every provider.
