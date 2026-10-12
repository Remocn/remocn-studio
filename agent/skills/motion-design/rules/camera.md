# Camera

Use framing to show the subject, explain its context and reveal results. A locked
camera is valid for any number of visual planes. Camera movement should follow an
action, reveal space, or change the viewer's access to a detail.

## Choose the target

Name the starting and final subject, crop and anchor before animating. For UI,
compute the target from actual bounds and verify that the click and response remain
identifiable. A close-up may retain controls or an edge for context; a fully isolated
macro works when the relationship is already clear.

One wrapper owns a camera transform. Keep its geometry and event timing related
to the subject rather than distributing unrelated zoom numbers across components.
A null camera in the checker means no camera is being measured; it is not an error.

## Choose the movement

A pan, zoom, dolly or orbit describes a different spatial relationship. Uniform
scale is a valid graphic zoom; parallax belongs when depth matters. Use real assets
or dimensional rendering if the shot depends on physical lighting and materials.
A tilted product view can be an intentional composition.

Choose curve and duration for the gesture. A camera can stop before a cut, cross
a cut while moving, or remain locked. For continuous movement, inspect the joins
for unintended position or velocity jumps. A large zoom has three useful scale
interpolations: log scale gives a constant perceived zoom between two non-zero
sizes; `1/scale` matches an object approaching at constant speed; Remotion's
`output: "perceptual-scale"` interpolates area, which suits growth from zero but
front-loads a large zoom (1→4 is at 2.9 halfway, against 2.0 for log). None is
universal; compare them on the actual move.

## Inspect the actual render

Inspect text and source-image resolution at maximum magnification. Check mask
edges, borders, target drift, and clipping. Fast pans, stepped content and fine
patterns can produce strobing; test consecutive frames and normal-speed playback.
For 3D scenes, inspect perspective and filter placement: a flattening ancestor can
change the intended depth. Reduce unnecessary movement before adding blur or noise.

Handheld motion, rotation and parallax should belong to the selected world. Use
seeded motion if needed so frame seeks remain deterministic. Do not add camera
movement just to satisfy a variation or static-frame diagnostic.
