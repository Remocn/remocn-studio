## Why

Answers **REM-628**. The message contract between the preview runtime and the webview
is written three times and nothing keeps the copies in step: a hand-written union of 26
commands in `preview/bridge.ts`, the Schema of the same 26 plus 25 messages in
`lib/studio/preview.ts`, and the zod `Command` of the `studio.*` subset inside the
project's `studio-objects-v5` runtime. What the preview sends is untyped —
`post(message: Record<string, unknown>)`, about twenty call sites in eight files — so a
renamed field fails `decodePreviewMessage` and is dropped without a word in
`hooks/use-preview.ts`. `bun run typecheck` reaches two of the thirty-four `preview/`
files (`bridge.ts`, `playback-rate.ts`); inspect, geometry and player-runtime are never
type-checked at all.

In the webview nine listeners each receive every message and pick it apart by
`message.type`; five handle `"rebuilt"` themselves and "ignore a stale report" is
re-derived per hook. Commands carry ten `"remocn-studio"` literals and twelve
`PREVIEW_COMMAND_SOURCE`s beside eleven builders; in the preview six `onCommand`
subscribers run their own if-chains.

This is built on `drop-the-iframe-adapter` (REM-627): with one adapter behind the
bridge, there is one shape to describe.

## What Changes

- `preview/protocol.ts` (new, types only) is the one statement of the contract: every
  command, every message, the entry-only `native.*` signals, and which preview module
  consumes which command. `post()` takes a `PreviewMessage`; `route(consumer, handlers)`
  replaces the six if-chains and is checked exhaustively at compile time.
- Commands lose `source`: they never cross a `postMessage` boundary any more, and the
  one reader that needs the tag, the v5 runtime, already gets it from
  `managed-transport.ts`.
- `lib/studio/preview.ts` keeps its Schema (the boundary is still decoded) and proves
  it equal to the protocol types with a compile-time check, per message type.
- `PreviewChannel` in the webview: `on(type, handler)` with the narrowed message, a typed
  `send`, the decode and the empty-composition settle in one place, and an epoch
  (url + video + build) so a hook never compares urls itself.
  `PreviewControl.subscribe` goes; the nine listeners move to `on`.
- `tsconfig.preview.json` brings all of `preview/` (sources and tests) under
  `bun run typecheck`.
- Tests: one in-memory surface replaces ten hand-written `PreviewControl` fakes (eight of
  them cast through `as unknown as`); one contract test runs what the real preview
  senders post through `decodePreviewMessage`, and one runs the webview's `studio.*`
  commands through the real v5 runtime.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None; `skip_specs` is set. The issue's one fix — `player-runtime.tsx` "intercepting"
`studio.draft/batch/request` — is not a defect: every `onCommand` subscriber receives
every command, so that early return only ended player-runtime's own chain. Routing
removes the branch; nothing observable changes.

## Impact

- Shared contract (`shared/ipc.ts`): none; no `SIDECAR_PROTOCOL` bump. The preview
  protocol is in-process, between the webview and a bundle it evaluates.
- Preview runtime: new `preview/protocol.ts` (and its `tauri.conf.json` resource
  entry); `bridge.ts`, `player-runtime.tsx`, `transport.ts`, `playback-rate.ts`,
  `geometry.ts`, `inline-text.ts`, `managed-transport.ts` and every `post` caller.
- Webview: `lib/studio/preview.ts`, new `lib/studio/preview-channel.ts`,
  `lib/studio/native-preview.ts`, `hooks/use-preview.ts` and the nine listeners;
  `components/studio/chat-result.tsx` loses its inline subscription to a hook.
- Tooling: `tsconfig.preview.json`, the `typecheck` script, `remotion` and
  `@remotion/player` as type-only devDependencies pinned to the template's version.
- Sidecar, Rust core: none.

## Non-goals

- Changing `studio-objects-v5`'s zod `Command`, `managed-loader.cjs` or the synthesized
  `MessageEvent`. That runtime lives in people's projects; it is held in step by a
  contract test, not rewritten.
- Generating the Schema from the types or the reverse. Effect cannot enter the
  project's bundle, and the Schema carries refinements (`NonEmptyString`, `Int`, ranges)
  a type cannot; a two-way equality check is enough.
- Moving `source` off messages. The webview stamps it in one place after REM-627 and the
  Schema still checks it; it costs nothing.
- Any new behaviour in Inspect, transport, layers, deletion or Snapshot.
