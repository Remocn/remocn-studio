---
"remocn-studio": patch
---

Refresh the vendored agent skills — `remocn`, `remotion-best-practices` and
`remotion-interactivity` — against upstream. They had drifted far enough that
`skills:check` failed on every run: upstream had added an `agents/openai.yaml`
and an icon to each skill, rewritten several reference pages, and dropped one
the vendored copy still carried.

What the agent knows about Remotion is now what upstream ships. `video-lessons`
is ours and is untouched.
