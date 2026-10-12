## Context

See proposal.md for the motivation and scope of REM-724. This change needs a
design because insertion crosses the project document, authored React, package
installation, the preview protocol and Inspect.

Read-only evidence collected on 2026-10-06 on `feature/rem-724`:

| Observation | Evidence and consequence |
| --- | --- |
| 23 shipped Shaders entries; 19 Paper wrappers and 4 custom implementations | Counted `remocn/registry/*/manifest.json` by category and inspected imports. Coverage must not stop after the Paper subset. |
| Installed Paper packages are 0.0.78 | Read their local package manifests. The current Paper website supplies useful control ranges but cannot define compatibility for arbitrary project versions. |
| Managed values are number, string, boolean or a four-number easing tuple | `shared/studio-document.ts`; runtime v5 independently decodes drafts with Zod. A palette UI alone cannot save or preview a colour list. |
| Object operations are remove and restore; other operations edit existing fields | `shared/studio-document.ts`. Creation needs its own validation, idempotence and inverse. |
| A document record does not mount a component | `templates/remotion/video-template/index.tsx` explicitly renders Backdrop and two Heading components. Inserting records without a render host cannot work. |
| The template renders an opaque Backdrop before its headings | Placing a shader outside that tree does not establish a usable background position. An explicit slot after the base background does. |
| Scene reports contain runtime sequence IDs and intervals | `preview/scenes.ts` also drops some wrappers and single-scene results. Those navigation reports are not stable insertion addresses. |
| Library placement copies files and reports missing packages to the agent | `sidecar/library/insert.ts`; the Remotion template does not install Paper. Direct insertion needs dependency preparation. |
| Existing document writes atomically replace one JSON, not a group of files | `sidecar/projects/studio-document.ts`; its v5-to-v6 removal upgrade is narrowly scoped. It is not a general source migration or transaction service. |
| Runtime v6 wraps the v5 provider; v5 owns a private React context | A new provider cannot silently replace old hooks with a different context. Migration must account for all participating readers. |
| Bundled source is pinned and hash-checked | `scripts/remocn-sync.ts`, `remocn/lock.json`; ad hoc edits to synced files are not a durable metadata strategy. |

These are source observations, not runtime performance measurements. No shader
benchmark, insertion prototype or export proof was run during planning. The
first implementation milestone supplies that evidence before catalogue rollout.

## Goals / Non-Goals

**Goals:** add a finite, project-local shader insertion mechanism whose saved
instances are independently editable and whose rendering is ordinary Remotion
code. Make target identity, save confirmation and failure recovery explicit.

**Non-Goals:** replacing React with a scene interpreter, inferring arbitrary JSX
stacking, adding a general asset insertion framework, or building text effects.
The proposal contains the complete product exclusions.

## Decisions

### 1. A scene declares a shader slot in its React tree

Introduce a versioned `StudioShaderSlot` project component inside the scene,
after the base background and before foreground content. React still chooses
where it is mounted and owns scene scheduling and transitions. The slot renders
only supported shader records assigned to its permanent ID. Nested scene
transforms and transitions naturally apply to those children.

Each slot declares a permanent slot ID, scene object ID (or a reserved root
target), label, contract version and a scene-local duration derived from the
same values that schedule the scene. Runtime reports add current global range,
frame rate and generation. Declarations and source bindings are checked against
the video's project-local insertion manifest; a scene label or sequence ID is
never used as identity. Duplicate live occurrences of an insertion target are
unsupported until an explicit occurrence contract exists.

The runtime reports eligible targets through the managed preview transport. The
webview registers the decoded report with the sidecar, tied to the active
project/video and preview generation. The sidecar matches it to the prepared
manifest and source revision before accepting insertion. It invalidates reports
on rebuild, video changes and relevant document/source changes. During a first
adaptation it waits for a fresh target report before creating an instance.

The whole-video template gets one root slot. Structured multi-scene authoring
gets one slot per scene. A single eligible scene at the playhead is the default;
overlap requires a choice, and gaps offer no guessed target. A full-duration
instance is stored as following the scene end, not a frozen copy of its current
length. An explicitly trimmed interval uses scene-relative frame boundaries
`[start, end)`; shortening a scene past an explicit end requires correction and
must not silently rewrite timing.

Use scene-local time for the shader clock even when its display start is
trimmed: changing visibility does not restart the material. Static speed values
are supported here; animated speed integration and keyframes are outside scope.

**Alternatives:** repeated JSX insertion lacks a reliable address in current
code and makes each click another structural edit. A root overlay cannot place
itself between an opaque scene background and its content. A universal JSON
renderer would replace the architecture for much broader scope. These are
rejected from the concrete source observations above, not claimed benchmark wins.

### 2. Separate shader metadata from synced upstream files

Add a Studio-owned descriptor catalogue (`shared/shaders.ts` plus versioned
descriptor data) keyed by bundled slug and implementation revision. Include
control definitions, initial values, palette limits, simple declarative
availability conditions, dependencies, export symbol and supported adapter.
Conditions are validated data, not executable strings.

Use the existing bundled posters and clips. Keep Shaders as ordinary bundled
assets for existing references; category filtering changes presentation only.
The specialised catalogue and insert action do not change what an old asset
reference means. A coverage test enumerates every Shaders manifest and demands
an adapter/descriptor for each entry before the change is considered complete.

Copy the chosen implementation closure, descriptor snapshot and adapter into a
versioned project-local namespace. Rewrite local imports using the existing
placement conventions. Do not import Studio application modules into project
code or rewrite existing authored remocn files. A small generated import table
includes only prepared implementations; document data cannot request arbitrary
module paths. Reopening or upgrading Studio leaves existing snapshots intact.

The pinned upstream files remain read-only inputs. If an implementation needs a
source fix that an adapter cannot supply (readiness, resource disposal, etc.),
make a tracked upstream update and resync, or an explicitly versioned Studio
adapter implementation with provenance. Do not bypass `remocn:check` by editing
hashed files without an intentional sync strategy.

For Paper, verify compatibility against the installed project version before
reuse; prepare the tested version when absent. A conflicting direct dependency
is not silently upgraded or downgraded. Report the required resolution, retaining
the existing film. A package being present is not sufficient compatibility proof.

