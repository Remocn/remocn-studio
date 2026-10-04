## Context

See proposal.md for why. The current state, read from the tree on 2026-10-02:

- `preview/native-entry.tsx:77-78` calls `configureSurface(environment)` and
  `configureBridge(environment)` on every mount; nothing else in the shipped runtime
  mounts a preview. Every `environment?.… ?? document/window` in `preview/surface.ts`
  (lines 29-39, 63-65, 97, 120) and the `else` branches of `post`/`onCommand` in
  `preview/bridge.ts:143-172` are therefore unreachable in a release.
- `preview/inspect.ts` still carries the in-page React Grab module: `GrabSource`,
  `GrabApi`, `GrabModule` (76-92), `let api` (132), the `"no-grab"` arm of
  `armInspect` (173-177), `grab()` (299-332), the `api?.getDisplayName` fallback in
  `nameOf` (766), the `native ? null : grab…` branches in `report`, `sourceOf`,
  `stackOf` (810-901), `normalise`'s window-sized fallback (1020), `grabModule()`
  (1080) and `rootPath()`'s `remocn_root` fallback (1087-1092).
- The webview stamps `source: "remocn-preview"` on everything the surface emits
  (`lib/studio/native-preview.ts:469`), after `bridge.post` already stamped it
  (`preview/bridge.ts:140`).
- `hooks/use-preview.ts:95` computes `originOf(preview.url)` and uses it only to gate
  and re-key the subscription effect (193, 258).

### Corrections to the issue

- **Not 23 of 24 test files run the dead path.** 23 of 24 never configure a surface,
  but only the files whose module reaches `surface.ts` or `bridge.ts` run a fallback:
  `anchor`, `assets`, `hidden`, `inspect`, `picker`, `snapshot`, `tuning`,
  `scenes-report` and `playback-rate` (and `managed-objects` through `contentRoot`).
  The rest — `fiber`, `stack`, `source`, `timing`, `scenes`, `playback-position`,
  `frame-clips`, `media-release`, `presence`, `geometry-between`, `shipped` — test
  pure functions or modules that never touch the surface, and need no harness.
- **The dead fallbacks are not only in `surface.ts`, `inspect.ts` and `bridge.ts`.**
  `preview/assets.ts` (`window.remotion_staticBase` and the `remotion-file:` token —
  which is exactly what `assets.test.ts` asserts today), `preview/transport.ts:146`
  (an in-page `keydown` handler installed only without a surface; the webview's
  `hooks/use-preview-transport.ts:204-215` owns Space and the arrows), and
  `preview/interactivity.tsx:208-214` (`remocn_root`) are the same adapter.
- **`managed-loader.cjs` / `managed-transport.ts` are not dead.** They adapt the
  `studio-objects-v5` runtime that ships *inside the person's project*
  (`templates/remotion/src/lib/studio-objects-v5/index.tsx:245-299`), which returns
  early when `window.parent === window`, posts to `window.parent` and drops any event
  whose `source` is not `window.parent`. Existing projects carry that code, so the
  loader's rewrite and the synthesized `MessageEvent` are load-bearing. They stay;
  REM-628 decides the channel.
- **"No mention of grab in `preview/`" needs one qualifier.** The `grab` package is
  live: `grab/core`'s `getStack` is what `native-preview.ts:570` hands the surface.
  What dies is the in-page React Grab module (`__REACT_GRAB_MODULE__`, `init`,
  `registerPlugin`, `getSource`, `getDisplayName`). The comments in `stack.ts:17-18`
  and `interactivity.tsx:196` that contrast Remotion's call site with "grab's
  resolution" are reworded to "the component stack", so the criterion holds
  literally.
- The bridge line reference is 140, not 139.

## Goals / Non-Goals

**Goals:**

- One environment for the preview runtime: a configured surface and bridge, or an
  error.
- Every `preview/` test that reaches the surface runs against a shadow root and a
  captured bridge — the shape that ships.

**Non-Goals:**

