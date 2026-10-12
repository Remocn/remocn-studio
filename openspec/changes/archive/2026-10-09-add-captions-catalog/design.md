## Context

See proposal.md for motivation and scope. This crosses catalogue tooling, the sidebar and agent turn preparation, so a design is required.

Evidence inspected on 2026-10-08:

- The adjacent remocn checkout at `d6cd742fa4f3ab0a74fecf2ac93f1542fa2ea8f7` contains 31 caption style pages, registry artifacts, `caption-core` and matching example scenes. The examples mount the real components with timed fixtures. `CaptionBaseProps` requires `Caption[]`; `CaptionSpeaker` additionally accepts speaker metadata. `CaptionProsody` derives emphasis from word duration, not audio analysis.
- Studio's sync and preview scripts both pin `8ae853e4c08108105684d4b8cac7f22400840d2a`; their category list omits Captions. Replacing the whole pin would refresh unrelated source files while `add-shaders-to-video` is still in progress.
- `scripts/remocn-previews.ts` follows example imports but fetches every helper as `.tsx`. Caption examples import `caption-fixture.ts`; unchanged tooling cannot fetch that helper correctly. The manifest's `captions` default is a string for the example scene, not the `Caption[]` accepted by the registry component.
- `AssetItem` already shows a poster and a delayed, muted, looping clip in a larger hover card. `useComposer.pick` adds a positional asset reference; `usePickedAssets` deduplicates assets by slug. The composer accepts asset-only messages.
- `sidecar/library/insert.ts` copies bundled registry closures before a turn and reports existing files and missing packages. Its prompt trailer tells the agent to reuse copied code. Caption-specific context is not present.
- Bundled caption instructions describe local Whisper transcription, including a runtime support probe, but there is no transcription service in the sidecar. The generic display guide defaults to Basic Captions, which must not override an explicitly selected remocn style.

These are source observations, not a successful rendering or transcription run. Runtime verification remains an implementation task.

## Goals / Non-Goals

**Goals:** reuse bundled asset identities, placement, preview clips and turn orchestration; keep style selection independent of transcript availability; make the selected upstream component and transcript source unambiguous to the agent.

**Non-Goals:** introduce another turn type, transcript IPC, a caption object insertion runtime, an in-app transcript editor or a mandatory paid transcription account. Existing Inspect behaviour is retained; dedicated caption controls are outside this change.

## Decisions

### 1. Extend the shipped set with an independently pinned caption batch

Add the 31 caption entries and their transitive registry closure from the inspected remocn revision. Extend the vendoring script and lock provenance to record the caption revision separately from the existing bundle pin. Preserve existing entry bytes and hashes rather than regenerating all categories. Preview generation must resolve an entry's provenance rather than assuming a single global revision. Any shared target collision with different source bytes must be reported and resolved deliberately, never silently overwritten.

The catalogue remains ordinary assets with `type: component`, `category: Captions` and the existing bundled slug prefix. `caption-core` and other helper entries stay uncategorised and invisible. Caption styles carry no motion role: a whole transcript-driven renderer does not have one entry/emphasis/exit role. Update the classification contract and coverage tests to scope mandatory roles to the existing motion-component categories.

Alternative: bump the global pin and reclassify every new component. Rejected because the current source pins and active shader work show that it changes much more than the requested caption set. A separate library and asset type would duplicate a placement path already capable of carrying registry closures.

### 2. Render previews from upstream examples at build time

Use the example scene referenced by the upstream index, with its preview defaults and fixtures. Extend example dependency discovery to support `.ts` and `.tsx`, preserving extensions and distinguishing a missing file from another fetch failure. Do not feed the manifest's text default directly into the registry renderer or synthesize a second implementation in the webview.

Render a short representative clip and choose a poster frame with visible text after the fixture's lead-in. Require coverage of all 31 entries, including special speaker and keyword examples. Keep fixture files in preview tooling; only installable registry files enter user projects.

Reuse the existing hover-card interaction: delayed preview, muted loop, teardown on close and fallback to poster on playback failure. Keyboard focus must expose the same preview access; reduced-motion mode keeps the poster until explicit playback. If the shared card needs a small accessibility extension, verify existing Components cards with it. Pre-rendering avoids 31 live Remotion players and does not require project dependencies just to browse.