For image-capable shaders, support optional project-local image inputs through
the existing asset picker pattern, with readiness and containment validation.
Where no image is selected, use a supported procedural/full-frame default and
disable image-dependent controls with an explanation. No logo/text conversion,
remote URL import or general image-filter application flow is added.

### 3. Extend managed data deliberately, with a new runtime

Add a palette value (ordered validated colour strings), palette field bounds
and safe control-availability metadata. Keep the existing document version 1
for compatible scalar documents and increment affected definition versions;
new palette/creation structures require the new editing runtime and newer
Studio. Older applications must reject unsupported data rather than truncate it.
Palette bounds and equality are enforced by both the sidecar and runtime.

Introduce `studio-objects-v7` as the next versioned runtime with palette readers,
draft support and existing geometry/text/removal behaviour. Update native
managed transport integration and its loader explicitly; currently its source
matching is specific to v5. Do not overwrite v1-v6 files in user projects.

Compatibility adapters upgrade only recognised video-local provider and hook
imports together. Shared/external hook consumers or modified runtime sources
that cannot be proved compatible are refused, not left on mismatched React
contexts. New templates use v7 consistently. Existing unconverted videos keep
their previous editing path.

Each shader has a permanent object ID, parent scene identity, a versioned shader
definition and complete initial values. Use typed optional shader metadata on
the record for immutable slug/revision/slot identity; editable shader parameters,
opacity, timing and slot order live in fields. No opaque JSON string stores a
palette or substitutes for typed shader identity.

Creation carries the complete proposed object, the exact definition, target
contract preconditions and operation ID. Under the document lock, validate all
of them, then append the record/needed definition and receipt in one atomic JSON
replacement. Retry compares the complete canonical operation. A new intentional
click gets a fresh operation ID; Retry retains the old ID.

Undo deactivates the instance with an inverse linked to creation, reserving the
ID and retaining prepared resources. Validate the expected object state so an
external edit is not silently discarded. Property changes and removal continue
through the managed history. This requires creation-aware inverse and selection
logic, not routing every operation with a `kind` through remove/restore.

### 4. Preparation is a recoverable state machine, not a multi-file atomic claim

Proposed sidecar methods in `shared/ipc.ts`:

- `shader.list`: validated descriptors and catalogue availability.
- `shader.targets`: register/retrieve current decoded target capabilities tied
  to preview generation and source revision; no authority from labels alone.
- `shader.insert`: fixed project/video/target/shader and operation identity;
  stream preparation progress, return a saved snapshot and insertion receipt.
- `shader.insertionStatus`: reconcile an operation after a lost reply/restart.

Exact naming can follow existing IPC conventions during implementation; these
responsibilities remain separate. Existing `studio.patch` carries property
edits and checked creation inverses; arbitrary callers cannot bypass insertion
preparation by supplying an unchecked create operation.

State progression:

`validate -> prepare dependencies/files -> connect slot -> confirm capability
-> commit instance -> await preview -> complete`

Preflight all compatibility/source conditions before package installation or
source mutation. Keep a sidecar-owned persistent preparation journal under the
app data directory keyed by canonical project identity, video and operation ID.
It records intended resources, before/after hashes, phase and the eventual
document receipt. It does not store a second copy of the video's object state.
Serialize package-manager operations with the existing project install lane and
serialize document/source commit phases with the project lock; never hold the
document lock throughout a network install.

Prepare resources before activating imports or an instance. For controlled
multi-file source adaptation, stage changes and record a recoverable journal;
preview confirmation and Export remain gated through the commit. This is not
an atomic filesystem transaction. Rollback removes or restores only files still
matching this operation's hashes. A concurrently edited file is preserved and
the conflict is surfaced. Package-manager changes and reusable prepared files
can remain after cancellation; never remove shared dependencies as an Undo.

On restart, reconcile document operation receipts first. A committed instance
is returned rather than recreated. For uncommitted work, check resource/source
hashes and either safely resume preparation or explain a conflict. Cancellation
before commit creates no instance; cancellation racing a commit resolves to the
saved result with Undo. Preview failure after commit is reported as saved but
not displayed, with Retry preview or Undo. Do not repeat insertion to recover a
render failure.

Use Effect services, scoped subscriptions and fiber interruption for sidecar
and `lib/**` orchestration. Browser lifecycle work remains in React runtime
effects. No new timer/promise orchestration layer is needed in the sidecar.

### 5. Ownership, transport and UI completion

| Owner | State and boundary |
| --- | --- |
| Sidecar | Catalogue validation, prepared manifests/journal, dependency lane, latest checked target generation, creation and document receipts; IPC above and existing studio methods. |
| Project files | Authoritative object values/history, slot bindings and versioned renderer/descriptor snapshots. |
| Project runtime / preview host | Actual slot ranges and occurrences, temporary value overrides, mounted shader readiness and saved-operation acknowledgement; decoded managed preview messages. The host bundles the same files for rendering. |
| Webview hooks | Search, displayed target, pending operation ID, progress, retry state, selection and palette gestures. `useShaderInsertion` coordinates; `useManagedObjects` keeps existing property/Undo ownership. |
| Rust | Generic IPC transport, version parity and existing menu integration; no shader state or renderer. |

A runtime acknowledgement must identify project/video context, generation,
operation and the successfully mounted instance; a generic bundle-ready event
is insufficient. Match it before opening Inspect. Switching videos cancels
local selection effects while reconciliation remains bound to the original
request. Pending insertion joins the existing preview/save Export gate.

Palette editing uses a dedicated control and `useShaderPalette` gesture hook:
colour edits, add/remove, pointer reorder and keyboard reorder all publish
temporary values then commit once per completed gesture. UI entries carry stable
local IDs, so duplicate colours and reorder do not lose focus; only ordered
colour values are persisted. Conditional controls evaluate against current
drafts, retain inactive values and show why they are inactive.

Opacity/timing/order are instance controls; pattern transforms act inside the
frame-sized host. Paper adapters pass native pattern parameters. Custom adapters
must supply and verify supported pattern transforms separately instead of
advertising unused Paper props. All four custom implementations are included.

### 6. Rendering and GPU lifetime are acceptance work

The shader adapter uses scene-local frame/fps and a static saved speed to drive
time. Paper's autonomous animation is disabled. Trim start only gates display;
it does not reset the scene clock. Exact raster equality across GPU engines is
not promised, but animation time and saved settings must agree, and cross-engine
captures must be visually checked.

