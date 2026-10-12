## Context

See proposal.md for scope. The user approved the example-based approach and expanded it from three passages to all templates. The registry at remocn revision `7fa2db1cd29dfb36743e54e3d078dd9107c879a2` and the live `llms.txt` both list five: Order Flow, Workflow Console, Product Showcase, Brand Guidelines and Release Teaser. Live docs and the Workflow Console registry JSON returned HTTP 200 on 2026-09-14. Published display names differ from two retained registry IDs; X Ads MCP has been renamed to Workflow Console.

The existing motion skill already covers reference tracing, causal timing and proof review. In the September 11 remocn-template generation, the person still had to explain that an outer scene transition hid the template's text entry. That supports teaching combined attention and in-point selection through concrete examples, rather than adding another generic continuity rule.

## Goals / Non-Goals

Make every template discoverable by the motion problem it solves. Keep the main skill small and route into studies only when relevant. Scope and exclusions are in proposal.md.

## Decisions

- Put one index and five short studies under the owned `motion-design` skill. Each study gives source files, useful ranges, causal choreography, adaptation choices and a comparison symptom. A single long always-loaded catalog would obscure the decision process; separate new skills would add invocation overhead without a new task boundary.
- Keep executable source in the existing template registry. Prefer available local source, then the published registry JSON and docs. Read selected file contents rather than dumping embedded photographic data. Duplicating source/media into the skill would create another maintenance and shipping pipeline, outside this change. Studies carry a source revision and instruct agents to verify current code and discover new catalog entries.
- Keep explicit user references primary. Templates teach implementation and transferable staging; their sample branding and content do not become product requirements. A suitable full template can be reused, or a passage adapted. No fit is an acceptable recorded result.
- Carry selection and comparison into existing pipeline strings and skill-aware conventions. No additional stages, tool handlers or runtime enforcement. Free conventions retain their current contents.
- Knowledge delivery already copies the whole bundle when the Codex sidecar process starts. A running process needs restarting for these skill edits. No new state, IPC changes, history migrations or settings keys.

## Risks / Trade-offs

- Source/preview unavailability → state the limit and continue with inspected available material; no invented exports or playback claims.
- Content or format changes break a copied gesture → recompute geometry, timing and reading windows and inspect the real-content proof.
- Five templates become one house style → select by visual task, preserve the brief, and assign additional sources narrow roles.
- Better instructions do not establish better output → validate routing and sources now; evaluate creative improvement on the next generated video.

## Validation

Check all five studies against actual source files and clocks; verify Markdown links and live docs/registry endpoints; run existing knowledge, conventions and pipeline tests, formatting, type checking and the full suite once. Validate the OpenSpec change. Do not render a new film or change upstream templates in this task.

### Results — 2026-09-14

- All five current registry IDs have a study; all referenced source files exist. Checked 30 local Markdown links. All 15 published preview-page, Markdown-doc and registry-JSON URLs returned HTTP 200; the five published `motion.ts` files match the inspected local revision.
- Source review caught Order Flow's `t + 1.85` mapping for confirmation/closing; the study records it rather than treating its internal times as film time. Workflow Console's recommendation points to `scenes/responses.tsx` as well as its camera helper.
- Frontmatter parsed and validated with the installed YAML package. The Python validator could not run because PyYAML is absent; no global runtime packages were installed.
- Existing knowledge, provider bundle, conventions and pipeline tests: 82 passed. Full suite: 2867 passed, 11 skipped, 0 failed across 253 files. Skips are the existing DOM capability probes and real-renderer smoke fixtures.
- `bun run typecheck`, formatting/check of the two modified TypeScript files, `git diff --check` and strict OpenSpec validation passed.
- Repository-wide `bun run check` reports five existing accessibility/attribute-order/format findings in `src-tauri/assets/icon-options/original-icon.svg`. Verified that file is byte-for-byte identical to HEAD; it is outside this change.
- No creative-quality improvement is claimed from these checks. After restarting the development Studio process, a new generation should record the selected template passage and its adaptation in the Motion document. Judge its rendered movement against that source and note whether routine movement corrections still fall to the user. Installed release builds need these source changes included in a build before that comparison.
