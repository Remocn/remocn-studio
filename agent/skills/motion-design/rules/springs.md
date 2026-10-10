# Springs

Use a spring when the response is physical: the object should arrive with
momentum, settle, or change destination mid-flight. A curve is simpler when a
landing must hit a fixed frame. Numbers below were measured on remotion 4.0.520
at 30 fps; sample `spring()` in the project's own version before relying on one.

## Choose the response, then convert

`spring()` without a config is not neutral: `{mass: 1, stiffness: 100, damping: 10}`
overshoots by 16% (peak at frame 11). Decide how fast the object responds (`d`,
seconds) and how much it bounces (`b`, 0 for none), then convert with mass 1:

```text
stiffness = (2π / d)²
damping   = 4π(1 − b) / d     b = 0 is critical: no overshoot; b < 0 changes nothing
```

For example, d 0.5 s and b 0 give stiffness ≈158 and damping ≈25, settling in
18 frames. Multiply the peak's excess by the travel in pixels to judge whether a
bounce is visible at delivery size: 4% of 20 px is noise, 4% of 800 px is a gesture.

Damping above critical (`2·√(stiffness·mass)`) changes nothing; Remotion renders
every such value exactly like critical. The `damping: 200` in many recipes means
"no bounce", not "softer". For a slower approach lower the stiffness or use a curve.
Raising `mass` at fixed damping adds bounce; scale damping by √mass to keep the
bounce, though the response still slows by √mass. Counterexample: a word slammed
onto a drum hit wants a hard stop or a cut, not a critical spring's gradual approach.

## Retarget without a stall

`spring()` always starts from rest and takes no initial velocity. When an object
changes destination before it settles (a cursor redirected, a panel cancelled
mid-open), add a second spring instead of restarting one from the current value:

```tsx
const config = physics; // the component's tunable `spring` group
const x =
  from +
  (to - from) * spring({frame, fps, config}) +
  (next - to) * spring({frame: frame - retargetAt, fps, config});
```

Restarting from the current value drops the per-frame step (14.1 → 6.7 px for
d 0.5 s, b 0, retargeting 0→100→150 at frame 4) before it surges again. Check the
per-frame deltas across the retarget frame: a dip followed by a surge is the
defect. Counterexample: a cursor that pauses on a button before the next target;
the pause is the meaning.

## What the options do

- `overshootClamping` does not make an underdamped spring safe: the default config
  reaches 1 at frame 8, holds, then dips to 0.97. Choose b = 0 instead.
- `durationInFrames` stretches the curve so its rest threshold lands on that frame,
  then snaps the last ~0.5% on the next one (4.5 px on a 1000 px move). Lower
  `durationRestThreshold` for large travel.
- An underdamped spring looks arrived at its first crossing but is not: the default
  config first reaches 0.98 at frame 8 and stays within 2% only from frame 25.
  [Timing](timing.md) describes when a spring arrival is ready.

Expose the physics as the component's `spring` group (`spring.damping`,
`spring.stiffness`, `spring.mass`) so they stay tunable.
