## Context

See proposal.md for why. This design starts from the tree as
`drop-the-iframe-adapter` (REM-627) leaves it: `preview/bridge.ts` has one adapter (a
configured `LocalBridge`, no `window.parent` path), `post()` no longer stamps `source`,
`MESSAGE_SOURCE`/`COMMAND_SOURCE` have left `bridge.ts`,
`lib/studio/native-preview.ts`'s `emit` is the one place a message gets
`source: "remocn-preview"`, `"no-grab"` is gone, and `test/surface.ts` provides
`withSurface()` (a shadow-root surface plus a captured bridge with `sent` and `send`).

Facts read from the tree on 2026-10-02 that shape the approach:

- **Everything is in one realm.** `native-preview.ts` evaluates the project's bundle in
  the webview's own document; `PreviewSurface.send` hands a command object straight to
  the runtime's subscribers, and `emit` hands messages straight back. No structured
  clone, no `postMessage` — except the hop into `studio-objects-v5`, which
  `managed-loader.cjs` rewrites onto `managed-transport.ts`.
- **The preview is compiled by the project's webpack** with no `@/` alias, and it must
  never pull `effect` (the app's dependency, absent from projects). `import type` is
  erased by the loader. `preview/shipped.test.ts` requires every non-test file in
  `preview/` to be a `tauri.conf.json` resource and every `../` specifier a preview
  file reaches — type-only or not, the regex does not tell — to be one too.
- **The root `tsconfig.json` excludes `preview/`.** `tsc --listFilesOnly` reaches only
  `bridge.ts` and `playback-rate.ts`, because `lib/studio/preview.test.ts` imports
  `@/preview/playback-rate`. Measured with a scratch tsconfig over `preview/**` (sources
  and tests, `types: ["bun"]`): **38 errors** — 10 `TS2307` because the app has no
  `remotion` / `@remotion/player` in `node_modules` (by design), ~17 cascading from
  `Internals` then being `unknown` in `interactivity.tsx` and `player-runtime.tsx`, 6
  `window.remotion_*` globals, and 5 real ones: `tuning.ts:621` (an implicit-any
  index), `inspect.test.ts` (7), `managed-objects.test.tsx` (2), `fiber.test.ts` (1).
- **Command fan-out is shared.** `inline-text.ts` listens to `seek`, `replay`,
  `transport.toggle` and `transport.step` to close an open edit, which
  `player-runtime.tsx` and `transport.ts` also handle. A command can have more than one
  consumer, so "one owner per command" is not the shape.
- **The player-runtime "interception" is not a bug.** `studioCommand` returning `true`
  for `studio.draft/batch/request` (`player-runtime.tsx:438-442`) ends that subscriber's
  own if-chain; `managed-transport.ts` is a separate subscriber and receives the command
  regardless.
- **Fakes.** Ten test files build a `PreviewControl` by hand: `use-native-preview`,
  `use-preview-transport` (two), `use-deletion`, `use-reconciled-videos`,
  `use-canvas-layers`, `use-tools`, `use-inspect` through `as unknown as`, and
  `use-managed-objects`, `chat-result` typed in full.

### Corrections to the issue

- 26 commands, not 25 (the Schema and the union agree with each other on 26).
- Ten `PreviewControl` fakes (eight cast), not six (five cast).
- `preview/tsconfig.json` cannot live in `preview/`: `shipped.test.ts` would demand it
  ship as a resource. It is `tsconfig.preview.json` at the root.
- Typechecking `preview/` needs Remotion's types; there is no way around a type source
  for `remotion` and `@remotion/player` (Decision 6).
- `player-runtime.tsx` does not swallow `studio.*` commands (above).
- `templates/…/studio-objects-v5` keeps its zod `Command`: it ships inside people's
  projects. It is held in step by a test, not removed.

## Goals / Non-Goals

**Goals:**

- One TypeScript statement of every command and message, read by both ends; a renamed
  field anywhere is a `bun run typecheck` error.
- No hook reads `message.type` or compares urls to drop a stale report.
- Every `preview/` file type-checked.

**Non-Goals:**

- Runtime decoding of commands. They are built by typed webview code and handed over
  in-process; decoding them would only re-check what the compiler proved.
- Re-shaping any message or command field. The protocol records today's shapes.

## Decisions

### 1. `preview/protocol.ts` owns the types; `lib` imports them, never the reverse

A types-only module (plus nothing at runtime but, optionally, the two source string
constants): `PreviewCommand`, `PreviewMessage`, `EntrySignal` (`native.painted`,
`native.error` — sent by `native-entry.tsx` through `environment.emit` and consumed by
`native-preview.ts`, never reaching a hook), `CommandType`, `CommandOf<T>`,
`MessageType`, `MessageOf<T>`, the shared value types (`TuningValue`, `TuningNodePath`,
`TargetStatuses`, `StudioValue`, `PreviewRect`, the selection's element and tuning
target, …) and the `CommandConsumers` table (Decision 3). Arrays are `readonly`;
fields the Schema defaults on decode are required here, since the runtime and the
webview ship in one bundle and a page "from an older build" no longer exists.

`lib/studio/preview.ts`, `lib/studio/native-preview.ts` and `lib/studio/preview-surface.ts`
`import type` from `@/preview/protocol`. That pulls `protocol.ts` into the root program
(fine — it imports nothing) and nothing into the project's bundle.

*Alternative: types in `shared/` (e.g. `shared/preview-protocol.ts`).* Rejected: every
preview file importing it adds a `../shared` resource entry and a second place the
runtime's contract lives; `preview/` is where the runtime is. *Alternative: protocol
imports `type PromptElement` from `../shared/ipc`.* Rejected: `shipped.test.ts` reads it
as a runtime dependency and would want `shared/ipc.ts` (which imports `effect`) shipped
into projects. The protocol spells the element shape out; the equality check below
keeps it equal to `PromptElement`.

### 2. The Schema stays and is proved equal, per message type

`lib/studio/preview.ts` keeps `PreviewMessage` (decoded at the boundary in the channel)
and keeps a `PreviewCommand` Schema for the contract tests only, both now **without**
`source` on commands. Equality is checked in the same file:

```ts
type Bare<T> = T extends unknown ? Omit<T, "source"> : never;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Agree<S extends { type: string }, P extends { type: string }> = {
  [K in S["type"] | P["type"]]: Same<Bare<Extract<S, { type: K }>>, Extract<P, { type: K }>>;
};
export const messagesAgree: { [K in MessageType]: true } =
  null as unknown as Agree<PreviewMessage, Protocol.PreviewMessage>;
export const commandsAgree: { [K in CommandType]: true } =
  null as unknown as Agree<PreviewCommandSchema, Protocol.PreviewCommand>;
```

A disagreeing variant reports `Type 'false' is not assignable to type 'true'` at the
name of that message — readable, local, no runtime cost (the constants are `null`).
Mutual assignability, not identity, so `readonly` modifiers and Schema's branded-free
refinements (`NonEmptyString` → `string`, `Int` → `number`) compare equal while a
missing, renamed or retyped field does not. `transport.rate` uses `PlaybackRate` on both
sides (the protocol imports the type from `./playback-rate`).

*Alternative: derive the TS types from the Schema.* Rejected: the preview cannot import
`effect`, even for types, without the webpack resolver failing on a project that does
not have it — and `import type` from a module that imports `effect` still makes `tsc`
for `preview/` load all of Effect. *Alternative: derive the Schema from the types.* Not
possible; refinements and decoding defaults are not in the types.

### 3. `route(consumer, handlers)` with a compile-time table of consumers

```ts
// protocol.ts
export type Consumer = "player" | "transport" | "rate" | "geometry" | "inline-text" | "managed";
export interface CommandConsumers {           // one key per CommandType, checked below
  seek: "player" | "inline-text";
  "studio.draft": "managed";
  …
}
type _AllRouted = Assert<Same<keyof CommandConsumers, CommandType>>;
export type CommandsOf<C extends Consumer> =
  { [K in CommandType]: C extends CommandConsumers[K] ? K : never }[CommandType];
export type Routes<C extends Consumer> =
  { [K in CommandsOf<C>]: (command: CommandOf<K>) => void };

// bridge.ts
export function route<C extends Consumer>(consumer: C, handlers: Routes<C>): () => void
```

`CommandConsumers` missing a command, or a consumer's `route` call missing (or adding) a
key, is a type error. `route` subscribes through the configured `LocalBridge` and
dispatches by `command.type`; `onCommand` stops being exported. Consumers:
`player` (`player-runtime.tsx`: inspect, inspect.clear, snapshot, seek, replay, pause,
highlight, studio.highlight/hover/hide/unhide, tuning.statuses, tune.set/reset),
`transport` (`transport.ts`: transport.request/toggle/step/audio), `rate`
(`playback-rate.ts`: transport.rate), `geometry` (`geometry.ts`: studio.geometry.*),
`inline-text` (`inline-text.ts`: studio.text.*, seek, replay, transport.toggle/step),
`managed` (`managed-transport.ts`: studio.draft/batch/request). The apply step
confirms the table against each module's current if-chain before moving it.

`managed-transport.ts` routes its three commands and wraps each in the
`MessageEvent` the v5 runtime expects, stamping `source: "remocn-studio"` there — the
only place the command tag still exists.

`post(message: PreviewMessage): void` replaces `post(message: Record<string, unknown>)`;
`LocalBridge.emit` is typed `(message: PreviewMessage | EntrySignal) => void`, and
`native-entry.tsx`'s `NativeEnvironment` uses it.

*Alternative: one exhaustive `switch` in `native-entry`.* Rejected: handlers close over
React refs (`player-runtime`) and module state (`geometry`, `inline-text`) that live in
their own modules; centralising them means exporting that state.

### 4. `PreviewChannel` in the webview owns decode, settle, dispatch and epoch

`lib/studio/preview-channel.ts` replaces `createPreviewSurfaceChannel` (which it
absorbs — attach/disconnect semantics unchanged):

```ts
interface PreviewEpoch { readonly url: string | null; readonly video: string | null; readonly build: number }
interface PreviewChannel {
  attach(surface: PreviewSurface): () => void;
  disconnect(): void;
  focus(): void;
  send(command: PreviewCommand): void;             // protocol type, no `source`
  on<T extends MessageType>(type: T, handle: (message: MessageOf<T>) => void): () => void;
  epoch(): PreviewEpoch;
  onEpoch(listen: () => void): () => void;          // for useSyncExternalStore
  serve(url: string | null): void;                  // usePreview: the ready url, or null
}
```

- **Decode** moves here from `hooks/use-preview.ts`; a message that fails to decode is
  dropped *and logged with its type and the Schema issue* through `console.warn` in
  development builds, so a contract drift that slipped past the types is visible in the
  devtools instead of silent.
- **Settle**: the 250 ms hold on an empty `composition` moves here, so every `on("composition")`
  listener — not only `usePreview`'s `pick` — is spared Remotion's transient empty list.
- **Epoch**: `url` is set by `serve`, `video` by each decoded `composition` message's
  `compositionId`, `build` increments on `rebuilt`. `transport.state` and `scenes`,
  which name their video by `compositionId`, are dropped before dispatch when it is not
  the epoch's — what `use-preview-transport` does by hand today. `capture` is not
  filtered: `use-snapshot` does not filter it today, and changing that is not this
  change's business.
- **Reports** that hooks keep across renders use `usePreviewReport(preview, type, scope)`
  (`hooks/use-preview.ts`): the latest message of that type in the current epoch, or
  `null`. `scope: "video"` keys on url + video (transport state, scenes — today's
  behaviour, so a rebuild does not blank the controls); `scope: "build"` also on build
  (`studio.present` in layers, which today resets on `rebuilt`).

`send` is typed by the protocol union; the issue's "only `commands.*` builders" is met
by the type instead: with `source` gone a literal command is exactly as checked as a
builder's, so builders remain only where they compute something (`replayCommand` from a
window, `tuningStatusesCommand` copying, `hideCommand` with `managedSelector`), and
`inspectCommand`/`seekCommand`-style one-liners may stay or go per call site.

