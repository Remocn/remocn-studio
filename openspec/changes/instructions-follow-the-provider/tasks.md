## 0. Prerequisites

- [x] 0.1 Confirm `one-ask-in-the-gate` (REM-629) and `the-turn-leaves-the-handler` (REM-630) are applied, so `runTurn` in `sidecar/agent/turn.ts` builds the turn's services; the planning wording is decided (design.md decision 2: name each runtime's tool, chosen by the user on 2026-10-02).

## 0b. Shared contract

- [x] 0.2 `shared/providers.ts`: add `planningTool: Schema.NullOr(Schema.String)` to `ProviderInfo` — `TaskCreate` for Claude, `update_plan` for Codex, `todo_write` for Grok, `null` for Copilot — with the evidence of design.md decision 2 beside each entry. Test: `sidecar/agent/registry.test.ts` pins the four values.

## 1. Sidecar — the instruction module

- [x] 1.1 Before moving anything, capture `conventionsFor(true, "intro")`, `conventionsFor(false, null)` and `pipelineBrief(<analysis active>, "intro")` as golden strings in `sidecar/agent/instructions.test.ts`; the Claude outputs of the new module must equal them byte for byte.
- [x] 1.2 Create `sidecar/agent/instructions.ts`: move the conventions text, `conventionsFor`, `MANAGED_OBJECTS`, `MOTION_TAXONOMY`, `STUDIO_CONVENTIONS`; add `stageBrief(stages, { planningTool, video })` with the planning sentence naming `planningTool` or, when it is null, the neutral sentence, and `instructionsFor(...)` → `{ system, trailer, media }`. Move `sidecar/claude/conventions.test.ts` into `sidecar/agent/instructions.test.ts` case for case; delete `sidecar/claude/conventions.ts` and its test. Update `sidecar/tools/specs.test.ts` imports. Test: `bun run test sidecar/agent/instructions.test.ts sidecar/tools/specs.test.ts`.
- [x] 1.3 Add the table test in `sidecar/agent/instructions.test.ts` over `AGENT_PROVIDERS` × `PROVIDER_INFO`: with an active stage, Claude's brief names `TaskCreate` byte for byte as before, Codex's names `update_plan`, Grok's names `todo_write`, Copilot's names no tool, and no non-Claude `system` contains `TaskCreate`; with a video, every stage's brief names `src/videos/<slug>/docs/`; `trailer` joins assets and brand and is null when both are.

## 2. Sidecar — the seam

- [x] 2.1 `sidecar/agent/adapter.ts`: replace `TurnServices.briefs` with `instructions: (hasSkills: boolean) => TurnInstructions`; replace `persistent?` with `toolKey({ chat, turn })` and add `forget(chat)` on `AgentAdapter`. Verify with `bun run typecheck` (every adapter must now implement both).
- [x] 2.2 `sidecar/agent/cli.ts`: add `missingCli(row, params)` returning a `PromptResult` with `kind: "auth"` and the row's detail. Test: `sidecar/agent/cli.test.ts` (new) — the four `missingRow()`s give four results with the same kind and their own sentence.
- [x] 2.3 Adapters place the three strings and use `missingCli`: `claude/adapter.ts` + `claude/session.ts` (system → `systemPrompt.append`, trailer/media → `contentOf`), `codex/adapter.ts` (system → `developer_instructions`, trailer/media → `inputOf`), `acp/turn.ts` (system → first block, trailer/media → `blocksOf`/`textOnly`), `copilot/adapter.ts`, `grok/adapter.ts`. `toolKey`/`forget`: turn id + `Effect.void` for Claude and Codex, `chat-${chat}` + `acpPool.dispose` for Copilot and Grok. Tests: `sidecar/claude/session.test.ts`, `sidecar/codex/*.test.ts`, `sidecar/acp/*.test.ts` stay green; `grep -rn "claude/" sidecar --include=*.ts | grep -v "^sidecar/claude/"` finds only the registry's adapter import.
- [x] 2.4 `sidecar/agent/registry.ts`: export `forgetChat(chat)` running every adapter's `forget`. Test: `sidecar/agent/registry.test.ts` — every adapter implements `toolKey` and `forget`, the ACP adapters key by chat and the others by turn, `forgetChat` disposes a pooled ACP chat.
- [x] 2.5 `sidecar/agent/turn.ts` (`runTurn`): build `instructions` from the picked adapter's `info`, the video, the stages and the asset/brand/media briefs; take the tool key from `adapter.toolKey`; wire `pipeline.brief` as `stageBrief(stages, { planningTool: adapter.info.planningTool, video })`. Test: `sidecar/agent/turn.test.ts` — the fake adapter's captured `instructions(true)` names the video and the fake info's `planningTool`, and a null `planningTool` names none.
- [x] 2.6 `sidecar/tools/execute.ts`: `PipelineCalls.brief`; `staged()` calls it for `start_video_pipeline` and `set_pipeline_stage` (including review-done); drop the conventions import. Test: `sidecar/tools/execute.test.ts` — the brief returned after a stage move is the port's, with the video folder.
- [x] 2.7 `sidecar/handlers.ts`: `history.remove` calls `forgetChat`; remove the `acp/pool` import. Verify: `grep -n "acp/" sidecar/handlers.ts` is empty; `bun run typecheck`.

## 3. Webview

- [x] 3.1 `lib/studio/models.ts`: `modeChoices(provider, mode, model)` → `{ items, running, hint }`, absorbing `MODES` and `modesFor` from the composer. Test: `lib/studio/models.test.ts` — Claude on Haiku disables Auto with the hint and runs Default; Claude on Opus offers all three; Codex/Copilot/Grok offer all three, run the picked mode, no hint.
- [x] 3.2 `components/studio/composer.tsx` renders `modeChoices(...)`; no `provider === "claude"` remains in the file. Test: `components/studio/composer.test.tsx` stays green.

## 4. Verification

- [x] 4.1 Changeset `.changeset/instructions-follow-the-provider.md` (patch): each provider is told to plan with the tool its own runtime has (Codex `update_plan`, Grok `todo_write`) instead of Claude's TaskCreate, and a stage moved mid-turn points the agent at the video's own documents folder.
- [x] 4.2 `openspec validate instructions-follow-the-provider --strict`, `bun run fix`, `bun run check`, `bun run typecheck`, the touched test files, then the full `bun run test` once.
- [ ] 4.3 In the running app, with Codex: start a new video so the pipeline begins — the turn works through analysis, the agent makes no TaskCreate attempt and the sidecar log shows no unknown-tool error (the Codex plan itself is not drawn — its `todo_list` item is dropped by design), and after it moves a stage the documents land under `src/videos/<slug>/docs/` and appear in Docs. With Grok: the same, and its `todo_write` call appears as a tool row. With Copilot: the same without a named tool — and note in the change which tool, if any, Copilot used for its plan, so `planningTool` can be filled in. With Claude: the plan checklist still appears. Delete a Copilot chat and confirm no `copilot --acp` process for it survives (Activity Monitor).
