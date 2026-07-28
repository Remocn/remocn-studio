---
"remocn-studio": minor
---

Cmd+V in the composer attaches whatever image is on the clipboard and drops a reference to it — `[Image #1]` — at the caret, in its own colour. A screenshot no longer has to be saved to disk and found again in a file dialog, and a file copied in Finder pastes the same way, keeping its own name. Pasting text is untouched: without an image on the clipboard the event is left alone.

The message can now point at a picture. "compare `[Image #1]` with `[Image #2]`" reaches Claude as the sentence cut at each reference with the image spliced in at that spot, rather than as two unlabelled images and a sentence about "the first one". Attachments nobody referenced go ahead of the whole sequence, which is byte-for-byte what a message with no references sent before. A picture referenced twice is sent once, and `[Image #7]` with three attachments stays plain text everywhere.

The reference format lives in one shared module because two processes parse it — the webview colours it, the sidecar splices into it — and two implementations that had to agree would drift. `items[i]` is always `[Image #{i+1}]`: removing an attachment takes its reference out of the text and shifts every higher one down, so the list and the sentence cannot disagree.

That binding runs both ways — deleting `[Image #1]` from the text drops the picture with it, and the rest renumber. The reference is therefore atomic: one Backspace next to it or inside it takes the whole thing, rather than leaving `[Image #1`, which points at nothing. Deleting it by selection, cut or Cmd+A works too. The trade is that referencing is no longer optional the way #13 first had it: an attachment cannot outlive its reference, so wiping the message wipes what was attached to it.

An attachment card is now the picture and nothing else — no filename, no format chip — so two attachments can be told apart at a glance rather than by reading them. The name is still the card's accessible name and its hover title, and a file that has since moved falls back to the icon. The reference stays coloured in the transcript, so a sent message reads the way it was written.

Pasted bytes cross into the core once, as a raw request body rather than a JSON array of numbers, and the core decides where the file lives — the same way it decides where the history database lives. From that moment the attachment is a path, which is what the prompt contract already carried, so nothing on the wire or in SQLite changed.

The webview can now load files as images through Tauri's asset protocol. The scope is deliberately broad: an attachment can be picked from anywhere on the machine, and the app already opens arbitrary folders.
