---
"remocn-studio": minor
---

Point at an element in the preview and comment on it in the chat. Turn on **Inspect**, hover the frame, click the thing you mean, write what should change, and the selection lands in the composer as an `[Element #N]` token you can point at from your sentence — exactly the way pasted images already work. You send the message yourself.

What Claude receives with each reference is the absolute path, line and column of the JSX that rendered the node, the component that owns it, a short project-only component stack, the composition, the frame you were looking at (and the frame within the enclosing scene, with its timing), and the node's own markup. "Make this bigger" becomes an instruction it can act on without grepping for the string and guessing which component to edit.

Source resolution is [React Grab](https://react-grab.com), driven headlessly: its global build is served by the preview host from a Tauri resource, before the project bundle so the DevTools hook beats React to the page, and kept out of the project's webpack — that compile costs seconds and peaks over a gigabyte, and this is 380 KB it would otherwise carry. Auto-init is suppressed and `init` is called with telemetry off, and the one web-font `@import` inside its overlay stylesheet is stripped when the file is served, so the feature sends nothing to a third party. A test reads the shipped bundle and fails if a version bump reintroduces one.

The preview message channel is now a two-way typed union discriminated by `type`, matching the sidecar contract's convention: the page reports its composition pick, its selections and its rebuilds; the app sends arm, freeze and seek down, addressed to the preview origin. Incoming messages are checked against the known preview origin before decoding, because these payloads carry file paths that end up in a prompt.

The shared reference reader is parameterised by kind, so `[Element #N]` and `[Image #N]` have their own counters and neither can consume the other's number. Everything else about it is unchanged: atomic deletion, renumbering, and the rule that a number beyond the list count is plain text. The binding runs both ways as it does for images — deleting the token deletes the selection.

Availability is deliberately narrow: Inspect is off while the composer is locked, while the preview is not serving, and while the preview's project differs from the open session's, so a path into one project can never reach a turn in another. Element references are dropped when the open session moves to a different project; text and image attachments are left alone. A rebuild clears the markers and disarms — a box drawn over the old render would lie about the new one — while leaving unsent references and whatever you were typing untouched. A selection whose source cannot be resolved is still usable, travelling with its markup, component name and frame, rather than silently doing nothing.
