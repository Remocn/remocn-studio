## Why

The `motion-design` guides tell agents *when* to reach for a spring or a crossfade but not how
Remotion actually behaves, and several of the recipes agents copy are wrong in ways that show on
screen. A pilot that read four motion sources (Williams' *Animator's Survival Kit*, Material 3
motion, WWDC18 *Designing Fluid Interfaces*, WWDC23 *Animate with springs*) through extraction,
consolidation and an adversarial review measured `spring()` in remotion 4.0.520 and found:
the default config overshoots 16 %; any damping at or above critical renders identically, so the
`damping: 200` that the vendored recipes and our own templates use means "no bounce", not
"softer"; `overshootClamping` holds and then dips 2.6 %; `durationInFrames` snaps the last 0.45 %
of travel; and restarting a spring mid-move stalls it. The same pass surfaced a handful of
product-demo and transition defects agents produce today (doubled text in crossfades, a dragged
object on its own curve, dead frames after a click). No Linear issue yet; the research record is
local under `.omc/research/motion-books/`.

## What Changes

- New guide `rules/springs.md`: choosing a config instead of the default, the duration/bounce →
  stiffness/damping conversion, damping above critical is inert, mass adds bounce, `spring()`
  starts at rest so a retarget sums springs, and what `overshootClamping` and `durationInFrames`
  really do. Linked from `easing.md`'s physical-response row and from SKILL.md's guide table.
- `easing.md`: opacity, colour and blur get their own non-overshooting driver; a speed jump to or
  from full on one frame reads as a jolt; one starting-curve row for a single fixed-frame
  overshoot with a curve that ends at rest.
- `timing.md`: readiness after a spring is measured in pixels at delivery size, not by
  `durationInFrames` or an underdamped first crossing.
- `staging.md`: a click is ordered arrival → press → response with no dead frames; a dragged
  object and the properties a gesture drives are computed from the pointer; content changes
  happen at rest, not during fast travel.
- `continuity.md`: fade the outgoing layout out before the incoming fades in when text is involved.
- `camera.md`: replace the log-scale sentence with the three scale interpolations,
  including Remotion's `perceptual-scale`.
- `anti-patterns.md`: two symptom rows (arrival hits an invisible wall; subject jitters against a
  smooth background).

Every addition carries a condition of use, a counterexample and a check an agent can run on code,
its event plan or rendered frames. Growth stays near 20 % per touched guide.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No spec states the content of the motion guides; `agent/knowledge` requires the five-skill
bundle and its delivery, which do not change. The change sets `skip_specs: true`.

## Impact

Agent-owned Markdown under `agent/skills/motion-design/` only — a Tauri resource already mapped as
a folder, so the new file needs no resource entry. No shared contract, sidecar, Rust core or
webview change; no dependency change. `skills:check` is unaffected because nothing under the
vendored skills is edited.

## Non-goals

- Editing the vendored `remotion-best-practices` / `remotion-interactivity` recipes that use
  `damping: 200`: they are upstream copies `skills:sync` would overwrite. `springs.md` states
  what that value does instead.
- Changing the bundled templates' spring values or the Studio's spring controls (whose damping
  range above critical is dead): a separate change if wanted.
- The remaining ~55 reviewed clusters and the rest of the corpus (Shaw, Brown, Block, Bowen,
  typography and UI sources): the next extraction round, after the extraction brief is fixed.
- Any automatic check or tool: the guides describe checks the agent runs itself.
