## Why

Linear REM-662. An audit of everything between Send and done found that a turn is
slowed less by the stream path, which is cheap, than by work the studio adds
around it. This change takes the quick wins: small, local fixes that each remove
a clearly reproducible cost.

- **Every agent write recompiles the whole project.** Both preview compilers run
  with `cache: false`. A rebuild redoes every module, about 7 s of CPU per write.
  `watch({})` also drops Remotion's `watchOptions`, including the rule that
  ignores `node_modules`.
- **The prompt cache misses.** Claude's system prompt is rebuilt on every launch,
  because it is an `append` without `snapshot`. The stage brief also lives inside
  that prompt, so a stage move rewrites the cache for the whole chat.
- **The end of every Claude turn waits on `getContextUsage()`.** By default the
  call uses `detail: "full"`, which costs one token-count call per category.
- **A Snapshot deletes design-check reports.** The capture sweeps the folder that
  also holds `readiness-<id>/report.json`. After that, `review done` fails, and
  the agent reruns a full check that takes minutes.
- **Tool results are pretty-printed**, which adds 25–50% to their tokens.
- **`Skill` and `ToolSearch` raise a card in accept edits and plan.** Copilot and
  Grok also ask for every read of the shipped bundle, which the spec says is
  readable.
- **An active stage pushes a pointed edit through the pipeline.** "Make the title
  bigger" ends with "keep going until the whole pipeline is done".

## What Changes

- The preview's watch compilers keep an in-memory webpack cache that lives as
  long as the compiler and is never written to disk. They also watch with the
  project's own `watchOptions`.
- Claude records a chat's system prompt once (`snapshot: true`). For every
  provider, the stage brief moves into the turn's message, beside the assets and
  brand briefs.
- The context reading uses `detail: "summary"`.
- Stills get a folder of their own, so a capture's sweep never reaches
  design-check reports.
- The studio's tool results are compact JSON.
- `Skill` and `ToolSearch` run without a card. Copilot and Grok read the shipped
  bundle without a card.
- The stage brief says that a pointed edit is made, checked and ended without
  moving the stage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent/permissions`: loading a skill and looking up a deferred tool run without
  a card, and protocol providers read the shipped bundle without one.
- `agent/knowledge`: on Claude, a chat keeps the system prompt it started with;
  the briefs ride in the turn's message.
- `agent/pipeline`: the stage brief rides in the turn's message and keeps a
  pointed edit from moving the stage.
- `preview/snapshot`: the stills folder holds only captures.

## Impact

- **Shared contract:** none. No protocol bump, no migration and no settings key.
- **Sidecar:** `preview/{host,native,still}.ts`, `claude/{session,permission}.ts`,
  `acp/permission.ts`, `agent/instructions.ts`, `tools/execute.ts`, and their
  tests.
- **Rust core and webview:** none.

## Non-goals

- **Fewer pipeline turns, shorter conventions, the managed vs legacy rules.**
  These change what the agent is asked to do, so they need their own change and
  an eval.
- **`design_check` completeness, one browser per call, contact sheets.** These
  change what a report means.
- **Prefix-remembered approvals, and studio tools for typecheck, install and
  still.** These are a decision about the permission model.
- **A warm CLI across turns, the ACP pool lifetime, the Codex sandbox network and
  its tool timeout.** Each needs a measurement from the real CLI first.
- **Exempting studio MCP tools on Copilot.** Nothing records how Copilot labels an
  MCP call in a permission request.
- **Sending the conventions once on ACP.** That belongs with the pool work.
