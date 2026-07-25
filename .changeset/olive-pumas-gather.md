---
"remocn-studio": minor
---

A folder is now a row, not a string. `project (id, path UNIQUE, name, …)` joins the
schema and `session.folder` is replaced by `session.project_id` with
`ON DELETE CASCADE`, so removing a project takes its sessions and their blocks with it
in one `DELETE` and never touches the folder on disk. `path` is canonical — symlinks and
`..` resolved before the uniqueness check — which is what makes opening the same folder
twice, including through a link, land on the same project instead of forking the history
in two.

An existing database migrates itself: one project per `DISTINCT session.folder`, named
after its basename and dated from the sessions it inherits, with every session relinked
and every transcript intact. The rebuild runs with foreign keys off, which is the only
way to drop and replace the `session` table without the cascade taking `block` down with
it. A `projectFolder` left in `settings.json` becomes a project on first boot and the key
is dropped.

`SIDECAR_PROTOCOL` is 7. `project.list` / `open` / `create` / `rename` / `remove` join
the contract, `open` being create-or-get by path. `PromptParams.cwd` and
`PreviewParams.folder` become `projectId` and the sidecar resolves the folder from its
own table — for the SDK and for the permission gate alike, so the webview can no longer
send a `cwd` that disagrees with the row, and it is the gate a disagreement would break.
A project whose folder is gone from disk keeps its row and its transcripts; what it stops
doing is starting turns.

The webview mints the `historyId` and sends it with the first turn, so a turn has a
stable key from the moment it starts rather than from the moment the sidecar answers.
