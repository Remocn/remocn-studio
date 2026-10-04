## Context

See proposal.md — Why. Everything below lives in the sidecar process; nothing
crosses a new wire. The turn is still one `agent.prompt` request over
`shared/ipc.ts`, streaming `AgentEvent` and answering `PromptResult`.

What the handler reads today and where it comes from:

| Need | Source today | After |
|---|---|---|
| History, projects, videos | `HistoryStore`, `ProjectStore`, `VideoStore` services in the handler's `R` | unchanged — `runTurn`'s `R` |
| Adapter | `adapterFor(params.provider)` | port `adapterFor` |
| Gate | module singleton `gate` (also answers `agent.permission`) | port `gate` |
| Tool gateway | module singleton `gateway` | port `gateway: ToolGateway` |
| Brand lifecycle | `configEffect(getConfig)`, `prepareBrandApplication`, `brandBrief`, `applicationBrief`, `finishBrandApplication` | port `brand` |
| `TurnTools` (design, library, moodboard, sounds, stock, connections, pipeline) | built inline, ~90 lines | port `tools(turn)`; default `turnTools` in `sidecar/agent/turn-tools.ts` |
| Stream, log, core asks | handler input `emit`, `log`, `ask` | `emit`, `log` ports; `ask` captured by the handler's `tools` closure |

`sidecar/history/sqlite.ts` already has `driverFor(":memory:")`, and
`store.test.ts` shows the `prepare` + `migrate` + `make*` recipe, so the stores need
no fake.

## Goals / Non-Goals

**Goals:** `runTurn` is testable without a CLI, a socket or a preview host; the
handler and `history.record` are each a few lines; behaviour is byte-for-byte the
same except the brand gap.

**Non-Goals:** see proposal.md. In particular the brief strings, the order of
emitted events and the resume fallback's wording do not change.

## Decisions

### `runTurn` signature

```ts
export class TurnError extends Data.TaggedError("TurnError")<{ message: string }> {}

export interface TurnPorts {
  readonly adapterFor: (provider: AgentProvider) => AgentAdapter;
  readonly brand: BrandLifecycle;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;   // raw; runTurn coalesces
  readonly gate: PermissionGate;
  readonly gateway: ToolGateway;
  readonly log: (line: string) => Effect.Effect<void>;
  readonly tools: (turn: TurnContext) => TurnTools;
}

export interface TurnContext {
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;   // coalesced
  readonly params: PromptParams;
  readonly project: Project;
  readonly store: HistoryStore;
  readonly turnId: string;
  readonly video: string;
}

export const runTurn: (params: PromptParams, ports: TurnPorts) =>
  Effect.Effect<PromptResult, TurnError, HistoryStore | ProjectStore | VideoStore>;
```

