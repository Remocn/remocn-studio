# remocn-studio

## 1.0.1

### Patch Changes

- 2674954: Each provider is now told to plan a pipeline stage with the tool its own runtime has — `update_plan` on Codex, `todo_write` on Grok, its own planning tool on Copilot — instead of Claude's TaskCreate, and a stage moved mid-turn points the agent at the video's own documents folder. A missing command-line tool now fails the turn the same way on every provider.
- 2674954: Copilot and Grok now ask before following a link inside the project that leads out of it, and a plan approved on them keeps the mode it was approved into: the running turn switches to it and the chat's next message starts in it.
- 396a352: Pressing Restart on the studio's helper no longer files a crash report. A report for a helper that really did stop now says how long it had been running and what it last said about leaving.
- 701c3d3: The canvas preview no longer fails with a SyntaxError when the project recompiles while the preview is loading the previous version — it always loads one whole build. A project whose code builds a source map comment in a string loads again.

## 1.0.0

### Major Changes

- e61b9a7: Remocn Studio is 1.0.

### Patch Changes

- 8f5a54f: The installer window's labels are readable again. "Remocn Studio" and "Applications" were black text on the dark background; each name now sits on a white badge.
- a47164d: The model menus carry the latest models. Claude adds Sonnet 5.5. Codex adds GPT-6.1 Sol, GPT-6 Sol and GPT-6 Luna, which need codex-cli 0.159 or newer. Copilot offers Fable 5.1, Opus 5.5, Sonnet 5.5, GPT-6.1 Sol, GPT-6 Astra, Gemini 3.8 Flash and Grok 4.6; Gemini 3.1 Pro is gone from its catalog. Grok adds Grok 4.7 and Grok 4.7 Fast.
- 798d161: The library has forty-one new remocn components from August and September, among them Lens Zoom, Shader Seam, Shader Spiral Pass, Shader Light Tunnel, Keystroke, Radial Burst and thirty-four typography animations. The components already in the library are updated to their latest versions, with new previews.

## 0.12.0

### Minor Changes

- e01aa72: Delete what you selected on the canvas yourself, without asking the agent: press ⌫ or Delete, use Delete in the properties header, or right-click the object on the canvas or its row in Layers. It disappears at once, and ⌘Z or Undo in the notice brings it back. A managed object is removed in the video's `studio.json` and stops being painted while everything that reads its values keeps working; the first deletion in a video moves it to the `studio-objects-v6` runtime. An element outside the catalogue is removed from its place in the code; one line that draws several instances offers Delete all N. Scenes and objects not on screen cannot be deleted, and say why.

### Patch Changes

- 0dbe006: Footage attached in one video's chat can no longer be swapped for another video's clip with the same file name. An attached clip or sound now lands in its video's own folder, `public/library/<video>/`. A different file whose name is already taken there is copied as `name-2`, `name-3` and so on, and attaching the same file again reuses the copy already there. Media attached before this update stays where it was.
- 64a88a4: Phone and camera footage no longer stutters in exports of new videos. The agent now embeds footage with `<Video>` from `@remotion/media`, which new projects declare. That component shows every frame of files whose frames start a fraction of a millisecond after their slot, where `OffthreadVideo` repeated one frame and skipped the next. It also matches the source's brightness. The design check now names each clip that `OffthreadVideo` would show late, counts its late frames, and says how to fix it.
- c60fd2c: Fit small windows: as the window narrows the sidebar folds first, then the inspector, then the chat, and the preview stays down to a 640 px window; a folded pane still opens over the layout, and the sidebar slides out when the pointer reaches the window's left edge. The canvas keeps room for its toolbar beside Export. The window can be dragged by its headers again.
- 333dfbc: Showing the preview no longer squeezes it. The inspector lives inside the preview, so a preview opened at its old width left a sliver of canvas, a playback panel whose hint wrapped one word per line and a toolbar cut off under Export. Now the chat narrows first, down to its own minimum, whenever the preview is shown, the app launches, the sidebar opens or closes, or the window is resized, and nothing is closed to make room. Dragging the divider still puts the preview wherever you drop it. On a narrow canvas the toolbar's zoom, full screen, zoom to selection and ruler buttons step aside, and their shortcuts keep working.

## 0.11.0

### Minor Changes

- 034ed88: The canvas names the video frame just above its top-left corner, and while a turn is working on the video the name gives way to a wide, single-ripple version of the chat's thinking mark and a changing phrase about the work, such as "Storyboarding…", whether or not anything is selected. The label follows the view as you pan and zoom, and the mark leaves when the turn ends or a card waits for you.
- 6709ba2: The video can be watched full screen. The canvas toolbar, the playback panel and F open it: the window goes full screen, the video is fitted on black with nothing around it, and the playback panel fades while it plays. Esc or F brings the canvas back as it was, at the same frame.

### Patch Changes

- f9de1cc: Several sound effects are approved on one permission card. The agent asks for every sound in one call, the card lists each request with its description and the charge notice, and the person can send all of them, uncheck some, or decline all. Other asks raised together — commands, paths outside the project — also share one card instead of coming up one after another.
- 666cec0: With content outside the frame hidden, the canvas now clips the video to the frame instead of covering the rest, so what lies beside the frame is no longer drawn underneath or picked by a click there, and scenes that reach far past the frame edges play smoothly.
- 51ba474: With content outside the frame shown, videos now play on the canvas as smoothly as with it hidden: whatever moves is drawn once and slid into place instead of being redrawn on every frame, so a wall of filtered type that runs far past both frame edges no longer drops frames, and it stays visible and dimmed beside the frame while it plays.
- 9d4628d: The preview plays videos with many sound effects. A video whose sounds all stayed mounted used to stop at a small warning sign in the preview while it exported fine; it now plays through, and a video that does fail to render says so and offers Retry.
- 3c5c5a1: The seek bar names a video's real scenes. A video laid out in a Series beside a soundtrack now shows its scenes by name instead of "Series Container" and its sound effects. Scene names never draw over each other, and the boundary ticks are easier to see.
- a5b31a4: A chat or video that is working shows its mark in the sidebar in the same purple as the chat's thinking mark, instead of white.
- 811b8b5: The Video dock stops animating between turns. When a turn ends with a stage still open, such as Review, the dock names the stage and draws its mark still instead of showing "Reviewing the result" forever.

## 0.10.0

### Minor Changes

- 1091e17: Edit managed geometry on paused animation frames through explicit invertible pose mappings. Account for local scale and rotated, uniformly scaled ancestors, preserve the opposite resize anchor, cancel unfinished gestures when the playhead changes, and save base values with one Undo. Ship the opt-in v5 runtime without replacing authored runtimes.
- 18090d2: The canvas camera feels more like a design tool's:
  - Fit, 100%, zoom in and out and zoom to selection glide to their view in about a fifth of a second instead of jumping. Panning or pinching stops them where they are, and they jump at once when macOS is set to reduce motion.
  - Rulers along the top and left edges measure the video in pixels, mark where the pointer is and highlight the selected object's extent. The ruler button in the toolbar or ⇧R shows or hides them, and the choice is remembered.
  - From 800% a grid marks every pixel of the video. It never appears in Snapshot or Export.
  - Each video opens where you left it after a relaunch, with the same point at the centre even if the window is a different size.
- 1091e17: Move, resize and rotate explicitly bound managed objects in the preview with scale-aware handles, dimensions, modifier keys and gesture cancellation. Save each gesture atomically with one Undo and retain failed edits for Retry or Discard. Add the versioned v4 geometry runtime and enable it in new video templates without overwriting authored runtimes. Advance the sidecar protocol to 36 for grouped property operations.
- 7cf9c9a: There is no paid plan anymore. Everything that was part of Pro is now available to everyone,
  with nothing to sign in to:

  - Inspect and Snapshot
  - writing tuned values back into the code
  - the bundled video-making skills
  - the seven-stage pipeline
  - the full studio conventions

  The trial card, Settings › Account and the account row at the bottom of the sidebar are gone.
  If you signed in to an earlier version, that sign-in is forgotten on first launch. It is
  removed from your keychain along with the plan the studio had cached, and nothing is sent
  anywhere.

- 1091e17: Edit managed plain text by double-clicking it in the preview. The input follows the text's typography and grows with its content; clicking outside or pressing Cmd/Ctrl+Enter saves one undoable property change, and Escape cancels. Existing scenes support unambiguous text fields, while the versioned v3 object runtime adds explicit bindings for separate text regions without overwriting authored runtimes.
- 2ac468a: The studio looks and feels more finished, and costs less while it works:
  - Failures read as sentences, with the raw text behind Details and a Copy details button. Mono text is set in Geist Mono again, and the interface no longer says "session", "composition" or "sidecar".
  - Videos and chats have native right-click menus. New Chat is on ⌘T, F2 renames a video and ⌘⌫ deletes a row.
  - The preview shows a progress bar while it builds and fades the frame in. The export pill shows its stage, a long render asks before it stops, a finished export can be dismissed and a failed one retried.
  - Motion, status colours, tooltips and floating cards share one set of tokens. The splash leaves as soon as its draw has landed, the window matches the theme, and the title bar shader rests while the window is in the background.
  - The canvas compiler alone gets the preview ready. The render bundle is built only when a render needs it, without hot-reload output, and old preview folders are pruned at start.
  - An export measures and renders in one browser. Claude's tool servers run inside the helper, Copilot and Grok keep their agent between turns, and account checks run at once and answer from the last sign-in.
  - Streamed text is saved a few times a second instead of on every token, the log rolls over while the studio runs, and saving a pasted picture no longer holds up the window.

### Patch Changes

- 1058512: The studio does far less work while it streams and while you type:
  - A streamed reply re-renders the transcript and nothing else, and lands at most once per frame; typing re-renders only the composer.
  - Playing a video moves only the seek bar, and panning or zooming the canvas moves only the stage, the rulers and the overlays.
  - The window opens on 1.3 MB less JavaScript: the markdown renderer, the code highlighter, the properties controls and the crash reporter load when they are first needed, and the release no longer carries the lab pages or preloads three fonts it does not use.
  - Chats you have not opened in a while are read back from history when you return to them, and videos in a chat show a still frame instead of a live player.
- d5f8512: Make canvas editing smoother: an ordinary element's card reopens after a
  rebuild, moving and resizing snap to the frame and other objects with guides
  (⌘/Ctrl turns it off), arrow keys nudge the selected object as one Undo,
  ⌘0 / ⌘+ / ⌘− / ⇧1 / ⇧2 control the camera with a Zoom to selection button,
  and content outside the frame is shown dimmed with a toggle to hide it.
- b2de7a4: The inspector is a vertical bar of icons — Layers, Properties, Snapshot and a
  collapse control — beside a collapsible panel; clicking the active view's icon
  collapses it to the bar. Layers lists the video's editable objects as a tree of collapsible groups, with
  scenes as their own groups and the scene on screen expanded:
  hovering a row outlines the object on the canvas and clicking selects it, so
  transparent, covered and off-screen objects can be reached, and objects not in
  the current frame are dimmed. Tab / Shift+Tab step through the objects on
  screen. Export moves to the preview pane's header, as in Docs.
- e6fce60: Make the canvas the only preview: remove the iframe preview page, its host and
  the separate properties column. The canvas now shows compile progress, and Fit
  and Zoom to selection leave room for the panels that actually cover the canvas.
  The render bundle no longer carries the preview runtime.
- 6c63c22: Panning the canvas follows the pointer: drag, wheel and pinch updates are
  applied once per frame, and the inspector no longer re-renders while the view
  moves, so Space-drag no longer lags behind the mouse or moves in jerks.
- 1091e17: Select preview elements directly without an Inspect button. A click pauses playback and opens the element's properties; hover uses a quiet outline and a text-aware cursor. Escape clears selection, Snapshot temporarily owns frame gestures, and element selection becomes available again after preview reloads.
- 76f13a0: The preview header no longer carries the Preview / Docs switch. Docs opens with
  ⌘D, the View menu, the command palette or a stage row, and shows a Preview
  button to return. The canvas's zoom controls sit in the header row, and the
  properties pane's color swatch is a square that fits its row.
- d5f8512: Edit where an object enters from and leaves to by dragging it on the canvas.
  The new `geometryBetween` helper in studio-objects-v5 moves an object between
  two field-backed poses; early in the move a drag edits the start pose, late in
  it the resting or end pose. The canvas names the edited pose and draws the other
  one as an outline with the path between them. Objects outside the frame can now
  be selected.
- dacc80c: Explore Studio opens on a welcome cover the first time, then walks through six chapters, each with a still of the real interface, a short title and a line on how to use it. The recordings are gone, and progress segments replace the chapter list.
- 1ad7743: Opus 5.5 is in the Claude model menu.
- ab10090: The canvas playback panel has a full-height seek bar in the style of the
  properties pane's sliders, with the elapsed and total time inside it. The
  canvas hint and status messages sit in the row of playback buttons, and the
  panel is shorter.
- 1091e17: Move playback controls below the preview so they no longer cover editable content. Add frame stepping, a seek bar, time display, sound controls, scoped keyboard shortcuts, and fullscreen with the controls kept visible.
- 492c68c: While a turn runs, the chat shows its latest steps and the model's reasoning
  scrolling under a shimmering task phrase, three lines at a time. Reasoning is
  shown live only and never stored. A finished turn reads "Worked for 2m 14s" in
  place of "Work details" and expands into its steps.
