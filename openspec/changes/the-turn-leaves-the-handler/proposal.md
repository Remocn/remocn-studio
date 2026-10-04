## Why

Linear REM-630. `agent.prompt` in `sidecar/handlers.ts` (lines 282–570, 290 of the
file's 1432) is the whole turn written inline in one handler: locating the project
and checking the video belongs to it, the brand-application lifecycle (prepare,
finish on result, `finish(false)` on interrupt), the resume policy and its fallback
that folds the last 24 000 characters of studio history into the prompt, placing
referenced assets and attached media, the pipeline stages and the mode switch, the
eight-key `TurnTools` the gateway serves, the briefs, and the adapter call.

It closes over the module singletons `gate`, `gateway` and `account`
(`handlers.ts:156–160`), so no test reaches it. `sidecar/host.test.ts` imports
`handlers` but only to override them; nothing exercises `agent.prompt`. Deleting the
handler and inlining its body elsewhere would change nothing — all the complexity
already lives in one place that cannot be tested. And `history.record`
(`handlers.ts:603–608`) restates in a comment that it is "agent.prompt's first two
steps", which it copies rather than shares.

The inlining also hides one real gap: once `prepareBrandApplication` has written
`brand.apply.json` as `running`, a failure of `store.blocks` in the resume fallback
fails the handler without finishing the application, so the file stays `running`.

## What Changes

- New deep module `sidecar/agent/turn.ts`: `runTurn(params, ports)` owns the turn —
  the project and video checks, the brand lifecycle, the resume policy and its
  notice, placement, stages, the mode switch, the tool host (gateway key, serving,
  transports, in-process asks) and the `TurnServices` handed to the adapter.
- The stores stay Effect services (`HistoryStore`, `ProjectStore`, `VideoStore`);
  everything with a process-wide singleton or a filesystem side behind it — the
  adapter, the gate, the gateway, the brand lifecycle, the tool implementations —
  arrives as a port.
- `agent.prompt` becomes a thin call to `runTurn`; `history.record` calls the same
  module's `openTurn` step instead of re-implementing it.
- Any failure or interruption after the brand application was prepared finishes it
  as failed (closes the `store.blocks` gap above).
- `sidecar/agent/turn.test.ts` covers what is unreachable today, with in-memory
  SQLite stores and a fake adapter that captures `TurnServices`.

## Capabilities

None. The turn's observable behaviour — events, notices, results, the transcript —
is already specified under `agent/*` and `history/*` and does not change; the brand
gap is a bug against the existing brand-application requirement, not a new one.
`skip_specs` is set.

## Impact

- Shared contract: none. No frame changes, no protocol bump.
- Sidecar: new `sidecar/agent/turn.ts` and `sidecar/agent/turn-tools.ts` (the
  `TurnTools` assembly and `videoSources`, moved out of `handlers.ts`);
  `sidecar/handlers.ts` loses ~300 lines and keeps the singletons it passes in;
  `sidecar/projects/apply.ts` gains the brand-lifecycle port's default
  implementation.
- Rust core: none.
- Webview: none.

## Non-goals

- Assembling the instructions differently. Brief assembly moves into `runTurn`
  verbatim, as its single call site; REM-631 (`instructions-follow-the-provider`)
  replaces it with `sidecar/agent/instructions.ts`, adds `AgentAdapter.forget` and
  moves the persistent gateway-key decision into the adapter. Doing any of it here
  would make the two changes collide.
- The permission protocol. `one-ask-in-the-gate` (REM-629) lands first and owns
  `gate.ask`; this change only passes the gate through.
- Adding the project/video ownership check to `history.record`. It does not make
  that check today, and adding a failure there is a behaviour change.
- Testing the tool implementations (`design_check`, library, moodboard, sounds,
  stock) through `runTurn`; they keep their own suites and are a stubbed port here.