*Alternative: keep `subscribe(listen)` and add a helper.* Rejected: it is the fan-out
that made every hook a parser. *Alternative: drop stale messages by `build` too for
transport.* Rejected: today a rebuild keeps the transport state until the runtime
re-reports it; keying it by build would disable the controls for a frame on every save.

### 5. `PreviewControl` exposes the channel, not `send`/`subscribe`

`PreviewControl` keeps `attachSurface`, `composition`, `focus`, `frameOf`, `hint`,
`isServing`, `onFrame`, `pick`, `playing`, `preview`, `restart` and gains
`channel: PreviewChannel`; `send` and `subscribe` leave it, and `useOnPreview` becomes
`usePreviewMessage(preview, type, handler)`. The nine listeners migrate:

| Listener | Today | After |
|---|---|---|
| `use-snapshot` | `snapshot`, `capture` | two `usePreviewMessage` |
| `use-reconciled-videos` | `composition` | one `usePreviewMessage` |
| `use-deletion` | two types | `usePreviewMessage` each |
| `use-preview-transport` | `transport.state`/`scenes` with url+composition checks, `playhead`, `rebuilt` | `usePreviewReport(…, "video")` ×2, `usePreviewMessage` for `playhead` and `rebuilt` (re-request + rate) |
| `use-managed-objects` | ten branches; `previewUrl` re-derived | `usePreviewMessage` per type; the cancel-on-change effect keys on the epoch |
| `use-tools` | `rebuilt` + one | `usePreviewMessage` each |
| `use-canvas-layers` | `studio.present`, `rebuilt` reset | `usePreviewReport("studio.present", "build")` |
| `use-inspect` | six branches incl. `rebuilt` | `usePreviewMessage` per type |
| `chat-result.tsx` | inline `preview.subscribe` in a component | new `hooks/use-result-ready.ts` |

