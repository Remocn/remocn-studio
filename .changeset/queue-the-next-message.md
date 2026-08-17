---
"remocn-studio": minor
---

Write the next message while the turn is still running, and let it queue.

Send during a run no longer clears the field and drops what you wrote on the
floor — the message joins a queue on that session and the button says so, in
words: **Queue**, beside Stop rather than instead of it. When the turn settles
cleanly the head of the queue goes out as an ordinary turn, in the mode the
session ended in, so a plan approved mid-turn carries.

The queue is the session's, not the screen's: a background session dispatches
its own queue while you are looking somewhere else, exactly as its turns already
run there. Three things deliberately hold it where it is — a turn you stopped by
hand, a turn that failed, and a permission card still unanswered — because
sending a prepared message over an error, or over a question you have not
answered yet, is not what anybody meant.

The queue is a drawer on top of the composer, beside the plan and sharing its
chrome: one line whatever is in it — the message that goes out next, and how many
wait — opening upwards into the whole list. Each row carries an × to forget it
and a click to put it back in the composer for editing: the text, its
attachments, its elements and its assets together, since the `[Image #N]`
invariant is positional and cannot be split. Editing needs an empty composer, and
the row says so rather than overwriting a draft.

The queue lives in the webview and does not survive a relaunch; nothing in the
sidecar or the IPC contract changed, because every queued message becomes an
ordinary `claude.prompt` when its turn comes.
