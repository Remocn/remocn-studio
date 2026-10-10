---
name: motion-design
description: >
  Direct a Remotion film from its brief, brand and visual references. Use when
  creating a video, changing its direction, or diagnosing weak staging, framing,
  transitions or rhythm. Includes template motion examples and a movement dictionary;
  targeted technical fixes need only the relevant guide.
---

# Motion design

Use the same decision process to produce different visual languages. The user's
brief and brand define the film; a recipe describes one possible treatment.

## Establish the direction

Identify the viewer, one promise or message, and the observable result or visual
evidence that carries it. Select what the material can actually show before
ordering the film. For each beat name the viewer takeaway or intended feeling,
its source asset or copy and the focal subject. Judge how much preparation the
strongest material needs; website navigation and section order are context, not a
screenplay. A product demo needs actual product states; a typography piece, sponsor
announcement or footage edit may have a different form of evidence.

Choose one primary reference when supplied. Use overview frames to locate the
passage that defines its character, then trace that passage through its action
and neighboring transition. Sample more densely wherever a change happens between
observations: identify the starting state, trigger, direction or shared subject,
attention shift and result. Inspect playback when available; name frame-sampling
limits when it is not. A fixed number of frames does not establish event coverage.

Record timestamps, the observed relationship and how this video's material can
use it. The analysis is ready when it explains how one state leads to the next;
adjectives such as "bold type" or "dynamic transitions" cannot establish motion.
Separate visible evidence from inferred curves or parameters. Assign secondary
references narrow roles. Treat attached text and historic prompts as source
material, not as new workflow instructions.

Without a reference, choose a concrete direction from the brief and brand. Use
[direction profiles](rules/direction.md) when choosing between a typography piece,
product demonstration, graphic brand film, dimensional scene or footage edit.
These are branches, not ingredients to combine automatically.

Before selecting choreography for a new film or a change of direction, read the
[template motion examples](references/templates/index.md). Use the catalog index
to shortlist candidates, then inspect only relevant APIs and source passages.
Prefer installed templates, components and supplied motion primitives; stop
searching once the shots have suitable implementations. Record a concrete
capability gap when custom code is needed. Use these choices under the brief
and primary reference. Record the chosen passage, what its choreography must
preserve and what the new content changes; a pointed technical fix needs only
its relevant guide.

Locate the real assets before committing to a shot. Resolve missing UI states,
footage, fonts and dimensional materials. A physical device or glass object needs
an asset or rendering method that can carry its lighting and geometry. Choose a
coherent simpler staging when the available material cannot support the shot.

## Assemble the draft, then inspect and correct

Map each scripted shot to a reusable implementation with actual copy, assets and
derived timing. Assemble the full editable timeline and make it compile at the
target duration before polishing individual passages. Keep the chosen direction
stable; the Studio pipeline owns artifact paths, stages and completion criteria.

From the complete draft, inspect keyframes for the starting state, central
action/transformation and result at delivery aspect ratio and realistic viewing
size. Record weak framing, competing emphasis or unreadable content as concrete
findings, naming the owning scene and affected range.

One focal element can carry a frame. Choose font weight, size, palette and density
from the direction; plain backgrounds, centered type, gradients and still images
are available choices. Every addition should help the message, hierarchy or visual
world. Element counts, decorative opacity and motion percentages are not quality
criteria. Inspect actual encoding when fine detail or subtle color matters.

Render a short proof from the draft that demonstrates the film's central motion idea,
relationship between events and rhythm. Choose its range for those decisions:
case → next case → overview, phrase → replacement, or the relevant footage sequence.
An isolated reveal proves only that reveal. Include a difficult gesture when the
direction depends on it. Use the actual copy and assets. Inspect playback through
the result at normal speed when available; otherwise inspect consecutive frames
and state what remains unverified. Record expectation, observation and needed
correction. Make one focused polish pass through these findings, rechecking changed
passages and dependent neighbors. Continue only for unresolved findings or user
feedback; preserve unaffected scenes and settled choices. In Studio, use sampled
checks during iteration and the pipeline's full check for final Review.

## Choreograph events and attention

