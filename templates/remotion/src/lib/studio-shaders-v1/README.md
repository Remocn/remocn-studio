# Studio shader adapters v1

The Mesh Gradient uniforms and fragment shader API match Paper Shaders 0.0.78,
`@paper-design/shaders-react/dist/shaders/mesh-gradient.js`. Initial appearance
matches the bundled remocn `shader-mesh-gradient` from revision
`8ae853e4c08108105684d4b8cac7f22400840d2a`. The implementation uses the public
`@paper-design/shaders` mount directly to own initialization, capture readiness,
error propagation and graphics disposal. Both Paper packages must be pinned to
0.0.78 in prepared projects. These adapters do not modify bundled upstream files.

Motion uses scene-local frame / fps, multiplied by the saved speed and 1000 to
convert to Paper milliseconds. Autonomous playback is disabled. Each requested
frame waits for layout, draws current uniforms and time, checks the linked
program and graphics errors, and finishes GPU work before releasing capture.
Unmount releases pending frame callbacks, capture handles and the GL context.
An initialization or context failure cancels capture.

The registry generated for a video imports only adapters prepared for that
video. Descriptor snapshots and implementations are versioned resources; do not
replace an authored copy during another insertion or on reopen.