### 3. Reuse ordinary composer selection

Add `captions` after `shaders` to pane navigation, command registry and persisted view validation. Implement `CaptionsPane` with existing search and grid primitives; filter category membership in pure pane helpers and manage search with `useAssetSearch`. Keep the UI free of placement/transcription decisions. Exclude Captions from Components; retain the Shaders exclusion.

The existing library pick path calls `useComposer.pick`. Different styles coexist. Repeated selection references the existing asset attachment; it need not prohibit repeated textual references to the same numbered asset. Removal and reference renumbering retain the composer contract. Preserve draft text, focus the composer as ordinary component selection does, and respect existing locked-composer states. Browsing remains possible without speech media; adding is subject to the same project/chat availability as Components.

Direct insertion was considered. It requires a known speech source and valid timing data that the supplied registry components explicitly require, whereas the user can choose a style before either exists. A subgroup in Components would also impose an irrelevant motion-role taxonomy and make the new set harder to discover.

### 4. Carry a trusted caption brief with the normal asset placement

The sidecar resolves a selected bundled slug against its own manifest. Extend its internal placement result with the caption classification needed to build a scoped brief; do not infer caption behaviour from a display title or accept a client-supplied category as authority. Reuse the existing placement and turn wire shapes.

The brief identifies the selected style and copied files, instructs the agent to read their props and reuse them, and loads the bundled caption workflow. An asset-only message means apply the selected caption style to the current video's speech. With multiple styles, follow explicit assignments; ask in chat if assignment is ambiguous instead of stacking every style on the same speech.

Update the bundled caption guidance so an explicit selected remocn component takes precedence over the generic Basic Captions recommendation and online component discovery. Missing packages are reported through existing placement diagnostics, then installed by the agent subject to normal permissions. Existing authored files remain untouched by placement. If an existing `caption-core` or installed package is incompatible, the agent must explain and resolve compatibility before rendering; it must not overwrite it automatically or claim completion after a failed import.

### 5. Let the agent prepare and reuse source-bound transcripts

The workflow follows this order:

1. Read explicit source/scene references in the message; otherwise inspect the current video's speech media. A single unambiguous voiceover can be used. Multiple candidates trigger a question; absent speech triggers a request for media, not invented dialogue.
2. Look for an existing transcript and establish that it belongs to the source and has the timing granularity required by the chosen style. An explicitly supplied transcript can be validated and associated on first use. JSON/SRT already in the project can be referenced through existing file mentions; this change does not add subtitle files to media drag-and-drop support.
3. Without usable word timings, run a tested local transcription recipe inside the normal agent turn. Install the minimum probe dependencies through normal permissions and check WebGPU support before downloading a model; provide a tested local CPU recipe based on the supplied remocn documentation when GPU support is unavailable. Do not silently switch to a cloud provider. Language must come from known context or a user answer when the backend needs it.
4. Save the result and provenance before connecting the renderer. Use a source-relative `Caption[]` JSON file under the video's source directory, plus adjacent metadata with source path, SHA-256 of source bytes, selected audio track, timing origin, language and backend/model identity. A transcript of an extracted segment records that segment's start and end. This is an agent-authored project convention, not a new app database or IPC schema. Keep user-corrected text when the source remains valid.
5. Map source times to the actual clip's trim, playback rate and scene offset. Place the component as a readable overlay within the video's bounds. Keep original transcript times so alternate edits and styles can reuse them; do not retranscribe solely because layout, colour, style or clip placement changed.
6. Check rendering and representative synchronization points before reporting completion. Preview, Snapshot and Export consume saved data and the same installed component; they must not start transcription or fetch speech data at render time.

An ordinary line-timed SRT is suitable for phrase subtitles but cannot supply true word timings for Karaoke or Prosody. Obtain word timings from the source when needed; do not distribute sentence duration equally over words or use the preview fixture as a substitute. Speaker metadata and explicit keyword/emoji props are used when available; no new diarization system is introduced.

Exact backend versions and support on the project's macOS/Linux targets require recorded smoke results during implementation. The architecture does not promise that every machine can transcribe: unavailable local execution produces an actionable chat explanation, preserving the selected style and any valid transcript.

