---
"remocn-studio": minor
---

Show the plan Claude writes as one live checklist in the transcript, instead of a
wall of `TaskCreate` rows. Task calls fold into a single list anchored where the
plan was written, each row a subject with its status and its description on
demand; the thinking marker reads the running task's `activeForm`; the task tools
carry a task icon and never raise a permission card.

A running session in the projects pane now says which task it is on and how far
the plan has got, in place of `Running · 2m`.

The current plan also floats beside the conversation, in the gutter left of the
transcript: full block while it fits, an icon button that opens it over the
transcript when the pane narrows, and nothing at all when even that has no room.

Task subjects wrap instead of truncating, the list is set at a readable size, the
floating block carries a proper elevation token, and it can be hidden by hand —
remembered across launches.