- 32b025f: The seek bar marks the video's scenes with short ticks and each scene's name
  above its segment, the current one highlighted; clicking a name jumps to the
  scene. The playback panel has a speed slider (0.25×, 0.5×, 1×, 2×) for the
  preview, and a shorter volume slider in the same style; its text is set in one
  face and size. The agent now names every scene and describes it in studio.json
  with a scene object its objects belong to, and the design check reports a scene
  without a name or a scene object. In the object list, clicking a scene, or an
  object that is not on screen, moves the playhead to that scene.
- c67537c: Replace the main Studio preview iframe with a navigable Shadow DOM canvas using
  the project's own React and Remotion. Add pan, pointer-anchored zoom, Fit and
  per-video camera memory, with the existing properties pane floating over the
  canvas. Route selection, geometry handles, inline text, Snapshot, playback,
  save receipts and Undo through the shared runtime and existing editing hooks.

  Adapt supported studio-objects-v5 transports during native compilation without
  rewriting video source. Scope styles and editing queries, retain playhead state
  across preview-only rebuilds, and package the native runtime and compatibility
  loader. Keep rendering/export on its existing bundle.

## 0.9.0

### Minor Changes

- ab7db28: Create new videos with stable editable object IDs and typed property documents. Inspect selects semantic roots, the properties panel saves directly with conflict checks and persistent Undo, and the object catalogue includes elements outside the current frame. Pending changes block export. Existing registered Studio projects stay available; new folder imports are limited to Studio projects.

  Use DialKit controls and collapsible property groups in the managed inspector, retaining live preview and one saved operation per slider or color gesture.

  Preserve preview playback position when saved properties rebuild the video. Show animation timing in seconds, translate existing frame-based fields using the video's FPS, and offer named easing curves for managed animations.

  Add editable cubic Bezier easing with draggable handles, coordinate sliders and presets. Curve edits support live preview, atomic saving and checked Undo. New videos use the v2 object runtime; existing authored runtimes remain intact.

  Organize managed properties into Appearance and Animation tabs with readable English labels, a single element selector, paired position and size controls, and expandable text spacing, spring settings and curve coordinates.

- b1a4a3f: Replace tips with a six-chapter, offline video overview of Studio features. Remember dismissal and the last chapter, and reopen the overview from Settings.

## 0.8.2

### Patch Changes

- 05db2d6: The DMG no longer shows the MIT license agreement when it is opened. The LICENSE file still ships inside the app bundle.
- 1911c8c: A sign-in is no longer refused for the number of Macs already signed in to the account, and the card that listed them is gone. Settings › Account counts the devices signed in without naming a ceiling.
- 05db2d6: The preview plays again on its own once a compile error is fixed. It used to sit at "Compiling — 100%" until the studio was reloaded.
- 05db2d6: Update the welcome video opened from the website to the new personalized 19-second thank-you, with a warm background, kinetic text and early-member card. Remove the old shader and confetti from newly created welcome projects.

## 0.8.1

### Patch Changes

- 2ae893f: The packaged app ships the whole preview runtime again: 0.8.0 left two of its
  files behind, so every project's preview failed to compile on a clean install.
  That failure is readable now too — the pane keeps the compile error on screen
  instead of letting webpack's trailing progress tick paint "100%" over it, and
  the error is written to `sidecar.log`.

## 0.8.0

### Minor Changes

- fea3077: Generate sound effects through a personal ElevenLabs connection with per-request approval. Save and play audio locally, retain generation details, recover completed downloads, and prevent automatic paid retries after uncertain results.

  Discover sound generation from the empty composer with a Generate sound shortcut that prepares an editable prompt or opens integration settings.

  Show generated sounds directly in chat with local playback, a Use in video action, and an editable Regenerate prompt. Preserve result cards in chat history.

