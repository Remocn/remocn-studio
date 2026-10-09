# Paper design implementation

Branch: `codex/paper-ui-redesign`. Scope: the complete current design in
`paper-handoff.json`, preserving existing application behavior. Horizontal chat
tabs are excluded and tracked separately in Linear REM-661, after this redesign.

## Final status — 2026-10-04

The current Paper design is implemented on this branch, excluding horizontal
chat tabs (REM-661). The implementation and web verification cover the groups
below; native-only checks are listed separately rather than implied by fixtures.

- [x] Foundations: Light/Dark semantic colors, Inter / Geist Mono, compact
  typography, radii, neutral focus and Hugeicons.
- [x] Shared primitives: flat fields, selectors, buttons, menus, overlays,
  feedback and disabled/loading/error/focus states.
- [x] Shell: 46 px chrome, 238 px single sidebar, recent chats, projects,
  inset content and responsive collapse/peek behavior.
- [x] Settings T01–T11: replacement sidebar, Back, pointer slide, instant
  keyboard/reduced-motion navigation, Project tabs and all settings sections.
- [x] Welcome, shared project dialog, authentic ratio logos, DESIGN.md import
  and product tour cover plus six chapters (O01–O13).
- [x] Composer, Thinking, permissions, results, long responses, design_check
  and audio generation states (W01–W04, V01–V04).
- [x] Asset/component libraries, audio transport and existing document tabs.
- [x] Canvas, rulers, playback, Inspector control families and layers
  (W05–W06, I01–I07).
- [x] Export ready/progress/result/error and functional dialogs (W07).
- [x] Web inspection in Light/Dark, 1440/1024 and narrow layouts; focus,
  keyboard, IME guards and reduced-motion branches.
- [x] Final typecheck, full test suite and lint.
- [x] Final production build and `git diff --check`. Production routes are
  only `/` and `/_not-found`; QA fixtures are excluded.

### Coverage and limits

The source inventory contains 188 component entries. Components that retain
source unchanged either inherit the updated primitives/tokens (for example
ChatResult and QuitGuard), already match the specimen (Avatar and Kbd), or own
functional drawing/behavior retained by the handoff (rulers, logo, thumbnails,
Thinking and reasoning). A file change is not itself evidence of visual coverage;
the checks below record the inspected screens and interactions.

The final interaction pass adds regressions for IME confirmation (including
WebKit keyCode 229), mention selection priority, ordinary Enter, Shift+Enter,
pointer Settings transitions and keyboard/reduced-motion transitions. Browser
QA reconfirmed Settings focus entry/return and draft preservation, with no
captured console warnings/errors. Screenshot: `/tmp/remocn-final-web-qa.jpg`.

Final automated results: **3489 passed, 11 skipped, 0 failed** across 322 files;
`bun run typecheck` and `bun run check` passed. The skipped tests were already
skipped at baseline. No sidecar, shared-contract or preview-runtime source was
changed by this migration. UI integration tests cover the retained handlers;
fixtures do not replace real native/provider end-to-end checks.

Outside the completed web checks: native macOS traffic-light placement (the
existing OS positioning configuration is retained), native file pickers and
asset-protocol/download handling, live external-provider generation, and actual
video rendering. The user requested continuing in the web browser; no native
application was relaunched for this audit. These remain verification limits,
not claims that those flows were exercised successfully.

## Baseline

2026-10-04, before application edits:

- `bun run typecheck`: passed.
- `bun run test`: 3475 passed, 11 skipped, 0 failed across 319 files.
- Existing uncommitted Paper handoff files belong to this design work and
  are retained.

## Implementation evidence

Chronological record. Earlier open items below are superseded by later passes
and the final status above; native-only limits remain explicit.

- Foundations and primitives now use the Paper semantic tokens, Inter / Geist
  Mono, flat surfaces and a shared Hugeicons adapter. Key-action fuchsia is
  reserved for export and project creation. Remaining component-specific styles
  still need the final visual sweep.
