## Context

See proposal.md for the motivation, and `specs/` for what changes for the
person. Everything here happens in the sidecar or the preview host. Nothing
crosses the webview↔sidecar contract: no `shared/ipc.ts` change, no
`SIDECAR_PROTOCOL` / Rust `PROTOCOL` bump, no history migration, no
`settings.json` key.

Two of the REM-662 figures were checked against the packages this repo pins:

- **Remotion 4.0.520 `computeHashAndFinalConfig`** sets `cache` after
  `webpackOverride` has run. That makes `cache: false` unchangeable from the
  override, so it has to be replaced on the config `webpackConfig()` returns. Its
  base config carries
  `watchOptions: { aggregateTimeout: 0, ignored: ['**/.git/**', '**/.turbo/**', '**/node_modules/**'] }`.
- **webpack 5's `Compiler.watch(watchOptions, handler)`** uses only its argument.
  `config.watchOptions` is read only by `webpack(config, callback)`, so
  `watch({})` throws Remotion's away.
- **`@anthropic-ai/claude-agent-sdk` 0.3.257** says this in its typings: "passing
  an `append` … turns the recording off, so your appended text is applied fresh
  on every launch". It recommends `snapshot: true`, which is accepted with no
  effect where recording has not rolled out. Its `getContextUsage` "Defaults to
  `'full'`", while `'summary'` "answers from the last response's usage and local
  estimates".

## Goals / Non-Goals

**Goals:**

- Remove each cost without changing what a turn produces. Every item is local to
  one file and its test.
- Keep each item independently revertible.

**Non-Goals:**

- Re-measuring the audit's wall-clock figures in this change. Those need the
  running app, so they are the user's tasks at the end of `tasks.md`.

## Decisions

### 1. An in-memory webpack cache, scoped to the compiler

Both watch compilers get `cache: { type: "memory", maxGenerations: 1 }`:

- the render compiler, by replacing `cache` on the config before `watch()`;
- the canvas compiler, in `nativeConfig()`.

`enableCaching` stays `false` in `BUNDLE_FLAGS`, and its test stays. The REM-318
record is about the **filesystem** cache: 9 GB in the person's
`node_modules/.cache`, corrupted when the host is killed mid-write, and no help
to a *cold* compile. A memory cache writes nothing, dies with the host, and is
what makes webpack's *watch* rebuilds incremental. With `cache: false`, webpack
has no module cache to restore from, so every rebuild re-processes every module.

`maxGenerations: 1` drops any entry a compilation did not use, so the cache holds
one generation's modules and not the history of every edit.

**Alternatives considered:**

- *Re-enabling the filesystem cache under the app's data directory.* Rejected,
  because it does nothing for an incremental rebuild and brings back the
  corruption problem.
- *Leaving the cache off and debouncing harder.* Rejected: agent writes are
  usually seconds apart, so a debounce would not merge them.

### 2. Watching with the project's own `watchOptions`

Both `watch()` calls pass `config.watchOptions ?? {}`. That restores Remotion's
`ignored` list (`node_modules`, `.git`, `.turbo`) and `poll`, and keeps its
`aggregateTimeout: 0`. Raising the timeout was considered and rejected: separate
tool calls are seconds apart, and the bursts that a timeout would merge, such as
an install writing into `node_modules`, are exactly what `ignored` removes.

### 3. The Claude system prompt is recorded once per chat

`optionsOf` passes `systemPrompt: { type: "preset", preset: "claude_code", append, snapshot: true }`.

For that to be correct, nothing that varies between turns of one chat may live
in `append`:

- the stage brief moves out (decision 4);
- the video sentence stays, because a chat's video never changes;
- the bundle sentences stay, because the bundle is attached on every turn of a
  working install.

**Accepted trade-off:** a chat started before an app update keeps its old
conventions until Claude compacts it. A new chat gets the new ones at once. The
frozen prompt also carries the git status from the first launch; the agent
already runs `git status` when it needs the current state.

**Alternative considered:** `excludeDynamicSections: true` without a snapshot. It
moves the dynamic sections into a user message on every launch, so `append`
would still be re-rendered and the stage brief would still sit in the system
prompt. Rejected as half of the fix.

### 4. The stage brief moves into the trailer, for every provider

`instructionsFor` returns `system = conventions` and
`trailer = joined(assets, brand, stageBrief)`. The stage brief goes last, so it is
the most recent text the model reads.

