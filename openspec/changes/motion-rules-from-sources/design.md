## Context

`agent/skills/motion-design/` is one `SKILL.md` that routes to thirteen short guides under
`rules/`; an agent loads only the guide its decision needs, so every line costs context on every
turn that opens it. The guides are deliberately conditional — values are examples, each rule has
a counterexample — and `SKILL.md` asks that a correction be generalised only with its
applicability and a counterexample. See proposal.md — Why for the defects.

The source of every rule here is the pilot record in `.omc/research/motion-books/pilot/`
(gitignored): `consolidated.md` (69 clusters from 114 candidates) and `review.md` (adversarial
verdicts, measured against `node_modules/remotion` 4.0.520 with bun probes, 30 fps). Only clusters
the review accepted or revised are used, in the reviewer's corrected wording. The touched guides
today: easing 37 lines, timing 70, staging 42, continuity 61, camera 41, anti-patterns 47.

Ownership: all state is static Markdown shipped as the `agent` Tauri resource and read by the
provider's own runtime; nothing crosses IPC, no process owns new state, nothing can fail at run
time beyond a guide being unread.

## Goals / Non-Goals

**Goals:**
- Make the measured Remotion spring behaviour available at the decision point (choosing a config).
- Add the reviewer's ten highest-ranked rules, each with condition, counterexample and a check the
  agent can compute from code, its event plan or rendered frames.
- Keep each touched guide within ~20 % growth.

**Non-Goals:**
- Rewriting existing guide text beyond the one camera sentence the review found wrong.
- Adding rules the review rejected or ranked below C-41 (`review.md` § Placement).

## Decisions

**1. Springs get their own guide, not an easing section.** Inlining the spring paragraph, the
retarget rule and the clamping/duration caveats would grow `easing.md` by more than 40 %
(review § Placement), and only turns that use `spring()` need them. `rules/springs.md` (~60 lines)
is linked from easing's "Physical response" row and from SKILL.md's guide table ("Choosing or
retargeting a spring"). Alternative — an easing section — rejected on size.

**2. State behaviour, pin the version.** The guide says what the code does in remotion 4.x
(measured on 4.0.520) rather than giving a recipe: default `{mass 1, stiffness 100, damping 10}`
peaks at 1.163 (frame 11 @30 fps); damping ≥ 2√(k·m) gives bit-identical frames (k 100: c 20…200);
`overshootClamping` on the default config reaches 1 at frame 8, holds, then dips to 0.9735;
`durationInFrames` leaves 0.45 % of travel to snap on the frame after D; restart-from-current
stalls a retarget (per-frame step 14.1 → 6.7 px) while summing springs is exact. A project on
another Remotion version reads the same guide, so the numbers appear as "measured on 4.0.520",
and the check (sample `spring()` and read the peak/settle) is what carries across versions.

**3. Conversion formula from duration and bounce.** `stiffness = (2π/d)²`, `damping = 4π(1−b)/d`
with mass 1; the review confirmed ζ = 1 − b exactly. Chosen over teaching stiffness/damping
directly because speed and bounce are the two decisions a designer makes, and the Studio exposes
the resulting numbers under the `spring` group the knowledge spec already requires. Apple's
perceptual bounce bands were dropped: not verifiable on rendered output.

**4. Corrected mappings only.** Six Remotion mappings in the pilot were wrong when run (review §
Systemic problems). The guide text uses the reviewer's measured replacements: a non-overshooting
driver instead of `overshootClamping`; `Easing.bezier(0.38, 1.21, 0.22, 1)` (ends at rest)
instead of Material's undershooting overshoot curve; `posterize` instead of `frame % 2`; the three
scale interpolations instead of camera.md's log-scale suggestion alone.

**5. Placement and budget.**

| Guide | Adds | Lines (≈) |
| --- | --- | --- |
| `rules/springs.md` (new) | C-01/02/03 + mass, C-07, clamping and `durationInFrames` caveats | 60 |
| `easing.md` | C-05 (property drivers), C-04 (speed jump), C-09 (table row), link to springs | 7 |
| `timing.md` | C-24 under "Define readiness" | 6 |
| `staging.md` | C-35, C-36/37, C-38 | 8 |
| `continuity.md` | C-47 | 5 |
| `camera.md` | C-61 replaces the log-scale sentence | +2 net |
| `anti-patterns.md` | C-66, C-64 rows | 2 |
| `SKILL.md` | one guide-table row | 1 |

`easing.md` sits at the cap (≈19 %); if wording runs long, C-09's row is the first cut.

**6. Vendored recipes stay untouched.** `remotion-best-practices` and `remotion-interactivity` use
`damping: 200` (timing.md:53,93; transitions.md:195,222; REFERENCE.md; interactivity
REFERENCE.md). Editing them would be overwritten by `skills:sync` and flagged by `skills:check`.
`springs.md` names the value and what it does, which is enough for an agent that reads both.

## Risks / Trade-offs

- [Numbers drift with a Remotion upgrade] → each number is labelled with its version and paired
  with the probe that reproduces it; the rule is phrased as behaviour to check.
- [More text loaded per motion turn] → springs split out; other additions capped; no guide is
  touched for a rule ranked below the top ten.
- [A rule nudges agents toward more motion] → each added rule was screened for that in review;
  C-35/C-38/C-47 restrain motion, and every addition names its still or cut alternative.
- [Wording drifts from the measured claim during editing] → task to re-run the spring probe and
  compare each number in the final text before closing.

## Migration Plan

Content only; ships with the next release in the `agent` resource. Rollback is reverting the
commit. No settings, protocol bump or history migration.
