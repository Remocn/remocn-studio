## Why

Linear REM-631. The `AgentAdapter` seam is real — four adapters behind
`sidecar/agent/registry.ts` — but what the agent is told is assembled around it,
and the provider-specific knowledge has leaked out on both sides:

- The shared instructions live in `sidecar/claude/conventions.ts` and are imported
  by Codex (`codex/adapter.ts`), the ACP bridge (`acp/turn.ts`), the turn handler and
  the tool host (`tools/execute.ts`). Every adapter re-assembles the same three
  strings itself (`conventions + "\n\n" + pipeline`, `[assets, brand].join`) because
  `TurnBriefs` is four nullable strings.
- The pipeline brief tells every provider to "create your task list with
  TaskCreate", although `shared/providers.ts` declares `planTool: false` for Codex,
  Copilot and Grok precisely because they do not speak that vocabulary.
- The brief that `set_pipeline_stage` and `start_video_pipeline` hand back is built
  with `pipelineBrief(stages)` — no video — so after a stage moves mid-turn the agent
  is pointed at the placeholder folder instead of `src/videos/<slug>/docs/`.
- A missing command-line tool fails the turn as `auth` on Claude and as `unknown` on
  Codex, Copilot and Grok, from four copies of the same preamble.
- The turn decides the tool-host key from `adapter.persistent`, deleting a chat calls
  `acpPool.dispose` by name, and the composer picks the Mode chip's items with
  `provider === "claude"` inline in the component.

## What Changes

- One provider-neutral instruction module, `sidecar/agent/instructions.ts`, builds
  `{ system, trailer, media }` for a turn from the provider's capabilities, the
  knowledge attach, the video, the pipeline stages and the briefs. Adapters only
  place those three strings in their runtime's format. The conventions text moves
  there unchanged.
- The stage brief's planning sentence names the plan tool the chat's runtime
  really has, read from a new `ProviderInfo.planningTool` field: TaskCreate for
  Claude (unchanged), `update_plan` for Codex, `todo_write` for Grok; Copilot,
  whose tool name could not be verified, is asked to lay out its steps in its own
  planning tool. Chosen by the user on 2026-10-02.
- The brief returned by the pipeline tools names the chat's own video folder, the
  same as the brief that opens the turn.
- A turn sent on a provider whose command-line tool is missing fails with that
  provider's install sentence and one failure class, the same on all four.
- `AgentAdapter` owns its tool-host key (`toolKey`) and its cleanup when a chat is
  deleted (`forget`); `persistent` goes away and the handlers stop importing
  `acp/*`.
- The Mode chip's items, the mode a turn will really run in and its hint come from
  one pure lookup in `lib/studio/models.ts`; `composer.tsx` stops branching on the
  provider.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent/pipeline`: the active stage's brief names the plan tool the provider's
  runtime has, and the brief handed back after a stage move
  names the chat's video folder.
- `agent/providers`: a missing command-line tool fails the turn with the same
  failure class on every provider.

## Impact

- Shared contract: `shared/providers.ts` gains `ProviderInfo.planningTool` (a static
  table both sides compile in; not a frame). Nothing on the wire. `AgentFailureKind` is unchanged; no protocol
  bump, no migration, no settings key.
- Sidecar: new `sidecar/agent/instructions.ts` (conventions, stage brief, the three
  strings), new `missingCli` in `sidecar/agent/cli.ts`; `TurnServices` carries an
  `instructions` builder instead of `briefs`; `AgentAdapter` gains `toolKey` and
  `forget`; `sidecar/agent/turn.ts` (from `the-turn-leaves-the-handler`) builds the
  instructions and the pipeline port's brief; `claude/adapter.ts`,
  `claude/session.ts`, `codex/adapter.ts`, `acp/turn.ts`, `copilot/adapter.ts`,
  `grok/adapter.ts`, `tools/execute.ts`, `handlers.ts` (`history.remove`).
  `sidecar/claude/conventions.ts` is deleted.
- Rust core: none.
- Webview: `lib/studio/models.ts` gains `modeChoices`; `components/studio/composer.tsx`
  renders what it returns.

Ordering: implemented after `one-ask-in-the-gate` (REM-629) and
`the-turn-leaves-the-handler` (REM-630); the brief assembly is planned against
`runTurn`, not against `agent.prompt`.

## Non-goals

- Rendering Codex's `todo_list` or an ACP `plan` update as the studio's plan
  checklist. That is a new feature with its own vocabulary mapping; here a provider
  without the plan tool simply stops being told to use one it does not have, and
  the providers spec already says no checklist appears for it.
- Rewording the conventions themselves. The text moves byte for byte; only the
  stage brief's one planning sentence varies.
- Moving the Mode/Effort decision for other providers' models. Only Claude has a
  model that cannot run a mode today; the lookup keeps that rule and returns every
  mode for everyone else.
- Removing the Free/Pro wording from the pipeline and knowledge specs (REM-520
  history); it is left for the drift ledger.