Every adapter awaits initialization and image processing before capture, draws
on direct seek, reports context/compilation errors and releases contexts,
textures, observers and pending render handles on unmount. Existing two-rAF
readiness wrappers are starting material, not proof that async image preparation
or every custom shader is capture-safe. Removed instances are unmounted by the
slot renderer, not merely CSS-hidden while consuming GPU resources.

Use prepared clips for the catalogue. Benchmark one and multiple active shaders
at representative resolutions in WebKit preview and Chromium export. Record
frame time, memory/context growth and initialization/capture results during the
implementation proof; tune quality budgets without changing time or parameters.

### 7. Compatibility and migration boundaries

The supported baseline is the format used by released Studio **1.0.0**. Read-only
inspection on 2026-10-07 of tag `v1.0.0` found a v6 managed template and no
creation-version field in scaffold metadata or the history video table. The table
records timestamps, which cannot establish a creating app version. Requiring the
new `studio-origin.json` from these videos therefore excludes the users this
migration is intended to serve. The earlier mandatory-provenance decision below
is superseded by this section.

Keep portable `studio-origin.json` (`version: 1`, `createdWithStudioVersion`) for
new videos. Never backfill historical provenance. Known versions below stable
1.0.0 remain unsupported for structural preparation; malformed metadata receives
a distinct error. Absent metadata selects structural compatibility analysis, not
an automatic refusal. A recognised runtime is compatibility evidence, never proof
of creation with a particular app version. Supporting unversioned 1.0.0-format
videos necessarily also allows an indistinguishable compatible older video; an
exact historical version cutoff cannot be enforced on those files.

The sidecar owns a read-only compatibility plan. Analyse the local import graph,
managed document and scene scheduling from source without executing arbitrary
project code in the sidecar. Recognise the original template and structured scene
components under Sequence, Series and TransitionSeries. Resolve supported timing
expressions and identify stable managed scene IDs. An AST-based adapter preserves
unrelated source; exact full-template string equality cannot remain the sole
adapter. Do not infer an insertion slot from a label, provider presence, or root
overlay. Unknown timing, ambiguous backgrounds, shared runtime consumers, repeated
scene occurrences or modified runtimes require explicit assisted preparation.

For each recognised scene, place a slot after its base background and before its
content within the scene's transforms and transition. Bind duration to the same
source as scene scheduling. Upgrade the video-local provider and all participating
hooks together without rewriting shared old runtime files. Preserve object IDs,
values, operations, audio, timing and all foreground markup. Hash all analysed
source dependencies, including timing and reader modules, into preparation
preconditions. Detect added/removed origin metadata as well as changed bytes:
absence must not silently become a known ineligible origin during preparation.
Revalidate conditions at activation, resume and commit; an already committed
receipt still wins recovery. Store preparation/contract state separately from
historical creation provenance.

Opening a video only analyses compatibility. The first Add gesture starts the
journalled automatic preparation with visible progress. Stage resources before
activating imports; wait for successful bundling and fresh runtime slot reports
with matching identities and intervals before committing an instance. Capture
representative baseline and prepared frames without a shader to verify that the
adapter preserves rendering, then verify shader placement and independent export.
Do not equate a successful compile with unchanged visual output. Subsequent
insertions reuse validated slots; errors and rollback follow section 4.

For structures outside deterministic adapters, Shaders exposes **Prepare video**
as a separate action. `useShaderInsertion` owns compatibility/preparation state;
ShadersPane presents its reason/action. Use the existing configured agent turn
and permission flow, scoped to the selected video and a source snapshot. Clicking
a shader never silently creates an agent turn. Preparation requests explicit scene
slots and coherent managed imports while preserving content and timing. Its result
passes the same source and preview capability checks; an agent's final message is
not verification. Track preparation writes and before/after bytes for recovery;
rollback preserves independent edits. No shader record is created until the person
subsequently selects a shader. Agent absence, cancellation and validation failure
remain visible, recoverable states. Known ineligible origins cannot use this path
to bypass the version rule.

The acceptance fixture must include a real finished multi-scene example matching
`discord-announce` (three Series scenes, local timing helpers and v6 hooks), plus
Sequence and overlapping TransitionSeries cases with opaque scene backgrounds.
Test copied fixtures; do not manually patch the user's original video to make the
migration appear successful. New templates and generation guidance keep emitting
slots and preserve their permanent identities.

The change bumps `SIDECAR_PROTOCOL` and Rust `PROTOCOL` together to 40, including
the explicit agent preparation request and its capability/status fields. Expand managed message decoders
on both sides for palettes, targets and acknowledgements. No SQLite history
migration is planned. The preparation journal is a versioned app-data file
format. No new `settings.json` key is planned: add `shaders` to `paneView`, retain
the current Projects view, and preserve unknown-view fallback. Shaders enters
the command registry/native View menu without a new shortcut.

## Risks / Trade-offs

- **Scene compatibility is narrower than all managed videos** -> publish a
  capability and reason; extend only with proven adapters, never guess stacking.
- **New data is not editable in older Studio versions** -> explicit runtime and
  definition versions, strict unsupported-format errors, no silent downgrade.
- **Source/package preparation is not fully atomic** -> journaling, staged
  activation, hash-checked recovery and no blind package rollback.
- **Agent writes race preparation** -> preconditions and final rereads; refuse
  conflicts. The app lock cannot exclude arbitrary external writers, so do not
  claim filesystem compare-and-swap against them.
- **Shared source consumers retain older contexts** -> refuse unsupported
  migrations instead of mixing v7 hooks with an old provider.
- **Opaque shaders cover earlier shaders** -> deterministic slot order and
  opacity controls; the foreground remains above the whole slot.
- **GPU/device differences** -> test actual WebKit and Chromium output; preserve
  the existing browser backend selection and fail capture on missing effects.
- **Website/package drift** -> descriptors validated against pinned code and
  snapshots shipped into each project, plus full-category coverage tests.

## Migration Plan

1. Add contracts and fixtures, then the preparation/runtime/Inspect path for
   Mesh Gradient. Demonstrate insertion, palette, persistence, Undo and export.