- Typed messages, exhaustive command routing, the webview `PreviewChannel` — REM-628.
- Bringing `preview/` under `bun run typecheck` — REM-628 (`test/surface.ts` will pull
  `preview/surface.ts` and `preview/bridge.ts` into the program as a side effect,
  which is fine and is a first step).

## Decisions

### 1. Acquire throws, release is harmless

`surface.ts` keeps one nullable cell and exposes a private `required()` that throws
`Error("The preview surface is not configured.")`. `contentRoot`, `overlayRoot`,
`styleRoot`, `surfaceHref`, `focusSurface`, `elementsAt` and
`surfaceEvents.addEventListener` go through it. `lockCamera(owner, false)`,
`onViewChange`'s unsubscribe and `surfaceEvents.removeEventListener` stay no-ops
without a surface, because `native-entry`'s `dispose` unmounts React before it stops
the surface and teardown order must never throw.

`surfaceEvents` remembers the target each wrapper was added to and removes it from
that target. Today `removeEventListener` re-reads the environment, so a removal after
`stopSurface()` would reach `window` and leak the listener on the viewport.

`nativeSurface()` is renamed `currentSurface()` — "native" only meant "not the
iframe" — and keeps its nullable return for the two readers that legitimately ask
"is there one?": `player-runtime.tsx`'s `askedId`/`preferredId` and inspect's
navigation check. Everything that needs a value (`assets.staticBase`,
`inspect.rootPath`, `interactivity.rootPath`, inspect's `normalise`) reads
`surface()` — the throwing accessor, exported.

*Alternative: keep falling back.* Rejected: in the shadow canvas `document` is the
Studio's own document, so a fallback turns a lifecycle bug into the app painting
overlays on itself. *Alternative: return null everywhere.* Rejected: it spreads null
checks across thirteen modules for a state that only a bug reaches.

**Failure direction.** A call outside a mount is a programming error and is loud:
it throws in the preview runtime, which the native mount's `PreviewBoundary`
surfaces as the worded "The video could not render…" when it happens during render,
and as a console error otherwise. Async continuations that can outlive a mount —
`report` after `getStack`/`assetNames`, Snapshot's capture — already return on
`!element.isConnected`; the apply step checks each `await` in `inspect.ts` and
`snapshot.ts` keeps such a guard before touching the surface again.

### 2. The bridge has one adapter

`post()` without a configured bridge drops the message (the mount is gone; nobody
listens) — the same outcome as today's microtask check when the bridge changes.
`onCommand()` without a bridge throws, like any acquisition. `post` no longer stamps
`source`; `native-preview.ts`'s `emit` is the one stamp, because it is the end that
decodes. `MESSAGE_SOURCE` and `COMMAND_SOURCE` leave `bridge.ts`.

### 3. Inspect reads the stack once

With one source of truth, `sourceOf` and `stackOf` collapse: `report` calls
`surface().getStack(element)` once, `projectFrames(root, frames)` gives the stack,
and its first frame is the source spot. `GrabSource` goes; `SourceSpot` (already
absolute, from `preview/source.ts`) is the one shape, so `resolved()` reduces to the
identity and is removed, and `whereOf` maps a `SourceSpot` straight to a
`TargetWhere`. For the chain links, `sourceFor(node)` stays one `getStack` per link,
as today. `nameOf` loses its third fallback and ends at `componentAt(element)`.

`armInspect` returns `"armed"` whenever a canvas exists. `"no-grab"` is removed from
`InspectStatus` in `preview/inspect.ts`, from the Schema literal list in
`lib/studio/preview.ts:51-57`, and from `troubleOf` in `hooks/use-inspect.ts:1227`.
A stale preview that still sent `"no-grab"` cannot exist — the preview runtime ships
in the same bundle as the webview — and an undecodable status falls to the existing
"could not enable element selection" branch anyway.

### 4. `withSurface()` lives in `test/surface.ts`

Not in `preview/`: `preview/shipped.test.ts` requires every non-test file there to be
a Tauri resource, and a test harness must not ship. `test/` already holds the shared
harnesses (`register-dom.ts`, `stub-global.ts`).

```ts
interface TestSurface {
  host: HTMLElement;          // the shadow host, inside viewport
  root: ShadowRoot;           // attachShadow({ mode: "open" })
  viewport: HTMLElement;      // appended to document.body
  overlays: HTMLElement;      // sibling of host inside viewport
  sent: Record<string, unknown>[];         // what the runtime posted
  send(command: PreviewCommand): void;     // deliver a command to onCommand subscribers
  pointAt(elements: Element[]): void;      // document.elementFromPoint → host,
                                           // root.elementsFromPoint → elements
  flush(): Promise<void>;                  // post() is microtask-deferred
  dispose(): void;
}
withSurface(overrides?: Partial<SurfaceEnvironment>): TestSurface
```

It builds the DOM the way `native-preview.ts` mounts it (viewport › stage host with an
open shadow root, overlays beside it), fills `SurfaceEnvironment` with fixed defaults
(`project: "/project"`, `assets: "http://127.0.0.1:4000/static"`, `url:
"http://127.0.0.1:4000/"`, `composition: "main"`, `getStack: async () => null`) and
calls both `configureSurface` and `configureBridge`. `dispose` tears both down and
removes the viewport and the `pointAt` stubs. Every live harness is also registered,
and `test/setup.ts`'s `afterEach` disposes what a test left — the same pattern as
`clearMocks()` — so one test's surface cannot reach the next.

`pointAt` exists because happy-dom does not hit-test: the existing tests already stub
`document.elementsFromPoint`; the native `elementsAt` needs the host check and the
shadow root's list, so the stub moves into one place.

## Risks / Trade-offs

- [A teardown path we did not anticipate calls an acquiring accessor after
  `stopSurface()` and now throws] → `native-entry`'s dispose order (unmount, then
  stop) is kept; the audit in task 2.3 walks every `await` in `inspect.ts` and
  `snapshot.ts`; the running-app check opens and closes videos with Inspect armed.
