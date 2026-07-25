---
"remocn-studio": minor
---

Chat transcript: assistant answers render as markdown — headings, lists and syntax-highlighted code — instead of raw text, streamed with a per-word reveal so an 85-character delta arriving every 470 ms reads as typing rather than stepping. Highlighting is Shiki loaded through a custom Streamdown plugin over `createHighlighterCore` with a fixed language set (tsx, ts, jsx, js, json, bash, css); `@streamdown/code` as it ships pulls every bundled grammar and costs 9.1 MB.

The animate plugin skips every text node inside `code`, `pre`, `svg`, `math` and `annotation`, so inline code used to pop in fully opaque while the words around it were still arriving; it now carries the same fade.

Every tool call is one compact activity line — `Edit src/Scene.tsx`, `Bash bun run build` — with a running/done/failed state, and clicking it expands the detail: a real line diff for Write and Edit, computed from the tool's own `old_string`/`new_string` rather than parsed out of the result text, the command next to its output for Bash, and a preview for everything else. A failed call shows its error without being expanded. Long output is capped at 60 lines with a "Show N more lines" affordance, so a 5000-line Bash result cannot lock up the pane; transcript blocks are memoized and rendered through `MessageScrollerItem`, which gives each one `content-visibility: auto`.

Composer: pick a reasoning effort (low → max, persisted) alongside the model, attach images that are sent to Claude as image blocks, and watch context-window use on a ring that fills as the session grows. The model picker moved out of the pane header into the composer. Attached files travel as paths — the sidecar reads and encodes them, so no base64 crosses the Tauri IPC — and the context reading is taken from the live SDK query just before it closes, since there is no session left to ask afterwards.