- The shell uses 46 px chrome, a single 238 px sidebar, recent chats and projects.
  Settings replaces the navigation and preserves the mounted workspace. Focus
  returns to the opener; keyboard and reduced-motion navigation skip the slide.
  Native macOS traffic-light positioning still needs desktop verification.
- Welcome and the shared 816 px project dialog were reviewed in Light/Dark.
  Ratio cards use authentic platform logos; project creation and native picker
  handlers retain their existing implementation.
- Tour is a 1040 × 480 modal with cover and all six existing chapters. Desktop,
  1024 px and 640 px layouts were inspected; narrow content scrolls independently
  of the footer. Persistence and navigation checks passed: 14 tests, 0 failures.
- Brand import uses a flat review with selective color and font application,
  draft/save semantics, and focus entering and leaving review. App, import and
  tour checks passed together: 40 tests, 0 failures. Typography previews load
  the selected brand fonts while using readable interface colors.
- Integrations use aligned service/provider rows and expandable Manage / Set up
  controls. Original connection, verification and removal flows remain intact.
  Integrations and Settings checks: 36 tests, 0 failures (2026-10-04).
- `app/lab/redesign/page.dev.tsx` provides an isolated visual fixture using mocked
  IPC and memory-only settings. It is excluded from production routes. Browser
  checks on it verify presentation, not native filesystem/provider operations.
- Web QA on 2026-10-04 covered Light/Dark settings, the project dialog, long
  transcript content, design-check findings and audio-result presentation.
  Settings at 640 px had no horizontal overflow; keyboard shortcut filtering,
  dialog ratio selection and returning to the chat with its draft were checked.
- Design-check results and task checklists stay visible when technical work is
  collapsed. Composer and result surfaces are flat; the composer has an 88 px
  minimum height, and audio actions use compact controls. Idle title-bar activity
  is hidden and stops animating.
- The Inspector fixture at `app/lab/redesign/inspect/page.dev.tsx` uses the real
  controls and local state. Its position pad follows Paper's 126 px height and
  retains a functional grid. Coordinate editing/reset, font/weight selection,
  color entry and array addition/reset were checked in the browser.
- At 1024 px, opening Preview used to immediately close it while the sidebar
  released space. Automatic resizing no longer counts as a user collapse, and
  the panel retries expansion when its container resizes. Reopening and closing
  through the keyboard separator were verified in the browser.
- Preview compilation, media playback, export, native pickers and external
  providers are not verified by these fixtures. The Preview fixture deliberately
  remains in its compiler-loading state; audio samples have no playable file.
- Verification after the web QA fixes (2026-10-04): `bun run typecheck`,
  `bun run check` and `bun run build` passed. `bun run test` passed 3481 tests,
  skipped 11 and failed 0 across 319 files. Production output includes only `/`
  and `/_not-found`; development fixtures are excluded. These checks do not
  close the remaining application-wide visual and native verification above.
- Export settings now follow the 560 px Paper dialog: compact 28 px neutral
  preset/format/resolution/quality choices, flat 36 px destination fields and a
  fuchsia Export action. All existing formats, including MOV, and project-default
  options remain available even where the static specimen omits them.
- `app/lab/redesign/export/page.dev.tsx` exercises the real `useExport` hook with
  memory-only IPC. Browser checks covered filename normalization, keyboard
  preset selection, GIF audio warnings, progress, cancellation confirmation,
  failure/retry and completion. Light/Dark and 640/390 px layouts were inspected;
  the 390 px viewport measured a 358 px dialog and no body overflow. Render
  events are simulated; this is not evidence of actual video rendering.
- Assets and Components use a responsive grid with 160 px minimum tiles, 5:3
  media, 12 px gaps and visible type metadata. Source switches are compact and
  borderless; component headings share the main surface color. Populated and
  filtered libraries, long names and both themes were inspected. Real thumbnail
  decoding and audio playback still need native/media verification.
- The shared surface sweep remains open for less-used primitives, including
  Sheet, Drawer, Toast and table/calendar variants; foundations/primitives are
  not yet fully verified.
- After the library/export pass: full suite 3481 passed, 11 skipped, 0 failed;
  typecheck and production build passed. The new export fixture is absent from
  production routes, along with the other development fixtures.

