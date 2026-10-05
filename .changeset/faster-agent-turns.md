---
"remocn-studio": patch
---

Agent turns waste less time. After each agent edit, the preview rebuilds only what changed instead of recompiling the whole project. A Claude chat keeps one system prompt from turn to turn, so the provider can reuse its cached prompt even when the pipeline moves to a new stage; the stage's instructions now travel with the message. A Snapshot no longer deletes the design check's report, so the review stage can close without running the check again. Loading a skill no longer asks for permission, and Copilot and Grok read the studio's bundled skills without a card. While the pipeline is mid-stage, a single pointed change is made and the turn ends, rather than the agent carrying on through the remaining stages. Chats started before this update keep their current conventions until Claude compacts them.
