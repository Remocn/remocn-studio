---
"remocn-studio": patch
---

The agent now knows remocn without the project having to install anything. A Claude Code plugin ships inside the app bundle carrying three vendored skills — `remocn`, `remotion-best-practices` and `remotion-interactivity` — and the sidecar hands it to the Agent SDK as the `plugins` option. In a fresh Remotion project the agent knows the registry components and installs them with `npx shadcn add @remocn/…`.

Globally installed skills were not an option: measured with an empty folder, the app's `settingSources: ["project"]` lists 45 commands and none of them is a remocn skill, and reaching a global install means adding `"user"` — which also loads `~/.claude/settings.json`, `~/.claude/CLAUDE.md` and every other skill on the machine, making the app behave differently per user. The plugin lists 48: exactly the three we ship. Nothing outside the app is written, and it works offline.

`bun run skills:sync` refreshes the vendored copy from upstream and `bun run skills:check` fails when what is committed no longer matches, which is now a CI job — a vendored copy rots silently otherwise. The sync copies real files rather than the symlinks a global skills install leaves behind; vendoring those would have loaded nothing, with no error to show for it.

The studio conventions the skills cannot know — exactly one composition with id `Main`, every scene inside it via `Series`/`TransitionSeries`, and keeping the result editable — are appended to Claude Code's own system prompt rather than replacing it.

A project that installed any of these skills itself keeps its own copy: the bundled plugin steps aside instead of shadowing it.
