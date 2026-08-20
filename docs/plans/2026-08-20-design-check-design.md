# Design check design

## Goal

Give every bundled agent provider one mechanical self-review tool before it
calls a scene finished. The tool renders two or three author-chosen key frames
through the preview host, reports objective contrast and layer defects with
coordinates, and warns when the sampled timeline did not change.

The tool does not judge taste, block human export, or claim to recognise
semantic decoration. Explicit motion intent belongs to REM-294.

## Tool contract

Add a provider-neutral `remocn-design` MCP server with one `design_check` tool.
The agent supplies a composition and two to nine distinct, non-negative frame
numbers. The current turn already owns the project id, so it is captured by the
sidecar handler rather than exposed to the model.

The answer is agent-readable JSON containing:

- the composition and sampled frames;
- the normal rendered PNG path for every sampled frame;
- findings with a stable code, severity, frame, message, fix hint, and bounding
  box when the defect is local;
- counts by severity.

The MCP call itself succeeds when findings exist. The convention requires the
agent to fix each finding or explain why it is intentional before saying the
scene is finished. The tool fails only when it cannot render or inspect the
composition.

The new server is registered in the shared MCP gateway and passed to every
bundled adapter with the library and pipeline servers. The existing declarative
server list remains the auto-allow source of truth, so there is no
provider-specific permission branch.

## Browser audit

Extend the preview host protocol with a design command and the warm render
session with a frame audit operation. One browser page is reused for the whole
request:

1. seek to the requested frame;
2. collect visible text candidates and layout geometry from the live DOM;
3. temporarily make the candidates' text paint transparent without changing
   layout;
4. capture one measurement PNG, then immediately restore the exact inline
   styles in a `finally` path;
5. decode the PNG inside the render page through `Image` and `canvas`, calculate
   contrast, and return findings;
6. capture the restored frame as the snapshot returned to the agent.

Doing pixel work in the browser avoids a new native PNG dependency and measures
the same composed pixels the renderer produced.

## Contrast

Audit visible elements that own non-whitespace text nodes. Skip elements that
are hidden, effectively transparent through an ancestor, smaller than eight
pixels, entirely outside the canvas, or under `data-design-check="ignore"`.

For each candidate:

- read the foreground from computed `color`, or a solid SVG `fill`;
- include a solid text stroke when it provides the stronger readable edge;
- hide only the text paint and capture the true pixels behind the glyphs;
- sample a bounded grid inside the candidate box, inset by one pixel, and use
  the median opaque background colour;
- composite foreground alpha over that background;
- require WCAG AA 4.5:1 for normal text and 3:1 for text at least 24px, or at
  least 19px at weight 700 or above.

A failure found at one sampled frame is a warning. The same selector and text
failing at two or more sampled frames is an error. Transparent output is not
audited because its final editor background is unknown.

## Layers

The first version reports only measurable text-layer failures:

- `text_out_of_frame` when readable text extends beyond the canvas;
- `text_clipped` when its rendered text range exceeds its own clipping box or a
  clipping ancestor;
- `text_occluded` when a bounded probe grid shows an unrelated painted element
  held above the text.

Every finding carries the text box coordinates and selector. A layer defect
seen at only one key frame is informational because it may be entrance or exit
travel; the same defect held at two or more samples is an error. Intentional
exceptions use the narrow `data-design-check="ignore"` escape hatch.

Generic occupied-area or empty-frame scoring is deliberately excluded. Sparse
frames are valid design, and a percentage cannot distinguish negative space
from missing content. The returned snapshots keep that judgement visible to
the agent.

## Timeline liveness

At each requested frame, fingerprint every visible DOM element in document
order using its rectangle and effective opacity. Fold an 8x8 pixel hash of
visible canvas and video elements into the fingerprint when readable.

When at least two distinct requested frames produce the same complete
fingerprint, return a global `timeline_static` warning. Its wording says that
the sampled timeline did not visibly advance and asks the agent to inspect the
snapshots; it does not call any element dead or require continuous motion.

Selector-scoped expectations such as `changes_between`, `visible_at`, and
`stays_in_frame` are intentionally deferred to REM-294 so `video/motion.md`
remains the only authoring source of truth in this change.

## Failure and cleanup

`design_check` requires the project's preview host, matching `preview.still`.
Missing preview, invalid frames, browser evaluation errors, and render failures
return normal tool errors with actionable messages. Measurement PNGs live only
in the preview host's temporary cache. Restored snapshots are temporary too and
are never copied into the project.

Text paint restoration is mandatory even when screenshot capture, decoding, or
sampling fails, so one failed sample cannot poison later renders in the warm
session.

## Verification

- Unit-test colour parsing, luminance, WCAG thresholds, alpha compositing,
  bounded sampling, persistence severity, and timeline fingerprint comparison.
- Test the MCP spec, shared gateway dispatch, provider tool exposure, and
  auto-allow coverage.
- Test preview protocol routing and browser style restoration on failure.
- Run a live fixture with weak normal text over a known background and verify
  that `design_check` reports the coordinates and 4.5:1 requirement; fix the
  colour and verify the finding disappears.
- Run typecheck, focused tests, the sidecar build, and the repository check.

