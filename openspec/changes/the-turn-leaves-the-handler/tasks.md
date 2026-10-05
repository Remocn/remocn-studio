Implemented after `one-ask-in-the-gate` (REM-629) and before
`instructions-follow-the-provider` (REM-631). Pure refactor; no changeset.

## 1. Sidecar — ports and the moved pieces

- [x] 1.1 `sidecar/agent/turn.ts` declares `TurnError`, `TurnContext`, `TurnPorts` and `BrandLifecycle` first; `sidecar/projects/apply.ts` exports the default `projectBrand: BrandLifecycle` (`begin` = config read + stale-revision check + prepare or `brandBrief`; `finish` = `finishBrandApplication`), both failing with `TurnError`. Verify `bun run typecheck`.
- [x] 1.2 `sidecar/agent/turn-tools.ts`: move the inline `TurnTools` object, `librarian`, `previewed`, `clipped` and `videoSources` out of `sidecar/handlers.ts` verbatim as `turnTools(turn: TurnContext, { ask, gate })`. Verify `bun run typecheck` and that `handlers.ts` no longer defines them.

## 2. Sidecar — `runTurn`

- [x] 2.1 `sidecar/agent/turn.ts`: `TurnError`, `TurnPorts`, `TurnContext`, `openTurn(params, log)` (the `recording` step) and `runTurn(params, ports)` — locate + `onDisk`, video ownership, `brand.begin`, `openTurn`, the resume step with its 24 000-character fallback and notice, the history event, placement with its notices, stages, the mode switch and `onApprove`, the gateway key, `gateway.serving(toolKey, ports.tools(turn))`, the briefs, `adapter.turn`, `recorder.flush` and `abandonSourceAssets` on exit. Behaviour identical to today's handler. Verify `bun run typecheck`.
- [x] 2.2 In `runTurn`, finish a prepared brand application with `Effect.onExit`: `finish(result.failure === null)` on success, `finish(false)` (error ignored) on any failure or interruption after `begin`. Test: `sidecar/agent/turn.test.ts`.
- [x] 2.3 `sidecar/handlers.ts`: `agent.prompt` becomes `runTurn(params, { adapterFor, brand: projectBrand, emit, gate, gateway, log, tools: (turn) => turnTools(turn, { ask, gate }) })` mapped to `HandlerError`; `history.record` calls `openTurn`; drop the now-unused imports and helpers (`joinedBriefs`, `resumingStored`); `located` stays for the other handlers that use it (`handlers.ts:765`, `:1070`) and delegates to `turn.ts`'s exported `locate` (ProjectStore lookup + `onDisk`, failing with `TurnError`) so the not-on-disk sentence has one owner. Verify `bun run check` and `bun run typecheck`.

## 3. Tests

- [x] 3.1 `sidecar/agent/turn.test.ts` harness: in-memory stores (`driverFor(":memory:")`, `prepare`, `migrate`), a project row on a temp folder, a video row; a capturing fake adapter (persistent and not), a recording fake gateway, a recording fake brand, a stub `tools`. Verify the file runs: `bun run test sidecar/agent/turn.test.ts`.
- [x] 3.2 Cases: briefs and `turnId`/`video` reach `TurnServices`; `toolKey` is `chat-<historyId>` for a persistent adapter and the turn id otherwise, for `serving` and every transport; the resume fallback rewrites the prompt, nulls `sessionId` and emits the notice before the adapter runs; a foreign video fails with the ownership sentence; `brand.finish(false)` on a failed result, on interruption and on a `store.blocks` failure; `openTurn` writes one user entry and answers the row. Verify `bun run test sidecar/agent/turn.test.ts`.
- [x] 3.3 Review fixes: brand lifecycle via `Effect.acquireUseRelease` (an interrupt during `begin` still finishes the application), `TurnError`/`BrandLifecycle` moved to the leaf `sidecar/agent/turn-error.ts`, `abandonSourceAssets` made lazy, and tests for notice order, stored-session resume, exit-path cleanup, the mode switch, placement notices, brand-finish errors and an interrupt during `begin`, each confirmed by a mutation. Verify `bun run test sidecar/agent/turn.test.ts`.

## 4. Verification

- [ ] 4.1 `openspec validate the-turn-leaves-the-handler --strict`, `bun run check`, `bun run typecheck`, `bun run test sidecar/agent/turn.test.ts sidecar/host.test.ts`, then the full `bun run test` once.
- [ ] 4.2 In the running app: send a turn with each of Claude Code, Codex, Copilot and Grok Build — it streams, the studio's tools answer (e.g. the pipeline dock moves), the permission card still appears for a Bash ask, and the turn ends with its result. Apply a brand change to a video and cancel the turn mid-way — the application ends as failed, not running. Send a message that only writes values into the code — it lands in the transcript without starting a turn.