- Toggle and ToggleGroup now use compact flat controls; vertical groups retain
  vertical layout for both variants. Canvas tools use 32 px buttons in a 40 px
  flat toolbar, with responsive priority hiding. Decorative Inspector, notice,
  selection-chip, managed-field, stock-tile and activity-detail borders/shadows
  were removed without changing their handlers or functional selection marks.
- Browser keyboard QA exposed an invisible focus outline: `outline-none`
  retained style `none` even with a focused 2 px width. Explicit solid focus
  outlines now accompany shared fields/buttons and custom Studio controls.
  The browser confirmed a visible solid 2 px neutral outline after Tab.
- At 1024 px, expanding the floating Inspector exposed automatic scrolling of
  the canvas viewport (331 px), moving its chrome offscreen. `overflow-clip`
  prevents browser scrolling while retaining camera pan/zoom. Repeating the
  browser scenario kept scrollTop at 0 and Inspector/canvas tops aligned at
  46 px. Pan, rulers, zoom, keyboard activation and collapsing Inspector worked.
- After this pass: full suite 3481 passed, 11 skipped, 0 failed; typecheck and
  lint passed. After the final canvas clipping change, 24 canvas/camera tests and
  the production build passed; only `/` and `/_not-found` were generated.
- Floating Inspector starts below the canvas toolbar, including ruler height
  and an 8 px gap. Web verification at 1024 px confirmed a top of 122 px and
  width of 340 px. Native rendering and media operations remain unverified.

- Shared surface pass uses Paper JSX from P04/P06/P07/P09, with unchanged token
  hash `0716ca32`: Sheet, Drawer, Toast, Table, Calendar, Frame, Empty, Group,
  HoverCard, PreviewCard, Autocomplete, Menubar, Item and Slider now use flat
  surfaces. Chart tooltips, button groups, accordion rows and context-menu
  switches no longer add decorative borders or bevels. Functional chart strokes,
  slider tracks and semantic group separators remain.
- Sheet/Drawer footer spacing now uses an explicit `data-variant=bare` marker
  instead of inferring footer type from the removed border class. Drawer swipe,
  nesting/bleed and Toast stack/hover-gap transforms were retained.
- Added `app/lab/redesign/surfaces/page.dev.tsx` with actual shared controls for
  Light/Dark inspection, sheet save/close, drawer actions, success/error toasts,
  date selection, toggle orientation and selected table rows. It is a development
  fixture and does not create projects or render files.
- Web access was recovered in a fresh tab after the old browser session closed.
  Shared surfaces were inspected in Light/Dark: sheet save, drawer actions,
  calendar selection, toggle orientation, table rows and stacked notifications.
  The success-toast action was verified by keyboard. Sheet layout was also
  inspected at 640 px. These checks use local fixture state, not native services.
- OTP fields, generic Sidebar variants, navigation popups and Bubble focus
  styles now use the flat surface and solid neutral focus conventions. Dialog
  footer spacing uses an explicit variant marker, as Sheet and Drawer do.
- After the shared surface pass: full suite 3481 passed, 11 skipped, 0 failed;
  typecheck, lint, production build and `git diff --check` passed. Production
  routes remain `/` and `/_not-found`; the new shared-surface fixture is excluded.

- Web QA found a calendar hydration mismatch: month labels used the host locale
  while the remaining calendar used DayPicker's locale. Labels now use its date
  library. A regression test verifies default and explicit Russian locales
  independently of the host formatter; the browser reload had no hydration error.
- Streamdown controls now use the shared Hugeicons adapter. Tables (including
  fullscreen), code blocks and their action rows have no decorative borders.
  Disabling line numbers exposed an upstream rendering issue: token lines became
  inline spans. Scoped block-line styles preserve separate lines and indentation;
  the browser confirmed four distinct 18 px lines with syntax highlighting.
  Fullscreen tables were inspected in both themes. Code copy shows its success
  state, but the browser clipboard bridge returned no text, so copied contents
  were not independently verified.