- fea3077: Generate music through an ElevenLabs integration using the same chat workflow as sound effects. Add a Generate music shortcut, per-request approval, local playback, library saving, and music-aware regeneration. Preserve instrumental preferences and recover completed downloads without repeating paid requests.
- a0e2cda: Export asks what you want and renders what you are looking at.

  - **A dialog before the render**: a preset to start from — YouTube, Shorts ·
    Reels · TikTok, Instagram Feed — then format (MP4/H.264, WebM/VP9, GIF,
    MOV/ProRes), resolution (source, or a 720, 1080 or 2160 short side) and
    quality (Draft, Standard, High, or the project's own settings). The file it
    will write is a field in the same dialog, not a save panel afterwards: the
    name follows the preset and the format until you type one, and the folder is
    `out` until you choose another. A summary says the real output size, the
    container and the length; a preset that does not match the video's shape warns
    without changing it; a GIF says it carries no audio. Format and folder are
    remembered per project.
  - **A WebGL scene exports without editing `remotion.config.ts` first.** The
    render browser is a headless Chrome of its own and Remotion 4 gives it no GL
    backend by default, so a shader never finished compiling and the render died
    with stock advice about disk space. The studio now chooses `angle` on the
    desktop, measures whether that browser can really make a WebGL2 context, and
    falls back to software once if it cannot — while never substituting for a
    backend the project chose itself. Every renderer-backed feature shares that
    one policy.
  - **A `delayRender()` that never cleared is no longer blamed on WebGL.**
    Failures are classified — no GL context, a lost one, a dead browser, a missing
    asset, the encoder, the scene's own code — and the GL sentence only appears
    when the browser really could not make a context.
  - **The project's own render settings actually reach the render.** They are read
    from the installed Remotion's own option registry, in a fresh process so an
    edited `remotion.config.ts` is never served from a module cache, and forwarded
    only where that Remotion's `renderMedia` accepts them. A setting that the
    chosen codec would refuse — a CRF on ProRes, a ProRes profile on H.264, an
    audio codec the container cannot hold — is left out and said out loud.
  - **A render is pinned to the bundle and assets it started with**, so an agent
    saving a file mid-export cannot change frames that are still being encoded.
  - **The preview and the export agree on the composition**: `calculateMetadata`
    is resolved in the preview too, so a composition that computes its size plays
    in the pane and exports at the size the dialog promised. Element changes
    waiting in the composer block the export rather than being quietly left out of
    it.

- a0e2cda: Give generated videos shared timing plans for entry, reading and complete exits,
  including staggered groups, heading/details and persistent cards that become a grid.
  The new versioned motion library installs beside existing authored components.

  Full review discovers event boundaries from the rendered code and checks the
  actual targets. Agent completion requires a current report with complete boundary
  coverage and no unresolved measured viewer defects. Intentional text reveals are
  distinguished from text that stays clipped after settling.

  Generation instructions select a story from the supplied material and give the
  agent responsibility for routine movement and editing. A repeatable evaluation
  corpus records real exports, first-pass usability and user corrections separately
  from mechanical render tests.

- f9c429f: Settings has an Integrations section: services the studio can reach with your
  own account.

  - **ElevenLabs and Figma can be connected**, with an API key and a personal
    access token. Choose the service, paste the key, the studio checks it with
    the service before keeping anything, and you name the connection. Several
    accounts of one service are allowed and told apart by name. Check,
    reconnect, disable and remove are on each row; removing asks first and says
    plainly when the service itself could not be told.
  - **Each key lives in this Mac's keychain, in an entry of its own**, and never
    reaches a chat, a model, a log or your project. A key that is stored is never
    shown back — replacing it means typing a new one.
  - **A turn can ask which services are connected** and what each may be used
    for, and is told about connections you have checked and left enabled. It is
    never told the key.
  - **AI Accounts moved** out of its own row in the rail and into Integrations,
    where it sits beside the services as its own group. Nothing about it changed:
    the studio still only probes your own signed-in CLI.
  - **Stock media left Settings.** The Pexels key was never yours to change — the
    build ships one — so the section is gone and the Assets pane says so directly
    when a build carries no key.

- e0dead6: The app answers `remocn-studio://` links, and one of them makes a project.
  `remocn-studio://open-template?template=welcome-early-member&props=…` — the
  link the landing's thank-you page writes — creates `Welcome — ‹name›` under
  `~/Movies/Remocn Studio`, with the welcome composition copied in as its first
  video and the props from the link written into that video's `defaultProps`, and
  opens it on the player. It works from a cold start and into a running app, and
  it works signed out and on Free: the template is not a Pro feature.

  A link that is not one of ours, names a route or a template the studio does not
  have, or carries props that are not base64url JSON in the shape the composition
  declares, raises a toast and creates nothing. The link can carry no path and no
  command: only a template name from the list, and props.

- 3c11bcd: The documents the production pipeline writes — analysis, brand, script,
  motion, choreography, review — can be read in the app. The right pane's title
  becomes a **Preview | Docs** switch, and Docs is a file manager's tab strip
  over the document itself: one tab per markdown file the video's docs folder
  holds, in pipeline order with anything else after it by name, each carrying
  its file icon and its stage's name. Inspect and Snapshot leave the header in
  Docs — they point at pixels that are not on screen — while Export stays,
  because a render already running must not be hidden by looking at a document;
  arming either and switching to Docs disarms it, down the same path a rebuild
  takes. The preview iframe is hidden rather than unmounted, so coming back
  costs neither a page load nor the frame you were on. In the Video dock, a
  stage whose document is on disk becomes a button that opens it; a stage that
  has written nothing stays a plain line.

  The documents also moved: `src/videos/<slug>/docs/*.md`, inside the video
  rather than at `video/*.md` in the project root. The old literal path was
  shared by every video in a project, so a second video overwrote the first
  one's script. `docsFolderOf(slug)` in `shared/pipeline.ts` is now the one
  source for both the agent's brief and the viewer, and the stage templates
  carry the folder as a token the turn's own slug fills in — outputs, discovery
  and done-conditions alike. There are no users and no migration; documents
  written under the old path have to be moved by hand.

  Two sidecar methods carry it: `video.documents` lists a video's markdown with
  its folder — a folder that does not exist yet answers with an empty list, not
  an error — and `project.read` reads one file, resolving symlinks and `..` and
  refusing anything outside the project, larger than a megabyte, or holding
  bytes no text file holds. That containment is the permission gate's own check,
  moved to `sidecar/contained.ts` so there is one implementation of it rather
  than two. The list is re-read when a turn settles and the open document is
  re-read when the agent writes to it, both off signals the webview already
  receives; no watcher was added.

- bb12ad9: Inspect can now tune a scene live, in a properties pane of its own. Clicking a
  component that declares an `InteractivitySchema` (exported through
  `Interactive.withSchema()`, with its `controls` passed to its own `<Sequence>`)
  opens a resizable pane to the right of the preview: every supported field —
  numbers, booleans, colors, enum variants, CSS transforms, UV coordinates and
  constrained arrays — rerenders the Preview as it changes, coalesced to one
  command per animation frame, and only the selected instance moves when the same
  component is mounted twice. It is shaped like a design tool's inspector:
  sections for Transform, Layer, Typography, Fill and Stroke ahead of the
  component's own parameters, every number typed or stepped with the arrow keys
  (shift for ten) through DialKit-backed tactile sliders, with safe unbounded
  values retaining the scrub-capable numeric fallback. Two-value properties like
  offset and transform origin split into editable X and Y that keep their units,
  opacity is shown as a percentage, and colors use DialKit's swatch and editable
  hex treatment. Remocn remains the owner of Preview state and AI diffs; DialKit
  is the controlled presentation layer. Cancel and per-row Reset restore the
  original values; Add keeps the live result on screen and hands the agent a
  structured `Requested changes` diff — paths and values, never runtime target
  ids. A rebuild clears the overrides and marks saved diffs `Preview changed`.
  Elements with no schema keep the compact comment card over the frame, and raw
  `TransitionSeries.Transition` factory arguments stay out of scope for this
  version.

  Inspect also picks elements it used to fall straight through: a scene that
  puts `pointer-events: none` on an overlay layer — the usual way to keep a
  title from eating `clickToPlay` — is hidden from `elementsFromPoint`, so
  clicking the words selected the scene behind them. The canvas is forced
  hit-testable while Inspect is armed.

### Patch Changes

- a9bc9e4: Let the studio call you back when it is not in front: a macOS notification when
  a turn ends, the agent waits for your answer, an export finishes or fails, or
  the studio's helper stops, behind a new Settings › Notifications section: one
  master switch that asks macOS once, a Grant permission button for when it has
  not, and a switch per event. The Dock icon carries a badge with the number of permission cards
  waiting and a progress bar for a running export, and the unread mark on a chat
  whose turn ended while you were looking elsewhere is now big enough to see.
- 5cc54be: The bundled bun runtime moves from 1.3.2 to 1.4.2, and the test suite runs on
  `bun test` instead of Vitest: the same 2406 tests in a quarter of the wall clock
  and a fifth of the CPU. The properties pane's asset picker now lists a
  project's `public/` in a stable order, whatever order the file system hands
  the entries back in.
- 4589790: Guide video agents to trace reference events, derive dependent movement from actual
  group completion, and prove the film's direction with a representative passage.
  Require observed evidence for holds, repeated staging and review exceptions while
  keeping technical checks separate from creative judgment.
- 7d618c8: Add a command palette on ⌘K that reaches every action, video, chat and project
  by name, a View menu and a Video menu built from the same command registry as
  the palette, and a shortcut for each: ⌘E Export, ⌘I Inspect, ⇧⌘S Snapshot,
  ⌘B the project list, ⌘\ the preview, ⌘1 ⌘2 ⌘3 the sidebar views, ⌘D Docs,
  ⌥⌘↑ ⌥⌘↓ the previous and next video, ⌘. stop the turn, ⇧⌘R restart the helper.
  Settings gains a read-only Hotkeys section that lists them all.
- 70c8faa: The composer keeps what you hand it. Five ways it did not:

  - A file dropped on the message field was silently filed in the asset library
    instead, and the drop ring never lit — the drag position arrives in CSS
    pixels, not the physical ones it was being scaled from.
  - Pasting a picture with the caret inside an existing `[Image #N]` cut that
    token in half and silently dropped the attachment it stood for. The caret now
    snaps outside a reference before anything is inserted, on every path.
  - The Model, Effort and Mode menus stayed open after a choice, so the next
    click — aimed at the text field they overlap — silently changed the setting
    again.
  - macOS substitution turned `--flag` into `—flag` on the way to the agent, and
    the transcript stored the mangled text for good.
  - `.m4v`, `.mkv`, `.avi`, `.mpeg`, `.flac`, `.aiff`, `.opus` and `.oga` are
    taken now; a `.heic` is still refused, but the refusal names the format and
    says to export it as JPEG or PNG.

- 042f255: The composer's control row now adapts to a narrow chat pane instead of pushing
  the Send button out of the box. `buttonVariants` carries `shrink-0` in its base,
  so the row could not give: dragged past roughly 500px the chips simply overflowed
  the rounded container and Send was clipped by the pane's edge.

  The row is a container of its own, because the pane is resized independently of
  the window — a viewport breakpoint would measure the wrong thing. Two things
  share the work. The model chip is the elastic one, `min-w-0 shrink` with a
  truncating label, so no combination of labels can overflow the box; and the
  labels collapse in the order of what is worth reading, Effort first (its labels
  are the longest and it is the value changed least), Mode last, each chip keeping
  its icon, its chevron and now a `title` carrying what the hidden label said. The
  Queue button that appears during a running turn collapses with Effort, since
  Queue beside Stop is the widest arrangement the row ever holds.

  Collapse is decided by width alone, never by which mode or model happens to be
  selected, so dragging the splitter moves through the same two steps every time.

- 3be88cf: The properties pane moves to dialkit 2.0, which takes back three things it had
  been doing for itself. The slider now carries its own role, tab stop and
  keyboard, so the wrapper that added them is gone — keeping it would have meant
  a slider inside a slider. The colour control is a text field beside a swatch
  that opens dialkit's own popover, so the CSS that laid a native colour input
  over the swatch went with it, and nothing coerces the value any more: a colour
  written as `rgb(…)` or `oklch(…)` reads as itself instead of arriving black.
  The bezier curve is dialkit's too, handles and all, in place of our SVG and its
  drag hook. The preview dot under it is still ours and now runs the element's
  own window rather than a fixed 1.8 seconds.
- 594f999: The line between Free and Pro, drawn in the client. The plan document the
  account server signs is verified against its Ed25519 key before it is believed,
  cached in app data so a bad connection keeps the plan that was paid for, read
  again once a day, and read as Free — with a card saying the subscription could
  not be checked — once it has been offline longer than the document lasts.
  Each turn carries the plan to the sidecar: on Free the skills bundle is
  withheld, the `remocn-pipeline` server is not served, and the conventions keep
  the lane and drop the craft; Inspect and Snapshot are disabled with the reason
  on their tooltip and open the trial card instead. A Pro turn reads exactly what
  it read before.
- 9635c87: An edit in the properties pane now says who it moves, what it took back, and why
  it was refused.

  A target is found again rather than remembered. The runtime used to cache the
  controls of everything ever selected so a later edit could find its schema by id
  — which is exactly wrong for a Player that unmounts a scene on every loop, since
  the ids it held were dead by the time the next edit used them. The registry is
  keyed on the anchor instead and `rebind` re-resolves every live target on every
  registration: the anchor back to a node, then that node's `refForOutline`
  owners, then the fiber chain when none of them claim it. `sameMappings` keeps it
  idempotent, republishing the synthetic `overrideId → nodePath` map only when it
  really changed. A `targetId` is now `anchor::componentName` while an
  `instanceId` stays the bare anchor, because `controlsChain` routinely returns
  two links whose host is the same DOM node — an `Interactive.Div` and the
  `withSchema` wrapper around it — and a bare anchor would merge those two into
  one card, losing the author's own schema behind Remotion's built-in style one.

  A reset names paths, never a target. The preview reads an empty path list as
  "drop this target's whole draft", and a `CameraRig` framing the scene is in
  every chain — so letting go of one card used to take a camera change another
  card had already Added. `changedPaths` is the one door every reset goes through
  now: Cancel, Reset all, picking elsewhere, a rebuild, and removing a chip from
  the composer each send only the paths that card actually moved. `byTarget`'s
  empty-list branch, the last thing that could still emit `[]`, is gone.

  Reverting unsent edits says so, with Undo. Picking elsewhere with pending
  changes raises `Reverted 2 changes on Pushed line`, whose Undo is a fiber
  interrupt on an `Effect.sleep` window and re-sends every value it took back,
  reopening that card — the shape a deleted asset already uses, and the same ten
  seconds. Undo abandons whatever card is open before it restores, or edits made
  on the element you had moved to would be left live in the preview with nothing
  listing them.

  A refusal belongs to a row. `tuningRefusal` carries `{message, path, targetId}`
  and renders under the control that asked for it; only a refusal naming no path —
  a reset, or a runtime that named no field — keeps the footer line. A later `ok`
  clears it for that same target and path and nothing else, and an `ok` for a
  request nothing recorded clears nothing at all, since `abandon`, a rebuild and
  removing a chip all mint request ids without registering them. An element off
  screen at the playhead is refused with the frame it would appear on: _This
  element is not on screen at frame 42. Title runs from frame 30 to 120._ That
  window is read from Remotion's own `SequenceContext` value — `cumulatedFrom +
relativeFrom` — because summing `memoizedProps.from` up the fiber chain
  triple-counts an `Interactive.Div`, which is three fibers deep, reading
  `from={30}` as 90; and the end is the sequence's real duration, with 60 frames
  kept only as the fallback when there is no finite one, since a cap would report
  a 300-frame scene as ending 60 frames in and make the sentence lie.

  The pane says when an edit is shared: `Shared by 4 · a change here moves all of
them` under the title, because one nodePath per `overrideId` is Remotion's model
  and there is no per-instance key to publish an override against through the
  contexts a Player exposes. `PropsPanel` is keyed on the innermost target's
  `instanceId`, so a comment typed for one line does not follow you to the next. A
  stored selection now keeps the whole chain rather than the one link that was
  edited, so reopening a chip lands on the link the message was written from and
  removing one resets every link it carried. And the agent's block groups the
  changes by owner — `Requested changes on Title ‹headline›
(src/videos/intro/Title.tsx:24):` — because a flat list of paths taken off a
  three-link chain read as one component's props and sent it editing the wrong
  file.

- b7d12e1: Inspect now shows you what you picked, and knows which one of them it is.

  The selection is a box of its own. It used to be the hover box — `hovered ??
pinned` — so what you had clicked was visible only while the pointer was off the
  canvas, and a click the app then discarded made it disappear, which reads as a
  deselect. There are two boxes now: a thin hover box that lives and dies with the
  armed session, and a solid selection box that is module-level, set
  synchronously on `pointerdown` before anything is awaited, and cleared only by a
  rebuild. Turning Inspect off keeps it, along with any Add markers and the open
  card: off means stop picking, not forget what I picked.

  Identity is the picked DOM node, not Remotion's `overrideId`. Every
  `Interactive.*` rendered from one JSX call site shares one id — the bundler
  injects a `stack` prop and `with-interactivity-schema.js` keys the id on it in a
  module-level map; measured, five instances, one id. So comparing that id made
  four claim lines one element and threw away every click after the first.
  `preview/anchor.ts` mints an anchor instead — the nearest `data-design-id` plus
  `:nth-child` steps, falling back to the canvas — which is per instance and
  survives a remount. The edit still lands on the call site, because one node path
  per `overrideId` is the whole of Remotion's override model; what changes is that
  the pane can say `2 of 4` about which instance was meant. A literal re-click on
  the instance already open pulses the box and changes nothing else — but only
  while a card is open, since Cancel never reaches the page and the next click on
  that element would otherwise be a dead one.

  The pane is titled by the name the agent wrote. Remotion already delivers it —
  it appends a hidden `name` field to every schema and reads it into
  `controls.currentRuntimeValueDotNotation` — and `preview/tuning.ts` was dropping
  it with the rest of the hidden fields, which is why two clicks on two different
  lines drew byte-identical panes. Under the title is where the link lives, `Div
in WordPush · src/components/WordPush.tsx:245`. A chain link whose whole schema
  is `hidden` and `layout` — the `<Series>` chip, whose two controls hide the
  whole film — is dropped unless it is the innermost.

  The picker aims at what the person sees. An element whose computed `opacity` is
  below 0.05, or whose `visibility` is not `visible`, paints nothing, so an
  unrevealed word before its entry frame is no longer pickable; a masked element
  paints only where it shows text, because a mask can hide any part of a surface
  and text is the one thing it is known to show. The text test now walks every
  descendant text node and widens each rect horizontally by 0.35 × its font size —
  the word gap — so a click between two `inline-block` words lands on their line
  rather than on the marker or the backdrop behind it, and a candidate covering
  text beats one that merely paints a surface. A surface filling at least 80 % of
  the container on both axes — a full-frame glow, a scene backdrop — loses to any
  later candidate under the same point that covers less. Alt still picks the
  literal topmost node.

  Codegen writes for that pane, and `design_check` enforces it. The conventions
  now say what shape a run of text takes: one named `Interactive.H1`/`P`/`Span`
  whose direct child is the string, typography as literals in its own `style`, a
  `name` unique in the frame and equal to its `data-design-id`, and a component
  that splits a run into words keeping the split inside behind one `text` prop
  (declared `type: "text-content"` from Remotion 4.0.513). The easing scan that
  was one regex is seven rules — constant easing, a spring whose physics are
  nailed shut, a text run in a plain element, one literal `name` shared by every
  mapped instance, a curve whose window defaults to zero, a schema component that
  never forwards its `controls`, and a raw export of the component `withSchema`
  wraps — merged into `design_check`'s own `findings` array with a `tunability_*`
  code and counted into its `summary`, because prose appended after the JSON is
  not a finding and the review stage's done-condition is that every mechanical
  finding is fixed or explained. Measured over the eleven videos of
  `remocn-news-videos`: 75 findings, 51 of them constant easings.
  `motion-design` gains `rules/tunable-text.md`, a worked `Headline` typechecked
  against Remotion 4.0.481 and pinned as a fixture that scores zero, and the
  shipped video template now exposes its spring's `damping` as a prop rather than
  failing its own rule set. The conventions text grew by 879 characters
  (+6.9 %); the prose that replaces paragraph 9 is simply longer than what it
  replaced.

- 9635c87: The pane now moves the frame, marks what animates, and edits text and type.

  A curve is inert at a settled frame. Every generated `interpolate` clamps both
  sides, so outside an element's own window every bezier yields the same constant
  — which is why dragging an easing looked like nothing happening, and why the
  agent itself wrote _"Set from the preview. Still inert"_ into an AskScene. The
  selection carries `window`, the element's own sequence span, and the pane leads
  with a time strip: the frozen frame in mono, a range over `[from, until]` that
  seeks, and Replay. An edit to Entry, Exit, Effects or Timing, or to anything
  whose path ends in `easing`, schedules **one** replay 250 ms after the last
  flush — a forked `Effect.sleep` each flush interrupts and re-forks — skipped
  while the preview is already playing. Picking still does not seek: the paused
  frame is the one being judged.

  The playhead crosses the wire, and it is deliberately not React state. The
  entry subscribes to the Player's own `frameupdate`/`play`/`pause` and posts
  `playhead` at most once per animation frame; every `frameupdate` also repaints
  the selection box, so it tracks an element that is moving instead of lying
  about where it was. Holding that frame in `usePreview`'s state was free while
  it moved only on `selection`, `capture` and `rebuilt` and cost the whole
  application the moment it moved sixty times a second — `frame` is in
  `PreviewControl`'s memo, which is in `tools`, which is in the studio context
  that ten components read, so playing the preview re-rendered the transcript,
  the sidebar and the composer every frame. It is a ref with its own listener set
  now, read through `useSyncExternalStore` by the only two things that draw it,
  while the turn's `playing` frame is a stable getter called at send time. The
  armed readout carries no `role="status"`, the same rule the running-time ticker
  already follows.

  The Player's transport bar works while Inspect is armed. The swallow used to
  test the canvas _rectangle_, which is also the rectangle the transport bar is
  drawn over, so the bar appeared on hover and did nothing when clicked;
  `overCanvas` asks `elementsFromPoint` what is actually under the point and
  stops the event only when the canvas contains it, falling back to the rectangle
  where nothing can be hit-tested.

  A field the code animates is marked, because a static override replaces the
  animation with a constant. `tuning.read` is throttled to once per 250 ms with
  one trailing read when the frame settles, and the answer is
  `currentRuntimeValueDotNotation` — the component's own incoming props, taken
  before Remotion merges the drag overrides in, which is exactly what makes it an
  animation detector. The mark is sticky: a key does not stop animating in code
  because somebody overrode it, and recomputing it per read cleared the badge the
  moment the field was edited and took `sampled` off the change with it. The
  first version also tried to report _the preview is no longer applying this
  value_ from the same reading, which differs from a draft **by construction** —
  so it fired on every edited field as soon as the playhead moved. There is no
  merged reading to ask for; that detector is gone rather than left firing, and a
  runtime that genuinely refuses an override already says so in `tune.set`'s own
  answer. `sampled: true` rides the change and reaches the agent as `from
(runtime value at frame N, animated in code; change the landing value, not the
frame)`.

  Nothing the schema declares is dropped in silence. `fontWeight: 800` (a number
  against 4.0.520's enum of strings) and `letterSpacing: "-0.03em"` (a unit
  string against a number) used to vanish with nothing on screen to say so.
  `readingOf` now answers for every value: the enum case coerces and stays
  editable, the unit string keeps a read-only row, a `text-content` built from
  parts says so, and anything else keeps its row as _value in code_ through a
  guarded stringify — a circular value throwing there would have cost not its row
  but the whole selection. Only a key the runtime holds no value for is still
  dropped, or a text element on 4.0.520 would draw eight rows reading
  `undefined`. `TYPOGRAPHY` matches bare `fontSize`/`fontWeight`/… as well as
  `style.`-prefixed paths, which is how every agent-written video writes them.

  Text is a field where the runtime has one and a request where it does not. On
  4.0.481 the selection carries the element's own words and the loaded families,
  and the pane opens a **Text** section labelled _sent to Claude, not previewed_
  that rides `tuningChanges` as `{path: "children"}`; it exists only while the
  innermost target declares no live `children` field. A stored selection chip now
  carries `window`, `text` and `fonts`, so a reopened chip keeps its time strip
  and its faces.

  The environment checklist warns below Remotion 4.0.513 and never upgrades
  silently. The row reads what is _installed_ — `node_modules/remotion`'s own
  version, with the declared range only as the fallback — so `^4.0.481` resolved
  to 4.0.520 is not accused, and a range that cannot be read stays `ok` rather
  than being guessed at. _Upgrade Remotion_ runs `pmOf`'s manager with
  `name@4.0.520`, in the manifest the row read rather than the lockfile's
  directory: for a workspace member those differ, adding at the root would write
  the pin somewhere the row never looks, and `yarn add` at a workspace root
  refuses outright. `warn` does not lock the composer and no longer claims the
  project is broken — the card reads _This project has one thing worth fixing_
  until something has actually failed.

  **The template pin does not move in this wave.** The six packages stay on
  4.0.481 until the gate in the running app is run against the prepared 4.0.520
  copy of the videos project: the preview compiles, a click opens a pane with a
  Typography group, dragging `style.fontSize` changes pixels, typing in Text
  changes the frame, and a snapshot still stays byte-identical to `npx remotion
still` on the same frame from the same copy. The mechanism is complete and
  pressable; moving the pin on a packed-source reading rather than a running
  Player would ship every new project onto a Remotion this studio has never
  previewed.

- 6effc7d: The left pane reads the way it is meant to.

  - Clicking a video opens its most recent chat, as the design always said it
    did. The row only expanded, so a video could sit expanded and highlighted
    while an unrelated chat drove the preview, the conventions and Export. The
    chevron beside it now has its own hit area and expands alone.
  - An inactive chat title was fainter than its own timestamp and failed WCAG AA
    in both themes — a fade applied to a token that was already a fade. The
    active row carries the emphasis instead.
  - The Components pane's sticky role heading sat under the tiles, so its text
    collided with tile labels while scrolling. It is above them now.
  - A saved stock photo is named `ocean — Magda Ehlers` rather than a truncated
    sentence of Pexels alt text, which made every card read `Dynamic wa…`.

- 76f5b1d: Make the permission gate absolute in Accept edits and Plan. Claude Code's own
  classifier approved a tool call before `canUseTool` was ever consulted, so a Bash
  command in either mode ran with no Allow/Deny card — measured: `ls src/videos`
  produced a tool row and nothing else. A `PreToolUse` hook now runs the same review
  ahead of that classifier and routes the calls that want a card into the existing
  gate. `auto` is unchanged, where the classifier deciding first is the trade that
  mode is. A stream chunk the webview cannot decode is also no longer dropped in
  silence — that is what made this impossible to diagnose from the logs.

  Say why a turn did not run in the mode it was given, and stop the Mode chip
  claiming one it did not. Haiku 4.5 does not offer Auto — Claude Code downgrades
  it to `default` and only the notice said so, in words that read as a fault in the
  studio. The notice now names the model, the chip reports the mode the turn will
  really run in, and the menu's Auto row carries the reason it cannot be picked.
  The session keeps the mode that was chosen, so a model with Auto brings it back.

- f8d87be: Dragging the chat/preview divider to the window edge no longer strands the
  preview. The panel collapsing inside react-resizable-panels was a different
  state from the app's own "preview hidden", and the header renders the way back
  off the latter — so one drag took the preview along with the toggle, Inspect,
  Snapshot and Export, in a layout the studio then persisted across launches. A
  collapse the panel reports now folds into the one flag, so the existing "Show
  the preview" button is there, and a layout already stored collapsed heals on
  the next launch.
- baf5416: The preview pane comes back, and says things in words.

  - After a sidecar crash the pane showed the bare word `cancelled` and stayed
    dead until someone found the unlabelled Restart button. It now comes back on
    its own when the sidecar does, and the gap is worded.
  - A failed Snapshot printed the renderer's raw error — a wall of percent-encoded
    URL, clipped where it ran off the pane, ending in Remotion's advice to buy more
    disk. It now names the asset that would not load, and nothing can overflow the
    pane again.
  - The Inspect box no longer stays painted on the frame after Cancel: it belongs
    to the properties pane, not to the mode, so disarming still keeps it while the
    pane is open.
  - An element chip is named the way the properties pane names it — the component
    the person saw, not the wrapped function behind it.

- 5d81098: The properties pane picks up the rest of dialkit's controls. A pair of numbers
  that is really a place on the frame — an offset, a transform origin, a UV
  coordinate — is one pad now instead of two sliders, with its Y the way up a pad
  has it rather than the way down CSS writes it. A picture is a field at last:
  Remotion's `asset` type was not in the pane's list at all, so an element made of
  an image opened with the image missing and nothing saying why; it is a picker
  over the project's own `public/` now, and changing it changes the preview. The
  three numbers of a `spring()` are drawn as one response above them rather than
  three unrelated dials, and the conventions ask the agent to name them so. And
  the pane's sections fold, remembered between elements, because an element on a
  real video opens with eight of them.
- fea3077: Use Remocn Studio as the application and release display name. Add the publisher, video category, descriptions, project links, and MIT license metadata, and include the license in the application bundle. Preserve the existing bundle identifier and deep-link scheme for compatibility with installed apps, stored credentials, and sign-in callbacks.
- ce91687: New projects scaffold on Remotion 4.0.520, so their text and type are editable.

  Below 4.0.513 `Interactive.js` builds an element's schema from `baseSchema +
transformSchema` alone — origin, translate, scale, rotate, opacity, hidden. There
  is no string field type, so no primitive anywhere can carry a font size, a weight
  or a colour, and no amount of work in the pane could have added one. That is why
  clicking a line of text in a real 4.0.481 video opened a pane with a Text row that
  could only be sent to the agent and nothing typographic beside it.

  The six pins in `templates/remotion/package.json` move together, and
  `sidecar/scaffold/template.test.ts` now asserts a floor of 4.0.513 next to the
  existing one-version rule. The template's title becomes an `Interactive.H1`
  carrying `name` and a matching `data-design-id`, the shape the conventions ask of
  every agent-written text run; `RisingText` takes that name as a prop rather than
  borrowing the one its `<Sequence>` already had. The text tags exist on 4.0.481
  too, so that part typechecks on both versions — what 4.0.520 adds is the schema
  behind them.

  What was measured before moving, against a real 4.0.520 installed in a scratch
  copy of the videos project: `textSchema` and `textContentSchema` are spread onto
  every text tag; the controls object still carries exactly the four fields
  `SequenceControls` declares, so `asControls` needed none of the optional fields it
  was expected to grow; every override seam the runtime drives is present; and
  `SUPPORTED` covers every field type 4.0.520 emits except `remotion-captions`,
  which has no control behind it. The video template typechecks against those types
  with a `tsc` run whose `node_modules` is that copy's.

  What was not measured is the running app: that `controls` is non-null on an
  `Interactive.Div`, that a `style.fontSize` drag moves pixels, that typing in
  `Text` moves the frame, and that a snapshot still stays byte-identical to
  `npx remotion still` from the same copy. The pin moved on the owner's call rather
  than on that gate, and existing projects are untouched — moving one is still the
  Upgrade button in the environment checklist, never silent.

  A `text-content` field never takes its schema default. Remotion answers
  `undefined` for `children` when the runtime value is not a string — a component
  that split its line into word spans, which is what `WordPush` and every
  staggered-text component in the corpus does — and that `undefined` _is_ the
  signal. `textContentSchema` declares `default: ''`, so defaulting it turned the
  signal into an empty string, which is a perfectly good `text-content` value: the
  pane drew an editable, empty Text box over a line whose text it could never
  write. It now reads _Text is built from parts — ask in words_, read-only, as it
  was meant to. The test that covered this passed either way, because its fixture
  declared the field with no `default` at all where the real schema has one.

- fea3077: Use a static capture of the studio's violet shader as the macOS DMG background, with a matching window size and positioned application and Applications icons.
- 4c1f55c: macOS builds are now signed with a Developer ID and notarized by Apple, so
  the app opens on first install without the "developer cannot be verified"
  dialog and the right-click workaround. The bundled bun runtime keeps the
  five hardened-runtime entitlements it ships with, so the sidecar starts
  under the new signature exactly as before, and the `.dmg` itself carries a
  notarization ticket as well as the app inside it.
- 7f1b929: Guide video generation through motion examples from all five remocn templates, with source-based adaptation and comparison of the resulting choreography.
- fea3077: Replace the application icon with Violet shader artwork and add a matching light version. The running macOS Dock icon follows the Studio theme, including changes from the System setting. Packaged icons use the dark version by default.
- b68eabf: Upgrade from the app. Settings › Account shows the plan as one surface — on a
  trial, a bar of how much is spent between its two dates — and, below it, the
  same Free and Pro cards the account page draws, with a Yearly / Monthly
  toggle. Pro's button asks the account server for a checkout and opens it in
  the browser; the trial card's Upgrade and the tooltip Inspect and Snapshot
  carry on Free lead there. While the page is open the app asks the
  server every five seconds, for ten minutes, then offers Check again; the
  purchase ends on one line, _Subscription active_, with the plan already Pro
  and no relaunch. A declined card's _Update card_ opens the billing portal.

  Settings is a page now, not a dialog: it takes the window, with the rail on
  the left and one readable column on the right, while the preview and any
  running turn stay exactly where they were underneath. Escape is the way back.

  Appearance gains a Title bar group: the band's shader can be turned off, or kept and
  held still, with a sample of the field beside the switches.

- fea3077: Show video design findings as visible review cards with improvements, cautions,
  observations and coverage status. Keep technical tool failures separate, extract
  useful diagnostic lines, shorten activity labels and consolidate consecutive
  identical failed attempts while retaining their logs. Fix the generated registry
  wrapper type and upgrade unchanged copies from earlier versions.
- 9d5a15a: Snapshot and the design check work again on a video that uses footage. The warm
  render page was told `proxyPort: 0`, so `OffthreadVideo` fetched every frame
  from `http://localhost:0/proxy?…` — a port Chrome refuses outright — and the
  capture hung until it failed with Remotion's guess about low disk space. The
  session now starts the same offthread-video proxy `renderStill` prepares and
  gives the page its real port, closing it with the session. The page also gets a
  source map at last, so the browser's own log lines stop throwing on the way out.

## 0.7.0

### Minor Changes

- 11abb95: Point out the features that nobody finds on their own.

  Inspect, Snapshot, `[Image #N]` on ⌘V, the asset library, the plan drawer,
  turns that keep running in the background — all of it is discovered by accident
  or never. A tip now appears the first time one of them is genuinely usable: an
  anchored card at the element itself, one at a time, and only when nothing else
  is already asking to be answered.

  It is deliberately not a ten-step tour on first launch. Half those steps would
  point at controls that are not on screen yet, and a wall of them gets closed
  unread. The catalog is data — one entry per tip with a pure availability rule
  over states the studio already keeps — so what can be shown and when is a table
  test rather than a walk through the app.

  "Got it" is remembered in `settings.json`; clicking away is "not now" and writes
  nothing. Settings → Behavior has a Replay tips button that offers every one of
  them again.

## 0.6.0

### Minor Changes

- 37a6e37: Give Codex, Copilot and Grok the same five bundled skills Claude already had.

  The studio has always shipped its knowledge as one plugin — `remocn`,
  `remotion-best-practices`, `remotion-interactivity`, `video-lessons`,
  `motion-design` — and only Claude ever loaded it. The other three got the
  always-on conventions and nothing else, so the same request produced a different
  process depending on whose model answered it. Now every provider gets the whole
  bundle, through its own native skill mechanism, out of the one `agent/skills/`
  that was always the source of truth. Nothing is copied into your project, no
  skill body is pasted into a prompt, and progressive disclosure still works: the
  runtime shows a catalog and the agent opens what it needs.

  Copilot and Grok take the shipped directory as `--plugin-dir` and read the
  manifest the plugin already carried. Codex needed more: it resolves plugins only
  from a user config layer, and `--config` overrides land in a layer it
  deliberately skips — measured against codex-cli 0.148.0, `codex plugin list`
  with those overrides answers "No marketplace plugins found" and the same tables
  written into a `config.toml` answer with the plugin. So the studio keeps a Codex
  home of its own beside its database and mirrors yours into it: every entry is a
  symlink back, `auth.json` included, so the ChatGPT session and the sessions you
  can resume are the same ones. Only the config and the plugin store are the
  studio's, and your `~/.codex/config.toml` is never written to.

  Attach is a value now, not a guess from the provider's name: `{ loaded, source,
collisions, reason }`. Skill-aware conventions are sent because the attach
  succeeded, and they name the skills in words no single runtime owns, so the same
  sentence resolves in four catalogs. A bundle that is missing or incomplete
  degrades to the studio conventions plus one notice — never a failed turn, and
  never dressed up as an auth or model failure.

  A project that ships its own copy of a bundled skill no longer switches the
  whole bundle off. That copy wins by each runtime's own precedence, the collision
  is logged, and the other four skills still load.

  Measured per turn, against the same prompt: Claude +1215 tokens, Grok +978,
  Codex +605. Copilot's live run is blocked by an org policy on the account this
  was built on, so it keeps its Experimental badge until someone can run the
  matrix against a Copilot login that works.

- 04d75b2: Generate a moodboard before building the video: photo references, a palette, a
  type pairing and tone words, curated by the agent and rendered to a real PNG.

  The spec is a neutral JSON structure (`shared/moodboard.ts`) — the generation
  does not know which canvas the board will end up on, which is what keeps a
  Paper or Figma adapter (REM-265) a pure translation later. The default render
  needs no external MCP at all: a deterministic HTML+CSS page built from the
  spec, screenshotted through the same provisioned headless Chrome the snapshot
  machinery already owns, at the exact 1440×900 viewport the `source` capture
  already opens.

  Three agent tools land on the existing `remocn-library` server, auto-allowed
  like the rest: `search_stock` finds Pexels photography through the sidecar's
  own client (the key and the network never reach the agent),
  `save_moodboard` downloads the curated picks, writes `spec.json`, renders the
  board and stores it all as one ordinary library asset — preview, undo window
  and insertion already work — and `get_moodboard` is the idempotence gate: an
  existing board comes back as its ready spec and PNG, so the expensive
  search-and-curate pass is never repeated unless the person asks to start over.
  Iteration is the same save with one block replaced; the pipeline's brand stage
  now calls for the board and works from its palette.

- 9632171: Movement now has a role: entry, emphasis, exit, scene or transition.

  Keyframes are being replaced here by a vocabulary of named behaviours, and a vocabulary
  needs a skeleton. This is it — one axis that says _when in the life of the thing it is
  attached to_ a movement runs, where the Components pane's categories only ever said what
  a component was about. All 99 bundled remocn components are classified: 21 entry, 15
  emphasis, 4 exit, 36 scene, 23 transition. Exit being that thin is information, and it
  is visible now.

  The pane groups by those five words instead of by category, with a count on each
  heading; category survives in the data and orders the tiles inside a group, so Scene
  still reads shaders before filters. A component you saved sits in its own role next to
  the shipped ones — that is the point, the dictionary is meant to grow — and anything
  saved before roles existed keeps a leading _Saved_ group.

  The agent is told the same vocabulary in every turn: the five roles, the rule that every
  animated element gets an entry and an exit and that emphasis is spent on the one thing
  that matters, the twenty dictionary names, and the props each role is expected to expose
  — so a behaviour it invents arrives with the knobs a props panel can pick up later. The
  names are in the conventions and the recipes are in the `motion-design` skill, which now
  carries a Remotion recipe and a starting number per name. `save_asset` takes the role,
  so a behaviour worth keeping joins the library already classified, and an inserted asset
  reaches the turn as `[Asset #N] Name (entry)`.

  The dictionary obeys `video-lessons` rather than competing with it: there is no `pulse`
  in it, because §1 bans pulsing, and `rise-in` is documented as panels-and-images only,
  because a text entrance travels on X or the glyph baselines snap.

  Nothing without a role behaves differently. The field is nullable wherever it is stored,
  a manifest written before this reads back as having none, and media is never given one.

- 27afc95: Ship the bun runtime, and install each project with its own package manager.

  The app used to need bun on the machine to start at all — no bun, no sidecar, and
  so no chat, no history, no preview, and not even the checklist that would have
  explained it. bun now rides in the bundle as a Tauri external binary, so the only
  thing the studio still asks for is a Claude Code you are signed in to.

  The other half is that bun is no longer everybody's package manager. `pmOf` reads
  the project's lockfile — npm, yarn, pnpm or bun — and the scaffold, the Install
  button and the "not installed yet" line in an asset brief all follow it, so
  opening a project with a `package-lock.json` no longer earns it a second
  lockfile. A project whose manager is not installed says so, and offers to install
  Node.js for you.

- ef73b8c: Add a measured product-launch rhythm profile, a launch-teaser recipe, and a
  bounded `keeps_moving` design assertion. The research corpus records only
  public source metadata and derived measurements; raw reference videos stay
  local and are never shipped.
- 1b83f12: Crash reporting through Sentry, off until it is switched on.

  A Rust panic, an unhandled rejection in the sidecar and a React render that
  throws now reach Sentry — and only with the person's consent, which is opt-in
  in Settings › Behavior and initialises no SDK at all until it is given. Paths
  are stripped of the home directory before anything is sent; prompts, agent
  conversations, project sources, breadcrumbs and the machine's hostname are
  never attached. A development build reports nothing whatever the switch says,
  and so does any build carrying no DSN — which is every build until the Sentry
  project exists, so this release behaves exactly as the last one did.

  `bun run crash:verify` measures all of it against a local stand-in for
  Sentry's endpoint, with no account needed.

## 0.5.0

### Minor Changes

- 18a165d: Drag video, audio and pictures from Finder straight into the composer.

  The message field is now a drop target beside the library. What lands in it is
  sorted by kind rather than by where you let go: a picture joins the attachments
  with an `[Image #N]` written at the caret, exactly as pasting one does, and a
  video or a sound joins the media list, which carries no reference — the sentence
  you write is what points at it. A mixed drop splits across both.

  There is still one drag subscription in the app. `useFileDrops` owns it and asks
  `zoneAt` which of the zones a drop landed in, so the composer and the library
  cannot both claim the same file, and a drop that missed both is ignored without
  a word — the left pane goes back to whatever it was showing before the drag
  passed over it.

  A locked composer is not a target at all: waiting on a permission card, a folder
  that is gone, or a failing environment check takes the field out of the hit test,
  so the ring never lights on a message that could not hold the file. Anything that
  is not media is refused out loud, in the same sentence the library uses, now
  saying which of the two it did not go into.

- 6e82941: Write the next message while the turn is still running, and let it queue.

  Send during a run no longer clears the field and drops what you wrote on the
  floor — the message joins a queue on that session and the button says so, in
  words: **Queue**, beside Stop rather than instead of it. When the turn settles
  cleanly the head of the queue goes out as an ordinary turn, in the mode the
  session ended in, so a plan approved mid-turn carries.

  The queue is the session's, not the screen's: a background session dispatches
  its own queue while you are looking somewhere else, exactly as its turns already
  run there. Three things deliberately hold it where it is — a turn you stopped by
  hand, a turn that failed, and a permission card still unanswered — because
  sending a prepared message over an error, or over a question you have not
  answered yet, is not what anybody meant.

  The queue is a drawer on top of the composer, beside the plan and sharing its
  chrome: one line whatever is in it — the message that goes out next, and how many
  wait — opening upwards into the whole list. Each row carries an × to forget it
  and a click to put it back in the composer for editing: the text, its
  attachments, its elements and its assets together, since the `[Image #N]`
  invariant is positional and cannot be split. Editing needs an empty composer, and
  the row says so rather than overwriting a draft.

  The queue lives in the webview and does not survive a relaunch; nothing in the
  sidecar or the IPC contract changed, because every queued message becomes an
  ordinary `claude.prompt` when its turn comes.

- 762d4e6: Point at a file with `@`, anywhere on the machine.

  Typing `@` in the composer opens a list of the project's files, filtered as you
  keep typing and matched on the file name as well as the path. Enter or a click
  writes the file into the message as a path in backticks, and the sentence around
  it is what says what to do with it. Escape leaves the `@` as the plain text it
  was.

  Each row leads with the mark of what the file is — the React logo on a `.tsx`,
  TypeScript, JSON, Markdown, CSS, and a plain glyph by category for pictures,
  video, sound, fonts and archives.

  The arrows walk the list and the list follows them, so the highlighted row is
  always the one you can see — including after typing narrows the list and moves
  the row you were on.

  A query that starts with `/` or `~` browses the filesystem instead: the list
  becomes that folder's contents, Enter on a folder drills into it and keeps the
  list open, and Enter on a file writes its absolute path. A file outside the
  project is read through the ordinary Allow/Deny card, because the permission
  gate auto-allows only what is inside the opened folder.

  A tagged file wears a chip where the message is drawn — in the composer as you
  write it and in the bubble after it is sent — so a path reads as a thing you
  pointed at rather than as punctuation in the middle of a sentence. A backticked
  span that is not a path, `Main` among them, is left as the text around it.

  A tagged file is plain text, not a fourth kind of reference beside
  `[Image #N]`, `[Element #N]` and `[Asset #N]` — a path is the whole payload, so
  nothing is spliced into the turn, the transcript and its SQLite rows are
  untouched, and a reopened session renders exactly what was sent.

## 0.4.0

### Minor Changes

- 727e9bf: Footage bigger than the composition previews from a proxy.

  A 4K clip made the preview crawl, and the reason was not the one it looked
  like. Measured in WebKit on a 15s clip: linear playback of 3840×2160 was almost
  fine — 33ms between frames at the median, the hardware decoder keeping up — but
  a **seek** cost 59ms against 6ms at 1920×1080, ten times worse. Remotion's
  preview seeks constantly: `seekThreshold` is 0.01s while the Player is paused,
  so every step, every scrub and every stop on a frame is one, and 59ms is nearly
  two frame budgets at 30fps. That is what a clip mounting mid-transition ran into.

  So a video asset taller than 1080p now gets a 1080p h264 proxy, made in the
  webview with `@remotion/webcodecs` — the encoder is there and configures for
  hardware, asked at run time rather than assumed. The preview page and the render
  page are served under different static bases: the preview resolves a file to its
  proxy, the render page never does, so an export and a snapshot still carry the
  original and "content matches the preview" holds everywhere it can be seen. A
  1080p file is left exactly as it is, since it already seeks inside a frame.

  Matching is by content hash, so one proxy covers every project the asset was
  inserted into. Conversion runs 0.58× realtime even with hardware encoding, which
  is why it is a background backfill and not a step of saving: the asset is usable
  the moment it lands, and until its proxy exists the preview streams the original
  — slower to seek, never broken. A webview with no encoder, and a clip already at
  the target, both record the decision so it is taken once.

- 727e9bf: Save an asset once and reuse it in every other video.

  The library lives in a drawer at the bottom of the left pane — one quiet strip
  with a count that opens upward into a grid of thumbnails, the way the plan
  drawer opens out of the composer. Closed, the sidebar looks exactly as it did
  before assets existed. It holds images, video, audio and finished Remotion
  components. Drag or click one into the composer and it lands
  as `[Asset #N]` — a third reference kind beside `[Image #N]` and `[Element #N]`,
  with the same chip, card and renumbering. On send the sidecar copies the files
  into the project _before_ the turn — media into `public/library/`, a component
  into `src/library/<slug>/` — and the prompt says where everything landed, which
  npm packages are missing, and that an existing file was left untouched. So the
  agent spends no tokens retyping code, raises no permission card reading app
  data, and an edit it made in an earlier turn survives.

  Saving media is a click: an icon on the attachment card, or a card above the
  composer when a turn that carried pictures ends. Content-hashed, so a file
  already saved or already declined is never offered again. Saving a component is
  the agent's job — it wrote the code and knows the import graph — through a new
  in-process MCP server, `remocn-library`, whose tools are auto-allowed the same
  way the pipeline's are. Two shortcuts write the phrase for you: a _Save to
  library_ button on the Inspect comment card, and one in the composer's + menu.

  The library lives in `app_data_dir`, as `assets/<slug>/` plus a `manifest.json`
  whose Schema is in `shared/`, so listing is a folder scan and previews load over
  the asset protocol for free.

  **Video and audio come in two ways.** The composer's + menu now takes them
  beside pictures, and the Assets tab accepts a drag straight from Finder. A
  picture still travels to the model as an image block spliced at `[Image #N]`; a
  video or a sound cannot — the API has no such block — so the sidecar copies it
  into `public/library/` before the turn and hands the agent the `staticFile()`
  path instead of the one on your disk. That keeps `[Image #N]` meaning what it
  has always meant, and makes an attached clip usable rather than silently
  dropped. Both kinds carry the same save-to-library icon, and both are offered
  by the end-of-turn card.

  **The library is a grid of thumbnails.** Two columns of cards — the picture
  over its name, with the clip's length badged in the corner — instead of a list
  of rows wearing type icons. Hovering a card reveals a Delete button, which
  takes the tile away at once and the folder only after an undo window, the way
  deleting a session already works.

  A video shows its first frame and a sound shows its waveform. Both are decoded
  once, when the asset is saved, and filed beside it as a picture, so the panel
  draws ordinary images and a library of thirty clips decodes none of them to
  list itself; anything saved before this existed is filled in the first time you
  open the tab. The length comes from the same decode, so the badge costs nothing
  extra. Cards in the composer, and any video whose frame is still missing, fall
  back to seeking the video itself — frame zero is the one time a `<video>` will
  not seek to, so it asks for a tenth of a second in.

### Patch Changes

- 76a6888: Refresh the vendored agent skills — `remocn`, `remotion-best-practices` and
  `remotion-interactivity` — against upstream. They had drifted far enough that
  `skills:check` failed on every run: upstream had added an `agents/openai.yaml`
  and an icon to each skill, rewritten several reference pages, and dropped one
  the vendored copy still carried.

  What the agent knows about Remotion is now what upstream ships. `video-lessons`
  is ours and is untouched.

- 727e9bf: Video and audio play in the preview.

  A composition that reached for a clip through `staticFile()` played in
  `npx remotion studio` and hung on the Player's buffering spinner here. The
  preview's own static server answered every request with `200` and the whole
  file, chunked, with no `content-length` — and the macOS webview will not start
  a `<video>` on that. It probes with `Range: bytes=0-1` first, and a response
  that is not `206` ends the attempt; `OffthreadVideo` defaults to
  `pauseWhenBuffering`, so a clip that never became playable read as a preview
  loading for ever rather than as anything failing.

  The server now answers byte ranges: `accept-ranges`, a real `content-length`,
  `206` with a `content-range` for a range it can serve, `416` for one past the
  end, and no body for a `HEAD`. Range parsing is a pure function with its own
  tests, since it is the half that has edge cases. `.mov`, `.aac` and `.ogg` also
  gained the media types they were missing — the library accepts all three, and
  they were being served as `application/octet-stream`.

  Files under `public/` are also cacheable now. Playing a scene means seeking the
  video element once per frame, and every seek against a `no-store` response is a
  refetch — as was the whole file on each loop. They carry `no-cache` and an ETag
  of size and mtime instead, so the webview keeps the bytes and revalidates, and a
  clip the agent replaces still invalidates. `bundle.js` keeps `no-store`, where a
  cache hit outliving a rebuild is the failure that matters.

## 0.3.0

### Minor Changes

- 906cbd2: Show the plan Claude writes as one live checklist in the transcript, instead of a
  wall of `TaskCreate` rows. Task calls fold into a single list anchored where the
  plan was written, each row a subject with its status and its description on
  demand; the thinking marker reads the running task's `activeForm`; the task tools
  carry a task icon and never raise a permission card.

  A running session in the projects pane now says which task it is on and how far
  the plan has got, in place of `Running · 2m`.

  The current plan also sits on top of the composer: one line saying which task is
  running and how far the plan has got, opening upwards into the whole list.

  Task subjects wrap instead of truncating, the list is set at a readable size, the
  block carries a proper elevation token, and whether it is open is remembered
  across launches.

## 0.2.0

### Minor Changes

- 97d1207: Show the plan Claude writes as one live checklist in the transcript, instead of a
  wall of `TaskCreate` rows. Task calls fold into a single list anchored where the
  plan was written, each row a subject with its status and its description on
  demand; the thinking marker reads the running task's `activeForm`; the task tools
  carry a task icon and never raise a permission card.

  A running session in the projects pane now says which task it is on and how far
  the plan has got, in place of `Running · 2m`.

  The current plan also sits on top of the composer: one line saying which task is
  running and how far the plan has got, opening upwards into the whole list.

  Task subjects wrap instead of truncating, the list is set at a readable size, the
  block carries a proper elevation token, and whether it is open is remembered
  across launches.

## 0.1.0

### Minor Changes

- 3e8a7cd: Export the previewed composition to mp4 from the preview pane, rendered by the project's own
  `@remotion/renderer`.

  The render reuses the bundle the preview is already serving, so the file cannot drift from what is
  on screen, and it refuses with a clear message when the project's `remotion`,
  `@remotion/renderer` and `@remotion/bundler` versions disagree. Progress reports frames rendered,
  then encoding, then the final combine; Cancel stops the render and removes the partial file, and
  the finished `out/<Composition>.mp4` is revealed in Finder. One export runs at a time.

- d7c9f7e: Check the environment when a folder is opened, and say what is wrong above the composer instead of
  letting it fail as a blank pane or a stack trace.

  The checklist covers the things the app depends on but does not own: whether Claude Code is logged
  in, which bun is running the sidecar, whether the folder is a Remotion project, whether its
  dependencies are installed and agree with the lockfile, whether a Remotion entry point is
  registered, and — once the preview has compiled — whether any composition is registered and whether
  one of them is called `Main`.

  Only being logged out locks the composer, because that is the one failure that would otherwise
  happen on send. Missing dependencies can be installed from the card, with the output streaming as
  it runs. Everything that passes is silent: the card renders nothing at all once there is nothing to
  act on, and it re-runs on opening a project, on Recheck and after an install — never per message.

- c47cd73: Ship a `video-lessons` skill in the bundled agent plugin: the production lessons from remocn-demo
  and its spun-off films, where every rule is there because the opposite was tried and had to be
  re-rendered.

  The turn's system prompt now tells the agent to work from it before writing or changing any video
  code, so the same corrections no longer have to be pasted into a prompt by hand. The instruction is
  added only when the plugin actually loaded, since a project carrying its own copy of a bundled skill
  drops the plugin wholesale.

### Patch Changes

- 3e8a7cd: Split the projects pane in two: the projects still on disk stay at the top, and the ones whose
  folder moved or was deleted collect under a "Moved or deleted" heading below them.

  They keep their sessions and transcripts — the history is still worth reading, and `Locate…` still
  reconnects a folder that only moved.

## 0.0.1

### Patch Changes

- ec3db4d: Chat transcript: assistant answers render as markdown — headings, lists and syntax-highlighted code — instead of raw text, streamed with a per-word reveal so an 85-character delta arriving every 470 ms reads as typing rather than stepping. Highlighting is Shiki loaded through a custom Streamdown plugin over `createHighlighterCore` with a fixed language set (tsx, ts, jsx, js, json, bash, css); `@streamdown/code` as it ships pulls every bundled grammar and costs 9.1 MB.

  The animate plugin skips every text node inside `code`, `pre`, `svg`, `math` and `annotation`, so inline code used to pop in fully opaque while the words around it were still arriving; it now carries the same fade.

  Every tool call is one compact activity line — `Edit src/Scene.tsx`, `Bash bun run build` — with a running/done/failed state, and clicking it expands the detail: a real line diff for Write and Edit, computed from the tool's own `old_string`/`new_string` rather than parsed out of the result text, the command next to its output for Bash, and a preview for everything else. A failed call shows its error without being expanded. Long output is capped at 60 lines with a "Show N more lines" affordance, so a 5000-line Bash result cannot lock up the pane; transcript blocks are memoized and rendered through `MessageScrollerItem`, which gives each one `content-visibility: auto`.

  A waiting turn says so in the transcript, where the answer will appear, rather than under the composer: a `Marker` with shimmering "Thinking…" that stands where the next block will land and steps aside the moment text starts streaming.

  Composer: pick a reasoning effort (low → max, persisted) alongside the model, attach images that are sent to Claude as image blocks, and watch context-window use on a ring that fills as the session grows. The model picker moved out of the pane header into the composer. Attached files travel as paths — the sidecar reads and encodes them, so no base64 crosses the Tauri IPC — and the context reading is taken from the live SDK query just before it closes, since there is no session left to ask afterwards.

- b285805: Turns keep running when you look away. Turn state — entries, the fiber, the
  pending permission queue — moves out of the chat pane into the provider as a map
  keyed by the session id the webview minted, so switching sessions is a read from
  another key rather than an unmount. Where a `key` prop used to be the cancel and
  the interrupt was a side effect of remounting, cancellation is now `stopTurn`,
  said out loud, and nothing else stops a turn.

  What was one "is thinking" boolean for the whole app is a status per session: a
  row shows running, waiting on a permission, or failed, and a turn that finished
  while you were elsewhere leaves an unread dot that clears when you open it. None
  of it is stored — the transcript in SQLite is the durable part, this is just what
  is happening right now.

  A permission raised by a session you are not looking at marks its row and is
  answered from that session, because the card belongs to its turn rather than to
  the screen. The gate now denies anything left unanswered for ten minutes: with
  background turns, nobody seeing a card is the normal case, and an unanswered card
  holds a `claude` process open indefinitely.

  Quitting with turns in flight asks first. The Rust core prevents both the window
  close and the app exit and emits `app://quit-requested`; the webview quits
  straight away when nothing is running and asks when something is, because the
  sidecar dies with its process group and every in-flight block dies with it.

- 93705aa: Sessions and history: every conversation is kept in the app's own SQLite, so
  closing the window no longer throws the transcript away. The left pane lists
  sessions newest first with their folder and a relative timestamp; picking one
  loads its blocks, rebinds Claude to that session's folder and resumes the same
  SDK session rather than starting a fresh one; deleting takes its blocks with it.

  History is the sidecar's, opened with `bun:sqlite` in the app data directory that
  Rust resolves and passes down. It lives there because that is where the events
  are — writing from the webview would have cost a Tauri IPC round trip per text
  delta, and `tauri-plugin-sql` would have pulled sqlx into the Rust build to put
  raw SQL in the front end. Only the SDK `session_id` is borrowed from Claude Code;
  its transcript files are not a public contract and would break the pane on any
  CLI update.

  A stored block _is_ a transcript entry, and there is exactly one fold: the
  webview runs it to render the live stream and the sidecar runs the same function
  to decide what to write, so a replayed session cannot drift from the one you
  watched arrive. Each event upserts its row as it happens, in WAL — force-quitting
  mid-turn loses the in-flight block and nothing before it, and the next turn picks
  up numbering where the crash left off. A store that cannot be written to logs and
  is ignored: history never fails a turn, and a database that cannot be opened at
  all leaves Claude working with the pane explaining why it is empty.

  Switching sessions stops the running turn, because the chat pane is keyed on a
  token only an explicit select or New changes — the interrupt is the unmount. A
  new session's row reaches the webview as the first chunk of the turn that created
  it, so it appears in the list immediately without a round trip and without racing
  the turn.

- ec3db4d: The sidecar reported itself as `starting` forever after launch, so the first message of a session failed with "the sidecar did not come up in time" and only a manual Restart brought it back. The supervisor published every phase with `watch::Sender::send`, which drops the value and leaves the old one in place when no receiver is alive — and receivers only exist while `wait_ready` is waiting. Every transition before the first request, `ready` included, went nowhere: `sidecar_status` kept reading `starting`, and `wait_ready` then waited 20 s for a change that had already happened. Publishing with `send_replace` stores the phase unconditionally.

  The webview no longer depends on catching the status event either: it re-reads the status until the phase settles, so a window that finishes loading after the sidecar came up shows the truth instead of a stale phase, and identical readings no longer re-render.

  The composer now follows that phase: Send is refused with an inline restart while the sidecar is down, and a start-up is spelled out rather than spent silently waiting.

- e1ec29a: The shadcn registry moves from the `base-luma` style to `base-vega`. Base UI is
  still the primitive underneath every component, so nothing about how they compose
  changes — but the shapes do: buttons go from `rounded-4xl` pills to `rounded-md`,
  and each size now derives its radius from `min(var(--radius-md), …)` rather than
  sharing one pill. Focus rings went from `ring-ring/30` to `/50` and the outline
  variant picked up a `shadow-xs`.

  Worth knowing for next time: a re-add rewrites all ~70 files in `components/ui`
  at once, in the registry's own formatting, so `bun run check` fails on every one
  of them until `bun run fix` runs. It also reintroduced the two generator defects
  this repo has hit before — a duplicated `components={{…}}` in `calendar.tsx` and a
  duplicated `render={…}` in `pagination.tsx`, both TS17001, both silently
  discarding the earlier attribute. `bun run typecheck` is what catches those, and
  it is the only gate over that directory.

  The projects pane picked up the fixes that came out of a guidelines pass at the
  same time: rows no longer change font weight between states (colour and
  background carry it), every elapsed time and count is `tabular-nums` so digits
  stop shifting as they tick, the status marker aligns to the title line rather
  than the centre of a two-line row, and the row's click target is an overlay with
  `aria-labelledby` — so a screen reader announces the session name as the button
  and reads "Waiting 4m · Bash" as its own line, instead of running the two
  together into one very long button name.

- 6badcf1: App shell: three resizable panes (sessions | chat | preview) under a thin title bar, with the open folder and the pane split persisted across restarts.
- 18ed343: Take a picture of the frame and send it with the message. Turn on **Snapshot** — the button next to Inspect — and the player pauses; click the frame to attach the whole thing, or drag a rectangle to attach just the part that is wrong. It lands in the composer as an ordinary attachment with an `[Image #N]` token, exactly like an image pasted from the clipboard, and goes when you send. Inspect answers _change this_; Snapshot answers _look at this_, so they are separate tools and only one can be on at a time.

  The pixels come from `renderStill` in **the project's own `@remotion/renderer`** — the path an export will take — so what Claude sees is what will be in the file, not what a webview happened to paint. Measured against `remocn-demo`: the still is byte-identical to what `npx remotion still` produces for the same frame.

  That needed no second bundle. `@remotion/bundler`'s `bundle()` merely drops `@remotion/studio/renderEntry` into the same webpack `entry` slot our preview entry already occupies, so one compile now serves both — about 20 KB more, against the ~7 s and 1.67 GB peak a second compile would cost. The preview page and the render page differ only in which container they declare, and our entry already declines to mount a Player when there is no studio container, so nothing new decides which half runs.

  Three findings were load-bearing and none were visible by reading. The `@remotion/studio/renderEntry` alias has to go **before** the base config's aliases, or webpack matches the broader `"@remotion/studio"` prefix — which points at a file — and cannot resolve the subpath. A `sideEffects: true` module rule is required, or the module imported purely for `window.getStaticCompositions` can be shaken away. And the preview page must declare `remotion_puppeteerTimeout`, because that is the only signal `renderEntry` has for "headless" and without it the preview would quietly mount a read-only Remotion Studio into the page.

  The first end-to-end render came out blank white. The preview compiles in development mode, so `getRemotionEnvironment().isRendering` was false and Remotion rendered nothing into the portal. The render page now declares `NODE_ENV=production` before the bundle loads, and hands over no env variables, so Remotion's own setup cannot overwrite it. A second thing that only showed up in a real render: Remotion forwards browser console output to stdout, which is the preview host's frame channel — the host now keeps stdout for frames and sends everything else to the log, patching `console` as well as the stream, because under bun `console.log` bypasses `process.stdout.write`.

  The rectangle is converted to a share of the composition **in the page**, where the player's scale is known, so a box drawn on a small preview crops the same region on a large render. Cropping and downscaling to ≈1568 px on the long edge happen in the webview through `<canvas>`, cropping first so detail survives in a small region, and the bytes go through the same invoke that already stores pasted images — no image library reaches the sidecar or Rust, and a snapshot survives on disk so reopening a session still shows it. A tiny drag counts as a click, so a shaky hand cannot hand you a four-pixel picture.

  Rendering options come from `remotion.config.ts` as well, read the way the CLI reads them, so `Config.setChromiumOpenGlRenderer`, `setDelayRenderTimeoutInMilliseconds` and the chrome mode apply to a snapshot exactly as they apply to `npx remotion still`. Nothing is defaulted on the project's behalf: `--gl=angle` changes the pixels even of a render that uses no WebGL, so choosing it for you would move every snapshot away from what your own export produces. A scene that draws with WebGL therefore needs `Config.setChromiumOpenGlRenderer("angle")` — the same line its exports already need, since the stock CLI fails on it too — and a `delayRender()` timeout now says exactly that instead of leaving you with Remotion's raw message.

  **A capture takes 83–122 ms**, because the render page stays open. `renderStill` is a sequence — size the page, navigate, switch the bundle into composition mode, seek, screenshot — and only the navigation is slow, so arming Snapshot walks the page up to that point once and every click is just seek-and-screenshot. The result is byte-identical to `npx remotion still` on the same frame. Reaching that means naming five of Remotion's internal modules, so if any of them moves in a future version the host falls back to a full `renderStill` per capture: slower, never wrong. The warm page is keyed by composition and dropped whenever the bundle rebuilds, since a page holding the old bundle would capture code that no longer exists.

  A capture costs one page load rather than two. Measured on a real project, the navigation is the whole cost — `openBrowser` 195 ms, `newPage` 187 ms, `goto` **3319 ms** — because that one page pulls 19.9 MB across 71 requests, 64 of them fonts, and `selectComposition` and `renderStill` each did their own. The composition measurement is now cached in the preview host and dropped whenever the bundle rebuilds, and arming Snapshot warms it while you are still aiming, so the click itself only renders: **8.4 s → ~3.6 s**, with the remaining measurement moved off the click entirely. Reusing the browser across captures was measured and does nothing — Remotion opens a fresh page per call — so there is no pool. What is left is the project's own runtime font loading, which Remotion's log already names: loading fewer weights and subsets in `loadFont()` takes seconds off every render, exports included.

  Snapshot shares Inspect's availability rules — off while the composer is locked, while the preview is not serving, and while the preview is showing a different project than the open session — and says why on a disabled button's tooltip. The browser download the first capture may need is reported rather than silently stalling, a failed render says so, and a scene whose `delayRender()` never resolves times out instead of hanging the app.

  The renderer seam, the browser provisioning and the progress reporting are built here as their own pieces so Export can take them unchanged.

- 4ade544: Claude Agent SDK session stream: the sidecar now runs `@anthropic-ai/claude-agent-sdk` against the opened folder and streams a turn into the app — assistant text, tool calls and their results — while the agent writes real files on disk. Auth comes from the already logged-in Claude Code; there is no API key and no custom OAuth. The model is the CLI default unless overridden from the picker in the chat pane.

  A turn is one sidecar request, so stopping it is a fiber interrupt: the SDK query is interrupted first and its input closed after, which lets the CLI shut down in about half a second instead of waiting out the SDK's grace window, and records the interruption so the session resumes cleanly. The SDK `session_id` comes back with the result and is passed to the next turn, so a follow-up message continues the same session rather than starting a new one.

  Failures are values, not crashes. A turn answers with a typed failure — `auth`, `usage`, `model` or `unknown` — and "Claude Code is not authenticated" reaches the UI in plain words instead of a stack trace; subscription usage limits keep the wording the CLI itself uses.

- e1ec29a: The projects pane says what it knows. With background turns a session could be
  running — or blocked on a permission the gate auto-denies after ten minutes — in a
  project whose group was collapsed, and the pane showed a chevron and a name. Now a
  collapsed project row carries a rollup for the worst state inside it (waiting,
  with a count, beats running beats failed beats unread), sessions that need you
  float to the top of their group with the longest wait leading, and a group holding
  a waiting session is lifted above the rest. The "Show N more" cap counts only
  quiet rows, so it can no longer hide the one thing that was asking; the number it
  shows is exactly what expanding reveals.

  Rows earn their height. A settled session stays one line with the time it was last
  touched on the right; a busy or failed one takes a second line that says what is
  happening in words — `Waiting 4m · Bash`, `Running · 2m`, or the first line of the
  error — and the times tick, so a wait is a fact rather than a snapshot from when
  the row rendered. The timer counts up and never down: the ten-minute deadline is
  the gate's, and the pane displays elapsed so that window can move without the pane
  noticing. The status marker also stopped disappearing exactly when you looked at
  it — the delete button has its own slot now instead of fading the marker out to
  make room.

  Deleting a session is undoable. The row leaves at once, a toast offers Undo for a
  few seconds, and taking it puts the session back exactly where it was, selection
  included. Quitting inside that window drops the delete rather than rushing it —
  the session is still there next launch, which is the direction that keeps data.
  Busy sessions still refuse to be deleted.

  Ordering, the rollup and the cap are one pure function over the projects, the
  sessions and the turn states, so all of it is pinned by tests that render nothing.
  Nothing about what is stored or sent changed: the timestamps behind the timers are
  webview-only, learned from events the pane already received.

- aaffce8: Activity lines you can read. A path-shaped target now renders as its folder,
  dimmed, in front of the filename at full contrast, and when the pane is narrow it
  is the _folder_ that is cut — from the left — so a row never truncates to
  `/Users/me/pr…`. `toolTargetParts` returns that split and `toolTarget` joins it
  back, so the row and the permission card cannot drift about what a call touches.

  A command gets the same treatment: a leading `cd …&&` or `VAR=…` is the lead,
  dimmed and the first thing to collapse, so the row spends its width on
  `find . -type d` rather than on the 52 characters every row shares. It is _not_
  matched against the open folder, because the folder a project row points at is
  routinely a scene inside a Remotion project while the agent works from its root —
  the prefix is noise wherever it goes. The permission card and the row's
  accessible name still carry the command verbatim: a card is what you approve, not
  a summary.

  The folder those calls ran in comes from the project of the session being
  rendered, not from whichever project happens to be selected — that one is `null`
  until `project.list` answers.

  A run of consecutive tool calls folds into one row that shows the last of them
  and a `+N`, expanding into exactly the rows it replaced, each still expandable to
  its own detail. While the turn runs, that row is a ticker of what the agent is
  doing right now, because the last entry is the newest one. Only a failed call
  breaks a run and keeps its own row, so an error and its text are never hidden
  behind a chevron. Grouping is a pure function over the transcript entries
  (`lib/studio/runs.ts`), never the fold in `shared/transcript.ts` — the pane
  decides what to show, the store keeps what happened, and a session loaded from
  history groups identically because the same function runs over the same entries.

  Each row now leads with an icon for the kind of work — a terminal, an eye, a
  pencil — instead of a coloured dot, and an unknown tool gets a wrench rather than
  nothing. State moved into the icon's colour: muted when done, amber and pulsing
  while running, destructive when failed. A settled turn no longer has a column of
  green.

- c69eeb6: The composer picks a mode, and it belongs to the session rather than to the app.
  Three of them, spelled the way the Agent SDK spells them so nothing has to be
  translated on the way down: **Auto** (the default) hands routine calls to Claude
  Code's own classifier, **Accept edits** lets writes inside the project through and
  still stops at every command, **Plan** makes the turn read-only.

  The permission gate is unchanged and still decides everything that reaches it —
  the mode only changes how much traffic that is. One consequence is deliberate and
  worth knowing: in Auto the classifier runs _before_ `canUseTool`, so a call the
  gate would have stopped can be approved without it ever being asked, and "anything
  outside the folder always asks" holds absolutely in Accept edits and Plan but is
  best-effort in Auto. What the classifier refuses on its own is no longer invisible
  either — a denial with no card now lands in the transcript as a notice, where it
  used to show up as nothing but a failed activity line. The CLI is also asked which
  mode it actually ran in, so a model that cannot do Auto says so instead of the chip
  quietly lying.

  Plan mode ends in a card above the composer with the plan itself in it: approve it
  into Accept edits or into Auto and the _same_ turn carries on building, or send it
  back to be revised without losing the turn. The approval switches the live session
  through `setPermissionMode` and persists the new mode, so the chip and the next
  turn agree.

  A session remembers its mode across restarts (a new column, defaulting to Auto, so
  existing sessions behave exactly as before) and a brand-new session always starts
  in Auto.

- b9d3a72: A folder is now a row, not a string. `project (id, path UNIQUE, name, …)` joins the
  schema and `session.folder` is replaced by `session.project_id` with
  `ON DELETE CASCADE`, so removing a project takes its sessions and their blocks with it
  in one `DELETE` and never touches the folder on disk. `path` is canonical — symlinks and
  `..` resolved before the uniqueness check — which is what makes opening the same folder
  twice, including through a link, land on the same project instead of forking the history
  in two.

  An existing database migrates itself: one project per `DISTINCT session.folder`, named
  after its basename and dated from the sessions it inherits, with every session relinked
  and every transcript intact. The rebuild runs with foreign keys off, which is the only
  way to drop and replace the `session` table without the cascade taking `block` down with
  it. A `projectFolder` left in `settings.json` becomes a project on first boot and the key
  is dropped.

  `SIDECAR_PROTOCOL` is 7. `project.list` / `open` / `create` / `rename` / `remove` join
  the contract, `open` being create-or-get by path. `PromptParams.cwd` and
  `PreviewParams.folder` become `projectId` and the sidecar resolves the folder from its
  own table — for the SDK and for the permission gate alike, so the webview can no longer
  send a `cwd` that disagrees with the row, and it is the gate a disagreement would break.
  A project whose folder is gone from disk keeps its row and its transcripts; what it stops
  doing is starting turns.

  The webview mints the `historyId` and sends it with the first turn, so a turn has a
  stable key from the moment it starts rather than from the moment the sidecar answers.

- 053e41e: Cmd+V in the composer attaches whatever image is on the clipboard and drops a reference to it — `[Image #1]` — at the caret, in its own colour. A screenshot no longer has to be saved to disk and found again in a file dialog, and a file copied in Finder pastes the same way, keeping its own name. Pasting text is untouched: without an image on the clipboard the event is left alone.

  The message can now point at a picture. "compare `[Image #1]` with `[Image #2]`" reaches Claude as the sentence cut at each reference with the image spliced in at that spot, rather than as two unlabelled images and a sentence about "the first one". Attachments nobody referenced go ahead of the whole sequence, which is byte-for-byte what a message with no references sent before. A picture referenced twice is sent once, and `[Image #7]` with three attachments stays plain text everywhere.

  The reference format lives in one shared module because two processes parse it — the webview colours it, the sidecar splices into it — and two implementations that had to agree would drift. `items[i]` is always `[Image #{i+1}]`: removing an attachment takes its reference out of the text and shifts every higher one down, so the list and the sentence cannot disagree.

  That binding runs both ways — deleting `[Image #1]` from the text drops the picture with it, and the rest renumber. The reference is therefore atomic: one Backspace next to it or inside it takes the whole thing, rather than leaving `[Image #1`, which points at nothing. Deleting it by selection, cut or Cmd+A works too. The trade is that referencing is no longer optional the way #13 first had it: an attachment cannot outlive its reference, so wiping the message wipes what was attached to it.

  An attachment card is now the picture and nothing else — no filename, no format chip — so two attachments can be told apart at a glance rather than by reading them. The name is still the card's accessible name and its hover title, and a file that has since moved falls back to the icon. The reference stays coloured in the transcript, so a sent message reads the way it was written.

  Pasted bytes cross into the core once, as a raw request body rather than a JSON array of numbers, and the core decides where the file lives — the same way it decides where the history database lives. From that moment the attachment is a path, which is what the prompt contract already carried, so nothing on the wire or in SQLite changed.

  The webview can now load files as images through Tauri's asset protocol. The scope is deliberately broad: an attachment can be picked from anywhere on the machine, and the app already opens arbitrary folders.

- 71442c3: In-app updates over this repo's own GitHub releases.

  The app asks `releases/latest/download/latest.json` once per launch, offers what
  it finds in the sidebar footer, and installs and restarts on request. Download
  progress is folded from the plugin's per-chunk events, so the bar reads a real
  percentage rather than a spinner.

  A `development` build — anything run from `bun tauri dev` — never checks at all.
  It has no bundle to replace: the executable sits in `target/debug` rather than
  inside a `.app`, which is what the updater resolves the install path from.

  Two release-side consequences, both required by the mechanism rather than chosen.
  Tagged releases are now published instead of drafted, because a draft's assets
  have no reachable download URL for either the manifest or the `.app.tar.gz` it
  points at. And the two macOS jobs run one at a time, because `latest.json` holds
  a key per platform and is assembled by merging into the asset already on the
  release — in parallel both read it before either writes, and one architecture
  disappears from the manifest.

  Updates are signed with the updater's own minisign key. That is unrelated to
  Apple code signing, which this build still does not do.

- 19e7966: Sidecar runtime and IPC: the Tauri core owns one bun process, supervises it across crashes, and bridges it to the webview over a single typed message contract — request/response plus streaming. The title bar shows whether the sidecar is up, and opens onto its pid, its log file and a restart.

  The contract is Effect `Schema`, so every frame crossing a boundary is decoded rather than cast, and both sides are typed from one declaration. Effectful code returns `Effect` with tagged errors end to end: cancellation is fiber interruption, subscriptions are scoped resources, and each sidecar request answers exactly once from a finalizer — so a cancelled or killed request still replies instead of leaving the caller waiting.

- b734f74: The left pane is projects with their sessions under them. Groups expand
  independently, the expansion survives a restart, and opening a project opens its
  group. Sessions stay newest-first inside a project, projects are ordered by their
  most recent session, and a project past eight sessions keeps the rest behind
  "Show more" rather than burying the projects below it.

  `+` on a project row starts a session in _that_ project; `+` in the pane header
  offers "Open folder…" and "New project…". There is no global active project any
  more — the open session decides what the title bar names and what the preview
  follows, which is what makes a second project a normal thing to have rather than
  a mode switch.

  A project whose folder has gone is dimmed rather than hidden: its transcripts are
  in our SQLite and stay readable, but it cannot start a turn, and both the row and
  the composer offer "Locate…", which moves the row to the folder you point at
  instead of forking a second project on the new path. That needs one method the
  schema could not express, `project.relocate`, alongside rename and remove — remove
  warns first, because the sessions and transcripts go with the row, and says
  plainly that the folder on disk is not touched.

- 2f96a3f: Point at an element in the preview and comment on it in the chat. Turn on **Inspect**, hover the frame, click the thing you mean, write what should change, and the selection lands in the composer as an `[Element #N]` token you can point at from your sentence — exactly the way pasted images already work. You send the message yourself.

  What Claude receives with each reference is the absolute path, line and column of the JSX that rendered the node, the component that owns it, a short project-only component stack, the composition, the frame you were looking at (and the frame within the enclosing scene, with its timing), and the node's own markup. "Make this bigger" becomes an instruction it can act on without grepping for the string and guessing which component to edit.

  Source resolution is [React Grab](https://react-grab.com), driven headlessly: its global build is served by the preview host from a Tauri resource, before the project bundle so the DevTools hook beats React to the page, and kept out of the project's webpack — that compile costs seconds and peaks over a gigabyte, and this is 380 KB it would otherwise carry. Auto-init is suppressed and `init` is called with telemetry off, and the one web-font `@import` inside its overlay stylesheet is stripped when the file is served, so the feature sends nothing to a third party. A test reads the shipped bundle and fails if a version bump reintroduces one.

  Grab's overlay is taken down entirely and only `getSource`, `getStack` and `getDisplayName` are used: hit-testing and the hover box are ours, drawn inside the preview document so the highlight still shares a document with the cursor. That is what makes two things possible that grab's own hit-test could not be steered into. The picker takes the first element that **paints** at the point — background, border, shadow, replaced element, or a text node whose rect contains the point — rather than the topmost transparent wrapper, so an animated wrapper lying over a card no longer swallows the click. And it climbs out of **inline wrappers** — inline-level elements painting no surface of their own — stopping at the first block-level element, so clicking a word in a text animated word-by-word (or letter-by-letter) selects the line, not the word, and that holds whether the word has a wrapper of its own or the line is a single word. A word that paints its own surface — a highlighted chip — stops the climb and stays selectable on its own. Anything in the SVG namespace counts as a drawing: an icon is always pickable, is never climbed through, and a click on one of its paths selects the whole `<svg>`. Holding **Alt** turns every rule off and takes the literal node under the cursor.

  The preview message channel is now a two-way typed union discriminated by `type`, matching the sidecar contract's convention: the page reports its composition pick, its selections and its rebuilds; the app sends arm, freeze and seek down, addressed to the preview origin. Incoming messages are checked against the known preview origin before decoding, because these payloads carry file paths that end up in a prompt.

  The shared reference reader is parameterised by kind, so `[Element #N]` and `[Image #N]` have their own counters and neither can consume the other's number. Everything else about it is unchanged: atomic deletion, renumbering, and the rule that a number beyond the list count is plain text. The binding runs both ways as it does for images — deleting the token deletes the selection.

  Availability is deliberately narrow: Inspect is off while the composer is locked, while the preview is not serving, and while the preview's project differs from the open session's, so a path into one project can never reach a turn in another. Element references are dropped when the open session moves to a different project; text and image attachments are left alone. A rebuild clears the markers and disarms — a box drawn over the old render would lie about the new one — while leaving unsent references and whatever you were typing untouched. A selection whose source cannot be resolved is still usable, travelling with its markup, component name and frame, rather than silently doing nothing.

- e1a04ee: The thinking marker now says how long the turn has been running, ticking once a second: `Thinking… 12s`, then `2m 5s`, and `1h 5m` once seconds stop meaning anything. Judging a turn no longer means remembering when you pressed send, and the first minute — where most turns live — reads as a number that moves rather than as the session row's one unchanging `<1m`.

  It counts from the instant the turn started, the same one the session row counts from, so the two panes cannot tell you different things about one turn. It keeps counting while a tool runs, while a permission card is up and while an answer streams and the marker is not on screen, because it measures the turn and not the marker's latest appearance — opening a background session that has been running a while shows its total rather than restarting its clock.

  The marker leads with the animated dot matrix (`DotmSquare11`, grad-prism) instead of a static sparkle, so the row that reports a running turn is itself in motion. The number sits beside the shimmer rather than inside it, muted and in tabular figures, so a digit changing every second neither shimmers nor shifts the words around it, and it carries no live region: a screen reader must never be handed something that changes sixty times a minute. When the turn settles the marker leaves, timer and all.

  Nothing is stored or sent for this — no IPC change, no migration, no transcript entry. The turn's start was already in the webview's turn state, and the whole feature is rendering. The chat pane's clock runs only while its turn does, so an idle window is not repainting once a second for as long as the app is open.

- e1ec29a: The window loses its title bar, and its lines with it. The rule underneath the bar
  and the one under every pane header are gone — two of them stacked ten pixels apart
  was most of what made the window look ruled rather than laid out. The panes now
  run to the top of the window, so the sidebar's own column starts up there: its
  first row holds the traffic lights, a sidebar-collapse control and the full
  remocn lockup, where the mark is the word's "r" and so sizes and colours as one
  piece of text. Under it the search field gained a New session button beside it,
  which starts a draft in the open project. `Main`, the sidecar status and Export
  moved to the preview pane's header — the far right of the window, where they
  were, minus the bar that used to carry them. Dragging the window still works
  anywhere along the top: the brand row and both pane headers are drag regions.

  The bar no longer shows the open folder at all: the projects pane is where a
  folder is opened and which one is open. A folder that fails to open still says so
  — that error moved to the foot of the projects pane, where the other pane errors
  already live, rather than disappearing with the button that used to show it.

  Inside, the pane is now built from the registry's own `Sidebar` parts rather than
  hand-rolled rows: `SidebarHeader` holds the brand row and the search field,
  `SidebarGroup` + `SidebarGroupLabel` + `SidebarGroupAction` make the Projects
  heading and its two controls, project rows are `SidebarMenuButton`, sessions sit
  in a `SidebarMenuSub`, loading is `SidebarMenuSkeleton` and Settings is a
  `SidebarFooter`. The key to embedding it in a resizable panel is
  `collapsible="none"`: it drops the off-canvas gap element and the mobile Sheet
  and renders a plain flex column, so the panel keeps owning the width. The
  provider is still required — every menu part reads its context — which is also
  why `SidebarProvider` now claims ⌘B globally.

  The sub-list keeps its list semantics but sheds the rail and indent it ships
  with, because a session title is meant to line up with the project name above it
  rather than hang off it.

  A project row leads with a folder icon in place of the chevron, open when the
  group is expanded and closed when it is not, so the icon carries the state the
  chevron used to. Session titles sit muted with the open one brought forward, and
  "Show N more" is text rather than a button-shaped thing.

  Search with ⌘K, the project sort control and a Settings row at the foot of the
  sidebar are **present but inert** — the layout the reference has, with none of the
  behaviour behind it yet. They are disabled rather than silently doing nothing, so
  the sidebar reads as finished without pretending to work.

- 4af9c61: Permission cards. The app opens **any** folder, including real repositories, so the agent no longer runs on `acceptEdits`: a `canUseTool` gate in the sidecar decides every call. Read, Glob, Grep, Write and Edit run silently as long as every path resolves inside the opened folder; Bash, any path outside the folder, and any tool the gate has no path rule for stop and ask.

  The path check resolves symlinks and `..` before comparing, walking up to the nearest existing ancestor so a file that does not exist yet is still placed correctly. `../../.ssh/config` is outside the folder whatever the literal argument says, and so is a symlink inside the folder that points out of it — the signature the card is remembered under is the resolved path, not the one Claude typed.

  The ask travels as a `permission` chunk on the turn's own stream, and the answer comes back as a separate `claude.permission` request. The card sits **above the composer** rather than in the transcript — an approval is a thing to answer, not a thing that happened — and the composer is locked behind it. Four choices, no checkbox: approve once, always allow this session, decline (the agent gets a message it can carry on from, not an error that ends the turn), or cancel the turn. "Always" keys a signature-scoped allowlist that lives in the sidecar process and never touches disk.

  Asks are queued, because one assistant message can raise several tool calls at once, and answering one reveals the next.

  Stopping a turn resolves its cards instead of leaving them dangling: the pending asks are settled before the SDK interrupt is awaited, so a stopped turn cannot hang on a prompt nobody will answer. `SIDECAR_PROTOCOL` is 4.

- 45e4774: Live Remotion preview in the right pane. The sidecar starts a host per project that
  compiles the folder with the project's own `@remotion/bundler`, its own webpack and its
  own `remotion.config.ts` override, and serves a `<Player>` instead of the Remotion Studio
  UI — so `staticFile()`, Tailwind, path aliases and any `webpackOverride` behave exactly as
  they do in `remotion studio`, with none of its chrome.
- 053e41e: The agent now knows remocn without the project having to install anything. A Claude Code plugin ships inside the app bundle carrying three vendored skills — `remocn`, `remotion-best-practices` and `remotion-interactivity` — and the sidecar hands it to the Agent SDK as the `plugins` option. In a fresh Remotion project the agent knows the registry components and installs them with `npx shadcn add @remocn/…`.

  Globally installed skills were not an option: measured with an empty folder, the app's `settingSources: ["project"]` lists 45 commands and none of them is a remocn skill, and reaching a global install means adding `"user"` — which also loads `~/.claude/settings.json`, `~/.claude/CLAUDE.md` and every other skill on the machine, making the app behave differently per user. The plugin lists 48: exactly the three we ship. Nothing outside the app is written, and it works offline.

  `bun run skills:sync` refreshes the vendored copy from upstream and `bun run skills:check` fails when what is committed no longer matches, which is now a CI job — a vendored copy rots silently otherwise. The sync copies real files rather than the symlinks a global skills install leaves behind; vendoring those would have loaded nothing, with no error to show for it.

  The studio conventions the skills cannot know — exactly one composition with id `Main`, every scene inside it via `Series`/`TransitionSeries`, and keeping the result editable — are appended to Claude Code's own system prompt rather than replacing it.

  A project that installed any of these skills itself keeps its own copy: the bundled plugin steps aside instead of shadowing it.

- b09fb8c: "New project…" produces a project, not an empty folder. `templates/remotion` is
  vendored here and ships as a Tauri resource — `package.json`, `tsconfig.json`,
  `src/index.ts`, `src/Root.tsx` with a single `<Composition id="Main">` and a
  `src/Main.tsx` that renders something. Copying it is offline; only `bun install`
  needs the network, which is why the one-composition invariant is guaranteed by a
  template we wrote rather than hoped for from a generator.

  `project.create` makes the folder and the row; `project.scaffold` streams the two
  steps that follow — expanding the template, then installing — so the chat is
  usable while `bun install` is still running, and a step that fails leaves the
  project in place with the error and a Retry beside it in the pane. Both steps are
  idempotent: expansion never overwrites a file that is already there, which is what
  makes Retry safe after Claude has already edited the scene. Nothing is deleted
  from disk on failure.

  The template's `package.json` is named after the folder, slugified, because npm
  names cannot hold spaces or capitals and a project called "Launch Film" is a
  perfectly reasonable thing to ask for.
