---
"remocn-studio": minor
---

Live Remotion preview in the right pane. The sidecar starts a host per project that
compiles the folder with the project's own `@remotion/bundler`, its own webpack and its
own `remotion.config.ts` override, and serves a `<Player>` instead of the Remotion Studio
UI — so `staticFile()`, Tailwind, path aliases and any `webpackOverride` behave exactly as
they do in `remotion studio`, with none of its chrome.
