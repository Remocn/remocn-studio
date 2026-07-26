---
"remocn-studio": minor
---

The composer picks a mode, and it belongs to the session rather than to the app.
Three of them, spelled the way the Agent SDK spells them so nothing has to be
translated on the way down: **Auto** (the default) hands routine calls to Claude
Code's own classifier, **Accept edits** lets writes inside the project through and
still stops at every command, **Plan** makes the turn read-only.

The permission gate is unchanged and still decides everything that reaches it —
the mode only changes how much traffic that is. One consequence is deliberate and
worth knowing: in Auto the classifier runs *before* `canUseTool`, so a call the
gate would have stopped can be approved without it ever being asked, and "anything
outside the folder always asks" holds absolutely in Accept edits and Plan but is
best-effort in Auto. What the classifier refuses on its own is no longer invisible
either — a denial with no card now lands in the transcript as a notice, where it
used to show up as nothing but a failed activity line. The CLI is also asked which
mode it actually ran in, so a model that cannot do Auto says so instead of the chip
quietly lying.

Plan mode ends in a card above the composer with the plan itself in it: approve it
into Accept edits or into Auto and the *same* turn carries on building, or send it
back to be revised without losing the turn. The approval switches the live session
through `setPermissionMode` and persists the new mode, so the chip and the next
turn agree.

A session remembers its mode across restarts (a new column, defaulting to Auto, so
existing sessions behave exactly as before) and a brand-new session always starts
in Auto.