- After the code changes: typecheck and lint passed; full suite 3482 passed,
  11 skipped, 0 failed across 320 files. Final CSS-only line layout and border
  adjustments passed formatting and browser inspection. Screenshot evidence:
  `/tmp/remocn-web-qa-dark.jpg` (1024 px, dark transcript).
- Production build and `git diff --check` also passed after the final CSS
  adjustments. Output still contains only `/` and `/_not-found`.

- Permission decisions now follow W03's current Paper JSX: flat card surface,
  36 px neutral primary action, compact secondary actions, and separate cancel.
  Choice descriptions remain available through `aria-describedby` and native
  hover titles. Single/batch/plan callbacks and the meaning of each choice are
  unchanged. Write-failure and asset-source cards share flat surfaces, aligned
  action descriptions, disabled states and solid focus outlines.
- Document tabs follow S12's flat strip: 32 px tabs, 14 px file icons, no dividers
  or bottom rule. Existing wheel scrolling, roving focus and activation remain.
  These are existing document tabs, not the deferred horizontal chat tabs.
- `app/lab/redesign/decisions/page.dev.tsx` adds a memory-only fixture for command,
  plan, batched service permissions, write refusal and document states. Browser
  checks covered Enter approval, partially selected batch (allow/deny/allow),
  Escape declining a plan, cancellation without writing, Arrow/Enter document
  navigation, long names, loading/error/empty states, Light/Dark and 640 px.
  The 640 px document region measured 581 px clientWidth and scrollWidth.
- Remaining custom focus rings in activity, task, queue, transcript, navigation,
  tour and canvas controls now use the same solid neutral outline. Inset focus
  stays inset for clipped canvas/dock surfaces. Browser keyboard focus on the
  decision controls measured a solid 2 px outline. Screenshot evidence:
  `/tmp/remocn-decisions-qa-dark.jpg`.
- After the decision/document pass: typecheck and lint passed; full suite
  3482 passed, 11 skipped, 0 failed across 320 files. The fixture uses no live
  provider requests and does not write to project files.
- Production build and `git diff --check` passed after this pass; the decisions
  fixture is excluded along with all other development routes.

- Label and field typography, toolbar inset/radius, progress/meter tracks,
  centered markers and idle resize separators now match the current Paper JSX.
  Disabled shared controls use 45% opacity; native select avoids applying it
  twice. Collapsible, skeleton and indicator animations respect reduced motion.
- The surfaces fixture now exercises real fields, both OTP implementations,
  progress/meter, collapsible placeholders and scroll areas. Browser checks
  covered Light/Dark, six-digit entry, incrementing both indicators and a
  visible 2 px solid keyboard outline. The contiguous legacy OTP slots match
  the Paper specimen. Preview's keyboard separator still resizes the panels
  and shows its neutral focus outline.
- Browser QA found host-locale hydration errors in Progress/Meter percentage
  labels. Both now default to en-US, with explicit locale overrides retained.
  Regression tests cover the default and Russian override; a browser reload
  emitted no hydration errors or OTP label warnings.
- Added memory-only project actions to the decisions fixture, using the real
  useProjectMenu hook and ProjectDialogs. The rename form lacked the shared
  DialogPanel, leaving its field flush with the popup edges. It now aligns with
  the heading and footer; long paths wrap at word boundaries. Browser checks
  covered empty-name disabling, Enter submission, removal cancellation,
  Light/Dark and 640 px. The narrow dialog measured 512 px client/scroll width,
  with its heading and field sharing the same left coordinate. No project
  files were renamed or removed. Screenshot: `/tmp/remocn-project-dialog-qa-dark.jpg`.
- Full suite after the primitive changes: 3484 passed, 11 skipped, 0 failed
  across 321 files. The final project-dialog change only wraps the existing
  form in DialogPanel and changes path wrapping; its handlers are unchanged.
- Final typecheck, lint, production build and `git diff --check` passed. The
  new fixture helper remains excluded from production routes. Native rendering,
  media playback and external provider flows are still outside these web checks.

