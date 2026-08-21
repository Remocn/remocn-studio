---
"remocn-studio": minor
---

Give Codex, Copilot and Grok the same five bundled skills Claude already had.

The studio has always shipped its knowledge as one plugin — `remocn`,
`remotion-best-practices`, `remotion-interactivity`, `video-lessons`,
`motion-design` — and only Claude ever loaded it. The other three got the
always-on conventions and nothing else, so the same request produced a different
process depending on whose model answered it. Now every provider gets the whole
bundle, through its own native skill mechanism, out of the one `agent/skills/`
that was always the source of truth. Nothing is copied into your project, no
skill body is pasted into a prompt, and progressive disclosure still works: the
runtime shows a catalog and the agent opens what it needs.

Copilot and Grok take the shipped directory as `--plugin-dir` and read the
manifest the plugin already carried. Codex needed more: it resolves plugins only
from a user config layer, and `--config` overrides land in a layer it
deliberately skips — measured against codex-cli 0.148.0, `codex plugin list`
with those overrides answers "No marketplace plugins found" and the same tables
written into a `config.toml` answer with the plugin. So the studio keeps a Codex
home of its own beside its database and mirrors yours into it: every entry is a
symlink back, `auth.json` included, so the ChatGPT session and the sessions you
can resume are the same ones. Only the config and the plugin store are the
studio's, and your `~/.codex/config.toml` is never written to.

Attach is a value now, not a guess from the provider's name: `{ loaded, source,
collisions, reason }`. Skill-aware conventions are sent because the attach
succeeded, and they name the skills in words no single runtime owns, so the same
sentence resolves in four catalogs. A bundle that is missing or incomplete
degrades to the studio conventions plus one notice — never a failed turn, and
never dressed up as an auth or model failure.

A project that ships its own copy of a bundled skill no longer switches the
whole bundle off. That copy wins by each runtime's own precedence, the collision
is logged, and the other four skills still load.

Measured per turn, against the same prompt: Claude +1215 tokens, Grok +978,
Codex +605. Copilot's live run is blocked by an org policy on the account this
was built on, so it keeps its Experimental badge until someone can run the
matrix against a Copilot login that works.