2. Preserve creation provenance for new videos; replace missing-origin refusal
   with structural compatibility analysis for existing 1.0.0-format videos.
   Demonstrate migration of an unmodified release fixture and a finished multi-scene
   video, Sequence and overlapping TransitionSeries, including unchanged baseline
   rendering, fresh capabilities, Inspect and export. Verify known-old/invalid
   metadata refusal, absent-origin races, source conflicts and assisted preparation.
3. Connect navigation and complete descriptors/adapters for all 23 shaders;
   run the readiness, seek and lifecycle matrix before declaring rollout ready.
4. Ship versioned runtime/resources and updated new-video generation guidance.
   Existing videos remain untouched until an explicit supported insertion.
5. Roll back a user's insertion with its inverse, retaining shared resources.
   A failed source adaptation restores only matching files. Downgrading Studio
   does not rewrite palette/creation documents into an older lossy format.

## Revision status — 2026-10-07

The missing-origin refusal is replaced with structural compatibility analysis.
Known pre-1.0.0/invalid metadata still refuses preparation. An absent origin is a
null/null no-op journal entry; preflight hashes include missing files, and
activation/resume/commit guard provenance changes without inventing a version.
Runtime files are also checked as preparation preconditions.

A source-graph/TypeScript AST adapter now recognises explicit local scene functions
under Sequence, Series and TransitionSeries. Supported timing expressions include
numeric constants, imported constant properties and arithmetic; explicit linear
or spring transition durations produce overlap targets. It preserves authored
source spans and adds a context-only scene scope plus a slot under the managed
scene root. Pure leading AbsoluteFill backgrounds are kept below the slot. Local
provider/hooks migrate together; read-only dependencies are bound into source
preconditions. Dynamic scheduling, reused scene components and external old-context
readers remain explicit automatic-adapter refusals. Agent-assisted preparation
(tasks 4.5/5.6) is now implemented as described below. The broader
transition/platform acceptance matrix remains pending.

The parser uses the existing TypeScript dependency. A sidecar build now contains
1508 modules and is 7.83 MB minified; the parser's size is a trade-off for analysing
source without executing project code in the sidecar. No new dependency, IPC
change, history migration or setting was introduced by this increment.

A one-shot Chromium proof used a **temporary copy** of the user's finished
`discord-announce`, its original v5/v6/motion runtimes, font and SVG assets, and the
same project-local v7/Mesh implementation used by insertion. The original project
was not modified. Analysis reported three scenes at 30 fps: announcement [0,75),
place [75,228), join [228,300). Frames 30, 100 and 250 rendered at 1920x1080 were
pixel-identical before and after automatic preparation without shader instances.
With a Mesh instance in each scene, over two million background pixels changed
per sampled frame and all 26,522 / 17,371 / 27,559 opaque white foreground pixels
were retained. The middle result was visually inspected. This proves copied-scene
preparation and Chromium still rendering, not WebKit click-through or encoded MP4.

- [Before preparation, frame 100](evidence/discord-before-100.png)
- [Prepared without shader, frame 100](evidence/discord-prepared-100.png)
- [Mesh below foreground, frame 100](evidence/discord-shader-100.png)

Validation: the full ordinary suite passed 3670 tests with 15 skipped and no
failures (38.86s); two additional provenance-race tests were then added and the focused UI/service
suite passed 98 tests. A subsequent local-runtime re-export regression failed,
was fixed, and the final adaptation/insertion run passed 36 tests. Typecheck, focused lint for eight affected source/test
files, and the sidecar build passed. The global lint still reports the pre-existing
exhaustive-dependencies diagnostic in `studio-shaders-v1/paper.tsx`; that immutable
copied runtime was not changed by this fix. Historical evidence below describes
the earlier slice and is not a claim that the full catalogue or acceptance matrix
is complete.

## Open Questions

- Final slider sensitivity and collapsed group defaults can be tuned against
  the completed Mesh Gradient flow without changing supported parameters.
- Hardware-specific quality budgets need measurements in the render proof;
  no playback frame-rate target is asserted from source inspection alone.

## Implementation evidence — 2026-10-06

The first implementation slice exposes Mesh Gradient only. The other 22 adapters,
optional images, generation diagnostics, structured transition proof and complete
platform/resource matrix remain outstanding; this is not the completed catalogue.
Text effects remain excluded. Completed task checkboxes describe implemented and
verified behavior, not planned coverage.

Historical implementation evidence (superseded policy): the mandatory
creation-version floor was implemented before the 2026-10-07 compatibility revision.
These tests describe that earlier implementation, not acceptance of the revised
requirements; missing-origin and multi-scene support still need implementation. Both standard and welcome-template
creation paths stamp `studio-origin.json` from the host Studio version (the bundled
app version for standalone execution). Existing video origins remain untouched;
unversioned existing videos are not backfilled. Structural adaptation validates
the semantic-version floor before dependency installation. A no-op journal edit
binds the original metadata bytes into the request's source revision and checks
them again at activation, resumed preparation and commit. Connected manifests do
not retain that provenance binding, so existing compatible slots keep working
without it. Failed resume preflight records a failed status rather than leaving
the operation indefinitely preparing. Journals predating the guard must establish
eligible provenance before continuing.

Verification of this increment: 122 tests passed across the provenance contract,
both scaffold paths, insertion service and agent instructions; typecheck and lint
for all 12 affected source/test files passed. Tests cover semantic-version edges,
unknown/invalid provenance, preserved creation versions, resumed journals,
metadata changes before preparation/activation/commit and connected slots without
provenance. This does not claim the remaining catalogue or WebKit proof complete.

The root path now includes strict descriptors and palettes, checked creation and
inverse operations, project-local runtime v7 and Mesh adapter, source/resource
preparation with a persistent journal, shader IPC (protocol 39 in TypeScript and
Rust), webview coordination, Shaders navigation and Inspect palette controls.
Palette rows have independent IDs including duplicate colors; keyboard and pointer
reordering commit once per gesture. Reset restores the creation defaults as one
undoable field operation. Generic document writes refuse unverified creation.

New videos have a root slot after Backdrop and before headings, an empty local
registry, and a source-bound manifest computed after stamping the video. The
existing-template adapter compares against the immutable v6 template copy, checks
v5/v6 runtime bytes and migrates provider/hooks together. Arbitrary authored JSX,
shared/external consumers, changed source hashes and authored resource collisions
remain refusals. Resource installation alone never migrates an existing film.

### Actual Chromium frame proof