- The new-video specimen was still using a 24 px heading and the project
  dialog's wider ratio breakpoint. Its heading now uses Paper's 20/28, and the
  shared FormatPicker has a video layout that fits four 139 px cards inside the
  640 px form. Project-dialog behavior below 720 px remains unchanged. Browser
  checks covered keyboard ratio selection, creation with 1080×1920, Light/Dark,
  four columns at the reference form width and two columns in a 640 px viewport.
- Splash now matches its current flat specimen: semantic background, 14/20
  wordmark and 16 px glyph. The decorative shader was removed; useSplash,
  animation completion and the boot-readiness contract are unchanged. Browser
  measurements confirmed both sizes and automatic dismissal. The focused
  splash/project suite passed 19 tests. Fieldset legends now explicitly use
  the specimen's 14/20 instead of inheriting a surrounding size.
- `app/lab/redesign/media/page.dev.tsx` provides an eight-second local WAV Blob,
  decoded by a real audio element through useAudioPlayer/AudioTransport. Browser
  checks verified duration, playback, pause, seeking to the end, natural ended
  state and replay; invalid and absent audio states were checked too. This
  verifies browser transport behavior, not native asset URL conversion or
  external audio generation. No media is uploaded or written into a project.
- Playback sliders and scene navigation now use solid neutral focus outlines;
  disabled playback controls follow the shared 45% opacity. Audio seek focus
  follows the same token and offset. The remaining SoundAsset specimen still
  differs from its native-audio implementation and needs a dedicated pass that
  retains its existing transport capabilities.
- After these changes: typecheck and lint passed; full suite 3484 passed,
  11 skipped, 0 failed across 321 files. Screenshot evidence:
  `/tmp/remocn-media-qa-dark.jpg` (1440 × 900).
- Production build and `git diff --check` passed after the final styling edits;
  the media fixture is excluded from production, which still has only `/` and
  `/_not-found` routes.

- SoundAsset now follows the compact Paper row: 76 px height, fixed 24 px audio
  icon, aligned name/metadata and 28 px play action. Audio rows follow the visual
  tiles in the library, preserving relative order within each group and avoiding
  incomplete grid rows. Unknown imported audio is labeled Audio; generated music
  and sound effects use their source metadata. Missing local URLs keep the asset
  selectable while disabling playback.
- The native audio control bar is replaced by the existing useAudioPlayer
  transport and a flat controls popover. Seek, volume, mute, playback speed,
  download link and ElevenLabs provenance remain available. Pick/remove callbacks
  and the bundled-asset removal restriction are preserved. Regression coverage
  confirms that playback and deletion do not also pick the asset, and checks seek,
  volume, mute, speed, local-file source, no autoplay and provenance access.
- Browser checks covered real WAV play/pause, end seeking, mute and playback
  speed, a 76 px row measurement, Light/Dark, a 390 px controls popover and the
  mixed library layout. Screenshot: `/tmp/remocn-sound-asset-qa-dark.jpg`.
  The standalone fixture supplies a local Blob URL; native asset-protocol
  conversion and download handling remain outside this browser evidence.
- After the audio-card implementation: full suite 3485 passed, 11 skipped,
  0 failed across 321 files; typecheck, lint and production build passed.
- After the final library grouping and label adjustment: all 17 focused audio
  and library tests passed, along with lint, production build and diff checks.
  Integrated library screenshot: `/tmp/remocn-library-audio-qa-dark.jpg`.

## Follow-up: sidebar navigation and Inspector — 2026-10-04

- Removed the right vertical Inspector rail. Layers / Inspect now share the
  Inspector header with its collapse action. Clicking the selected view keeps
  it open. The collapsed Inspector consumes 0 px; reopening lives in the canvas
  toolbar. Snapshot also lives in that toolbar, with its original availability,
  busy state, shortcut and capture handler retained.
- Settings and library navigation use the shared SidebarSlide with persistent
  panels and explicit transform transitions: 200 ms, cubic-bezier(.32,.72,0,1).
  Back reverses the same transition; keyboard and reduced-motion navigation
  switch immediately. Inactive panels are inert and hidden from accessibility.
  Settings no longer relies on a newly mounted starting-style entrance.
