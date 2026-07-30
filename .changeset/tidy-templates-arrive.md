---
"remocn-studio": patch
---

"New project…" produces a project, not an empty folder. `templates/remotion` is
vendored here and ships as a Tauri resource — `package.json`, `tsconfig.json`,
`src/index.ts`, `src/Root.tsx` with a single `<Composition id="Main">` and a
`src/Main.tsx` that renders something. Copying it is offline; only `bun install`
needs the network, which is why the one-composition invariant is guaranteed by a
template we wrote rather than hoped for from a generator.

`project.create` makes the folder and the row; `project.scaffold` streams the two
steps that follow — expanding the template, then installing — so the chat is
usable while `bun install` is still running, and a step that fails leaves the
project in place with the error and a Retry beside it in the pane. Both steps are
idempotent: expansion never overwrites a file that is already there, which is what
makes Retry safe after Claude has already edited the scene. Nothing is deleted
from disk on failure.

The template's `package.json` is named after the folder, slugified, because npm
names cannot hold spaces or capitals and a project called "Launch Film" is a
perfectly reasonable thing to ask for.
