---
"remocn-studio": minor
---

Activity lines you can read. A path-shaped target now renders as its folder,
dimmed, in front of the filename at full contrast, and when the pane is narrow it
is the *folder* that is cut — from the left — so a row never truncates to
`/Users/me/pr…`. `toolTargetParts` returns that split and `toolTarget` joins it
back, so the row and the permission card cannot drift about what a call touches.
Bash keeps its single-string target: a command reads from the left.

The folder those calls ran in comes from the project of the session being
rendered, not from whichever project happens to be selected — that one is `null`
until `project.list` answers, which is why a screenshot of a real turn showed
fourteen absolute paths. Both ends are fixed: the source is the session's
project, and a row still reads well when the folder is unknown.

A run of consecutive calls that changed nothing folds into one row, `Read 12
files in components/studio`, that expands into exactly the rows it replaced, each
still expandable to its own detail. While the turn is running that row is a
ticker showing the file being read right now; when it settles it becomes the
count.

What counts as changing nothing is a named set of tools — `Read`, `Glob`, `Grep`,
`NotebookRead`, `WebFetch`, `WebSearch` — plus a `Bash` call whose command reads
the classifier as read-only, because an agent explores through the shell far more
than through `Read` and a turn is otherwise twenty rows of `ls`, `find` and
`cat`. That classifier splits on `&&`, `||`, `;` and `|`, refuses any command
containing a redirect, a backtick or `$(`, and then requires every segment's
program to be in a small allowlist with per-program guards — `find -delete`,
`git commit` and `curl -o` are all writes. Anything unrecognised is loud, so the
default is always to show. A `Write`, an `Edit`, a failed call and any tool the
app does not know are never folded either.

A `cd` into the open project is split off the front of a command and dimmed like
a folder, so the row spends its width on `find . -type d` rather than on the 52
characters every row shares. The permission card and the row's accessible name
still carry the command verbatim — a card is what you approve, not a summary.

Grouping
is a pure function over the transcript entries (`lib/studio/runs.ts`), never the
fold in `shared/transcript.ts` — the pane decides what to show, the store keeps
what happened, and a session loaded from history groups identically because the
same function runs over the same entries.
