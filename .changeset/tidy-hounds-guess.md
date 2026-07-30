---
"remocn-studio": patch
---

Permission cards. The app opens **any** folder, including real repositories, so the agent no longer runs on `acceptEdits`: a `canUseTool` gate in the sidecar decides every call. Read, Glob, Grep, Write and Edit run silently as long as every path resolves inside the opened folder; Bash, any path outside the folder, and any tool the gate has no path rule for stop and ask.

The path check resolves symlinks and `..` before comparing, walking up to the nearest existing ancestor so a file that does not exist yet is still placed correctly. `../../.ssh/config` is outside the folder whatever the literal argument says, and so is a symlink inside the folder that points out of it — the signature the card is remembered under is the resolved path, not the one Claude typed.

The ask travels as a `permission` chunk on the turn's own stream, and the answer comes back as a separate `claude.permission` request. The card sits **above the composer** rather than in the transcript — an approval is a thing to answer, not a thing that happened — and the composer is locked behind it. Four choices, no checkbox: approve once, always allow this session, decline (the agent gets a message it can carry on from, not an error that ends the turn), or cancel the turn. "Always" keys a signature-scoped allowlist that lives in the sidecar process and never touches disk.

Asks are queued, because one assistant message can raise several tool calls at once, and answering one reveals the next.

Stopping a turn resolves its cards instead of leaving them dangling: the pending asks are settled before the SDK interrupt is awaited, so a stopped turn cannot hang on a prompt nobody will answer. `SIDECAR_PROTOCOL` is 4.