`originOf` is already gone (REM-627); `hooks/use-preview.ts`'s url/composition stay
the source of `serve` and the epoch.

### 6. `tsconfig.preview.json`, and Remotion's types as devDependencies

`tsconfig.preview.json` at the root: the root's compiler options minus the Next plugin
and `incremental`, `types: ["bun"]`, `paths` for `@/*` (preview tests import
`@/lib/…` and `@/test/…`), `include: ["preview/**/*", "test/surface.ts",
"test/matchers.d.ts", "types/preview-env.d.ts"]`. `typecheck` becomes
`tsc --noEmit && tsc --noEmit -p tsconfig.preview.json`.

`remotion` and `@remotion/player` join `devDependencies` pinned **exactly** to the
template's version (`templates/remotion/package.json`, 4.0.520), for their types only.
`types/preview-env.d.ts` (outside `preview/`, so it does not ship) declares
`__remocn_project_remotion` as `export * from "remotion"`, `__REMOCN_NATIVE_ASSETS__`,
and the `window.remotion_*` globals `player-runtime.tsx` writes.

*Alternative: ambient `declare module "remotion"` stubs.* Rejected: `Internals` would be
`any`, and the files the issue cares about (`player-runtime`, `interactivity`) would be
"type-checked" against nothing. *Alternative: point `paths` at
`test/fixtures/render-smoke/node_modules`.* Rejected: that install is optional and
network-bound. *Alternative: a nested package for types.* Rejected: a second install
step in CI for the same result.

