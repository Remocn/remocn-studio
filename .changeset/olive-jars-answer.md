---
"remocn-studio": patch
---

The projects pane says what it knows. With background turns a session could be
running — or blocked on a permission the gate auto-denies after ten minutes — in a
project whose group was collapsed, and the pane showed a chevron and a name. Now a
collapsed project row carries a rollup for the worst state inside it (waiting,
with a count, beats running beats failed beats unread), sessions that need you
float to the top of their group with the longest wait leading, and a group holding
a waiting session is lifted above the rest. The "Show N more" cap counts only
quiet rows, so it can no longer hide the one thing that was asking; the number it
shows is exactly what expanding reveals.

Rows earn their height. A settled session stays one line with the time it was last
touched on the right; a busy or failed one takes a second line that says what is
happening in words — `Waiting 4m · Bash`, `Running · 2m`, or the first line of the
error — and the times tick, so a wait is a fact rather than a snapshot from when
the row rendered. The timer counts up and never down: the ten-minute deadline is
the gate's, and the pane displays elapsed so that window can move without the pane
noticing. The status marker also stopped disappearing exactly when you looked at
it — the delete button has its own slot now instead of fading the marker out to
make room.

Deleting a session is undoable. The row leaves at once, a toast offers Undo for a
few seconds, and taking it puts the session back exactly where it was, selection
included. Quitting inside that window drops the delete rather than rushing it —
the session is still there next launch, which is the direction that keeps data.
Busy sessions still refuse to be deleted.

Ordering, the rollup and the cap are one pure function over the projects, the
sessions and the turn states, so all of it is pinned by tests that render nothing.
Nothing about what is stored or sent changed: the timestamps behind the timers are
webview-only, learned from events the pane already received.
