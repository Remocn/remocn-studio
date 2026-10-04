## Context

See proposal.md for the two defects. The state today, read on 2026-10-02:

- `sidecar/agent/gate.ts` is a module singleton made in `sidecar/handlers.ts:156`.
  It exposes `wait`, `remembers`, `answer` and `abandon`; the ten-minute deadline
  is already inside `wait` (`timeoutOrElse` → deny).
- `sidecar/claude/guard.ts:46-89` (`decide`) runs review → `remembers` (skipped for
  `outward`) → emit the `permission` event → `wait` → apply `answer.mode` through
  `onApprove` (line 83). An aborted SDK signal answers its own id with deny.
- `sidecar/acp/permission.ts:55-117` (`answerPermission`) runs the same sequence
  without the mode step, and `reviewAcp` checks containment with a private
  `inside()` (124-131) that never calls `realpath`. Its header comment — "ACP
  carries no symlinks to chase: locations arrive resolved by the agent" — is the
  assumption the defect rests on: a location is a path the agent names, and the
  agent does not resolve links in it.
- `sidecar/integrations/sounds.ts:97-114` calls `gate.wait` directly with
  `onReady` (emit after the ask is registered) and `rememberable: false`, and
  raises every prepared sound's ask concurrently so they land on one card.
- The mode switch (`sidecar/agent/mode.ts`) is bound per turn through
  `TurnServices.onMode`. The Claude session binds it (`claude/session.ts:113`);
  `acpTurn` never does, so `switcher.set` answers false there. `approved` in
  `handlers.ts:410-418` calls `switcher.set`, then stores the mode on the chat row
  and re-streams it whatever `set` answered.
- `reviewAcp` has no case for the protocol's `switch_mode` kind, so a request to
  leave plan mode falls through to reason `tool`: a generic card with no mode.
- `acpTurn` records the session's current mode only when it sets one itself
  (`turn.ts:287`); a `current_mode_update` from the agent is never read.

## Goals / Non-Goals

**Goals:**

- One function owns the ask; no adapter can reach `wait` or forget the mode.
- One containment check (`escapee`) for every provider.
- A plan approved on Copilot or Grok reaches the running turn and the chat row.

**Non-Goals:**

- Moving the turn wiring out of `handlers.ts` — that is REM-630, which will take
  the per-turn binding built here into `runTurn` as it is.
- Moving the rest of `sidecar/claude/` that other adapters import — REM-631. This
  change moves only the verdict type and `signatureOf`, which the ask needs.

## Decisions

### D1. The gate binds per turn and answers Allow | Deny

`PermissionGate` keeps `answer` (the `agent.permission` handler) and gains
`forTurn({ turnId, emit, applyMode }) → TurnGate`, where
`TurnGate = { ask(request), abandon }` and
`request = { verdict, name, input, id? }`. `wait` and `remembers` leave the public
interface, so "no adapter calls `gate.wait`" is enforced by the type, not by
review. `ask` answers `{ kind: "allow", always: boolean } | { kind: "deny" }`:

1. verdict `allow` → Allow, no card;
2. reason other than `outward` and the signature remembered → Allow, no card;
3. register the pending ask, then emit the `permission` event (the `onReady`
   order sounds already uses — it closes the window in which an answer could
   arrive before the ask is registered and match nothing);
4. await the answer, ten minutes then deny, as today;
5. deny → Deny; allow with a mode → `applyMode(mode)` **before** answering, so
   Claude's `setPermissionMode` still lands before the tool runs;
6. interruption removes the pending ask (the existing `ensuring`).

Rememberability follows the reason: an `outward` ask is never consulted and never
remembered, so sounds no longer passes `rememberable: false` and a future paid
tool cannot forget to.

*Alternatives.* `gate.ask({ turnId, verdict, name, input })` on the singleton, as
the issue sketched — rejected because the ask also needs the turn's `emit` and
`applyMode`, which every caller would then have to thread and could omit; binding
them once in `handlers.ts` is what makes the mode impossible to drop. Returning the
raw `GateAnswer` — rejected: the mode is consumed inside, and adapters only need
allow / always / deny.

### D2. Containment stays in the reviewer, through `contained.ts`

The verdict type and `signatureOf` move to `sidecar/agent/verdict.ts`.
`reviewAcp` becomes `Effect<PermissionVerdict>` and checks file locations with
`escapee(cwd, [], paths)`; `inside()` is deleted. The outside signature carries
the resolved destination, as Claude's does.

*Alternative.* The gate resolves paths itself — rejected: which input fields are
paths, and which extra roots a read may reach (the shipped bundle for Claude Code's
reading tools), is per-runtime knowledge the reviewer already holds.

### D3. A protocol `switch_mode` request is a plan card

`reviewAcp` maps kind `switch_mode` to reason `plan`, signature
`signatureOf("switch_mode", plan)`, and the card input `{ plan }` from
`rawInput.plan` when it is a string, else the tool call's text content, else its
title. An approval picks the agent's allow-once option, never allow-always: the
protocol's own example labels allow-always on this request as auto-accepting every
action — the agent's allow-all mode, which `turn.ts` already declines to map. The
mode itself is then applied by D4.

The pattern — exiting plan mode is a tool call of kind `switch_mode` that requests
permission — is the Agent Client Protocol's documented one (Session Modes, "From the
Agent"). It has not been measured against the Copilot or Grok CLIs; if neither
sends it, the card never appears and nothing regresses. Task 5.2 checks it.

