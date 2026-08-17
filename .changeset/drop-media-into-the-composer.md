---
"remocn-studio": minor
---

Drag video, audio and pictures from Finder straight into the composer.

The message field is now a drop target beside the library. What lands in it is
sorted by kind rather than by where you let go: a picture joins the attachments
with an `[Image #N]` written at the caret, exactly as pasting one does, and a
video or a sound joins the media list, which carries no reference — the sentence
you write is what points at it. A mixed drop splits across both.

There is still one drag subscription in the app. `useFileDrops` owns it and asks
`zoneAt` which of the zones a drop landed in, so the composer and the library
cannot both claim the same file, and a drop that missed both is ignored without
a word — the left pane goes back to whatever it was showing before the drag
passed over it.

A locked composer is not a target at all: waiting on a permission card, a folder
that is gone, or a failing environment check takes the field out of the hit test,
so the ring never lights on a message that could not hold the file. Anything that
is not media is refused out loud, in the same sentence the library uses, now
saying which of the two it did not go into.