`REMOCN_SHADER_RENDER=1 bun test sidecar/preview/shader-render.test.ts` passed on
macOS/Apple Silicon using the fixture's Remotion 4.0.520 renderer, Chromium with
`gl: "swangle"`, Paper 0.0.78 and the project-local v7/Mesh files. This is a
one-shot offscreen capture, not a running development server. A temporary project
resolves ordinary installed dependencies; no application runtime imports are
used by its video. The first browser launch was denied by the macOS sandbox; the
same test ran successfully with the authorized sandbox escalation.

At 320×180, 24 fps, frames 0, 72 and 149 produced actual shader pixels under a
green foreground marker. Frame 72 was captured again after out-of-order seeks
and its decoded RGB hash was identical. With speed 0, frames 0 and 149 had
identical decoded RGB hashes. All 15 pixel/determinism assertions passed. The
middle capture was visually inspected: the gradient fills the frame and the
green marker remains above it.

- [Beginning](evidence/mesh-start.png)
- [Middle](evidence/mesh-middle.png)
- [End](evidence/mesh-end.png)
- [Static at frame 149](evidence/mesh-static-end.png)

The original still-only test did not prove WebKit preview, encoded-video output, real UI insertion,
transition compositing, images, multiple live GPU contexts, GPU resource growth or
representative export resolutions. The adapter's initialization/context-loss and
unmount tests use mock GPU resources; those platform cases remain unchecked.

### UI and verification boundary

The native app inventory did not contain a running Remocn Studio. The user has
been asked to launch this branch for the WebKit insertion/Inspect/restart/export
proof. `CLAUDE.md` reserves dev-server startup for the user. Do not treat the
Chromium frame proof as satisfying tasks 5.4, 5.5 or 7.3, or roll out the remaining
adapters before the required first-flow proof.

The first full suite found a new Composer rerender regression from an unstable
hook result, plus an app-shell timeout. The hook result is now memoized. The
focused shell/Composer rerun passed all 92 tests. `bun run build` completed the
Next static export. `bun run remocn:check` verified the unchanged pinned resources
at `8ae853e4c081`. OpenSpec strict validation passed. Final lint/type/test results
are recorded below after completion.

Final verification for this slice: `bun run fix` succeeded; the subsequent
`bun run check` and `bun run typecheck` succeeded. The last full `bun run test`
reported 3,627 passed, 15 skipped, one failure and one timeout error across 335
files. The remaining failure is `app shell > opens video creation from the
sidebar`, which exceeded the suite's 15-second timeout (15.7 seconds when rerun
without a concurrent build/typecheck). Its focused shell/Composer run passed,
but this is not a clean full-suite result. The Composer rerender failure no
longer occurs. Runtime-gated suites remain skipped in the ordinary test command;
the explicit Chromium shader capture above was run separately and passed.
Generation guidance now describes v7 context boundaries and preserving shader
records/source bindings; shader-specific design-check diagnostics still remain
part of unchecked task 7.1. The full catalogue is still unfinished. The subsequent changeset describes the
implemented Mesh Gradient and compatibility/preparation paths only.


## Assisted preparation and verification — 2026-10-07, current

Tasks 3.7, 4.5 and 5.6 are implemented. Shaders offers a separate Prepare video
button only when structural analysis fails and provenance/document checks permit
preparation. The action opens a fresh chat with the selected provider, model,
mode and normal permission gate. Shader cards never start an agent. Missing
origin is accepted; recorded old/invalid origin does not receive an agent bypass.
For the original `studio-launch-final/src/videos/discord-announce`, a final read-only
check still plans announcement [0,75), place [75,228), join [228,300), without an
origin write. No original user project was edited for this proof.

Preparation copies source, public assets, project configuration and root agent
instructions to an app-data working directory. Installed node_modules is reused
through a link; dependencies are outside the authorized edit scope. The agent
may change only this video's source; existing studio.json and origin bytes must
remain unchanged. Deterministic adapters can finish connecting the agent's
normalized source, or explicit authored slots can be validated. Source bindings
are completed from the local import graph. The project-owned Remotion bundler
compiles the copy before activation. Because that bundler has no cancellation
API, cancellation waits for it to release the copy before cleanup and is observed
before activation.

A persistent journal captures before/after bytes before activation. The entire
analysed source revision is checked under the project writer lock, with additional
per-file checks before writes. Independent editor writes are preserved during
recovery; this is not an OS-level compare-and-swap. Interrupted working copies are
cleaned on recovery. Versioned shared resources stay installed after rollback.
An agent failure, partial edit, cancelled turn, invalid source, compile failure or
missing live preview acknowledgement cannot create a shader instance. The UI
blocks insertion/Export while preparation is active and offers retry on failure.
A matching checked live scene report is required to finish. Temporary SDK resume
tokens are neither saved nor returned to the original-project chat; its transcript
is retained. Protocol 40 requires the native core and sidecar to be rebuilt/restarted
together, rather than restarting only the helper under a protocol-39 core.

Coverage now includes sidecar handler routing and provenance refusal; a failed
configured provider; isolated turn context/history; stale source, out-of-scope
writes and changed Inspect values; cancellation; compile/preview failures;
conflict-preserving rollback; interrupted activation recovery; matching/stale live
reports; explicit UI action, double-click prevention, retries and scope switching.
The optional integration test also compiled a real prepared project with
Remotion 4.0.520 before activation (not a mocked compiler).

### Encoded export proof

On macOS arm64, Remotion 4.0.520 and Chromium with `gl: swangle`, the shader test
now independently exports H.264 MP4 from project-local code. All 25 assertions pass:
320×180 at 24 fps; exactly 150 decoded frames; a 6.25-second video stream;
representative start/middle/end frames, repeatable out-of-order seeks and speed-zero
freezing; decoded frame 72 within mean RGB error 4 of its still capture, with the
green foreground preserved. The container metadata includes slight mux padding,
so duration is checked alongside the decoded frame count. The decoded middle
frame was also visually inspected. This is software-rendered Chromium evidence,
not WebKit, transition, image-input, GPU-growth or full-resolution acceptance.

- [Standalone MP4](evidence/mesh-export.mp4)
- [Decoded middle frame](evidence/mesh-export-middle.png)

### Latest checks (supersede older slice results above)