### D4. The protocol turn binds the mode switch

The mode matching in `enterMode` moves to `sidecar/acp/mode.ts`: `modeIdFor(mode,
modes)` (match by the name after the last `#`, compared whole — see *Review fixes*) and `switchMode(peer, sessionId, mode,
record)`, which sends `session/set_mode` and updates the held record, and skips when
the record already shows that mode. `acpTurn` uses it for the turn's opening mode
and binds `services.onMode` to it once the session is open, so `switcher.set`
reaches the running turn. The protocol allows `session/set_mode` at any time during
a session, including while the agent is generating.

The turn also reads `session/update` frames of kind `current_mode_update`
(including during a replay) into the held record, so a mode the agent entered on
its own is not mistaken for the old one when the next turn decides whether to
switch.

**Failure direction.** A failed `set_mode` is logged (`acp: could not enter …`) and
`switcher.set` answers false; `approved` already stores and re-streams the mode
regardless, so the next turn starts in it. Never silent toward the person's
choice: the chip shows the approved mode.

### D5. `TurnServices` carries the bound gate

`TurnServices.gate` and `TurnServices.onApprove` become
`TurnServices.permissions: TurnGate`; `onMode` stays (the applier is the
runtime's). `handlers.ts` builds `gate.forTurn({ turnId, emit, applyMode: approved })`
once per turn and hands the same object to sounds. The Claude guard runs `ask`
with `Effect.runPromiseExit(…, { signal })` (verified in
`node_modules/effect/dist/Effect.d.ts`, `RunOptions.signal`) instead of answering
its own id on abort; an interrupted ask is a denial to the SDK, as today.

**State and wire.** All of it is sidecar state — the pending asks and remembered
signatures in the gate singleton, the held protocol mode in the ACP pool entry. No
`shared/ipc.ts` change, no `SIDECAR_PROTOCOL` bump, no migration, no settings key.

## Risks / Trade-offs

- [A CLI rejects `set_mode` mid-generation] → logged; the stored mode makes the
  next turn right. The running turn finishes in its old mode.
- [Copilot or Grok sends no plan text with `switch_mode`] → the card body falls back
  to the request's title; the choices still work.
- [Resolving locations costs a `realpath` per ask] → one per location, the same
  cost Claude Code already pays on every file tool.
- [A protocol answer fails as an Effect] → `answerPermission` folds any failure into
  the `cancelled` outcome, never into an allow.

## Deviations during apply

- `TurnGate.abandon` is an `Effect<void>` value rather than a function: the binding
  already carries the turn id, so there is nothing left to pass.
- `switchMode(peer, sessionId, mode, record, log)` takes the turn's logger and answers
  a boolean — true when the agent is in the mode, false when it refused or offers no
  matching mode. The `onMode` binding rejects on false, which is what makes
  `switcher.set` answer false. A missing match is not logged, as `enterMode` did not
  log it either.
- The plan text falls back to the tool call's text content through `toolText`, now
  exported from `sidecar/acp/events.ts` rather than duplicated.
- The Claude guard keeps its own `signal.aborted` check. `runPromiseExit` with an
  already-aborted signal does not interrupt before the ask starts: the fiber runs
  synchronously until it first yields, so review, the remembered-signature lookup
  and the card's emit all happen first — an orphan card, and an allow for an
  in-folder or remembered call.

## Review fixes

- **Mode ids match by name, not substring.** Every ACP mode id carries the
  protocol's own URI, which contains "agent", so `includes("agent")` resolved
  accept edits and auto to whichever mode came first — `#autopilot` on Copilot,
  its allow-all mode, where Bash runs with no card. `modeIdFor` now compares the
  name after the last `#` (or the last path segment) whole, against `agent` or
  `plan`; no exact match means no switch.
- **`set_mode` has a deadline.** The approved mode is applied before the
  permission answer goes out, and the agent is waiting on that answer; an agent
  that never answers `session/set_mode` meanwhile would hold both. `switchMode`
  gives it five seconds (`Effect.timeoutOrElse`), then logs
  `acp: could not enter <mode>: the agent did not answer in time` and answers
  false, so the approval still reaches the agent and the stored mode still makes
  the next turn right.
- **No allow option, no card.** `answerPermission` checks the option an approval
  would pick before it asks. When there is none — for a plan, no allow-once — the
  request is cancelled with no card, so an approval that could only end cancelled
  never switches the mode first.
- **The mode comes only from a plan card, and a plan card is never remembered.**
  The gate applies `answer.mode` only when the verdict's reason is `plan`, and a
  `plan` ask, like an `outward` one, is neither consulted nor remembered.
- **Containment walks the path the way the kernel does.** `escapee` resolved the
  target lexically (`resolve`) before `realpath`, so `linkdir/../x` with
  `linkdir` → `/outside/deep` was read as `<project>/x` while the kernel opens
  `/outside/x`; and a dangling link `dangling` → `/outside/new.txt` failed
  `realpath`, so the walk-up re-joined the link's own name inside the project.
  `realPathOf` now resolves component by component — `lstat` each, `readlink` a
  link and continue from its target, `..` taken from the resolved prefix, 40
  hops at most — and joins the rest on as written from the first component that
  does not exist. `~` and `file://` stay literal. Every caller of `escapee`
  (documents, footage, removals, `@` tagging) gets the same walk.
