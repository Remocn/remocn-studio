# Tasks

## 1. The preview recompiles incrementally (sidecar/preview)

- [x] 1.1 `sidecar/preview/bundling.ts`: add `WATCH_CACHE = { type: "memory", maxGenerations: 1 }` and a pure `watched(config)` that returns the config with that cache and its own `watchOptions` (or `{}`). `BUNDLE_FLAGS.enableCaching` stays `false`. Test `sidecar/preview/bundling.test.ts`: `watched` replaces `cache: false` with the memory cache, carries Remotion's `watchOptions` (`ignored` with `node_modules`, `aggregateTimeout`, `poll`) through untouched, and answers `{}` when the config has none; the existing "never writes a webpack cache into the person's project" case still passes.
- [x] 1.2 `sidecar/preview/host.ts` `watch()`: build the render compiler from `watched(config)` and call `compiler.watch(<its watchOptions>, …)`. `sidecar/preview/native.ts`: `nativeConfig()` sets `cache` to `WATCH_CACHE`, and the canvas compiler is watched with the config's own `watchOptions`. Verify: `bun run typecheck`, `bun run test sidecar/preview/bundling.test.ts sidecar/preview/native.test.ts sidecar/preview/host.test.ts`.

## 2. Captures keep to their own folder (sidecar/preview)

- [x] 2.1 `sidecar/preview/still.ts` `freshFile`: sweep and write `<dir>/captures/`, and also remove loose files (never folders) left directly in `<dir>` by earlier builds. Test `sidecar/preview/still.test.ts`: "keeps only the capture it just took" reads the captures folder; a new case writes `readiness-abc/report.json` and `design-1234/frame.png` into the stills folder, takes a capture, and finds both still there; a loose `old-frame-1.png` in the stills folder is gone after a capture.

## 3. Claude's prompt stays cacheable (sidecar/agent, sidecar/claude)

- [x] 3.1 `sidecar/agent/instructions.ts`: `instructionsFor` returns `system` = the conventions alone and `trailer` = `joined(assets, brand, stageBrief)`, with the stage brief last. Test `sidecar/agent/instructions.test.ts`: with a stage active, `system` contains no stage text and is identical to the no-stage `system`; `trailer` ends with the brief; with only a brief, `trailer` is the brief; the existing assets-and-brand and no-trailer cases still pass. Update the cases that read the brief from `system`.
- [x] 3.2 `sidecar/agent/instructions.ts` `stageBrief`: add the pointed-edit paragraph before the closing instruction, and make that closing "keep going in the same turn" apply to stage work (design §5). Test `sidecar/agent/instructions.test.ts`: every stage's brief carries the pointed-edit paragraph, names `[Element #N]`, and says the stage is left where it is.
- [x] 3.3 `sidecar/agent/turn.test.ts`: the turn that starts mid-stage hands the adapter a `system` without the brief and a `trailer` that carries it. Verify: `bun run test sidecar/agent/turn.test.ts`.
- [x] 3.4 `sidecar/claude/session.ts`: export `optionsOf`. Its `systemPrompt` carries `snapshot: true` beside the preset and the `append`. The context reading calls `getContextUsage({ detail: "summary" })` and keeps its 2 s window. Test `sidecar/claude/session.test.ts`: `optionsOf` answers a preset system prompt with `snapshot: true` whose `append` is exactly the system text, and adds no stage brief. The reading asks for `detail: "summary"`, passes the totals to `onContext`, and leaves the previous reading untouched when the call does not answer within the window.

## 4. No card for reading instructions (sidecar/claude, sidecar/acp)

- [x] 4.1 `sidecar/claude/permission.ts`: add `Skill` and `ToolSearch` to `FREE_TOOLS`. Test `sidecar/claude/permission.test.ts`: both are allowed with no card; `Bash`, `WebFetch` and an unknown tool still ask. Test `sidecar/claude/guard.test.ts`: in accept edits and plan the `PreToolUse` hook passes a `Skill` call through without forcing an ask.
- [x] 4.2 `sidecar/acp/permission.ts` `reviewAcp`: pass `PLUGIN_DIR` as the read root for the `read` and `search` kinds only. Test `sidecar/acp/permission.test.ts`, with `PLUGIN_DIR_ENV` pointed at a temporary bundle: a read inside the bundle is allowed with no card; a search inside it, the same; an edit or delete inside it asks; a read outside both the folder and the bundle still asks; an unset `PLUGIN_DIR` changes nothing.

## 5. Compact tool results (sidecar/tools)

- [x] 5.1 `sidecar/tools/execute.ts`: drop the indentation from the four `JSON.stringify(…, null, 2)` calls (design check, report, merged readiness, stock search). Test `sidecar/tools/execute.test.ts`: the existing `JSON.parse` cases still pass, plus one case asserting a `design_check` answer contains no newline-then-indent sequence.

## 6. Integration

- [x] 6.1 Changeset `.changeset/faster-agent-turns.md` (patch): the preview rebuilds faster after each agent edit; Claude chats reuse their cached prompt between turns; a Snapshot no longer discards the design check's report; loading a skill no longer raises a card.
- [x] 6.2 `openspec validate faster-agent-turns --strict`, `bun run check`, `bun run typecheck`, the touched test files, then the full `bun run test` once.

## 7. In the running app (the user)

- [ ] 7.1 Open a project and, with Activity Monitor on the preview host's `bun` process, have the agent make five separate small edits. Record each rebuild's time (the sidecar log or the pane's build progress) and the host's memory, before this change and after. Expected: rebuilds after the first are well under the ~7 s full compile, and memory settles rather than climbing with every edit.
- [ ] 7.2 In a git-tracked project with Claude, send three short messages in one chat while the pipeline moves a stage between the second and the third. In the turn results (`result.usage`, logged by the SDK), the second and third requests read most of their input from the cache.
- [ ] 7.3 In accept edits with Claude, ask for something that invokes a bundled skill: no card is raised for the skill. A `Bash` command still raises one.
- [ ] 7.4 Run a full `design_check`, take a Snapshot, then let the agent mark review done with that report: it closes without re-running the check.
- [ ] 7.5 With Copilot and with Grok, in a turn that follows a bundled skill's references, no "outside the project" card is raised for files under the bundle. Writing into it still asks.