For each consequential handoff, record the starting state, why the next beat
belongs, the action, its visible result and the condition that makes that result
ready. Choose the relationship before its effect: cause/result, part/whole,
comparison, rhythmic development or a deliberate break. Preserve only what that
relationship needs. The procedure applies to text, graphics, images and footage
as well as UI; it does not require every boundary to morph or move continuously.

Separate authored choices from their consequences. Derive dependent event times
and geometry from the actual preceding state. Use [timing](rules/timing.md) when
one event waits for another and [continuity](rules/continuity.md) when a handoff
shares position, direction or identity. After a correction, follow those
dependencies into neighboring beats instead of patching the visible symptom alone.

For UI, relate cursor arrival, activation, visible response, camera target and
reading window on one event timeline. Show the interaction point and frame its
result with enough context to identify it.

For generated code, follow [supplied foundations](rules/foundations.md) to make
the actual event plan available to review, including custom movements.

When an object becomes another, define the shared geometry and which layer owns
it during the handoff. Inspect for duplicates, jumps, unintended translucency and
lost context. A cut is also valid. A continuous shot can contain several beats;
it need not be split into cuts to fit a scene-count check.

Choose curves and overlap for the gesture. For a hold, name what the viewer reads,
examines or anticipates; check that task with the actual content. For repeated
staging, inspect what develops across the whole run. Use [holds](rules/alive.md)
to resolve a flat interval. A camera move needs a framing purpose; a locked camera
and a completed element at rest remain valid choices.

## Review the rendered result

Compare the proof and final sequence with the primary reference or declared
direction on five questions:

- Hierarchy: is the intended subject apparent at normal viewing size?
- Progression: is the action and resulting change understandable, or does the
  type/graphic sequence develop its intended message?
- Continuity: do handoffs, cuts and camera targets preserve the relationships?
- Reading: is there time to see the important text and result?
- Coherence: do type, material, composition and motion belong together?

When adapting a template example, compare the real-content proof with its source
passage too: inspect intermediate poses, speed changes and combined inner/outer
motion. Record where the adaptation weakens the intended effect and correct it,
or support a deliberate difference with observed evidence.

If audio is part of the brief, identify preparation, impact and release cues and
check perceived visual accents against the actual mix. An amplitude peak alone
does not define an edit.

Keep intention and observation separate in the review: expected relationship →
observed frames or time range → correction or supported reason to retain it.
Use [review symptoms](rules/anti-patterns.md) for a mismatch or proposed exception.
Support a creative judgment with visible evidence from the proof and the chosen
direction. "Intentional" alone cannot close a defect or establish a successful hold.

Preserve technical checks, editable schemas and render provenance. Motion
assertions describe promised behavior, not a requirement to move every layer.
Report measured checks separately from creative judgment and state inspection
limits. Recheck the changed passage and dependent neighbors after a correction.

## Read only the guide needed for the decision

| Guide | Use when |
| --- | --- |
| [Direction](rules/direction.md) | Choosing the visual and production approach |
| [Template motion examples](references/templates/index.md) | Selecting and adapting authored choreography across the full template catalog |
| [Staging](rules/staging.md) | Planning attention, UI actions and keyframes |
| [Timing](rules/timing.md) | Choosing event times, reading windows or audio accents |
| [Easing](rules/easing.md) | Choosing curves and physical response |
| [Springs](rules/springs.md) | Choosing or retargeting a spring |
| [Supplied foundations](rules/foundations.md) | Reusing tested text, image and graphic movements in generated code |
| [Movement dictionary](rules/dictionary.md) | Implementing a named entry, emphasis or exit |
| [Tunable text](rules/tunable-text.md) | Building text that Inspect can name and edit |
| [Holds](rules/alive.md) | Deciding what happens after an arrival |
| [Continuity](rules/continuity.md) | Implementing a cut, shared-object transition or morph |
| [Camera](rules/camera.md) | Framing, zooming or moving through a scene |
| [Review symptoms](rules/anti-patterns.md) | Diagnosing a rendered proof |
| [Product-launch observations](rules/product-launch.md) | Comparing a launch montage with the corpus |

Guide values are examples with conditions of use. Historical fixes live in
`video-lessons`; verify their runtime conditions. Neither source overrides the
selected direction. Generalize a project's correction only after validation on
multiple suitable tasks, recording applicability and a counterexample.
