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

The current plan also sits on top of the composer: one line saying which task is
running and how far the plan has got, opening upwards into the whole list.

Task subjects wrap instead of truncating, the list is set at a readable size, the
block carries a proper elevation token, and whether it is open is remembered
across launches.
