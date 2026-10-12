# Components and implementation decisions

Read [handoff.md](handoff.md) first. The complete source map is [paper-handoff.json](paper-handoff.json). Names below are existing files, not newly implemented components.

## Button

Use Button for actions; keep navigation semantic. Use an icon size for compact icon actions and provide an accessible name.

Existing variants in [button.tsx](../../components/ui/button.tsx): `default`, `secondary`, `ghost`, `outline`, `link`, `destructive`, `destructive-outline`. The implementation now adds `key-action` for the two high-priority actions; there is no `primary` variant. The default is `variant="default"`, `size="default"`.

- Routine actions remain neutral. Use secondary for filled controls and ghost for low-emphasis actions.
- Export and project creation receive the `key-action` visual role. Use `variant="key-action"`, implemented in the shared Button.
- Destructive variants are for destructive actions, not emphasis.
- Keep existing size API; update its visual recipe to the token scale. Flat `outline` still has no decorative border in the target design.

Existing call-site pattern in `new-project-wizard.tsx`:

```tsx
<Button onClick={control.close} size="sm" variant="ghost">
  <ChevronLeftIcon data-icon="inline-start" />
  Back
</Button>
```

Incorrect: changing `--primary` to fuchsia globally; it would recolor routine controls and active states.

Decision: project creation/Export → key-action visual role; destructive → destructive variant; routine filled → secondary; low emphasis → ghost. Loading retains the button's width and label space; disabled controls have no hover action.

## Input and selector controls

Sources: `components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `combobox.tsx`, `radio-group.tsx`, `checkbox.tsx`, `switch.tsx`, `field.tsx`.

Use Input for text; Select for a fixed list; Combobox for a searchable list; RadioGroup for mutually exclusive visible choices. Inset Inspector values use the flat shared tuning controls rather than a new generic form layout.

Default fill is neutral; selected is neutral accent. Disabled, invalid and keyboard-focus states are separate. Radius is 8 px for fields; no decorative stroke. Focus-visible uses neutral 2 px outline + 2 px offset. Errors require text, not just a colored background.

Correct existing project pattern: `<Input autoComplete="off" autoFocus spellCheck="false" ... />`. Preserve its `onChange`/`value` wiring and slug-like input behavior. Incorrect: replacing the location picker with an editable path input; its existing action opens the native folder picker.

## New project dialog and FormatPicker

Sources: `components/studio/new-project-wizard.tsx`, `format-picker.tsx`, `components/ui/dialog.tsx`, `hooks/use-new-project.ts`, `lib/studio/formats.ts`.

Use the same dialog from welcome and Projects +. The former full-page wizard is archived. Use existing Base UI Dialog behavior instead of a custom overlay implementation.

Current designs: S18 filled, S19 empty/focused, O02 welcome context, O03 sidebar context. Geometry and behavior are in [handoff-layout.md](handoff-layout.md).

- FormatPicker remains shared between project creation and New video. The ratio belongs to the first video, not to every future video in the project.
- Four formats: landscape 1920×1080, vertical 1080×1920, square 1080×1080, portrait 1080×1350. Default is landscape.
- Keep ratio and resolution visible; social platform names appear only in accessible names/tooltips. Use authentic SVG logos; the vertical option stacks Shorts, TikTok and Instagram with 6 px overlap.
- Existing call pattern: `<FormatPicker id={RATIO_LABEL} onChange={control.onFormatChange} value={control.format} />`.
- Incorrect: duplicating a separate picker or changing the project format when an existing video's ratio changes.

## Shell and navigation

Sources: `components/studio/app-shell.tsx`, `projects-pane.tsx`, `chat-pane.tsx`, `titlebar.tsx`.

One 238 px sidebar with top app identity/search/new-chat, Videos/Assets/Components, Recent chats, Projects and bottom actions. Settings replaces its content with Back and settings sections. Keep macOS controls outside the animated body. Recent chat selection opens the conversation. Horizontal chat tabs are deferred to REM-661 and are excluded from this implementation.

Use W01/W04 for populated/empty chat states, O01 for no open tabs, T01–T11 for settings context. Do not restore the extra icon rail.

## Conversation and media

Sources: `components/studio/composer.tsx`, `thinking.tsx`, `chat-result.tsx`, `audio-transport.tsx`, `sound-result-card.tsx`.

Composer specimens cover empty/filled/attached/running/waiting/add-menu states. Keep model choice visible, preserve existing Send/Stop/permission logic and keyboard behavior. Do not treat Thinking as a second composer.

V01–V04 provide long text, visual design_check, ready audio and generation. Keep transport controls stable between states, use tabular numerals for time, and retain asset actions. Audio loading does not imply a playable result. Use the existing components rather than rasterizing the turn as a single image.

## Preview, Inspector, settings and export

Sources: `components/studio/canvas-preview.tsx`, `canvas-rulers.tsx`, `preview-controls.tsx`, `props-pane.tsx`, `managed-props-pane.tsx`, `managed-fields.tsx`, `tuning-controls.tsx`, `settings-page.tsx`, `export-dialog.tsx`.

Canvas retains rulers, selection handles, pan/zoom and playback. Scene artwork keeps its own colors when UI theme changes. The 340 px Inspector uses label/value lanes, shared controls and neutral selected states. I01–I07 are the detailed control reference; the component library includes light/dark recipes.

T01–T11 own the settings layout, including Project/General, Brand, Typography and Guidelines. Use the dedicated settings sidebar, not the workspace sidebar with an appended settings list.

Export is a key action; dialog controls are neutral. Preserve export ready/progress/result/failure logic from the existing source rather than introducing new states from decorative mockup content.

## Onboarding and brand

Sources: `components/studio/startup.tsx`, `onboarding-dialog.tsx`, `project-brand-editor.tsx`, `lib/studio/onboarding.ts`, `hooks/use-onboarding.ts`.

O01 is the no-project welcome with abstract ribbon and manual hint slider. It is separate from the product tour. O07–O13 preserve the code's cover + Inspect, Snapshot, Assets, Components, Brand, Export chapters. O04–O06 cover DESIGN.md choose/review/draft.

Correct: reuse chapter IDs and persistence from the existing onboarding hook. Incorrect: treat the four welcome hints as replacements for the six product-tour chapters.
