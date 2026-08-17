---
"remocn-studio": minor
---

Point at a file with `@`, anywhere on the machine.

Typing `@` in the composer opens a list of the project's files, filtered as you
keep typing and matched on the file name as well as the path. Enter or a click
writes the file into the message as a path in backticks, and the sentence around
it is what says what to do with it. Escape leaves the `@` as the plain text it
was.

A query that starts with `/` or `~` browses the filesystem instead: the list
becomes that folder's contents, Enter on a folder drills into it and keeps the
list open, and Enter on a file writes its absolute path. A file outside the
project is read through the ordinary Allow/Deny card, because the permission
gate auto-allows only what is inside the opened folder.

A tagged file is coloured where the message is drawn — in the composer as you
write it and in the bubble after it is sent — so a path reads as a thing you
pointed at rather than as punctuation in the middle of a sentence. A backticked
span that is not a path, `Main` among them, stays the colour of the text
around it.

A tagged file is plain text, not a fourth kind of reference beside
`[Image #N]`, `[Element #N]` and `[Asset #N]` — a path is the whole payload, so
nothing is spliced into the turn, the transcript and its SQLite rows are
untouched, and a reopened session renders exactly what was sent.
