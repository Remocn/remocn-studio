## Context

See proposal.md — Why. The state this design starts from, verified on 2026-10-02:

- `sidecar/claude/conventions.ts` (347 lines) exports `STUDIO_CONVENTIONS`,
  `MANAGED_OBJECTS`, `MOTION_TAXONOMY`, `conventionsFor(hasSkills, video)` and
  `pipelineBrief(stages, video)`. Importers: `claude/session.ts`,
  `codex/adapter.ts:24`, `acp/turn.ts:13`, `handlers.ts:31`, `tools/execute.ts:12`,
  and the tests `claude/conventions.test.ts` and `tools/specs.test.ts`.
- The three placements: Claude appends `conventions [+ pipeline]` to the
  `claude_code` system prompt (`session.ts` `optionsOf`) and passes
  `[assets, brand]` + `media` into the user message (`claude/adapter.ts:46-63`);
  Codex sets `developer_instructions` (`codex/adapter.ts:194-200`) and passes the
  trailer and media to `inputOf` (`:109-115`); ACP sends the conventions as the
  first text block and the trailer and media as later blocks (`acp/turn.ts:205-221`).
  So every provider already takes exactly three strings: a system part, a trailer
  and a media part.
- What each adapter knows that the turn does not: only whether its knowledge attach
  succeeded (`locateBundle` for Claude and ACP, `codexHome(...)` for Codex), which
  is the `hasSkills` argument of `conventionsFor`.
- `planTool` is already a declared capability (`shared/providers.ts:22`), true for
  Claude only; it means "speaks the checklist vocabulary", not "has a plan tool". The plan checklist is parsed from `TaskCreate` tool calls
  (`lib/studio/tasks.ts:23`). Codex's `todo_list` item is dropped by its translator
  (`codex/events.ts:50`), and the ACP translator handles only message, thought and
  tool-call updates (`acp/events.ts:93-105`) — a `plan` update is ignored. So no
  non-Claude plan reaches the studio today, whatever the brief says.
- `pipelineBrief` call sites: `handlers.ts:522` passes `video`;
  `tools/execute.ts:522` (`staged`, used by both `start_video_pipeline` and
  `set_pipeline_stage`) does not, and `TurnTools` carries no video to pass.
- Missing CLI: `claude/adapter.ts:25-35` returns `kind: "auth"`;
  `codex/adapter.ts:65-75`, `copilot/adapter.ts:53-63`, `grok/adapter.ts:51-61`
  return `kind: "unknown"`. Each message is its provider's `missingRow().detail`.
  The webview reads only `failure.message` (`hooks/use-turns.ts:485-511`);
  `failure.kind` is not read anywhere outside the sidecar, so the class is a
  contract for the transcript and future readers, not for today's UI.
- `persistent` is read once, `handlers.ts:289-290`; `acpPool.dispose` is called
  once, `handlers.ts:614`.
- `composer.tsx:62-81` holds `MODES` and a local `modesFor(model)`;
  `:161-166` picks items, the running mode and the hint with `provider === "claude"`.

This change lands after `the-turn-leaves-the-handler` (REM-630), which moves
`agent.prompt` into `runTurn` in `sidecar/agent/turn.ts`, and after
`one-ask-in-the-gate` (REM-629). Every "the turn" below means `runTurn`.

## Goals / Non-Goals

**Goals:**

- Nothing under `sidecar/claude/` is imported from outside it.
- Each adapter places three strings and decides nothing about their content.
- Every `pipelineBrief` call knows the video and the provider's plan tool.
- The handler layer names no provider and no provider module.

**Non-Goals:**

- Translating Codex `todo_list` / ACP `plan` into the plan checklist.
- Any change to the conventions' text other than the stage brief's planning sentence.

## Decisions

### 1. `sidecar/agent/instructions.ts` owns the words and the three strings

The module takes over `conventions.ts` wholesale (text unchanged) and adds:

```ts
interface TurnInstructions {
  readonly media: string | null;
  readonly system: string;
  readonly trailer: string | null;
}

instructionsFor(input: {
  provider: ProviderInfo;
  hasSkills: boolean;
  video: string | null;
  stages: readonly PipelineStage[];
  briefs: { assets: string | null; brand: string | null; media: string | null };
}): TurnInstructions

stageBrief(stages, { planningTool, video }): string | null
```

`system` is `conventionsFor(hasSkills, video)` plus the stage brief when one is
active; `trailer` is assets and brand joined; `media` passes through. The joins
that are copied three times today exist once.

`TurnServices.briefs` is replaced by
`instructions: (hasSkills: boolean) => TurnInstructions`, a closure `runTurn` builds
over the `info` of the adapter it picked, the video, the stages and the
briefs. The adapter calls it once after its own knowledge attach, because the attach
result is the only input it alone has.