- `bun run fix`, `bun run check`, `bun run typecheck`: pass. The imperative redraw
  dependency rule has a narrowly documented Biome override for the immutable
  `studio-shaders-v1/paper.tsx`; existing copied runtime bytes were preserved.
- `bun run test`: **3690 passed, 16 skipped, 0 failed**, 10701 assertions across
  339 files. Gated render/bundle tests are not counted as run by this command.
- Final focused preparation/handler/turn/hook/pane/IPC run with
  `REMOCN_SHADER_RENDER=1`: **81 passed**, including the real bundler check.
- Explicit shader renderer run: **1 passed, 25 assertions**, including MP4 decode.
- `bun run sidecar:build`: pass, 1510 modules, 7.85 MB bundled output.
- `.changeset/odd-candies-smoke.md` was created through `bun run changeset --empty`
  and filled with the implemented feature and compatibility limits.

The native app was not available in the computer-use inventory. Live WebKit
insertion/Inspect/palette/restart/Undo and the remaining acceptance matrix are
still unverified. The existing instruction reserves dev-server startup for the
user. Tasks 5.4, 5.5, 5.7 and 7.3 remain unchecked; remaining shader adapters must
wait for the first complete UI flow required by this migration plan. This is not
a completion or release-readiness claim for the entire 23-shader change.


### Preparation repair loop (2026-10-07)

The failed `x-anounce-brand` preparation exposed two independent requirements:
expanding a dynamic schedule is insufficient when each scene still returns a
custom `SceneRoot`, and post-turn validation must feed its diagnosis back to the
agent. Preparation now specifies the direct Remotion `AbsoluteFill`, local
literal managed scene binding, static sequence timing and preservation rules.
Root diagnostics identify the source file, component and unsupported wrapper.

A single explicit Prepare action permits three total attempts in the same copy
and Studio chat, with numbered progress and a recorded repair prompt containing
the last structural/compiler diagnostic. Each attempt uses the selected provider
and normal tool/permission flow. It starts a fresh provider session against the
retained working copy; temporary SDK session IDs are still not persisted. The
connector snapshots only the files it can change and restores them on validation
failure, so a compiler error does not leave generated v7 imports or stale source
hashes in the next agent attempt. Agent-authored edits survive this reset.
Scope/metadata violations, provider failures, cancellation, activation conflicts
and live-preview failures remain terminal. No failed attempt touches the original.

Verification replayed the original agent's schedule-only edit on a temporary copy
of `studio-launch-final`, then applied the wrapper expansion through the second
agent callback. The real project Remotion bundle passed; four stable scene slots
were saved, no shader instances were added, and a before/after project source
snapshot confirmed the original was unchanged. The callback was deterministic
and simulated the agent's edits: this proves the service/validation/activation
path, not live model compliance or WebKit preview. The compiler emitted a harmless
cache-write permission warning for the shared node_modules cache; compilation
completed. The isolated copy was removed after verification.

Focused tests with `REMOCN_SHADER_RENDER=1`: 48 passed, including real bundling,
SceneRoot rejection/repair, compiler cleanup/repair, three-attempt exhaustion,
repair cancellation and handler/provider/transcript feedback routing. Repository
lint and both TypeScript checks pass. No IPC contract changed in this fix.

Final full-suite verification: `bun run test` passed **3695 tests, 16 skipped,
0 failures**, 10759 assertions across 339 files (36.38 seconds). The first run,
concurrent with lint/typecheck, timed out in `app/page.test.tsx` and caused a
second failure in that file; the isolated file passed 37 tests, then the normal
full command passed without other checks running concurrently. OpenSpec strict
validation and `git diff --check` also pass. Task 4.6 is complete; overall change
progress is 23/43, with the earlier full-catalogue and WebKit gaps unchanged.

### Preparation sidebar polish

The preparation block owns sidebar guidance while offered, running or failed.
During work it replaces the scene-selection hint, unavailable reason and disabled
button with one 48px-minimum-height status: Preparing video, Checking video or
Connecting shaders, plus a short chat hint. The existing spinner is decorative
inside a single status live region and respects reduced motion. Internal attempt
diagnostics remain in the preparation chat. Failure uses a short alert and native
closed details with a bounded scroll area, alongside the existing retry action.
Idle preparation and failure actions use 40px minimum hit areas. Ready state
returns to normal scene guidance without a redundant success paragraph.

Pane and insertion-hook tests: 19 passed, including each active phase, duplicate
suppression, disabled shader cards, collapsed errors and ready-state transition.
This is a focused presentation change; no preparation or insertion protocol changed.

### Full catalogue expansion (2026-10-07)

The user confirmed the preparation/insertion flow works in their running app and
explicitly requested catalogue expansion. This supersedes the earlier decision
to hold remaining adapters. It does not establish the entire manual acceptance
matrix: tasks 5.4, 5.5, 5.7 and 7.3 remain unchecked.

The catalogue now contains all 23 shipped Shaders entries: 19 Paper shaders pinned
to 0.0.78, plus Caustics, Strata, Weave and Light Tunnel. New immutable adapter
files and descriptor snapshots extend `studio-shaders-v1`; existing Mesh Gradient
and shared Paper mount bytes remain unchanged. Each insertion copies only its
adapter and required helpers, alongside the original bundled source. A coverage
test compares the category, descriptor snapshots and transitive local imports and
rejects conflicting shared resource hashes. A service test inserts Mesh, Perlin,
Water, Caustics and Light Tunnel into one video, preserving earlier objects and
the existing Mesh adapter.

Paper fields reflect the pinned uniform APIs, palette limits, shapes, integer
parameters and fractional ranges. Defaults combine package defaults with the
bundled neutral wrapper defaults. Dependent fields retain their values and explain
when unavailable. Custom shader controls match their actual APIs; explicit Studio
authoring bounds and pattern-coordinate transforms are recorded in the copied
`catalog-v1.md`. Light Tunnel preserves the original two-pass field/halftone
renderer. All adapters use the scene's frame/fps clock and release GPU resources
on unmount. Internal noise and empty image textures decode before mounting, with
a capture gate held until the child canvas has established its own draw gate.

Water, Gem Smoke and Liquid Metal expose procedural modes. Optional project image
inputs are still task 6.5 and are not claimed as delivered by this expansion.

Verification:

- Focused descriptors, adapter bindings, texture readiness/failure/unmount,
  Paper lifecycle, Light Tunnel lifecycle and resource coverage: 84 passed.
