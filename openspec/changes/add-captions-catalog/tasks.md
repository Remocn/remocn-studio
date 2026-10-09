## 1. Catalogue contract and pinned sources

- [x] 1.1 Record the exact 31 caption style IDs and registry dependency closure from remocn revision `d6cd742fa4f3ab0a74fecf2ac93f1542fa2ea8f7`; verify category coverage and ordinary `Asset`/`PromptAsset` round trips in `sidecar/library/bundled.test.ts` and `shared/library.test.ts`, including hidden helpers and nullable caption roles.
- [x] 1.2 Extend `scripts/remocn-sync.ts` and lock provenance for a separately pinned caption batch, preserving existing component source bytes and rejecting conflicting target files; verify reproducibility, preserved old hashes and collision diagnostics in `scripts/remocn-sync.test.ts`.
- [x] 1.3 Import the caption registry artifacts and transitive dependencies into the shipped bundle; verify 31 selectable captions, closure completeness and no helper cards in `sidecar/library/bundled.test.ts`. Update role coverage in `sidecar/library/roles.test.ts` so existing motion entries retain their roles while captions carry none.

## 2. Preview assets

- [x] 2.1 Extend `scripts/remocn-previews.ts` to resolve each entry's source pin and both `.ts` and `.tsx` example helpers; verify `caption-fixture.ts` resolution, preserved extensions, example-scene mounting and fetch failures in `scripts/remocn-previews.test.ts`.
- [ ] 2.2 Generate all 31 posters and clips using the upstream examples, selecting poster frames after the text lead-in; verify nonempty output and catalogue coverage in `sidecar/library/bundled.test.ts`, inspect a contact sheet and representative clips, and record aggregate bundle bytes and render duration in this change's evidence.

## 3. Sidecar placement and agent context

- [x] 3.1 Resolve caption classification from the trusted bundled manifest and carry it only in internal placement metadata; verify copied closure, preserved existing files, missing packages, unknown slugs and absence of preview fixtures in `sidecar/library/insert.test.ts`. Keep existing IPC and history payload shapes unchanged.
- [x] 3.2 Add the scoped caption brief to normal turn preparation, including selected-style precedence, asset-only intent and explicit source/style assignment; verify caption and ordinary-component requests in `sidecar/library/insert.test.ts`, `sidecar/agent/instructions.test.ts` and `sidecar/agent/turn.test.ts`.
- [ ] 3.3 Route selected styles through Studio-owned bundled caption guidance ahead of the generic display default to use the selected remocn renderer, preserve transcript corrections, check source identity, distinguish line and word timings, map trims/rate/offsets and report failures; verify bundled guidance routing in `sidecar/agent/instructions.test.ts` and record an acceptance transcript proving Basic Captions does not replace the chosen style.

## 4. Local transcription recipes and project data

- [ ] 4.1 Supply and exercise a local WebGPU recipe with a support probe and a CPU fallback grounded in the supplied remocn documentation. Add `sidecar/agent/captions.test.ts` for recipe/data validation where executable helpers exist; record real short-speech transcription results, dependency versions and unavailable-backend behaviour for supported macOS/Linux targets in this change's evidence. Do not treat prompt-string assertions as proof of successful transcription.
- [ ] 4.2 Document and verify the project-local transcript/provenance convention, validation and temporary-output publication; cover source bytes changing at the same path, audio-track identity, segment timing origin, corrected transcript reuse and cancelled preparation in `sidecar/agent/captions.test.ts` for executable helpers and an agent acceptance run for instruction-driven behaviour.
- [ ] 4.3 Build a caption rendering acceptance fixture with saved word timings, a trimmed/rate-adjusted clip and a later scene offset; verify representative frames and no render-time transcription in `sidecar/preview/caption-render.test.ts`, including a failed-render case and Preview/Snapshot/Export consistency.

## 5. Navigation, hooks and composer

- [x] 5.1 Add Captions after Shaders to the pane model and category filtering, preserving current shader behaviour; verify view validation, ordering and both category exclusions in `lib/studio/pane-view.test.ts`. Use `usePanes` for navigation/restoration and verify saved/unknown values in `hooks/use-panes.test.tsx` and `lib/studio/settings.test.ts`.
- [x] 5.2 Add the Captions command through `useCommands` and `usePanes`, without a new shortcut; verify navigation/check state in `hooks/use-commands.test.tsx`. Confirm that the native View menu consumes the same registry and that no new Rust command or protocol bump is introduced.
- [x] 5.3 Wire caption selection through `useLibrary`, `useComposer` and `usePickedAssets`; verify draft preservation, distinct styles, repeated-pick attachment deduplication, removal/renumbering, asset-only Send and locked-composer behaviour in `hooks/use-library.test.tsx`, `hooks/use-composer.test.tsx` and `components/studio/composer.test.tsx`. Assert that card selection itself performs no placement or transcription.

## 6. Caption pane and preview interaction

- [x] 6.1 Implement `CaptionsPane` with `useAssetSearch`, existing pane/grid primitives and pure category filtering; verify all 31 titles, search, empty/loading/error/retry states, no role groups and no Delete action in `components/studio/captions-pane.test.tsx`. Keep behavioural decisions in hooks and pure helpers.
- [x] 6.2 Connect the pane to `ProjectsPane` through `useLibrary` and `usePanes`; verify selecting captions and switching among Captions, Components and Shaders in `app/page.test.tsx` and retain existing Components/Shaders pane tests.
- [x] 6.3 Reuse the shared clip preview and `useClipFallback` in `hooks/use-hover-clip.ts`; add only the focus/reduced-motion controls it lacks through a dedicated preview hook if needed. Verify delayed hover/focus, close cleanup, muted looping, failed playback and explicit playback under reduced motion in `components/studio/asset-grid.test.tsx` and `hooks/use-hover-clip.test.tsx`; verify existing component cards remain usable.

## 7. Integration, release and verification

- [ ] 7.1 In the user's running app, verify browse/search/hover/focus, two style references and repeated selection, draft preservation, navigation restoration, reduced-motion playback and failure fallback. Record observations in this change's evidence; do not start a development server.
- [ ] 7.2 Run an end-to-end agent request with real speech and no transcript; then switch styles after correcting a word and confirm no second transcription. Also exercise explicit media selection, ambiguous sources, missing speech, line-only SRT with a word style, preparation denial/cancellation and unavailable transcription. Record chat outcomes and exported output; list any platform verification still outstanding rather than claiming it passed.
- [x] 7.3 Add a user-visible changeset with `bun run changeset`; document any new vendoring/tooling convention in `CLAUDE.md` and verification evidence in this change. Confirm no unrelated component or shader sources changed.
- [x] 7.4 Reconcile overlapping shell/role delta requirements with the then-current `add-shaders-to-video` change before spec synchronization or archive, preserving both features; verify with `openspec validate add-captions-catalog --strict` and inspect the combined requirement text.
- [x] 7.5 Run `bun run fix`, then `bun run check` and `bun run typecheck`; run all touched test files and the full `bun run test` suite once on the final implementation. Record results and any unrelated pre-existing failures. Re-run checks only when subsequent edits or failures justify it.