All four adapters already put `trailer` at the end of the turn's message, so
none of them changes. Codex's `developer_instructions` and ACP's leading system
block no longer change when a stage moves either.

**Cost:** each turn's message now carries the brief, about 2–5 K characters while
a stage is active, and it stays in the resumed history. That text sits in the
cached prefix on later requests. Before this change, every stage move made the
whole conversation miss the cache.

**Alternative considered:** sending the full brief only when the stage has
changed since the previous turn. That needs per-chat state for "last brief
sent", which is left for the pipeline change named in the non-goals.

### 5. The pointed-edit guard lives in the stage brief

`stageBrief` gains one paragraph, placed before its "keep going" close: when the
message asks for one specific change, such as an `[Element #N]` edit, the agent
makes it, checks the affected range and ends the turn without moving the stage.
The close is reworded so "keep going in the same turn" applies to stage work.

**Alternative considered:** omitting the brief whenever `[Element #N]` tokens are
present. Rejected: the person sometimes points at an element *as* the answer to
a stage question, and the agent would then lose the stage context. Both
alternatives are prompt-only; neither makes the decision in code.

### 6. Context reading with `detail: "summary"`

The reading stays inside the result's tap, because the spec requires it before
the turn closes the session, and keeps its 2 s window. Only the detail level
changes: the meter shows a total and a maximum, and `summary` returns both.

### 7. Stills get a `captures/` folder of their own

`freshFile` sweeps and writes `<stills>/captures/` instead of `<stills>/`. It
also removes loose files left directly in `<stills>/` by earlier builds, but
never a folder there.

- `readiness-<id>/` and the `design-*` folders stay in `<stills>/`. Their own
  sweep (`freshDesignFolder`, "previous sampled checks are swept") is unchanged.
- `clips/` already lives in its own folder.
- The asset-protocol scope is `**`, so the webview loads a capture from the new
  path with no Rust change.
- The composer's attachment is still a permanent copy, so nothing that refers
  to an old path is broken.

### 8. Compact JSON in tool results

The four pretty-printed `JSON.stringify(…, null, 2)` calls in
`sidecar/tools/execute.ts` lose their indentation. No reader parses the
whitespace: the agent reads the text, and the tests parse it.

### 9. `Skill` and `ToolSearch` join `FREE_TOOLS`

**Loading a skill.** It reads instructions; it does not run anything. A script
or file the skill then points at is a `Bash` call or a file tool, and the gate
still judges that call on its own. The spec's bundle-is-readable rule already
covers the files a bundled skill points at.

**Looking up a deferred tool.** `ToolSearch` returns schemas, not results.

**Mode coverage.** In auto mode Claude Code's classifier usually approves both
without asking. The cards appeared in accept edits and plan, where the
`PreToolUse` hook forces every `ask` verdict through the gate. Adding the two
tools to `FREE_TOOLS` gives an `allow` verdict, so the hook passes them through
too.

### 10. ACP reads of the bundle

For `read` and `search` kinds, `reviewAcp` passes `[PLUGIN_DIR]` as the read
roots to `escapee`, mirroring `readRootsFor` in the Claude review. `edit`,
`move` and `delete` keep no read roots, so a write into the bundle still asks.

## Risks / Trade-offs

- **[Memory cache raises the host's resident memory.]** A full compile already
  peaks at 1.67 GB. With the cache, each compiler keeps one generation's modules
  between builds.
  → `maxGenerations: 1`. Hosts are still stopped when idle. The user's runtime
  task records rebuild time and host RSS before and after; if RSS is not
  acceptable, the render compiler, which only wakes for tools, is the one to
  give the cache back.
- **[`snapshot` freezes a chat's conventions across an app update.]**
  → Accepted and written into the knowledge spec. A new chat picks up the new
  conventions.
- **[The brief in the message is more salient than in the system prompt.]**
  → This is intended, and the pointed-edit paragraph tempers it.
- **[An ACP agent may report the bundle under a path that differs from
  `PLUGIN_DIR`, for example through a symlink.]**
  → `escapee` resolves both sides with `realpath`, as it does for Claude.

## Migration Plan

No migration is needed.

- Captures written before the change sit as loose files directly in
  `<stills>/`. A capture's sweep also removes loose files at that level, but
  never folders, so they go on the first capture after the update.
- Rollback is reverting any one decision. None of them depends on another,
  except 3 on 4: `snapshot` without moving the stage brief would freeze the brief
  of the chat's first turn.
