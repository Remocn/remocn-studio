## Why

Studio cannot yet browse or use the 31 caption styles recently added to remocn. People need to choose an animated subtitle style visually and ask their agent to apply it to speech, including obtaining the timed transcript when none exists.

## What Changes

- Add a dedicated Captions view beside Shaders, with search, posters and muted animated hover previews from the existing remocn examples.
- Bundle all 31 caption styles and their registry dependencies from a pinned remocn revision. Keep captions out of the Components role groups; reuse the upstream implementations rather than re-creating effects.
- Picking a style adds an ordinary asset reference to the composer. Support several different styles in one message and deduplicate the attached asset when the same style is picked again. Picking never starts a turn, transcribes speech or edits the video.
- On Send, reuse the existing bundled-component placement mechanism and give the agent caption-specific instructions: use the selected remocn implementation, identify the speech source, reuse a valid transcript or obtain word timings, then position and synchronize the captions.
- Keep transcripts in the project, associated with their source, so changing style reuses the same timings. Ask in chat when the speech source or assignment of multiple styles is ambiguous.
- Make missing speech, unavailable transcription and insufficient timestamps explicit in chat. Demo timings are for catalogue previews only.

## Capabilities

### New Capabilities

- `library/captions`: the bundled caption catalogue, preview behaviour and selection into the composer.
- `agent/captions`: caption-specific turn context, source selection, transcription, reuse and application of the selected style.

### Modified Capabilities

- `library/components-and-roles`: exempt transcript-driven caption styles from motion-role classification and exclude them from Components while keeping ordinary asset placement.
- `shell/layout-and-panes`: add Captions navigation, command/menu access and restoration through the existing pane preference.

## Non-goals

- Direct code insertion on card selection: the speech source and transcript may not exist yet.
- A transcript editor, dedicated transcription settings or a new background transcription service: the agent handles preparation within a normal turn.
- New caption effects, a generic animation runtime or an unrelated refresh of the existing remocn bundle: reuse the supplied caption sources and preserve existing components and shaders.
- Automatic speech synthesis, translation or speaker diarization: captions follow supplied speech; speaker metadata is used when available.
- Automatic cloud transcription or new paid-provider integrations: retain the existing consent and permission model.

## Impact

- **Shared contract:** reuse `Asset`, category and `PromptAsset` references. No new asset type, IPC method or history payload is planned.
- **Sidecar/agent:** extend pinned vendoring and preview generation; resolve caption identity from the bundled manifest and add caption instructions to normal turn preparation. Project dependencies include the registry-declared caption packages.
- **Rust core:** no new commands or protocol changes; native navigation uses the existing command registry.
- **Webview:** add the pane and its filtering/navigation through existing hooks; reuse card previews and composer selection.
- **Persistence:** reuse `paneView`; no new settings key or SQLite migration. Transcripts and source provenance are project files written during the agent turn.
- **Coordination:** preserve the in-progress `add-shaders-to-video` navigation and category exclusions. Reconcile its overlapping specification deltas before archiving either change.
