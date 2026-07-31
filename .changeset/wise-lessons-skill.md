---
"remocn-studio": minor
---

Ship a `video-lessons` skill in the bundled agent plugin: the production lessons from remocn-demo
and its spun-off films, where every rule is there because the opposite was tried and had to be
re-rendered.

The turn's system prompt now tells the agent to work from it before writing or changing any video
code, so the same corrections no longer have to be pasted into a prompt by hand. The instruction is
added only when the plugin actually loaded, since a project carrying its own copy of a bundled skill
drops the plugin wholesale.
