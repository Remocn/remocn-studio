---
"remocn-studio": patch
---

The thinking marker now says how long the turn has been running, ticking once a second: `Thinking… 12s`, then `2m 5s`, and `1h 5m` once seconds stop meaning anything. Judging a turn no longer means remembering when you pressed send, and the first minute — where most turns live — reads as a number that moves rather than as the session row's one unchanging `<1m`.

It counts from the instant the turn started, the same one the session row counts from, so the two panes cannot tell you different things about one turn. It keeps counting while a tool runs, while a permission card is up and while an answer streams and the marker is not on screen, because it measures the turn and not the marker's latest appearance — opening a background session that has been running a while shows its total rather than restarting its clock.

The marker leads with the animated dot matrix (`DotmSquare11`, grad-prism) instead of a static sparkle, so the row that reports a running turn is itself in motion. The number sits beside the shimmer rather than inside it, muted and in tabular figures, so a digit changing every second neither shimmers nor shifts the words around it, and it carries no live region: a screen reader must never be handed something that changes sixty times a minute. When the turn settles the marker leaves, timer and all.

Nothing is stored or sent for this — no IPC change, no migration, no transcript entry. The turn's start was already in the webview's turn state, and the whole feature is rendering. The chat pane's clock runs only while its turn does, so an idle window is not repainting once a second for as long as the app is open.