Alternative considered: keep `TurnBriefs` and pass `stages` raw, letting each
adapter call `instructionsFor`. Rejected — every adapter would again import the
words module and pass the same five arguments; the closure leaves one argument the
adapter genuinely owns. Alternative: compute everything in `runTurn` with
`hasSkills` guessed from `locateBundle`. Rejected — Codex's attach is a mirrored
home that can fail independently (`codex/home.ts`), and the knowledge spec requires
the brief to claim the skills only once that attach succeeded.

`sidecar/claude/conventions.ts` is deleted, and its test moves to
`sidecar/agent/instructions.test.ts` case for case.

### 2. The planning sentence names each runtime's own plan tool

Decided by the user on 2026-10-02 ("name each runtime's tool"), replacing a
neutral wording proposed first. The only sentence of the brief that varies. Today
(`conventions.ts:334-335`):

> Start the stage by finding out what is already known, in this order, and create
> your task list with TaskCreate from what you find:

The wording is selected by data on the provider, never by provider id inside the
instructions module. `ProviderInfo` (`shared/providers.ts`) gains
`planningTool: Schema.NullOr(Schema.String)` — the name of the plan tool the
runtime itself exposes to the model, or null where that name has not been
verified. `capabilities.planTool` keeps its meaning (the runtime speaks the
vocabulary the studio's plan checklist parses — Claude only) and keeps gating the
plan drawer; the two answer different questions. The table:

| Provider | `planningTool` | Evidence |
| --- | --- | --- |
| Claude | `TaskCreate` | the studio's own checklist parser (`lib/studio/tasks.ts:23`) and the brief today |
| Codex | `update_plan` | vendored source `repos/codex/codex-rs/core/src/tools/handlers/plan.rs:50` (`ToolName::plain("update_plan")`), enabled unless `tools.update_plan.enabled = false` (`core/src/config/mod.rs:2586`); the name is present in the shipped `@openai/codex` 0.147.0 binary (43 occurrences in `strings`); its calls surface in the SDK stream as the `todo_list` item (`@openai/codex-sdk` `TodoListItem`) |
| Grok | `todo_write` | `strings` of the installed Grok Build 1.0.46 binary: `crates/codegen/xai-grok-cursor/src/tools/todo_write.rs`, a tool table row ``| `todo_write` | Create and manage task lists |``, and the hook alias pair `TodoWrite` / `todo_write` |
| Copilot | `null` | not verifiable on disk: Copilot CLI 1.0.90 ships a compressed bundle (`strings` finds no `sessionUpdate`, no todo or plan tool name) |

Wording, with `${tool}` the provider's `planningTool`:

- Named tool: `…in this order, and create your task list with ${tool} from what
  you find:` — for Claude this is the current sentence, byte for byte.
- `null` (Copilot): `…in this order, and lay out your steps from what you find, in
  your own planning tool if you have one:`.

Recorded assumptions, for the running-app check: Copilot's own plan tool name is
unknown, so it gets the neutral sentence; a later probe that finds it fills in
`planningTool` and nothing else changes. Codex rejects `update_plan` in its own
collaboration Plan mode (`plan.rs:84-88`), which the studio never enters — the
studio's plan mode maps to the `read-only` sandbox (`codex/adapter.ts:44-48`) — so
the call stays legal on every studio mode. Grok's name comes from one CLI version;
a rename in a later release would make the sentence name a tool that is gone, which
the agent tolerates the same way it would a missing skill.

The studio still renders none of these plans (Non-goals): Codex's `todo_list` is
dropped by its translator and ACP `plan` updates are ignored; the providers spec's
"no plan drawer without the plan tool" stands.

Alternative considered: a neutral sentence for every non-Claude provider. It was
the first proposal; the user chose naming each runtime's tool, because a named tool
is a concrete instruction the model can act on and the names are verifiable data.
Alternative: switch on provider id in the instructions module. Rejected — the
instructions module must stay provider-neutral; a fifth provider adds one table
entry, not a branch.

### 3. The pipeline tools get their brief from the turn, not from a word list

`PipelineCalls` (`tools/execute.ts`) gains `brief: (stages) => string | null`.
`runTurn` wires it as `(stages) => stageBrief(stages, { planningTool: adapter.info.planningTool, video })`,
the same inputs as the opening brief. `staged()` calls `tools.pipeline.brief` and
`execute.ts` imports nothing from the instructions module. A video row that could
not be read gives `video: null`, which `resolveStage` already turns into the
placeholder folder.

Alternative considered: add `video` to `TurnTools`. Rejected — the tool host would
still need the provider's plan tool for the planning sentence, and two fields to build a
string the turn already knows how to build is the leak this change removes.

### 4. One `missingCli`, classed as `auth`

`sidecar/agent/cli.ts` gains
`missingCli(row: EnvironmentCheck, params: PromptParams): PromptResult` returning
`{ context: null, failure: { kind: "auth", message: row.detail ?? row.title }, sessionId: params.sessionId }`.
All four adapters call it with their own `missingRow()`.

Why `auth`: the providers spec classes failures as signed out, out of quota,
unusable model, or something else, and words the sign-in case as an instruction.
A missing tool is the same family — the environment row already carries
`fix: { step: "install", type: "provider" }` beside the `signin` step — and its
sentence is an instruction to install and sign in. `unknown` would class a fully
diagnosed state as undiagnosed. A new `"install"` kind was rejected: it widens
`AgentFailureKind` on the wire (a `SIDECAR_PROTOCOL` + Rust `PROTOCOL` bump) for a
distinction no reader makes today.

### 5. `AgentAdapter.toolKey` and `AgentAdapter.forget`

```ts
readonly toolKey: (ids: { chat: string; turn: string }) => string;
readonly forget: (chat: string) => Effect.Effect<void>;
```

Claude and Codex: `toolKey` answers the turn id (tools live for the turn),
`forget` is `Effect.void`. Copilot and Grok: `toolKey` answers `chat-${chat}` (the
held ACP process keeps its MCP servers across turns), `forget` is
`acpPool.dispose(chat)`. `persistent` is removed. `registry.ts` exports
`forgetChat(chat)`, which runs every adapter's `forget`; `history.remove` calls it
instead of `acpPool.dispose`, so `handlers.ts` imports nothing from `acp/`.
Calling all four rather than the row's provider is deliberate: each `forget` is a
no-op for a chat it never held, and it needs no read of the deleted row.

State ownership: unchanged — the ACP pool stays in the sidecar; nothing crosses the
wire.

### 6. The Mode chip from one lookup

`lib/studio/models.ts` gains

```ts
modeChoices(provider: AgentProvider, mode: SessionMode, model: string):
  { items: readonly ModeChoice[]; running: RunningMode; hint: string | null }
```

which absorbs `MODES`, the local `modesFor` and the `provider === "claude"` branch
from `composer.tsx`. The issue suggested putting `modesFor(model)` on
`ProviderInfo`; it is a Schema struct of plain data shared by both sides, so a
function there would make it undecodable, and the hint wording depends on
`modelLabelOf`, which already lives in `models.ts`. The composer only renders the
returned value.

## Risks / Trade-offs

- [The moved conventions text drifts during the move] → the test file moves case
  for case, and a byte-equality test pins `instructionsFor` for Claude with skills
  against the old `conventionsFor(true, video) + "\n\n" + pipelineBrief(...)`
  output, captured before deletion.
- [A non-Claude agent ignores "your own planning tool" and plans in prose] →
  harmless; the stage's done-condition and checklist are unchanged.
- [`forget` on all adapters kills a held ACP process mid-turn for a chat being
  deleted] → same as today: `history.remove` already disposed the pool entry.
- [Re-classing Codex/Copilot/Grok's missing-CLI failure as `auth`] → no reader of
  `kind` exists in the webview (verified), so nothing visible changes.

## Migration Plan

None: no protocol bump, no history migration, no settings key. Rollback is a revert.

## Deviations during apply

- **The golden strings are pinned as SHA-256 and length**, not as literals: the
  three outputs of task 1.1 and the combined Claude `system` run to 2–23 KB each.
  Before `conventions.ts` was deleted, the new module was compared with the old
  one directly — `conventionsFor` with and without skills, with and without a
  video, and `stageBrief(…, TaskCreate)` against `pipelineBrief` for every stage
  — and every pair was equal; the hashes in `instructions.test.ts` were taken
  from the old module.
- **The pipeline port's brief reaches the tools through `TurnContext.brief`.**
  Since REM-630 the pipeline calls are assembled by `ports.tools(turn)` in
  `sidecar/agent/turn-tools.ts`, so `runTurn` builds
  `(stages) => stageBrief(stages, { planningTool: adapter.info.planningTool, video })`
  and hands it over on the context; `turnTools` puts it on `PipelineCalls.brief`.
  `execute.ts` imports nothing from the instructions module.
- **One `joined` helper**, exported from `instructions.ts`, makes the trailer and
  replaces `runTurn`'s `joinedBriefs` for the media brief. It drops empty strings
  as well as nulls, which is what the adapters' `filter(Boolean)` did.
- **`missingCli` takes `Pick<PromptParams, "sessionId">`** — the only field it reads.
- **`modeChoices` reads a per-provider table** (`AUTOLESS`, Claude's set of
  models without Auto, empty for the others) rather than branching on the
  provider, and the composer passes `models[provider]`. `offersAutoMode` and
  `runningMode` stay: `sidecar/claude/events.ts` reads the first.
- **`ProviderInfo` is not on the wire**: no frame decodes it (it is only the
  static `PROVIDER_INFO` table both sides compile in), so `planningTool` needs no
  `SIDECAR_PROTOCOL` / Rust `PROTOCOL` bump and nothing in `src-tauri` changed.
- **`TurnServices.video` stays** although no adapter reads it any more; removing
  it is outside this change.