The invariant "the app bundles no Remotion" holds: nothing in `app/`, `components/`,
`hooks/`, `lib/` or `sidecar/` imports either package; the sidecar resolves Remotion
with `createRequire(<project>/package.json)`, which walks up from the project folder
and never reaches the repo for a real project. The task adds a check to
`preview/shipped.test.ts`-style tooling: a grep test that no non-test file outside
`preview/` imports `remotion` or `@remotion/player`.

### 7. Tests: one in-memory surface, two contract tests

- `test/preview-channel.ts`: `memorySurface()` returns a `PreviewSurface` plus `sent:
  PreviewCommand[]` and `emit(message: PreviewMessage)` (stamps `source` as the native
  surface does); `previewControl(overrides)` builds a fully typed `PreviewControl` around
  a real `PreviewChannel` attached to it. The ten hand fakes go; tests assert on typed
  `sent` and drive messages through `emit`.
- `preview/protocol.test.ts`: with `withSurface()`, run the real senders — inspect's
  report, `transport.ts` state, `scenes-report.ts`, snapshot's capture, geometry,
  inline-text, presence, managed-transport's `studio.ready` — and pass every captured
  message, stamped, through `decodePreviewMessage`. Types prove shape; this proves the
  refinements (`NonEmptyString`, `Int`, `0 ≤ volume ≤ 1`, 1–16 candidates).
- `preview/managed-transport.test.tsx`: mount v5's `StudioObjects` with `window.parent`
  stubbed to a distinct object, deliver `studio.draft`/`studio.batch`/`studio.request`
  as the webview builds them through `managedTransport`, and assert the draft renders
  and `studio.ready` comes back — the v5 zod `Command` held in step by behaviour.
- `lib/studio/preview.test.ts`'s literal fixtures shrink to what only a literal can test
  (rejections: wrong `source`, bad literal, non-integer frame); acceptance cases move to
  the contract test.

