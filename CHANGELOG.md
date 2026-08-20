# remocn-studio

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
