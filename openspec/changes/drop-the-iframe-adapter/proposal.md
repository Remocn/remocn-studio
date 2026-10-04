## Why

Answers **REM-627**. The iframe preview was removed in 8b23db1 and its grab script in
cfd6ae5, but the adapter that served it still sits behind every call the preview
runtime makes to its surface. `native-entry.tsx` always calls `configureSurface` and
`configureBridge`, so in a release build the fallbacks to `document`, `window` and
`window.parent` never run — yet they are what most `preview/` tests exercise, because
only `surface.test.ts` ever configures a surface. The tests are green against a path
nobody ships, and the path that does ship (the shadow root, `elementsAt`'s host check,
the bridge) goes largely untested.

The fallback is not only dead, it is wrong: inside the shadow canvas, `document` is the
Studio's own webview document. A stray call made outside a mount would query and paint
the app's DOM rather than fail.

REM-628 ("one preview protocol, one channel") depends on this change: with one adapter
behind the bridge, the typed contract it introduces has one shape to describe.

## What Changes

- The preview surface becomes a required environment. `preview/surface.ts` drops every
  `?? document` / `?? window` fallback; reaching for the surface outside a mount is an
  error, while teardown-path calls (unlocking the camera, removing a listener) stay
  harmless.
- `preview/bridge.ts` drops the `window.parent.postMessage` path, its `message`
  listener and `COMMAND_SOURCE`; the webview end (`lib/studio/native-preview.ts`) is
  the one place a message is stamped with its `source`.
- `preview/inspect.ts` drops the React Grab window module: `grab()`, `grabModule()`,
  `GrabApi`/`GrabModule`/`GrabSource`, the `api` display-name fallback, the
  `native ? … : grab` branches and the `remocn_root` fallback. Source and stack come
  from the surface's `getStack` alone, read once per element.
- The `"no-grab"` Inspect status disappears from the preview, from the Schema in
  `lib/studio/preview.ts` and from `hooks/use-inspect.ts`'s trouble wording.
- The other dead fallbacks go too: `assets.ts` (`remotion_staticBase`, the
  `remotion-file:` token), `transport.ts` (the in-page `keydown` handler that only ran
  without a surface), `interactivity.tsx` (`remocn_root`), and `originOf(url)` in
  `lib/studio/preview.ts`, which `hooks/use-preview.ts` used only as an effect
  dependency.
- Tests: one harness, `withSurface()` in `test/surface.ts`, raises a shadow-root
  surface and a captured bridge on happy-dom. Every `preview/` test that touches a
  module reaching `surface.ts` or `bridge.ts` goes through it; tests of the fallback
  path are rewritten, not kept beside.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Inspect, selection and Snapshot behave exactly as specified today; the removed
code never ran in a shipped build. `skip_specs` is set.

## Impact

- Shared contract: none. `shared/ipc.ts` is untouched; no protocol bump.
- Preview runtime (`preview/`): `surface.ts`, `bridge.ts`, `inspect.ts`, `assets.ts`,
  `transport.ts`, `interactivity.tsx`, comments in `stack.ts`.
- Webview: `lib/studio/preview.ts` (`InspectStatus`, `originOf`),
  `lib/studio/native-preview.ts` (sole source stamp), `hooks/use-preview.ts`,
  `hooks/use-inspect.ts`.
- Sidecar, Rust core: none.
- Tests: new `test/surface.ts`; `preview/*.test.ts` that reach the surface or bridge,
  `lib/studio/preview.test.ts`, `hooks/use-preview.test.tsx`.
- Docs: the `preview/` line of CLAUDE.md's Layout map stops naming grab.

## Non-goals

- The `managed-loader.cjs` rewrite and `managed-transport.ts`'s synthesized
  `MessageEvent`. They are live: they adapt the `studio-objects-v5` runtime that lives
  in the person's project and checks `event.source === window.parent`. Replacing that
  hop is a channel question and belongs to REM-628.
- Typing `post()` messages or routing commands exhaustively — REM-628.
- The `grab` npm package. `grab/core`'s `getStack` is how the webview resolves a
  node's stack for the surface; only the in-page React Grab module is dead.
- The properties-pane spec's mention of "a full iframe reload" — spec wording drift,
  left for a spec pass.