## Risks / Trade-offs

- [Making defaulted fields required in the protocol forces senders to send them, and
  one sender currently omits a field] → the type error names it; send the default
  explicitly. The Schema keeps its `withDecodingDefault` until a later cleanup, which
  is harmless.
- [Typechecking `preview/` surfaces more than the measured 38 once `remotion` resolves
  and `Internals` is typed] → budget for it in task 1; fixes are type-level, and a real
  defect found this way is reported, not silently patched.
- [`remotion` in the repo's `node_modules` changes what a preview test resolves when it
  does not `mock.module("remotion")`] → run the whole `preview/` suite after the install,
  before any other change, and record the result in tasks.
- [Epoch-dropping by video hides a message a hook relied on] → only `transport.state`
  and `scenes` are filtered, exactly the two `use-preview-transport` already compares
  against the playing video; its tests move over unchanged in intent.
- [`console.warn` on a failed decode is noise if something posts junk] → nothing else
  posts on this channel after REM-627; a warning there is a defect.

## Migration Plan

None: no persisted state, no settings key, no `SIDECAR_PROTOCOL` bump, no history
migration. The preview runtime and the webview ship in one build. Rollback is a revert.

## Deviations during apply

- **13 errors, not 38.** With Remotion's real types in place the cascade from an `unknown`
  `Internals` never happens. Every fix is type-level (tasks.md 1.3 names them); the one real
  defect is in a test: `inspect.test.ts` called `highlightTarget(id)` without `open`, so two
  cases ran the close branch instead of the one they name.
- **`types/preview-env.d.ts` declares only `__remocn_project_remotion`.** `remotion` already
  declares the `window.remotion_*` globals on `Window`, and `__REMOCN_NATIVE_ASSETS__` keeps its
  module-local `declare const` in `native-remotion.ts`, the one file that reads it.
- **`post` takes `PreviewMessage | EntrySignal`.** `player-runtime.tsx` reports a Player error as
  `native.error` through `post`, not through `environment.emit`.
- **`geometry` is a consumer of `seek`, `replay`, `transport.toggle` and `transport.step`.** Its
  chain cancels a live gesture on all four, exactly as `inline-text` saves on them; the table in
  §3 missed it.
- **The channel hands hooks the decoded Schema type** (`PreviewMessageOf<T>` in
  `lib/studio/preview.ts`, which carries `source`), not the protocol's `MessageOf<T>`. The two
  are proved equal minus `source`, and the Schema-side aliases (`PreviewSelection`,
  `TuningTarget`, …) are what twenty UI files already read.
- **Nothing is dispatched while nothing is served.** The old hook subscribed only while the
  preview was ready; the channel drops every message while `epoch.url` is `null`. `serve` does
  not reset `video`, as the old hook kept `pick` across a url change.
- **`lib/studio/preview-surface.ts` is gone.** `PreviewSurface` lives in `preview-channel.ts`
  with `StampedMessage`; its nine tests moved into `preview-channel.test.ts`.
- **Every builder stays**, without `source`. None of the one-liners was worth churning its call
  sites.
- **`scope: "build"` keys on the build counter alone**, not on url and video as §4 has it, so
  `use-canvas-layers` keeps the last presence across a video switch until the new runtime
  reports its own — HEAD's behaviour (see *Review fixes*).
- **`use-managed-objects` keys its two cancel effects on `epoch.url`**, not on the whole epoch:
  a rebuild that remounts the runtime cancels through `studio.ready`'s new generation already,
  and keying on `build` would add a cancel today's code does not have.
- **`useResultReady` also owns the seek on "View change"**, so `chat-result.tsx` only renders.
- **Two tests changed intent-preservingly.** The early-scenes case now delivers the composition
  and the scenes in one batch before the pane re-renders: the epoch moves with the composition
  message synchronously, so early scenes are kept by the epoch rather than by the hook's
  `composition` prop (renamed in *Review fixes*). `use-reconciled-videos`' empty-registry case advances the settle, which
  moved from `usePreview` into the channel every listener reads.
- **`managed-transport.test.tsx` redirects instead of evaluating the loader's output.** It
  stubs `window.parent` and sends `window`'s `message` listeners through `managedTransport` —
  the three rewrites `managed-loader.cjs` makes — and asserts in its own case that the loader
  accepts v5's source. Evaluating rewritten source needs a module plugin, which is
  process-global and would reach `managed-removal.test.tsx`'s v5 import in the same worker.
