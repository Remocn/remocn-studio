---
"remocn-studio": patch
---

Claude Agent SDK session stream: the sidecar now runs `@anthropic-ai/claude-agent-sdk` against the opened folder and streams a turn into the app — assistant text, tool calls and their results — while the agent writes real files on disk. Auth comes from the already logged-in Claude Code; there is no API key and no custom OAuth. The model is the CLI default unless overridden from the picker in the chat pane.

A turn is one sidecar request, so stopping it is a fiber interrupt: the SDK query is interrupted first and its input closed after, which lets the CLI shut down in about half a second instead of waiting out the SDK's grace window, and records the interruption so the session resumes cleanly. The SDK `session_id` comes back with the result and is passed to the next turn, so a follow-up message continues the same session rather than starting a new one.

Failures are values, not crashes. A turn answers with a typed failure — `auth`, `usage`, `model` or `unknown` — and "Claude Code is not authenticated" reaches the UI in plain words instead of a stack trace; subscription usage limits keep the wording the CLI itself uses.