- Assets replaces workspace navigation with Back and Library / Photos / Videos.
  Components replaces it with Back and All components / Saved / Built-in.
  These filters use the existing asset/stock data and components. Opening the
  library on a narrow viewport reveals its navigation; leaving restores the
  underlying workspace. Drafts remain mounted and focus returns to the opener.
- Moved the window sidebar toggle down 6 px, matching the native controls'
  center in the supplied screenshot (29 px). OS button configuration is unchanged;
  native pixel alignment was not independently rechecked in the web fixture.
- Browser verification covered dark/light, 1440/1024 px, saved/bundled sources,
  stock Photos, Back and Inspector collapse/reopen. Inspector measured 340 px
  open and 0 px closed, with no remaining rail. Native capture was not performed
  by the fixture. Screenshots: `/tmp/remocn-assets-sidebar-final.jpg` and
  `/tmp/remocn-inspector-header-final.jpg`.
- Final validation: 3490 tests passed, 11 skipped, 0 failed; typecheck, lint,
  production build and diff checks passed. Development fixtures remain excluded
  from production routes.

### Additional layout and focus pass

- Fixed the empty-chat template list's width at narrow chat sizes. The list's
  deliberate 12 px horizontal bleed now has an explicit matching width, and its
  flex container can shrink. Browser measurement changed from 369 / 386 px
  client / scroll width to 369 / 369 px, removing the horizontal scrollbar.
  Template buttons expose their complete description in a native title.
- Added the shared neutral focus outline to Inspector coordinate fields and
  made the custom controls' outline style explicit. The focused Position Y
  field now has a computed solid 2 px outline instead of only an inset underline.
- Reset, video-group and session actions remain visible on coarse pointers;
  keyboard and hover visibility are retained. The coarse-pointer branch was
  reviewed in source, not verified on a touch device.
- Rechecked Assets and Components replacement navigation, Settings and
  Inspector collapse in the web fixture. Snapshot is in the canvas toolbar;
  the fixture cannot capture an actual compiled frame. Evidence:
  `/tmp/remocn-inspector-toolbar-verified.jpg`,
  `/tmp/remocn-chat-overflow-fixed.jpg`,
  `/tmp/remocn-inspector-coordinate-focus.jpg`.
- Typecheck, lint and diff checks passed again. Focused app navigation,
  Settings, PropsPanel, templates, tuning controls and session tests:
  113 passed, 0 failed.

## Library inside the sidebar — 2026-10-05

- Assets and Components now render their filters, search and scrollable content
  inside the replacement sidebar. They no longer cover or make the chat inert.
  The existing Videos view retains its workspace presentation.
- Picking an asset adds it to the composer while keeping the library open.
  Back restores workspace navigation through the existing slide transition.
- Browser checks covered both libraries, source selection, search, adding an
  attachment while retaining the draft, and sidebar/chat/preview together.
  Screenshot: `/tmp/remocn-components-in-sidebar.jpg`.
- All 44 focused app-shell and asset tests passed, along with typecheck, lint
  and diff checks. Regression coverage verifies library placement in the
  sidebar, usable chat input, draft preservation and picking without closing.

## Chat turn indicators — 2026-10-05

- Session rows use DotmSquare1: animated key-action fuchsia while running,
  static success green after a successful turn, static destructive red on error.
  Waiting retains its question marker. Successful outcomes do not disappear
  merely because the chat is read; unread title emphasis remains independent.
- Completion is derived from the known in-memory turn outcome (`workedMs`
  with idle status), not guessed from a stored chat's existence. Historical
  sessions without loaded outcome metadata stay neutral; this change adds no
  persistent history schema. Existing Reduce Motion support remains active.
- Browser verified actual colors and animation names in Light/Dark. Color is
  passed through the matrix's color prop because its inline currentColor would
  otherwise override a text-color class. Preview: `/tmp/remocn-chat-dotmatrix.png`.
- 81 focused session, grouping, turn and command tests passed; typecheck,
  lint and diff checks passed. The visual fixture is development-only.