- **The contract test drives ten message types**: `selection`, `studio.select`,
  `studio.geometry.request`, `capture`, `inspect.clear`, `transport.state`, `playhead`,
  `scenes`, `composition`, `studio.present`; `studio.ready` is decoded in
  `managed-transport.test.tsx`. Not driven: `studio.text.*` (a request needs text layout rects
  happy-dom does not compute), geometry `begin`/`commit`/`cancel` (pointer gestures over
  measured boxes), `inspect`/`snapshot` statuses and `tune.result` (posted from inside the
  mounted Player), `rebuilt` (the webview's own). Their shapes are still checked by the types.
- **`playback-rate.test.ts` keeps one cast**, for the off-the-list rate its "ignores a speed the
  panel does not offer" case sends; the runtime guard it covers stays.

## Review fixes

- **The guard covers the preview runtime too.** With `remotion` installed for its types, a runtime
  import of `@/preview/*` from `app/`, `components/`, `hooks/` or `lib/` would bundle Remotion
  into the app silently. `test/no-remotion-in-app.test.ts` now fails on any non-type import of a
  `preview/` module from those folders outside an allowlist (`preview/playback-rate.ts`,
  `preview/protocol.ts`), and walks each allowlisted module's imports to prove it reaches no
  `remotion`, `@remotion/player` or `__remocn_project_remotion`. `import type` and all-type
  `import { type … }` are erased by the scan; an import used only as a type but not marked
  `type` is flagged, which is the conservative side. Mutation-checked: a runtime import of
  `preview/interactivity` from `hooks/` and of `preview/composition` from `lib/studio/` both
  fail it, a type-only one does not, and `import "remotion"` added to `playback-rate.ts` fails
  the allowlist case.
- **Layers keep the last presence across a video switch.** HEAD cleared `present` on `rebuilt`
  only, so a switch was judged against the previous video's presence until the new report
  arrived; the first apply cleared it on `serve(newUrl)`, which expanded every group and showed
  every row present for the seconds until reveal. `scope: "build"` now keys on the build counter
  alone. `hooks/use-canvas-layers.test.tsx` covers the switch and fails against the url+video
  scope.
- **The order the channel relies on.** `transport.state` and `scenes` are dropped unless their
  `compositionId` is the epoch's video, and the epoch's video moves only on a `composition`
  message, so both rely on `composition(X)` reaching the channel first. In the runtime it does:
  `Stage`'s `describe` effect posts `composition` on the commit that first picks X, while
  `useResolvedMetadata` resolves in an effect, so the Player — and with it
  `usePlayerTransport`'s first `transport.state` — mounts at least one commit later, and in
  that commit `Stage`'s `describe` effect is declared before `usePreviewCommands` and runs
  first. `scenes` flush on a `requestAnimationFrame` after that. A hidden runtime's messages
  are buffered and `reveal` delivers them in posting order (`rebuilt` first when the bundle
  changed). The early-scenes test is renamed to what it tests — scenes delivered in one batch
  with their composition, before the pane re-renders — and a second case pins that scenes
  before their composition are dropped.
- **The agreement check is two-way and sees optional keys.** `EveryMessageAgrees` and
  `EveryCommandAgrees` assert `Same<…["type"], Protocol.MessageType | CommandType>`, so a
  Schema-only variant fails; each variant is compared through `Shape<T>`, which strips
  `readonly`, turns arrays mutable and tags every key `"required"` or `"optional"` recursively,
  so an optional key on one side only — at any depth — fails. Mutation-checked: deleting
  `readOnly?` from the protocol's `TuningField` fails `messagesAgree` at `selection`; a
  Schema-only message and a Schema-only command fail the two assertions; an optional key added
  to the Schema's `rebuilt` fails `messagesAgree` at `rebuilt`.
- **A stale transport after a switch is tested through the real channel.** `memorySurface()`
  gains `reveal(messages)`, one synchronous batch as `native-preview`'s reveal delivers it;
  `hooks/use-preview-transport.test.tsx` delivers `rebuilt`, `studio.present([])`, an empty
  `composition`, `composition(outro)`, a late `transport.state` for intro and outro's `scenes`,
  and asserts intro's state never shows as outro's. It fails with the channel's stale-video
  filter removed.