### 6. State, boundaries and failure ownership

| State or action | Owner | Existing boundary / failure direction |
| --- | --- | --- |
| Pinned sources, posters and clips | Build tooling and packaged resources | Deterministic sync/preview output; missing required assets fail catalogue build validation |
| Search, hover and draft selection | Webview hooks | Existing asset list and composer references; playback failure falls back to poster, listing failure shows retry |
| Remembered view | Webview preferences | Existing `paneView` persistence; unknown values fall back to Videos |
| Copy plan and caption brief | Sidecar | Existing asset placement and turn request; unknown bundle entries give a notice, filesystem failures use existing worded errors |
| Source choice, transcript and installation | Agent in the normal turn | Existing file/shell tools and permission cards; ambiguity asks in chat, denial/cancellation stops preparation without claiming success |
| Authored caption rendering | Project preview host and renderer | Existing preview/Snapshot/Export paths; render errors stay visible and prevent a success claim |

No new Rust command, MCP tool, preview-host frame or `shared/ipc.ts` method is needed. No `SIDECAR_PROTOCOL`/Rust `PROTOCOL` bump, SQLite history migration or new `settings.json` key is planned. Caption metadata stays internal to the sidecar until rendered into the existing textual turn context. New sidecar effects follow Effect error/cancellation/resource patterns; hooks execute effects. There is no new bare-Promise orchestration or detached background job.

Transcription failure is a failed caption operation reported in chat, not necessarily a transport-level failed turn. Other user requests can still complete. Interrupted preparation may leave reusable completed transcript files, but partial output must not replace a validated transcript. The agent uses temporary output and validates before publishing the final data.

## Risks / Trade-offs

- Local runtime support, model download size and language accuracy are unverified -> exercise a short recorded speech fixture on supported macOS/Linux targets, test unavailable-backend handling and keep cloud use explicit.
- Updating a shared registry dependency could break existing user code -> preserve copies, detect incompatible dependencies and test caption placement in both fresh and existing projects.
- Agent workflow is less deterministic than a dedicated service -> send a scoped brief, provide executable tested recipes, test prompt construction and perform end-to-end acceptance runs; unit tests alone cannot prove transcript quality.
- Stale transcripts can look plausible -> associate them with actual source bytes and timing origin; explicitly invalidate source changes while retaining user corrections to valid data.
- The current shader change overlaps navigation and role filtering -> preserve its runtime behaviour and reconcile delta requirement names before archive; do not modify its planning files as part of creating this change.
- Thirty-one clips increase bundle size -> record aggregate preview bytes and render duration during implementation; keep short clips and lazy playback instead of live players.

## Migration Plan

1. Add and validate the pinned caption batch and preview assets without changing existing component bytes.
2. Add internal caption brief preparation and bundled agent guidance; verify ordinary component turns retain their behaviour.
3. Expose the new pane through existing commands and preferences. Existing histories decode unchanged; old builds fall back from an unknown pane value.
4. Complete automated checks and running-app acceptance before release. Record a user-visible changeset.
5. Rollback removes catalogue exposure and brief generation; already-authored project caption code and saved transcripts remain usable and must not be deleted.

No unresolved product decision blocks implementation. Backend smoke results are a release verification gate, not an assumed success.

## Implementation notes

Studio-specific caption instructions live in `motion-design/rules/studio-captions.md`
and its sibling recipe/helper. The selected asset's scoped brief routes there
before the generic renderer recommendation. Upstream `remotion-best-practices`
files stay byte-identical: `skills:sync` replaces vendored trees, so placing custom
instructions there would lose them. This preserves selected-style precedence
without changing the upstream default for requests that select no style.

Preview mount indexes and example closures are resolved separately for each source
pin. Copied example-to-example imports become relative paths inside that pin's
folder, preventing a newer index or fixture from silently replacing an older one.

Integration navigation coverage uses the real shell in `app/page.test.tsx`,
including two caption references, repeated selection, draft retention and switching
through Components and Shaders. This is the ProjectsPane integration acceptance
originally listed as a separate `projects-pane.test.tsx`.
