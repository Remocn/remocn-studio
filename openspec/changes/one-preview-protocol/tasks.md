Starts after `drop-the-iframe-adapter` (REM-627) is applied: `bridge.ts` has one adapter,
`test/surface.ts` exports `withSurface()`, `"no-grab"` and `originOf` are gone.

## 1. Tooling: type-check all of `preview/`

- [x] 1.1 Add `remotion` and `@remotion/player` to `devDependencies`, pinned exactly to `templates/remotion/package.json`'s version (4.0.520); `bun install`. Run the full `preview/` test suite (`bun run test preview/`) before any other change and record pass/fail in this task — a test that now resolves the real `remotion` instead of failing must be noticed here, not later.
  *Result:* `bun run test preview/` (57 files, `sidecar/preview` included) — 680 pass, 11 skip, 0 fail before the install and the same 680/11/0 after it.
- [x] 1.2 Add `types/preview-env.d.ts` (`__remocn_project_remotion` re-exporting `remotion`, `__REMOCN_NATIVE_ASSETS__`, `window.remotion_*`) and root `tsconfig.preview.json` (design §6); `typecheck` runs both programs. Verify: `bunx tsc --noEmit -p tsconfig.preview.json` lists every `preview/` file (`--listFilesOnly`).
- [x] 1.3 Fix what `tsconfig.preview.json` reports (measured 38 before the Remotion types; real ones in `tuning.ts:621`, `inspect.test.ts`, `managed-objects.test.tsx`, `fiber.test.ts`). Type-level fixes only; a real defect found is listed in this task and in the PR body. Verify: `bun run typecheck` green.
  *Result:* 13 errors with Remotion's types in place, not 38. Fixed: `tuning.ts:621` (an `isOptionList` guard — `Array.isArray` does not narrow a `readonly` array out of a union), `fiber.test.ts` (the helper fills every `Fiber` field), `managed-objects.test.tsx` (the v5 fixture typed as v1's document), `interactivity.tsx` (`readonly` node path into Remotion's mutable one, `as never` like its neighbours), `composition.ts` (`AnyComposition.calculateMetadata` takes `never`, `component` is `unknown` — both were only ever cast or passed on), `player-runtime.tsx` (`_experimentalKeepAudioContextAlive={false}`, required by 4.0.520's `RemotionRootContexts`; `undefined` and `false` behave the same, the Player's own default is `false`).
  *Real defect (tests only):* `inspect.test.ts` called `highlightTarget(id)` without `open` six times, so "draws nothing for a target the selection never carried" and "survives being called with no session" ran the close branch, not the one they name. They now pass `open` as their names say; all still pass.
- [x] 1.4 Add a test (`test/no-remotion-in-app.test.ts`) that no non-test file outside `preview/`, `templates/` and `test/fixtures/` imports `remotion` or `@remotion/player`. Verify: it passes, and fails when a scratch import is added.

## 2. Preview runtime: the protocol and the router

- [x] 2.1 Create `preview/protocol.ts` (design §1, §3): `PreviewCommand` (26, no `source`), `PreviewMessage` (25), `EntrySignal`, `CommandType`/`CommandOf`/`MessageType`/`MessageOf`, the value types moved out of `bridge.ts`, `Consumer`, `CommandConsumers` with the `keyof` = `CommandType` assertion, `CommandsOf`, `Routes`. Add `"../preview/protocol.ts"` to `tauri.conf.json` resources. Verify: `preview/shipped.test.ts` passes; `bun run typecheck` green.
- [x] 2.2 `preview/bridge.ts`: `post(message: PreviewMessage)`, `LocalBridge` typed with `PreviewMessage | EntrySignal` and `PreviewCommand`, `route(consumer, handlers)`; stop exporting `onCommand`. `native-entry.tsx`'s `NativeEnvironment` uses the protocol types. Verify: `bun run typecheck` reports every untyped `post` caller (expected: inspect, geometry, inline-text, snapshot, transport, player-runtime, scenes-report, managed-transport, presence via `environment.emit`).
  *Result:* only `managed-transport.ts` (its `postMessage` parameter) and `player-runtime.tsx` (`describe()` returned `reason`/`type` widened to `string`) failed; every other sender already posted the protocol's shape. `describe` now returns `MessageOf<"composition">` and `pick` a typed `Picked`. `post` takes `PreviewMessage | EntrySignal`, because `player-runtime.tsx` reports a Player error as `native.error` through it.
- [x] 2.3 Fix every `post` caller to the protocol shape (a defaulted field becomes an explicit value). Verify: `bun run typecheck` green; `bun run test preview/` green.
- [x] 2.4 Move the six `onCommand` subscribers to `route`: `player-runtime.tsx` (`player`, the `studioCommand` draft/batch/request branch deleted), `transport.ts`, `playback-rate.ts`, `geometry.ts`, `inline-text.ts`, `managed-transport.ts` (stamps `source: "remocn-studio"` on the `MessageEvent` it synthesizes). Confirm `CommandConsumers` against each module's current if-chain first. Verify: `bun run typecheck`; `bun run test preview/`.
  *Confirmed against the chains:* `geometry.ts` also cancels its gesture on `seek`, `replay`, `transport.toggle` and `transport.step`, exactly as `inline-text.ts` saves on them — the table names both as consumers of those four.
- [x] 2.5 `preview/managed-transport.test.tsx` (design §7): v5 `StudioObjects` with a stubbed `window.parent`, `studio.request` answers `studio.ready`, a webview-built `studio.draft` and `studio.batch` render. Verify: the test passes, and fails if `managed-transport` stops stamping `source`.

## 3. Webview contract

- [x] 3.1 `lib/studio/preview.ts`: `import type` the protocol; drop `source` from the command Schema; `messagesAgree`/`commandsAgree` (design §2); `PreviewCommand` and value types re-exported from the protocol for `@/` callers; builders stop stamping `source` and keep only those that compute (design §4); delete `PREVIEW_COMMAND_SOURCE`. Verify: renaming one field in `protocol.ts` makes `bun run typecheck` fail at that message's name (check once, revert).
- [x] 3.2 `lib/studio/native-preview.ts` and `lib/studio/preview-surface.ts` type `emit`/`subscribe`/`send` with the protocol (`EntrySignal` handled, the rest stamped and forwarded). Verify: `bun run typecheck`; `hooks/use-native-preview.test.tsx`.

## 4. Webview channel

- [x] 4.1 `lib/studio/preview-channel.ts` (design §4): absorbs `createPreviewSurfaceChannel`; decode with a development `console.warn` on failure; empty-`composition` settle; `on`; epoch with `serve`, `onEpoch`; `transport.state`/`scenes` dropped for another video. Test: `lib/studio/preview-channel.test.ts` — dispatch by type, decode failure dropped and warned, settle cancelled by a populated list, epoch on `serve`/`composition`/`rebuilt`, stale-video drop, detached surface ignored (the cases of today's `preview-surface` tests move here).
- [x] 4.2 `test/preview-channel.ts`: `memorySurface()` and `previewControl(overrides)` (design §7), fully typed, no casts.
- [x] 4.3 `hooks/use-preview.ts`: `PreviewControl` gains `channel`, loses `send`/`subscribe`; `usePreviewMessage(preview, type, handler)` and `usePreviewReport(preview, type, scope)`; `pick`/`playing`/frame read through `on`; `serve` on ready/not ready. Test: `hooks/use-preview.test.tsx` (settle, pick, playing, frame, report scoping across a rebuild and a video switch).

## 5. Webview listeners

- [x] 5.1 `hooks/use-preview-transport.ts` → `usePreviewReport(…, "video")` for state and scenes, `usePreviewMessage` for `playhead`/`rebuilt`; no url comparison left. Test: `hooks/use-preview-transport.test.tsx` on `previewControl()`.
- [x] 5.2 `hooks/use-canvas-layers.ts` → `usePreviewReport("studio.present", "build")`. Test: `hooks/use-canvas-layers.test.tsx`.
- [x] 5.3 `hooks/use-managed-objects.ts` → `usePreviewMessage` per type, cancel effects keyed on the epoch, literals gone. Test: `hooks/use-managed-objects.test.tsx`.
- [x] 5.4 `hooks/use-inspect.ts`, `hooks/use-tools.ts`, `hooks/use-snapshot.ts`, `hooks/use-deletion.ts`, `hooks/use-reconciled-videos.ts` → `usePreviewMessage`. Tests: `hooks/use-inspect.test.tsx`, `hooks/use-tools.test.tsx`, `hooks/use-deletion.test.tsx`, `hooks/use-reconciled-videos.test.tsx`, `hooks/use-snapshot` coverage where it exists.
- [x] 5.5 `hooks/use-result-ready.ts` takes `chat-result.tsx`'s inline subscription; the component only renders. Test: `components/studio/chat-result.test.tsx` on `previewControl()`.
- [x] 5.6 Remaining `send`/`subscribe` readers (`components/studio/preview-controls.tsx`, `canvas-preview.tsx`, `hooks/use-canvas-preview.ts`, `hooks/use-native-preview.ts`) move to `channel`. Verify: `rg "\.subscribe\(|message\.type ===|source: \"remocn-studio\"|PREVIEW_COMMAND_SOURCE" hooks components lib` finds nothing preview-related; `rg "as unknown as PreviewControl"` finds nothing.

## 6. Contract test

- [x] 6.1 `preview/protocol.test.ts` (design §7): with `withSurface()`, drive the real senders and pass every captured message, stamped, through `decodePreviewMessage`. Shrink `lib/studio/preview.test.ts` to literal-only rejection cases. Verify: both pass; removing a refinement-satisfying value in a sender (e.g. an empty `requestId`) fails the contract test.

## 7. Verification

- [x] 7.1 `bun run fix`, then `bun run check` and `bun run typecheck` green; the touched test files; the full `bun run test` once. No changeset: nothing user-visible changes.
  *Result:* `ultracite fix` over the files this change touched (not the whole tree, so the parallel `sidecar/` work was left alone); `bun run check` (1055 files) and `bun run typecheck` (both programs) green; the 74 touched test files 948 pass / 11 skip / 0 fail; the full `bun run test` 3427 pass / 11 skip / 0 fail across 318 files.
- [x] 7.2 Update CLAUDE.md's working rule for the preview entry ("duplicates the message shapes and `lib/studio/preview.test.ts` keeps the two in step") to name `preview/protocol.ts`, the equality check and `tsconfig.preview.json`.
- [ ] 7.3 In the running app (the user runs `bun tauri dev`): open a video — it plays, play/pause/step/rate/volume work and survive a save-triggered rebuild without the controls blinking; switch videos — scenes and transport follow the new video; Inspect picks an element and the properties pane tunes it; on a managed video drag an object, edit text inline, hover a layer, delete and undo; Snapshot captures a frame; the chat's result link opens the preview at the asked frame; switch videos on a managed project and watch the layers tree.
- [x] 7.4 Review fixes (design *Review fixes*): the no-Remotion guard covers runtime `preview/` imports from the webview against an allowlist; layers keep the last presence across a video switch (`scope: "build"` keys on the build alone); the channel's composition-first order documented and the early-scenes test renamed; `messagesAgree`/`commandsAgree` check variants both ways and optional keys at any depth; a stale `transport.state` after `composition(B)` tested through the real channel with `memorySurface().reveal`.
