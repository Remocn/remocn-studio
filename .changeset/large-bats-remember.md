---
"remocn-studio": minor
---

Sessions and history: every conversation is kept in the app's own SQLite, so
closing the window no longer throws the transcript away. The left pane lists
sessions newest first with their folder and a relative timestamp; picking one
loads its blocks, rebinds Claude to that session's folder and resumes the same
SDK session rather than starting a fresh one; deleting takes its blocks with it.

History is the sidecar's, opened with `bun:sqlite` in the app data directory that
Rust resolves and passes down. It lives there because that is where the events
are — writing from the webview would have cost a Tauri IPC round trip per text
delta, and `tauri-plugin-sql` would have pulled sqlx into the Rust build to put
raw SQL in the front end. Only the SDK `session_id` is borrowed from Claude Code;
its transcript files are not a public contract and would break the pane on any
CLI update.

A stored block *is* a transcript entry, and there is exactly one fold: the
webview runs it to render the live stream and the sidecar runs the same function
to decide what to write, so a replayed session cannot drift from the one you
watched arrive. Each event upserts its row as it happens, in WAL — force-quitting
mid-turn loses the in-flight block and nothing before it, and the next turn picks
up numbering where the crash left off. A store that cannot be written to logs and
is ignored: history never fails a turn, and a database that cannot be opened at
all leaves Claude working with the pane explaining why it is empty.

Switching sessions stops the running turn, because the chat pane is keyed on a
token only an explicit select or New changes — the interrupt is the unmount. A
new session's row reaches the webview as the first chunk of the turn that created
it, so it appears in the list immediately without a round trip and without racing
the turn.
