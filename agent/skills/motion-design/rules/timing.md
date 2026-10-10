# Timing

Choose event times before curves. Timing determines when a change happens;
spacing determines how the object travels between those times. Durations follow
the selected reference, travel distance, content and intended energy.

## Build an event timeline

Identify the event that makes the next action possible: a phrase vacates a reading
position, the graph reaches its value, the footage reveals its subject, or all
required images become inspectable. For UI this can be target visible → activation
→ response → result readable. Separate authored choices (pace, gap, travel duration)
from derived times (group completion, result ready, next start). Use the same clock
and units for dependent events; one continuous shot may contain several beats.

Read the actual component schedule, including its children, before assigning a
completion time. These relationships describe common dependencies:

```text
groupExitEnd = max(memberExitEnds)
uniformStaggerExitEnd = exitStart + (itemCount - 1) * exitStagger + exitDuration
overviewReady = max(cameraSettled, ...requiredImageEndTimes, ...requiredLabelEndTimes)
nextStart = predecessorReady + chosenGap
```

For example, nine words fading from frame 176, two frames apart, for eight frames
each finish at frame 200. A following phrase using the vacated position cannot
treat frame 188 as that completion. If a replacement deliberately overlaps, derive
both sides from one handoff and specify the masking or ownership that keeps the
important text legible.

Define readiness for the viewer's task. A whole-grid inspection waits for its
required images and labels as well as the camera. A caption can be read while an
unrelated background moves. A reading window starts when masking, movement and
occlusion stop preventing that task; it does not start merely when the scene or
wrapper mounts. Budget entry, action, reading and transition overlap together.

A spring-driven arrival is ready when its remaining distance stays below what shows
at delivery size (for example 1 px); sample `spring()` to find that frame. Neither
`durationInFrames` nor an underdamped spring's first crossing marks it
([springs](springs.md)). Wait for the full settle only where residual drift would
show, as in a match cut or geometry handed to the next object.

After changing copy, item count, stagger or duration, recompute group completion
and every dependent event. Inspect the last child and the next arrival together,
including the frames around their computed boundaries. Keep code and review on
that computed schedule; [foundations](foundations.md) describes its implementation.

## Choose a starting duration, then inspect

For a restrained UI gesture at 30fps, an entry around 8–18 frames (0.27–0.60s) can
be a useful experiment. This is an illustrative range, not a calibrated quality
threshold. A large reveal, physical gesture or slow disclosure may need much longer;
a graphic cut may need no animated entry. Convert seconds to the actual FPS.

Allocate time to the action and viewer task before distributing a total duration
among shots. Related actions can share duration classes, and equal lengths can
support rhythmic typography. Inspect what each repetition contributes before
retaining the same entry/hold/cut pattern. A slower exit can itself be the subject.

If a move feels frantic, test time, distance and framing separately. Doubling its
duration is one experiment; reducing unnecessary travel can be the better fix.

## Reading and audio

Preview at normal speed and realistic viewing size. Keep the result long enough
to identify what changed. A long still title can be appropriate; add movement only
when it has a role, not to fill a measured static interval.

Use audio landmarks as evidence: preparation, impact and release have different
roles. Decide which visible event should peak at the chosen cue, then place its
start earlier if needed. Confirm by listening to the actual mix; never stretch an
empty scene merely to reach the end of a track or cut at every amplitude peak.

The checker reports duration distribution and sampled holds. These are diagnostic
observations; compare them with the intended direction and comprehension demands.
