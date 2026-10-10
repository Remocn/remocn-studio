# Catalogue adapters v1

Paper controls and uniforms match @paper-design/shaders(-react) 0.0.78. Defaults
combine its default preset with the bundled remocn wrapper defaults; fit is cover.
Limits and palettes follow the pinned shader declarations. Integer controls use
whole steps for octaves, iterations, ball/spot counts and steps per colour.
Shared instance fields control the slot, never shader uniforms. Procedural shapes
are available for Water, Gem Smoke and Liquid Metal; image input is not yet exposed.
Internal noise/empty textures must decode before mounting or acknowledging readiness.

Custom GLSL and Light Tunnel's two-pass renderer derive from remocn revision
8ae853e4c08108105684d4b8cac7f22400840d2a. Original files remain in upstream/.
Caustics, Strata and Weave use the checked Paper mount with GLSL 300 syntax and
sample-coordinate transforms; their default appearance and seconds clock remain
unchanged. Light Tunnel keeps its field, mipmapped render target and halftone pass,
adds pattern-coordinate transforms, and checks every frame before capture.

Custom authoring limits: Caustics frequency 0.1–20/intensity 0–5; Strata layers
1–60/amplitude 0–1; Weave density 1–100/warp 0–0.5. These are Studio control ranges
for APIs that do not specify bounds. Light Tunnel follows its upstream bounds.
Custom palettes have fixed stop counts. Pattern scale/rotation/offset transform
the field rather than the frame-sized canvas. Colors use RGB in custom GLSL;
Paper colors retain alpha. Speed is scene-local frame/fps, never wall-clock time.

These are immutable resources: do not alter existing files after distribution.
Add a new revision and path for future incompatible changes.
