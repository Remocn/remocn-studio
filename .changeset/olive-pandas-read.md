---
"remocn-studio": minor
---

Activity lines you can read. A path-shaped target now renders as its folder,
dimmed, in front of the filename at full contrast, and when the pane is narrow it
is the *folder* that is cut — from the left — so a row never truncates to
`/Users/me/pr…`. `toolTargetParts` returns that split and `toolTarget` joins it
back, so the row and the permission card cannot drift about what a call touches.

A command gets the same treatment: a leading `cd …&&` or `VAR=…` is the lead,
dimmed and the first thing to collapse, so the row spends its width on
`find . -type d` rather than on the 52 characters every row shares. It is *not*
matched against the open folder, because the folder a project row points at is
routinely a scene inside a Remotion project while the agent works from its root —
the prefix is noise wherever it goes. The permission card and the row's
accessible name still carry the command verbatim: a card is what you approve, not
a summary.

The folder those calls ran in comes from the project of the session being
rendered, not from whichever project happens to be selected — that one is `null`
until `project.list` answers.

A run of consecutive tool calls folds into one row that shows the last of them
and a `+N`, expanding into exactly the rows it replaced, each still expandable to
its own detail. While the turn runs, that row is a ticker of what the agent is
doing right now, because the last entry is the newest one. Only a failed call
breaks a run and keeps its own row, so an error and its text are never hidden
behind a chevron. Grouping is a pure function over the transcript entries
(`lib/studio/runs.ts`), never the fold in `shared/transcript.ts` — the pane
decides what to show, the store keeps what happened, and a session loaded from
history groups identically because the same function runs over the same entries.

Each row now leads with an icon for the kind of work — a terminal, an eye, a
pencil — instead of a coloured dot, and an unknown tool gets a wrench rather than
nothing. State moved into the icon's colour: muted when done, amber and pulsing
while running, destructive when failed. A settled turn no longer has a column of
green.