`runTurn` is scoped internally (`coalescing`'s finalizer) so callers need no
`Scope`. `TurnError` is the sidecar-agent module's own tagged error; the handler
maps it to `HandlerError` in one `Effect.mapError`. Alternative considered:
fail with `HandlerError` directly — rejected because `host.ts` is the frame
loop, and the agent seam should not depend on it.

`adapterFor` is a port rather than an `AgentAdapter` because the provider comes
from `params`; the handler passes the real `adapterFor` from `registry.ts`.

### Ports vs. services

Stores stay in `R`: the issue's own test recipe is in-memory SQLite, the handlers
already declare them, and `history.record` and the rest of `handlers.ts` keep
providing them the same way. Everything that is a process-wide singleton (gate,
gateway) or reaches outside the database (project files for the brand, the preview
host for design checks, the network for stock and sounds) is a port, so a test
substitutes it without touching `mock.module`.

### Brand lifecycle port

```ts
export interface BrandLifecycle {
  readonly begin: (project: Project, video: string, params: PromptParams) =>
    Effect.Effect<{ brief: string | null; application: ProjectBrandApplication | null }, TurnError>;
  readonly finish: (project: Project, video: string,
    application: ProjectBrandApplication, success: boolean) => Effect.Effect<void, TurnError>;
}
```

`begin` keeps today's order: read config, reject a stale `brandRevision` with
"Project brand changed. Reload settings before applying it.", then prepare an
application or fall back to `brandBrief`. The default `projectBrand` lives in
`sidecar/projects/apply.ts` beside the functions it wraps.

`runTurn` attaches `Effect.onExit` right after `begin` returns an application: on
success the result's `failure === null` decides `finish(success)` as today; on any
failure or interruption it calls `finish(false)` and ignores its error. That
replaces today's `onInterrupt` on the adapter call alone, and is what closes the
`store.blocks` gap.

### Tool assembly moves to `sidecar/agent/turn-tools.ts`

`turnTools(turn, { ask, gate })` is today's inline object plus `videoSources` and
`librarian`, moved verbatim from `handlers.ts`. The pipeline calls (`setStage`,
`start`, `requestSource`) need the store, the coalesced emit and the turn id, which
is exactly why they arrive through `TurnContext`. The handler passes
`tools: (turn) => turnTools(turn, { ask, gate })`.

### What `history.record` shares

`openTurn(params, log)` = today's `recording(store, params, log)` — open the session
row and write the user entry — exported from `turn.ts` and called first by
`runTurn`. `history.record` calls `openTurn` and answers `{ session }`. The resume
decision is a separate step (`resumed(params, recorder, store)`) that only
`runTurn` takes, because it can fail on `store.blocks` and `history.record` has no
use for it.

### Brief assembly and the gateway key stay put

`toolKey = adapter.persistent === true ? chat-<historyId> : turnId` and the
`briefs` object move verbatim into `runTurn`. REM-631 replaces both; keeping them
in one place here is what makes that change a single edit.

### Tests: a capturing adapter

`sidecar/agent/turn.test.ts` builds stores from `driverFor(":memory:")`, a project
row pointing at a temp folder (so `onDisk` passes), and a video row. The fake
adapter's `turn(params, services)` pushes `{ params, services }` into an array and
answers a scripted `PromptResult` (or `Effect.never` for the interrupt case). The
fake gateway records the keys passed to `serving`, `ask` and `transport`; the fake
brand records `finish` calls. Cases:

- briefs (`assets`, `brand`, `media`, `pipeline`) and `turnId`/`video` reach the
  adapter; `toolKey` is `chat-<historyId>` for a persistent adapter, the turn id
  otherwise, for serving and every transport;
- a stored session without an SDK session id: the prompt carries the history
  fallback, `sessionId` is null, and a `notice` is emitted before the adapter runs;
- a video from another project fails with the ownership sentence;
- `finish(false)` when the adapter's result has a failure, when the fiber is
  interrupted mid-turn, and when `store.blocks` fails after `begin`;
- `history.record` via `openTurn` writes one user entry and answers the row.

## Risks / Trade-offs

- [The move changes event order or a brief string by accident] → the tests assert
  the briefs and the notice; the running-app check covers all four providers.
- [`onExit` on the whole tail also finishes the application on a defect] → that is
  the intended direction: an application must never stay `running` after its turn
  is gone.
- [REM-631 rewrites the same lines] → it is sequenced after this change and the
  brief/key code is concentrated in one function for it.

## Migration Plan

Pure refactor, no data or protocol change. Rollback is reverting the commit.

## Deviations during apply

- **The turn's gate binding rides on `TurnContext`.** REM-629 landed first, so
  `TurnServices` carries `permissions: TurnGate` (from
  `gate.forTurn({ applyMode, emit, turnId })`) rather than `gate`/`onApprove`, and
  sounds takes that same binding. `runTurn` builds it once and hands it to both
  the adapter and `ports.tools(turn)` as `TurnContext.permissions`; the default is
  therefore `turnTools(turn, { ask })`, not `turnTools(turn, { ask, gate })`.
- **The design check's `video === null` branch is gone.** `TurnContext.video` is
  the video row's `compositionId`, a non-empty string, and it was already that in
  the handler; once out of the inline generator the linter reported the
  comparison as constant (`noUnnecessaryConditions`). Dropping it changes nothing
  observable. `videoSources` keeps its `string | null` parameter as moved.
- **`projectBrand` maps every brand failure to `TurnError`** with the
  `ProjectSettingsError` message unchanged, which is the sentence `unstored`
  already forwarded; `agent.prompt` maps `TurnError` back to `HandlerError` with
  the same function.
- **`openTurn` reads `HistoryStore` itself** (`openTurn(params, log)` in `R`)
  rather than taking the store, so `history.record` is one `Effect.map`.

## Review fixes

- **The brand application is finished by `Effect.acquireUseRelease`**, not
  `Effect.onExit` after `begin`: `begin` is the uninterruptible acquire and the
  release sees the turn's exit, so an interrupt that lands while `begin` is still
  preparing the application waits for it and then finishes it as failed. Otherwise
  the semantics are unchanged: `finish(result.failure === null)` on success, its
  failure surfaces; `finish(false)` on failure or interruption, its failure ignored.
- **`TurnError`, `BrandStart` and `BrandLifecycle` live in
  `sidecar/agent/turn-error.ts`**, a leaf module, so `sidecar/projects/apply.ts`
  no longer imports `turn.ts`'s graph.
- **`abandonSourceAssets` reads the pending requests when it runs.** It built its
  list when called, and `runTurn` (like the handler before it) calls it while
  assembling the pipeline, before the adapter has asked for anything — so a
  source-asset request left open by a finished, failed or cancelled turn was never
  cancelled and waited out its ten minutes. `Effect.suspend` in
  `sidecar/agent/source.ts`; the cleanup tests found it.
- **Tests added** for the notice order, the stored-session resume, flush and
  abandon on success, failure and interruption, the mode switch, the placement
  notice, both brand-finish error paths and an interrupt during `begin`; each was
  confirmed by a mutation that made it fail.