- Shader insertion service: 28 passed, including mixed Paper/custom insertion.
- Explicit `REMOCN_SHADER_CATALOG_RENDER=1` capture: 23 shaders × 5 frames,
  414 assertions, passed in 40.66 seconds using macOS Chromium/SwANGLE. For each
  shader, frames 72, 0 and 72 again at 24 fps prove repeatability and motion;
  frames 149 and 0 at speed zero match exactly. Every capture preserves the
  foreground marker, replaces the background and has spatial color variation.
  The temporary project is built from actual resource plans and imports only
  copied project runtimes and package dependencies.
- Inspected the complete rendered contact sheet, including both passes of Light
  Tunnel and procedural Water/Gem Smoke/Liquid Metal. Captures are available at
  `/tmp/remocn-shader-catalog-captures/catalogue.png` on the verification host.
- `bun run remocn:check` confirms unchanged bundled source at `8ae853e4c081`.

The new render matrix tests still capture, not an MP4 for each new shader. The
earlier Mesh MP4 proof remains applicable to Mesh only. Native WebKit testing of
all new adapters and repeated GPU add/remove measurements remain task 7.3.

Repository checks after expansion: `bun run fix` and `bun run check` pass across
1188 files; both TypeScript projects, strict OpenSpec validation and
`git diff --check` pass. `bun run sidecar:build` also passes with the expanded
catalogue bundled. Full `bun run test` ran twice: each run had 3766 passes,
17 skips and one timeout in the existing `app shell > opens video creation from
the sidebar` test (with a subsequent asynchronous error from that timeout).
Running `app/page.test.tsx` alone passed all 37 tests; the affected test took
12.44 seconds, close to the suite's 15-second limit. This is not a green full-suite
claim, and the timeout was not hidden by increasing test limits or skipping it.
No shader test failed. Catalogue tasks 6.3, 6.4 and 6.6 are complete (26/43 total).
The sequential isolated full run also finished with 3766 passes, 17 skips and
the same one timeout, so the failure is not confined to parallel workers.

### Native WebKit precision correction (2026-10-08)

The user's trace was reproduced in a standalone macOS WKWebView with Paper
0.0.78 and the actual custom fragment sources. All three failed with
`Precisions of uniform 'u_resolution' differ between VERTEX and FRAGMENT shaders`,
followed by the same invalid WebGLProgram/getAttribLocation exception. The latter
is secondary: Paper proceeds to attribute setup after its program failed linking.

Paper's vertex shader defaults to mediump while the custom fragments default to
highp. Paper promotes both stages on GPUs reporting medium-float precision below
23 bits. This WebKit reports 23, so it keeps the conflicting declarations. Matching
only the shared uniform declarations fixes the link; global fragment arithmetic
remains highp. The earlier Chromium/SwANGLE render check did not expose this.

`shader-precision-loader.cjs` runs only in native preview on the three known v1
fragment module paths. It explicitly qualifies u_resolution, u_rotation and
u_scale as mediump, matching Paper's vertex interface. Paper's existing promotion
then still aligns both stages on lower-precision GPUs. The loader leaves explicit
qualifiers and other uniforms alone. New and already-copied runtimes use it without
resource replacement, descriptor revisions, source-hash changes or saved-value
migration. Export keeps the original project implementation. The loader is also
included in the packaged Tauri resources.

Verification: the original minimal WKWebView program failed for all three; the
qualifier-only candidate linked all three with no console errors. The permanent
`REMOCN_SHADER_WEBKIT=1 bun test --isolate sidecar/preview/shader-webkit.test.ts`
fixture then rendered the actual React adapters/PaperCanvas at frame 72/24 fps,
read their pixels and checked nonuniform output. It passed on native WebKit.
The test uses the same loader and cleans up its temporary browser bundle; the
standalone native runner uses an ephemeral website data store. A first attempt
at this larger fixture timed out because the inline JS bundle contained HTML
script delimiters; loading its separate bundle.js fixed the test harness.

The resource preflight for all 23 shaders passed against studio-launch-final.
Its saved Caustics files match the tested runtime. No user project files were
modified. This establishes a native frame-render proof for these three shaders,
not the remaining interactive/native acceptance matrix in task 7.3.

Final verification: 97 focused runtime/insertion/native compiler tests passed;
the added packaging assertion and precision/native subset passed 24 tests.
The gated real WebKit capture passed in 5.77 seconds. Repository lint, both
TypeScript projects, sidecar build, strict OpenSpec validation and diff whitespace
checks pass. The unrelated full-suite New video timeout recorded above was not
retested or reclassified by this focused fix.


## Successive insertion after preview rebuilds (2026-10-08)

A deterministic service regression reproduced the reported “The target scene
changed. Refresh the preview before adding a shader.” after a successful first
insertion. It holds an old preview report inside source planning, confirms the
new preview, then releases the old report before inserting Perlin Noise after
Mesh Gradient. Both an old empty report and an old validation failure cleared
the sidecar target map; a valid old report could replace its generation. The
webview already discarded old RPC responses, leaving the displayed target and
the sidecar's insertion preflight inconsistent.

The service now orders publishing reports per canonical project/video scope.
Older completions and errors cannot overwrite newer reports; explicit
invalidation also retires in-flight reports. Read-only capability queries do
not supersede a pending report. Source, scene, timing and generation checks
remain in place. The webview clears actionable targets during refresh, including
the gap between render acknowledgement and capability confirmation.

Retry refreshes an unstarted operation only after status confirmed there is no
journal or saved result. It retains operation/object IDs and requires the same
scene, slot and timing. Journaled and uncertain requests retain their original
payload for recovery. User project files and copied runtimes are unchanged.

The regression failed before the fix with the exact reported error and passes
afterward. Hook tests cover clicking after the first render acknowledgement but
before the refreshed target returns, a second independent instance, refreshing
an unstarted retry and preserving a journaled retry across a generation change.
Interactive verification in the user's running Studio remains separate; no dev
server was started.

Verification: 52 focused hook/service/pane tests passed, followed by all three
out-of-order report variants (including the added valid-old-report case).
Both TypeScript projects, repository lint (1191 files), sidecar build, strict
OpenSpec validation and tracked diff whitespace checks passed. Existing
ScrollArea act warnings were emitted by pane tests without failures. The full
suite and native interactive acceptance matrix were not rerun for this fix.


