---
"remocn-studio": minor
---

Turns keep running when you look away. Turn state — entries, the fiber, the
pending permission queue — moves out of the chat pane into the provider as a map
keyed by the session id the webview minted, so switching sessions is a read from
another key rather than an unmount. Where a `key` prop used to be the cancel and
the interrupt was a side effect of remounting, cancellation is now `stopTurn`,
said out loud, and nothing else stops a turn.

What was one "is thinking" boolean for the whole app is a status per session: a
row shows running, waiting on a permission, or failed, and a turn that finished
while you were elsewhere leaves an unread dot that clears when you open it. None
of it is stored — the transcript in SQLite is the durable part, this is just what
is happening right now.

A permission raised by a session you are not looking at marks its row and is
answered from that session, because the card belongs to its turn rather than to
the screen. The gate now denies anything left unanswered for ten minutes: with
background turns, nobody seeing a card is the normal case, and an unanswered card
holds a `claude` process open indefinitely.

Quitting with turns in flight asks first. The Rust core prevents both the window
close and the app exit and emits `app://quit-requested`; the webview quits
straight away when nothing is running and asks when something is, because the
sidecar dies with its process group and every in-flight block dies with it.
