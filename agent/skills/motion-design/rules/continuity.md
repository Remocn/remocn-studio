# Continuity

Choose what the relationship across a boundary should communicate. It can preserve
an object, show its result, reveal a larger space, introduce another subject or
mark a change in time. A hard cut, fade and continuous transformation are all valid.

For a consequential boundary, write a short decision record before choosing its
transition. Example for a portfolio whose message expands from one case to breadth:

```text
Before: one case fills the view.
Relationship: this case belongs to the collection we want to reveal.
Action: widen the view while preserving that case's identity and position in it.
Result: the viewer recognizes the case among the other work.
Ready when: the framing and required images/labels support inspecting the collection.
```

This relationship motivates a shared space; a comparison or a change in time may
motivate a cut instead. Derive the geometry and readiness from the chosen relation.

## Shared objects

For a morph or match cut, identify the shared geometry, screen position and layer
ownership at the handoff. Derive both states from the same anchor. Inspect just
before, during and after the handoff for duplicate objects, seams, unintended
translucency and jumps. A crossfade between two opaque shapes may expose both;
use ownership or masking when the intended object should remain solid.

Two semi-transparent layouts over each other read as one muddy image with doubled
text. Fade the outgoing layout out before the incoming fades in, or keep the overlap
to a few frames in the fastest part of an accompanying move. `TransitionSeries`
`fade()` lays the incoming scene over an outgoing one held at full opacity unless
`shouldFadeOutExitingScene` is set, so text doubles either way; drive both opacities
yourself when text is involved. Check for frames where the incoming layer sits
between about 0.1 and 0.9 opacity while the outgoing one is still visible beneath.
A dissolve whose blend is the meaning keeps its overlap.

Mount a persistent bridge outside the Series boundaries it crosses. Matching DOM
ids or a shared background alone does not prove perceptual continuity; the viewer
must still understand the relationship between subjects.

## Cuts and camera

A cut on action can preserve direction and apparent speed. A cut on a resting
frame can clarify a new statement. Let the chosen shot relationship decide;
there is no mandatory moving layer or camera-settle interval around every cut.

For continuous travel, preserve the intended position and velocity at the join.
Distinguish entry side from travel direction: in a rightward flow, A can exit
center → right while B enters left → center. Both move right. Derive their offsets
from the shared direction, viewport and handoff progress so changing the direction
updates both sides. A deliberate reversal or a new shot has a different relation;
A's exit side alone does not determine B's entrance.

For a new shot, choose its composition for its message and relation to the prior
shot. Similar framings can produce an accidental jump; inspect whether the small
difference communicates anything before increasing scale or adding a transition.

## Time and reading

Budget transition overlap together with entry, action and reading time. Evaluate
actual visibility, including masks and motion blur. An incoming scene can be fully
composed at frame zero or build later when the reveal needs it. Empty space or a
pause can prepare an accent or clarify a break; check that purpose against the
rendered passage. An absent promised result is a defect. Use the actual readiness
conditions in [timing](timing.md) to determine when its reading window begins.

A single shot can contain several beats. Distinguish those beats in the script
without inventing cuts or relabelling states to satisfy a minimum scene count.
For technical TransitionSeries and coordinate traps, consult `video-lessons`.