- [Tests rewritten through the harness lose a scenario the fallback tests covered] →
  each rewritten file keeps its case count; assertions that read `document.head` /
  `document.body` read `root` / `overlays` instead.
- [`test/surface.ts` pulls `preview/surface.ts` and `bridge.ts` into `tsc`, exposing
  type errors there] → both are small and already typed; fix in place.

## Migration Plan

None: no persisted state, no protocol bump, no settings key. Rollback is a revert.

## Deviations recorded during apply

- **`snapshot.test.ts` and `managed-objects.test.tsx` stay as they were.** Task 3.1
  named them, but neither reaches the surface at runtime: `snapshot.test.ts` covers
  only the pure `isDrag`, `videoBox` and `normalisedRect`, and `managed-objects.test.tsx`
  calls `managedRoot(element, container)`, which takes its container as an argument —
  only `managedRoots(id)` reads `contentRoot()`, and no test there calls it. A harness
  in either file would configure a surface nothing reads.
- **`rootPath()` leaves `inspect.ts` altogether.** `report` was its only caller, and
  `report` now destructures `{ getStack, project }` from `surface()` once, so the
  project root and the stack come from the same read.
- **`normalise` divides by the canvas alone.** With the window fallback gone, a canvas
  with no area falls to `|| 1` rather than to `window.innerWidth` — the window was the
  iframe's canvas, and in the shadow canvas it is the Studio's own window.
- **`onViewChange` keeps its nullable read.** It never fell back to `document`, its
  subscribe is called from inside a mounted session, and its unsubscribe is already a
  teardown no-op; routing it through `surface()` would add a throw for no gain.
- **Tests gained cases, none lost one.** `inspect.test.ts` adds "reads the stack once
  and takes its first project frame as the source" (`getStack` is asked for the picked
  element exactly once); `surface.test.ts` adds `elementsAt`'s host check and
  shadow-root filter, and the removal-after-`stopSurface()` case from task 2.1;
  `test/surface.test.ts` covers the harness itself.