## GPU-backed export precision parity (2026-10-08)

The original precision correction above applied only to native preview. Its
software Chromium proof did not cover Studio's macOS default, Chromium ANGLE.
`REMOCN_SHADER_EXPORT=1 bun test --isolate sidecar/preview/shader-export.test.ts`
reproduced the user's exact `getAttribLocation` WebGLProgram error in 4.38 seconds.
Browser logs identified all three custom fragments' `u_resolution` precision
mismatch immediately before the error. This uses project-local adapter copies,
Remotion's real renderMedia, and the production renderOnly compiler override.
The initial sandbox run could not launch Chromium (macOS Mach port permission);
the native browser test ran with approved elevation. No dev server was started.

The narrow fragment rule now lives in bundling.ts and is used by both nativeConfig
and renderOnly. The host passes the shipped preview resource directory to the
render compiler, retaining the already packaged compatibility loader. This
supersedes the earlier decision to leave export compilation unchanged. Project
source, resource hashes, authored shader settings, GPU selection and math precision
remain unchanged. Only the existing three known v1 fragment interfaces are matched.

After the change, the same fixture exported six-frame H.264 files at 960x180/24fps
on both `angle` and `swangle` in 7.14 seconds with no browser errors. FFmpeg decoded
all six frames in each file; spatial samples from each of the three shader panels
contained more than five colors. The decoded ANGLE frame was visually inspected:
Caustics ripples, Strata bands and Weave lines are visible with the dark defaults.
Temporary review captures are under `/tmp/remocn-shader-export-check` and are not
project resources. The fixture cleans its working copy and can optionally retain
captures through REMOCN_SHADER_CAPTURE_DIR.

73 focused compiler, native, precision, browser-policy and export tests passed,
as did both TypeScript projects. This is a real encoded-output regression proof
for the reported failure; it does not claim the entire user video or the remaining
interactive acceptance matrix was exercised.


## Full user-project copy audit (2026-10-08)

At the user's request, all 13 videos from studio-launch-final were copied with
source, media and installed dependencies. Results are retained outside version
control in `artifacts/shader-video-audit-2026-10-08/`: README, HTML players, original
and inserted PNGs, decoded frames, MP4s, JSON measurements and the one-shot test
harness. No development server was started. Chromium GPU access was approved for
the batch. The TypeScript project now excludes this generated artifacts directory,
matching the repository's existing Git and Biome exclusions.

All 23 catalogue shaders were distributed across the copies: two independent
insertions in ten videos and one in three videos. Insertion used the real
makeShaderInsertions service, resource checks, journal and source manifests.
A compiler-only probe transport captured actual slot and shader.ready messages
from the project's v7 runtime during renderStill; target generation, source
revision, scene bounds and saved objects were validated by the real service.
This bypasses native UI clicks but does not fabricate target reports.

Five videos already had slots; studio-github-launch, studio-timer and test used
automatic connection. Five required explicit copy-only preparation:
studio-launch-final, x-anounce-brand, x-anounce-describe, x-anounce-library and
x-anounce-pipeline. Their dynamic scheduling/SceneRoot wrappers remain outside
automatic adaptation. Local hooks/providers were upgraded coherently and a
manifest-bound first-scene slot was inserted without flattening their timelines.
This is not evidence that agent-assisted preparation or automatic migration of
all five works without intervention.

The first studio-launch-final slot was outside OldTv and was visually occluded
by its black background: shader.ready succeeded but pixel difference was zero.
The slot was moved inside OldTv, above that background and below scene content.
The empty prepared scene still matched the original frame exactly; Dot Orbit
and Gem Smoke then each visibly changed the frame. The entire 1685-frame film
was re-exported. Both the initial occluded render and its correction are retained.

Final outcome: 13/13 full MP4 exports at 1920x1080/30fps on Chromium ANGLE,
23/23 ready acknowledgements and positive control-frame differences, no browser
render errors. Independent system FFmpeg decoded all 6029 frames with exact
per-video counts; all encoded frame-30 comparisons were within mean absolute
RGB error 2.483/255 of the corresponding pre-encode PNG. The contact sheet of
all 13 decoded samples was visually inspected. Every pre-insertion resource
connection and explicit empty preparation comparison had zero pixel difference.
All final documents and source manifests validated. SHA-256 checks of all 482
original source/config/media files were unchanged.

Scope limits: first-scene insertions, default shader parameters and frame-30
visual comparisons; full-length decoding catches damaged/missing encoded frames
but does not establish visual correctness at every instant. Native Inspect,
Undo, interactive overlap selection and long-running GPU growth remain outside
this batch and their open tasks remain open. In the UI-heavy describe scene,
the background shader is visible only in small exposed areas, as expected from
the existing opaque panels. No original project files were changed, and no
application shader behavior was modified during this audit.

## Descriptor formatting collision (2026-10-08)

Dot Orbit insertion in `remocn-october-update` reproduced the reported authored
resource error. The existing descriptor was the shipped template's 4419-byte
JSON; the insertion plan serialized the decoded descriptor as 4499 bytes. Their
parsed data was identical. Raw file hashing falsely treated object-key order
and whitespace differences as authored changes. The original `studio-launch-final`
and its render-audit copy already used the serialized form and did not reproduce
this collision.

Resource preflight now accepts equivalent JSON only at the selected descriptor's
exact path. Runtime source files still require exact bytes. Descriptor values,
unknown properties and array order must match; invalid JSON remains a conflict.
The checked plan retains the existing descriptor's content and byte hash, and
insertion passes that plan into the journal. No project file is reformatted or
overwritten. Journal preparation, activation and restart recovery keep their
existing exact-byte checks, including edits made after preflight.

Regression tests first reproduced the error with shipped template descriptors,
then passed after the fix: all 22 non-Mesh template descriptors, real Dot Orbit
insertion after an interrupted dependency step, a second insertion, unchanged
file bytes, changed defaults/revisions/properties/array order, invalid JSON and
concurrent reformatting. The focused resource/insertion/scaffold suites passed
79 tests; typecheck, repository lint, sidecar build and strict OpenSpec validation
passed. Read-only resource preflight passed for all 23 shaders in both
`remocn-october-update` and `studio-launch-final`. This verification covers the
insertion service, not another native UI or video-render run.
