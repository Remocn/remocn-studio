---
"remocn-studio": minor
---

The left pane is projects with their sessions under them. Groups expand
independently, the expansion survives a restart, and opening a project opens its
group. Sessions stay newest-first inside a project, projects are ordered by their
most recent session, and a project past eight sessions keeps the rest behind
"Show more" rather than burying the projects below it.

`+` on a project row starts a session in *that* project; `+` in the pane header
offers "Open folder…" and "New project…". There is no global active project any
more — the open session decides what the title bar names and what the preview
follows, which is what makes a second project a normal thing to have rather than
a mode switch.

A project whose folder has gone is dimmed rather than hidden: its transcripts are
in our SQLite and stay readable, but it cannot start a turn, and both the row and
the composer offer "Locate…", which moves the row to the folder you point at
instead of forking a second project on the new path. That needs one method the
schema could not express, `project.relocate`, alongside rename and remove — remove
warns first, because the sessions and transcripts go with the row, and says
plainly that the folder on disk is not touched.
