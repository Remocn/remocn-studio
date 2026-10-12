## Why

The canvas chain (`shadow-preview-canvas`, `canvas-pan-follows-the-pointer` and
the changes built on them) was verified in the running app and archived on
2026-09-24. Work that was still open in them moves here so it is not lost inside
the archive. Their requirements are already in the main specs; this change
implements and tests what those requirements say.

## What Changes

- Middle-button drag pans the canvas (required by `preview/shadow-canvas`,
  "Panning follows the pointer"): the moves do not reach the page; find the layer
  that drops them and fix it there.
- Remove the grab script the sidecar still serves for the removed iframe page:
  `GRAB_SCRIPT_ENV` in Rust and the sidecar, the `grab/index.global.js` resource,
  `/__remocn/grab.js`, `withoutWebFonts`.
- Suspend the render compiler between renders, once the native compiler reports
  ready/failed to the pane and resets the still cache itself.
- Automated coverage the canvas never got: stale connection and disposal, camera
  boundaries, native bundling, reload and media cleanup, packaged resources.

## Capabilities

None: every behaviour here is already specified; `skip_specs` is set.

## Non-goals

`canvas-camera-feel` (animated camera, rulers, grid, remembered camera) stays its
own change.

## Impact

Webview camera and pointer handling, the sidecar preview host and Rust sidecar
supervision (grab), the render compiler lifecycle, tests.
