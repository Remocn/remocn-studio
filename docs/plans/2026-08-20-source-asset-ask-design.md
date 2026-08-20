# Source asset ask card

## Problem

The Brand pipeline currently asks the agent to inspect a supplied site and
requires assets in `video/assets/`, but it does not say where those files must
come from. An agent can therefore satisfy the folder-shaped completion check by
drawing a replacement logo. That loses the identity the person explicitly
pointed at.

## Source-first contract

An identity asset named or shown by an authoritative source is source material,
not a design prompt. During Brand, the agent first tries to recover the original
file from the supplied resource: direct downloads, page image sources and
source sets, linked SVGs, or other files the page exposes. A recovered file is
copied unchanged into `video/assets/` and its source is recorded in
`video/brand.md`.

Synthesising, tracing, or restyling the asset is not a fallback. When no usable
original can be recovered, the agent asks the person to choose between supplying
the original and using an exact page capture.

The Brand stage is complete only when every required identity asset has both a
local file and a recorded provenance.

## Agent interface

Add a provider-neutral MCP tool named `request_source_asset` to the existing
pipeline server. It accepts:

- the asset's human name;
- the authoritative source URL;
- a short account of the attempted extraction and why it failed.

The call waits for the person's answer and returns one of two structured
outcomes:

- `uploaded`, with the project-relative path of the original file selected by
  the person;
- `screenshot`, authorising Studio to capture the supplied source without
  redrawing it and returning the resulting project-relative path.

The common studio tool gateway carries this call, so Claude, Codex, Copilot and
Grok receive the same behavior.

## Card

Introduce an `AssetSourceCard`, separate from permission approval. It shows the
asset name, source host or URL, and the agent's failed-attempt summary. It offers
two actions:

1. **Upload original** opens the native file picker. Studio validates that a
   file was selected, copies it into `video/assets/` with a collision-safe
   filename, then resolves the waiting MCP call with that path.
2. **Use site screenshot** asks Studio to capture the authoritative page and
   store an unchanged raster fallback in `video/assets/`, then resolves the call
   with that path and marks its provenance as screenshot-derived.

The card locks the composer while it is pending, is keyboard reachable, and has
an explicit cancel path. Cancelling leaves the Brand stage active and returns a
structured cancellation to the agent; it does not license invention.

## Capture boundary

Capture is app-owned rather than provider-owned so all bundled providers behave
the same. The first version captures the supplied page at a deterministic
desktop viewport and stores the page image as the fallback. Automatic logo
detection or destructive cropping is deliberately deferred: an incorrect crop
would be a new kind of identity mutation. The agent may frame or clip the
unchanged capture non-destructively in the Remotion layout, or ask the person
for the original, but may not trace or repaint it.

## Data flow

1. The Brand brief requires source-first extraction and provenance.
2. The agent attempts extraction with its available web/file tools.
3. On failure it calls `request_source_asset`.
4. The sidecar registers a pending source ask and emits an `asset_source` agent
   event.
5. The UI renders `AssetSourceCard` and sends the selected action through a
   dedicated sidecar method.
6. The sidecar copies the uploaded file or captures the page, then settles the
   pending MCP promise.
7. The agent records the returned path and provenance in `video/brand.md` and
   continues the pipeline.

Pending asks are scoped to the turn and are cancelled when the turn stops. A
late UI answer reports `matched: false` rather than affecting another turn.

## Errors

- An invalid URL is rejected before the card is emitted.
- A missing or unsupported upload leaves the card open with an actionable
  message.
- A failed page capture leaves the Brand stage active and returns the failure to
  the card; it never silently selects the upload branch.
- Filename collisions are resolved without overwriting an existing asset.
- Only HTTP(S) sources are eligible for app-owned capture.

## Tests

- Pipeline prompt tests prove the source-first process, provenance criterion and
  `request_source_asset` tool name stay aligned.
- Tool schema and gateway tests cover argument validation and a settled answer.
- Sidecar tests cover upload copying, collision-safe names, URL validation,
  capture failure, turn cancellation and late answers.
- UI tests cover both actions, file-picker cancellation, focus, Escape and the
  pending composer lock.
- A live flow supplies a site URL, forces extraction failure, chooses each
  branch in turn and confirms the agent receives a real path under
  `video/assets/`.
