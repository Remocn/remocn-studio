# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Rules

- **Never start a dev server.** `bun dev`, `next dev`, `bun tauri dev` and
  equivalents are the user's to run — he owns that terminal. One-shot commands
  that terminate (`bun run build`, `bun install`, `cargo check`) are fine. When a
  change needs runtime verification, verify what a build can verify, then say
  what must be checked in the running app and ask him to run it.

## What this is

A **local macOS desktop app** (Tauri v2) that turns "I want a video" into a real
Remotion project: Claude writes actual Remotion TSX into a folder on disk, and
the app previews the result live and exports an mp4. Design record and work list:
[Remocn/remocn#218](https://github.com/Remocn/remocn/issues/218) and its children
(#219–#228).

**This is not `studio.remocn.dev`.** That one — sketched in the remocn repo's
`RENDER_SDK.md` §13 — is a hosted, spec-driven web editor built on one generic
composition plus a JSON spine. Different product. Do not carry its timeline /
project-JSON design into this repo.

Shape of the prototype, as decided in #218:

- **Claude produces code, not spec.** Real TSX in the user's folder, like Claude
  Code + the remocn skill. So preview must compile source the app has never seen.
- **Open any folder.** The app controls neither the entry point, the Remotion
  version, nor the build config.
- **Exactly one composition,** id `Main`; every scene lives inside it via
  `Series` / `TransitionSeries`. No composition selector.
- **Claude access via `@anthropic-ai/claude-agent-sdk`** inside a bun sidecar,
  using the Pro/Max subscription of the already-logged-in Claude Code. No API
  key, no custom OAuth.
- **Three panes:** projects | chat | preview. Projects are rows and sessions hang
  under them; turns keep running when you look away (#235 supersedes the original
  "sessions pane, exactly one active session").
- **Own SQLite history** — the CLI transcript format is not a public contract.
- **Permissions split:** file tools inside the opened folder run automatically;
  Bash and any path outside the folder raise an Allow/Deny card. How much of that
  is asked about is the session's **mode** — auto, accept edits or plan (#236).
- **Export goes through the *project's own* `@remotion/renderer`,** resolved from
  its `node_modules` — never a version the app bundles.

## Commands

The lockfile is `bun.lock`; use bun.

- `bun run check` — formatter **and** linter in one pass, read-only. This is what
  CI runs; it fails on violations rather than fixing them.
- `bun run fix` — apply the fixes `check` reports.
- `bun run typecheck` — `tsc --noEmit`. Keep this in the loop: Next 16 no longer
  lints on build, and it is the only gate over `components/ui/**`, where the
  linter is deliberately off.
- `bun run test` — Vitest, single run. `test:watch` and `test:coverage` also exist.
- `bun run build` — Next static export into `out/`. Needs network on a cold cache
  (fonts are self-hosted at build time).
- `bun run sidecar:build` — bundle `sidecar/` into `sidecar-dist/main.js`, which
  ships as a Tauri resource. **Only release builds need this** — in debug the
  core runs `sidecar/index.ts` from the repo, so there is nothing to rebuild.
  `bun tauri build` runs it via `tauri:before-build`.
- `bun tauri build` — unsigned `.app` bundle. `--no-bundle` compiles without
  packaging; `--bundles app` skips the DMG.
- `bunx shadcn@latest add <component>` — add UI components (config in
  `components.json`).
- `bun run skills:sync` — refresh the vendored agent skills under `agent/skills`
  from upstream; `bun run skills:check` is the read-only half CI runs. Both need
  network. See *What the agent knows*.
- `bun run changeset` — record a change for the next release (see Releases).

### Linting and formatting

[Ultracite](https://www.ultracite.ai/) over Biome; config in `biome.jsonc`,
which extends `ultracite/biome/{core,next,react}`. Two things about it are
load-bearing:

- **`repos/` is force-ignored** (`!!repos`). Without it `ultracite init` walks
  into the vendored checkouts — it reformatted 42 `tsconfig.json` files inside
  `repos/effect` on first run.
- **The linter is off for `components/ui/**` and `hooks/use-mobile.ts`**, which
  are `shadcn add` output we do not author and that any re-add overwrites; 90 of
  93 findings on first run were there. Formatting stays on. `recommended: false`
  does **not** work as a blanket in that override — the ultracite presets enable
  rules by name and they survive it. `typecheck` is the real net for that
  directory, and it earns its keep: the generator shipped duplicated
  `components={{…}}` in `calendar.tsx` and duplicated `render={…}` in
  `pagination.tsx`, both TS17001, and a duplicate JSX attribute silently discards
  the earlier one.

**Biome is pinned to 2.5.5 for one reason:** 2.5.3 and 2.5.4 panic in their
module resolver on any file that does `import { memo } from "react"`
(`index out of bounds: the len is 38 but the index is 287`), and a panic fails the
whole file instead of emitting a diagnostic. 2.5.5 in turn reads `!value` in
`useStudio` as always-truthy, which is why that guard is spelled `value === null`.
Two rules shape how components are written here: `noArrayIndexKey` means rendered
rows carry their own id (`DiffLine.id`), and `noJsxPropsBind` bans inline arrows
in props — a per-item handler reads `event.currentTarget.value` instead, which is
why `useAttachments` exposes `onRemove` as an event handler.

### Tests

Vitest + React Testing Library + jsdom (`vitest.config.mts`). The `@/*` alias
resolves natively via `resolve.tsconfigPaths` — do not add `vite-tsconfig-paths`,
Vite 7 warns that it is redundant.

**jsdom is not a Tauri webview.** There is no `window.__TAURI_INTERNALS__`, so
any `invoke()` that reaches the real transport throws. Tests touching IPC must
install a fake with `mockIPC` from `@tauri-apps/api/mocks`; `vitest.setup.ts`
calls `clearMocks()` after each test so one test's fake cannot leak into the
next. `app/page.test.tsx` is the worked example.

## Releases

Version lives in **one** place: `package.json`. `src-tauri/tauri.conf.json` sets
`"version": "../package.json"`, which Tauri resolves at build time, so there is
no version sync step and `src-tauri/Cargo.toml`'s version never reaches the
bundle.

Changesets drives versioning and the changelog — not publishing; the package is
private, and `privatePackages: { version, tag }` in `.changeset/config.json` is
what makes it work on a private package at all.

1. `bun run changeset` to record what changed.
2. On push to `main`, `.github/workflows/publish.yml` opens/refreshes a
   "Version Packages" PR that bumps `package.json` and writes `CHANGELOG.md`.
3. Merging that PR is the decision to release; the action pushes a `v<version>` tag.
4. The tag triggers the macOS build (Apple silicon + Intel) and publishes a
   **draft** GitHub release with the bundles attached.

The version script is named `version:packages`, not `version`, because npm and
bun treat a `version` script as an `npm version` lifecycle hook, which recurses.

## Architecture

### Frontend is Next.js in **static export mode**

`next.config.mjs` sets `output: "export"`. Tauri serves `devUrl`
(`http://localhost:3000`) in dev and the `out/` bundle over a custom protocol in
production — **there is no Node server at runtime**. Therefore:

- No SSR-dependent features: no server actions, no `cookies()`, no route
  handlers that read the request, no `redirects`/`rewrites`/`headers`, no proxy,
  no ISR, no default-loader image optimization (`images.unoptimized` is set).
- Anything that needs a real runtime goes to **Rust (Tauri commands)** or to the
  **bun sidecar**, never to a Next.js server.
- `components.json` has `"rsc": false` so generated components carry
  `"use client"` — the editor is interactive top to bottom.
- `turbopack.root` is pinned in `next.config.mjs`: an unrelated `package-lock.json`
  sits above this repo and Turbopack's root inference walks up to it otherwise.

### UI

- **Primitives are `@base-ui/react`, NOT Radix.** The shadcn style is
  `base-vega`; every `components/ui/*` file imports from `@base-ui/react/*`.
  Prop names and composition patterns differ from Radix — check the actual
  primitive import before editing a component. The style moved from `base-luma`
  to `base-vega` when the tree was regenerated: buttons went from `rounded-4xl`
  pills to `rounded-md`, and radii now come from `min(var(--radius-md), …)` per
  size. **A re-add rewrites all ~70 files at once**, so run `bun run fix` right
  after — the registry emits its own formatting and `check` fails on every file
  until it is normalised.
- **Tailwind v4, CSS-first.** No `tailwind.config.*`. Theme lives in
  `app/globals.css` via `@theme inline` and CSS variables (`:root` / `.dark`),
  colors in `oklch()`, radius scale derived from `--radius`. Tokens are copied
  from remocn.dev — the `.dark` set is the warm obsidian palette (`#141318`).
- `app/globals.css` imports `shadcn/tailwind.css`, which supplies the `data-open`
  / `data-checked` / … custom variants the base-vega components compile against.
  Do not drop that import.
- **Dark-first**, and deliberately not following the OS: `components/theme-provider.tsx`
  sets `defaultTheme="dark"`, `enableSystem={false}`.
- **Assistant markdown is [Streamdown](https://streamdown.ai)**, not `react-markdown`.
  Two lines in `app/globals.css` are load-bearing: `@import "streamdown/styles.css"`
  (the `animated` reveal keyframes) and `@source "../node_modules/streamdown/dist/*.js"`
  — Streamdown ships Tailwind utility classes inside its compiled JS, so without
  that the markdown renders unstyled. It expects the shadcn tokens, which the
  base-vega palette already supplies.
- **Syntax highlighting is our own Shiki plugin**, `lib/studio/highlighter.ts`,
  built on `createHighlighterCore` with a fixed language set (tsx, ts, jsx, js,
  json, bash, css) and the JS regex engine, so no `onig.wasm` has to load over
  the custom protocol. `@streamdown/code` is deliberately not installed: it calls
  `createHighlighter` with `bundledLanguages` and its options expose themes only,
  so the 9.1 MB it adds cannot be configured away. `CodeHighlighterPlugin` is a
  public interface and `plugins.code.getThemes()` wins over the `shikiTheme` prop.
  The langs and themes are dynamic imports, so they are separate chunks, not part
  of the initial bundle.
- `cn()` in `lib/utils.ts` (clsx + tailwind-merge) composes all classNames.
- Path alias `@/*` maps to the repo root. Bun honours it too, so `sidecar/` code
  imports `@/shared/ipc` the same way the webview does.

### Effect

Effect is how effects are expressed here — not an option to justify per case.
`effect@4.0.0-beta.101`; read `agent-patterns/effect-schema.md` before any Schema
code, because v4 rewrote Schema and v3 knowledge is wrong rather than stale.

- **`lib/**` returns `Effect`, hooks run it.** Every effectful function fails with
  a `Data.TaggedError` (`SidecarError`, `ShellError`, `ChannelError`,
  `HandlerError`), built in the `catch` of `Effect.tryPromise`. Never let a bare
  `UnknownException` reach a hook: `Effect.runPromise` then rejects with a
  `FiberFailure` whose message hides the real text, and for the sidecar that text
  *is* the feature — "the sidecar is not running" has to reach the UI.
- **Hooks surface failures as values.** `useAsyncAction` runs
  `Effect.runPromiseExit` and renders `causeMessage(exit.cause)`;
  `Cause.hasInterruptsOnly` returns `null` there, so a deliberate cancel is not
  an error.
- **Cancellation is interruption.** `useSidecarEmitter` keeps a `Fiber`, not a
  request id, and `Effect.onInterrupt` sends the cancel frame. Subscriptions are
  `Effect.acquireRelease` inside `Effect.scoped`, forked once and interrupted on
  unmount, so the unlisten is structural rather than bookkeeping.
- **Effect v4 names that differ from muscle memory**: `Effect.callback` (not
  `async`), `Effect.result` (not `either`), `Effect.catch` (not `catchAll`),
  `Schema.decodeUnknownEffect`/`Exit` (not `decodeUnknown`).
- **The one place not to modernise** is `useHydratedSettings`. `lib/studio/settings.ts`
  memoises the store handle with `Effect.cached`, and interrupting *any* caller of a
  cached effect caches the interrupt exit, so every later caller fails forever. That
  hook drops late results with a closure flag on purpose; a fiber interrupt there
  hangs the boot screen in `next dev` only, because of StrictMode's double mount.

### The sidecar

One bun process, owned by the Rust core, supervised in `src-tauri/src/sidecar/`.
The webview never talks to it directly: it goes through Tauri commands
(`sidecar_request` / `sidecar_cancel` / `sidecar_status` / `sidecar_restart`) and
gets streams back over `tauri::ipc::Channel` and status over a `sidecar://status`
event.

- **stdio, not a port.** Frames are newline-delimited JSON on stdin/stdout;
  **stderr is the log** and the core copies it, line by line, into
  `~/Library/Logs/com.remocn.remocn-studio/sidecar.log`. Anything the sidecar
  writes to stdout that is not a frame breaks the protocol, so use `log()`.
  Ports come later and per-service (the Vite preview reports its own).
- **`shared/ipc.ts` is the only contract**, written as Effect `Schema` and
  mirrored by serde in `src-tauri/src/ipc.rs`. `SIDECAR_METHODS` holds a schema
  per method for params, result and stream chunk; the TS types are derived from
  those with `["Type"]`, so `requestSidecar` and the handler map are typed from
  one place and every boundary is *decoded*, not cast. Bump `SIDECAR_PROTOCOL`
  when frames change — a mismatch is logged, not fatal.
  - The wire discriminator is `type`, not Schema's default `_tag`, so the frames
    are `Schema.Union`s of `Schema.Struct`s with a `Schema.Literal` tag. Keep it
    that way: the Rust `#[serde(tag = "type")]` mirror depends on it.
  - Decoders are `Exit`-based and hoisted to module scope. `Exit` *is* an
    `Effect` in v4, so the same decoder works inside `Effect.flatMap` and in a
    synchronous Tauri `Channel` callback — where decoding must stay sync, or
    forked fibers would reorder stream chunks.
  - The request envelope keeps `method` as a plain string and `dispatch` decodes
    it separately. If the envelope rejected unknown methods, a bad method would
    be dropped as unparseable and the caller would wait forever instead of
    getting `there is no method called …`.
- **A turn carries more than a prompt.** `claude.prompt` takes the reasoning
  `effort` and image `attachments`, and answers with the context-window reading
  next to the session id. Two decisions there are deliberate: attachments travel
  as **paths**, and `sidecar/claude/content.ts` reads and base64-encodes them, so
  megabytes of image never cross the Tauri IPC or the stdio frames; and the
  context reading is taken from the live `Query` with `getContextUsage()` **before
  the turn closes it**, because afterwards there is no session left to ask. It is
  wrapped in a timeout and ignored on failure — a missing reading hides the meter,
  it never fails the turn. Where the images sit in that turn is the *prompt's*
  decision now — see *Pasting a picture, and pointing at it*.
- **Permissions are a `canUseTool` gate *and* a permission mode.** The gate is the
  constant: `review()` in `sidecar/claude/permission.ts` resolves each path field —
  symlinks and `..` included, walking up to the nearest existing ancestor so a file
  that is about to be created still resolves — and auto-allows the file tools when
  everything lands inside `params.cwd`. Bash always asks; so does a tool with no
  path rule. What the *mode* changes is how much traffic ever reaches it, because
  the SDK routes a call to `canUseTool` only when the mode would otherwise prompt.
  - **The mode belongs to the session** and travels on `claude.prompt` as
    `permissionMode`. Three values, spelled the way the SDK spells them so there is
    no translation table: `auto` (the default), `acceptEdits`, `plan`.
    `bypassPermissions` and `dontAsk` are deliberately not offered — a mode that
    skips the gate has no story here.
  - **What `auto` costs.** Claude Code's classifier decides *before* `canUseTool`,
    so in `auto` a call the gate would have stopped — including a write resolving
    outside the opened folder — can be approved without the gate ever seeing it.
    The #223 invariant "anything outside the folder always asks" is therefore
    absolute in `acceptEdits` and `plan`, and best-effort in `auto`. That is the
    trade `auto` *is*; it is not an oversight. Its silent denials are not silent:
    `system`/`permission_denied` is folded into a `notice`, or a refused tool would
    show up as nothing but a failed activity line.
  - **The CLI is asked what it actually did.** `system`/`init` reports the
    `permissionMode` in force; it rides on the `session` event, and a mismatch with
    what was requested (a model without `supportsAutoMode`, say) adds a `notice`.
    The chip must never claim a mode the turn did not run in.
  - **Plan mode ends in a card, not a message.** `ExitPlanMode` reaches the gate
    like any other tool and gets its own reason, `plan`, with the plan markdown in
    the tool input. Approving carries the mode to continue in, and the sidecar
    applies it to the live `Query` with `setPermissionMode` — so the same turn
    starts building — then persists it and re-emits the `history` chunk, which the
    webview already folds into the session row. Denying is "keep planning" and says
    so to the agent, rather than the standard refusal.
  - **The ask is a stream chunk of the turn** (`ClaudeEvent` `permission`), not a
    notification, so it belongs to the turn that raised it and dies with it. The
    answer is a *separate* `claude.permission` request, which works because
    `dispatch` forks each request into a `FiberMap` rather than serving them in
    order.
  - The card renders **above the composer, not in the transcript** — an approval
    is a thing to answer, not a thing that happened. `useClaudeTurn` keeps the
    asks in a queue and hands out the head, because one assistant message can
    raise several tool calls at once. The composer is locked while one is up, and
    answering removes it: what the tool then did is already the activity line's
    job to say.
  - The gate is a module singleton in `sidecar/handlers.ts`; `makeGate()` exists so
    tests get their own. It holds a `Deferred` per pending ask and a `Set` of
    remembered signatures — session-scoped by being process-scoped, never written
    to disk.
  - **Cards settle before the interrupt is awaited.** `stoppable()` calls
    `onStop` — `gate.abandon(turnId)`, synchronously — *before*
    `session.interrupt()`, because that call can only be answered by a CLI that is
    not blocked on a permission prompt. `Effect.onExit` around the stream repeats
    the abandon for every other way a turn can end.
- **bun comes from the user's machine**, resolved from `$REMOCN_STUDIO_BUN`,
  `~/.bun/bin`, `$PATH`, then the usual Homebrew/`/usr/local` locations. A
  GUI-launched app gets a minimal `PATH`, which is why the fallback list exists.
  The app does **not** bundle a bun runtime — #218 already requires the user to
  have bun and a logged-in Claude Code.
- **Where the script comes from differs by profile**: debug resolves
  `../sidecar/index.ts` from `CARGO_MANIFEST_DIR` (edit and restart, no build
  step), release resolves the bundled `sidecar/main.js` from the resource dir.
  The release bundle is **minified with no sourcemap** — bundling Effect makes
  the map 4.16 MB of mostly third-party sources, and dev already runs from
  source where traces are exact. 0.51 MB shipped, against 26 KB before Effect.
- **Inside the sidecar, everything is Effect.** `SidecarChannel` is a
  `Context.Service` over stdio (`sidecar/channel.ts`), so tests provide a
  `PassThrough` instead of the process. In-flight requests live in a `FiberMap`
  keyed by request id: `cancel` is `FiberMap.remove` (a fiber interrupt) and
  stdin EOF closes the scope, which interrupts every request at once. Each
  request replies exactly once from an `Effect.onExit` finalizer, so a cancelled
  or crashed handler still answers — a plain `SIGTERM` now gets a `cancelled`
  frame out before the process exits. There is no `AbortController` anywhere:
  `Effect.sleep` is interruptible on its own.
- **Nothing is orphaned.** The child is spawned into its own process group, so
  quitting signals the whole group — enough to take down `claude` and Vite later.
  Belt and braces on the child's side: the sidecar exits when stdin hits EOF (the
  parent's pipe closes even on `SIGKILL`) and polls `REMOCN_STUDIO_HOST_PID`
  every 2s.
- **Crashes restart, with a visible gap.** Four attempts with exponential
  backoff; every in-flight request is failed with the reason rather than left
  hanging, and after four the phase is `down` until someone hits Restart.
  A request made while the sidecar is still starting waits for `ready` (20s cap)
  instead of failing.
- Fonts come from `next/font/google` (Manrope → `--font-manrope`, Geist Mono →
  `--font-geist-mono`) and are self-hosted into the export at build time. Note
  this means **`bun run build` needs network on a cold cache.**

### History

Sessions and transcripts live in **our own SQLite**, opened by the sidecar with
`bun:sqlite` — not in the Claude Code transcript files, whose format is not a
public contract and would break the left pane on any CLI update. Only
`sdk_session_id` is kept, and only so the SDK can `resume`.

- **The sidecar owns it, because the sidecar is where the events are.** Writing
  from the webview would mean a Tauri IPC round trip per text delta; here it is
  a function call on the same object that just emitted the chunk. `bun:sqlite`
  also costs nothing to add — it is part of the runtime the sidecar already is,
  where `tauri-plugin-sql` would have pulled sqlx into the Rust build and put raw
  SQL in the webview. Accepted cost: the pane needs the sidecar up, which every
  other part of the app already does.
- **The database file is the core's decision, not the sidecar's.** Rust resolves
  `app_data_dir()`, creates it and passes it as `REMOCN_STUDIO_DATA_DIR`, next to
  `REMOCN_STUDIO_HOST_PID`. Run by hand without it, the sidecar falls back to a
  temp dir and says so on stderr.
- **A block is a transcript entry, and there is exactly one fold.**
  `shared/transcript.ts` holds `fold`; the webview runs it to render the live
  stream and `sidecar/history/recorder.ts` runs the *same* function to decide
  what to store. The recorder writes only the entries whose identity changed —
  `fold` is immutable, so that is at most one row per event. Two folds that had
  to agree would drift; this one cannot.
- **Grouping runs of activity is render-time, and lives nowhere near that fold.**
  `lib/studio/runs.ts` takes the entries and returns items that are either one
  entry or a run of consecutive tool calls; the pane folds a run of two or more
  into a single row showing the last of them and a `+N`, which expands into
  exactly the rows it replaced. Doing it in `shared/transcript.ts` instead would
  put presentation into SQLite and make the stored transcript lossy — and because
  the grouper is a pure function over the entries, a session loaded from history
  groups identically to one folded live.
- **Every tool call folds, and only a failure breaks a run.** An earlier rule
  folded a named set of read-only tools and kept every command on screen. Two
  turns' worth of screenshots killed it: a real turn is walls of `Bash`, and the
  walls are as much `mkdir` and generator scripts as `ls` — a rule that spares
  mutations spares the wall. A failed call still stands alone, because its error
  text renders under the row and a count must never be the only trace of the one
  thing that went wrong. Showing the newest entry rather than a count is what
  makes the same row a live ticker while the turn runs.
- **A row leads with an icon for the kind of work, not a state dot.**
  `components/studio/activity-icon.tsx` maps tool → lucide icon through a `Map`
  (a `Record` would resolve `constructor` off `Object.prototype`), with a wrench
  for anything unknown. State went into the icon's colour, so a settled turn has
  no column of green and `running`/`failed` stay findable.
- **`id` is not stored.** The row is `(session_id, ordinal, kind, payload)` and
  the id is rebuilt on load as `block-<ordinal>`, so a session loaded from disk
  and a turn folded live can never collide on a React key.
- **A crash costs the in-flight block and nothing else.** Every event upserts its
  row as it arrives (`ON CONFLICT (session_id, ordinal)`), in WAL with
  `synchronous = NORMAL` — a force-quit cannot lose a committed row, and the next
  turn resumes numbering from `MAX(ordinal) + 1`.
- **History never fails a turn.** `recording()` swallows and logs every store
  error and hands back an inert recorder, the same way the context-window reading
  does; a database that cannot be opened at all yields `broken()`, whose methods
  all fail with the reason, so Claude still works and the pane says why it is
  empty. The `history.*` methods report their errors normally.
- **Migrations are `PRAGMA user_version`** against `MIGRATIONS` in
  `sidecar/history/migrations.ts` — one array entry per version, applied in one
  transaction. The schema *will* change; adding an entry is the whole ceremony. A
  step is a SQL string or a function over the driver, because migration 2 has to
  resolve symlinks and take a basename to turn every `session.folder` into a
  `project` row, and SQL can do neither. That migration rebuilds `session` around
  `project_id`, which is why `migrate` turns **foreign keys off** around its
  transaction: with them on, `DROP TABLE session` runs an implicit delete and the
  cascade takes every `block` with it. `PRAGMA foreign_key_check` before `COMMIT`
  is what proves it did not.
- **A folder is a row.** `project (id, path UNIQUE, name, …)` and `path` is
  canonical — `realpathSync` plus `resolve`, so the same folder opened twice,
  symlink or not, is one project rather than two histories. Sessions cascade from
  it and blocks from them, so removing a project is one `DELETE` and never touches
  the folder on disk. A project whose folder is gone keeps its row: `missing` is
  computed at read time with `existsSync`, and the sidecar refuses to start a turn
  in it rather than handing the SDK a `cwd` that is not there.
- **The mode is a column on the session** (migration 3, defaulting to `auto`, so
  every session that predates it comes back behaving exactly as it did). Two things
  write it: the turn itself, through `open`'s upsert, so the stored mode and the
  mode a turn ran under cannot drift; and `history.mode`, for a mode picked between
  turns that would otherwise be lost on quit. A draft session has no row yet and
  keeps its mode in the turns map, exactly as it keeps its SDK session id.
- **`bun:sqlite` cannot be imported by the test suite** — Vitest's workers run
  under Node, which has no `bun:` loader — so the store is written against a
  three-method `SqlDriver`. Production binds it to `bun:sqlite` in
  `sidecar/history/sqlite.ts` (imported only from `index.ts`); the tests bind it
  to `node:sqlite` and exercise the real SQL. Those suites need
  `// @vitest-environment node`: the default jsdom environment refuses to bundle
  Node built-ins, and `vitest.setup.ts` skips its DOM teardown when there is no
  `window`.

The pane on top of it: projects ordered by their most recent session — that
*base* ordering is `project.list`'s `ORDER BY` — sessions newest first inside
each, expansion persisted in `settings.json`. A session row is created by
the first turn and arrives in the webview as the `history` chunk at the head of
that turn's stream, which is why the list can show a brand-new session without a
round trip and without racing the turn that created it. The id in that row is one
the *webview* minted and sent, so a turn has a key from the moment it starts
rather than from the moment the sidecar answers.

### The pane never hides what needs you

`paneGroups` in `lib/studio/groups.ts` is one pure function over the projects, the
sessions and the turn map, and it decides everything the pane's honesty rests on:
grouping, ordering, the collapsed rollup, and which rows the cap may hide.
Components render its output and decide nothing, which is why the rules are pinned
by tests that render nothing.

- **Attention beats recency, but only where it exists.** Inside a group: waiting
  first, longest wait leading, then running, then everything else in the order the
  store gave. Across groups: the store's order is the base and a group holding a
  waiting session is promoted above the rest, keeping the base order within each
  half. That promotion is the one piece of ordering the *webview* owns, and it has
  to be — turn state exists nowhere else. With an empty turn map the output is
  byte-for-byte the store's order.
- **The cap counts only quiet rows.** Waiting, running and unread rows render
  regardless and are excluded from the "Show N more" count, so the number always
  matches what expanding reveals and the cap can only ever hide what you have
  already seen and settled.
- **The rollup is worst-of**, waiting > running > failed > unread, on the project
  row while the group is collapsed, and waiting carries its count.
- **Timestamps are webview-only.** `TurnState` gains a `startedAt` when a turn
  begins and each pending ask an `askedAt` when its event arrives — no IPC, schema
  or sidecar change, because the webview already receives both moments. One
  minute-interval tick (`useNow`, a fiber, not a bare `setInterval`) drives every
  label in the pane, and the pure layer takes `now` as an argument so tests pass a
  fixed one instead of faking clocks.
  - **The thinking marker reads the same `startedAt`, a second at a time.**
    `runningTime` is the ticker's formatter — seconds, then `2m 5s`, then
    *`elapsedTime` itself* past an hour, so the long tail is written once and the
    two panes cannot drift. The chat pane owns that clock and passes `now` down;
    the marker formats and decides nothing. The redundancy with `Running · 2m` is
    deliberate — one origin instant, a resolution per pane, chosen by how many
    rows are on screen at once. `useNow` takes `null` for "do not tick", and the
    pane passes an interval only while its turn runs: without it an idle window
    repaints the conversation once a second for a desktop app's whole lifetime.
    `Effect.repeat` runs its effect once before the schedule, so resuming the tick
    refreshes `now` rather than measuring the turn against a timestamp frozen when
    the pane mounted. The number is muted, `tabular-nums` and outside the shimmer,
    and carries no live region or status role: a screen reader must never be
    handed something that changes every second.
- **Rows are adaptive.** Settled is one line — title left, relative time right.
  Waiting, running and failed take a second line: `Waiting 4m · Bash`,
  `Running · 2m`, or the first line of the error. The waiting timer counts *up*
  and never toward the gate's ten-minute auto-deny: if that window changes the
  pane needs no change, because it displays elapsed and not remaining.
- **Hovering hides nothing.** The status marker leads the row and the delete
  button has its own slot, where the marker used to fade out to make room for it —
  aiming at a session used to cost you the thing you were checking.
- **Deleting forgives.** The row leaves the list at once, but `history.remove` is
  held behind an undo window — `Effect.sleep` in a forked fiber — and the toast's
  Undo is a fiber interrupt that puts the row back at its old index, selection
  included. The window is a parameter with a default so tests shrink it. Quitting
  inside the window drops the delete rather than rushing it: the session comes back
  next launch, which is the failure direction that keeps data. A busy session still
  refuses to be deleted at all.

### Turns run in the provider, not in the pane

`hooks/use-turns.ts` holds a map keyed by that id: entries, the running `Fiber`,
the pending permission queue. Switching sessions is a read from another key, so
nothing is interrupted — where the chat pane used to be keyed on a token and a
remount *was* the cancel, cancellation is now `stopTurn`, said out loud.

- **The open session is a ref, not a prop.** `markOpen` tells the store which key
  is on screen; a turn that ends anywhere else sets `unread`, which the row shows
  as a dot until you open it. Status per row — running, waiting on a permission,
  failed — is derived from the same map by `statusOf`, and none of it is stored.
- **The pane's folder is the open session's project, not the selected one.**
  `openedProject` resolves it from the session's `projectId` and only falls back
  to the selection, because the selection is `null` until `project.list` answers
  and every path in the transcript then renders absolute. One project drives the
  title, the transcript's `cwd`, the permission card and the missing-folder
  banner, so they cannot disagree about which folder a turn ran in.
- **A permission belongs to its turn, not to the screen.** A background session
  that asks marks its row and keeps its own composer locked; the card is answered
  when you open that session. The gate denies anything unanswered for ten minutes,
  because with background turns "nobody is looking at this card" is the normal
  case and a held card holds a `claude` process open.
- **The mode chip reads the open turn, not a setting.** Model and Effort are
  app-wide and live in `settings.json`; the mode is per session and lives in the
  same map as everything else about a turn, which is why the composer takes it as a
  prop where the other two come from `useStudio()`. Persisting it needs both the
  turn map and the session list, so `useWorkspace` owns that seam — it is the only
  place that has both.
- **Quitting asks first.** The Rust core prevents both `CloseRequested` and
  `ExitRequested` and emits `app://quit-requested`; the webview answers by
  invoking `quit_studio` immediately when nothing is in flight, or after the
  confirmation when something is. The flag that lets the second attempt through
  lives in Rust, so `app.exit(0)` cannot deadlock against its own guard.

### Pasting a picture, and pointing at it

Cmd+V attaches whatever image is on the clipboard and drops `[Image #1]` at the caret;
the sentence the user writes is what says which picture they mean, and the turn is built
by cutting the text at each reference and splicing the image in there (#13).

- **The reference format lives in `shared/references.ts`**, next to the IPC contract and
  the transcript fold, for the same reason the fold is shared: it is parsed in two
  processes — the webview colours it, `sidecar/claude/content.ts` splices into it — and
  two implementations that had to agree would drift. Everything about the format is a pure
  function there: render, segment, insert at a caret, locate the reference a keystroke
  should take, drop one (or several) and renumber, and diff two drafts for the references
  that left. A number outside the attachment count is **not** a reference: `[Image #7]`
  with three attached is plain text everywhere, coloured nowhere and spliced nowhere.
- **The invariant is positional.** `items[i]` is always `[Image #{i+1}]`, which is what
  makes the sidecar's splice a lookup by number rather than through a side table, and why
  references carry no identity. Removing an attachment removes its reference and shifts
  every higher one down, so the list and the text cannot disagree.
- **The binding runs both ways, which is why the reference is atomic.** Deleting the
  reference deletes the attachment, so Backspace/Delete touching or inside `[Image #N]`
  takes the whole token in one keystroke rather than leaving `[Image #1`, which parses as
  nothing. Anything that removes a reference wholesale — select and delete, cut, paste
  over, Cmd+A — is caught instead by diffing the draft against the previous one in
  `onChange`, and that path is the *only* one that rewrites text the user just typed, so
  the fast path must never touch the caret. Two consequences worth knowing: modified
  deletes (Option/Cmd+Backspace) are left to the browser and land in the diff path, and
  **this reverses #13's story 16** — referencing is no longer optional, so an attachment
  cannot outlive its reference. `contentOf`'s unreferenced-first rule stays because it is
  what keeps a no-reference message byte-for-byte what it was, not because the UI can
  still produce one.
- **The composer owns the text, so it owns the references.** `useAttachments` is a plain
  store whose add/attach report *how many* items arrived; every operation that touches
  both the list and the text is orchestrated in `useComposer`, the only thing holding the
  caret. `refer()` reads the live textarea rather than the `value` closure, so an image
  that took a second to save cannot overwrite what was typed meanwhile.
- **Three rules keep the spliced content safe.** Attachments nobody referenced go **first**,
  ahead of the whole sequence — with no references at all that reduces byte-for-byte to
  what the builder emitted before, which is what keeps the old behaviour and its tests
  intact. A repeated reference stays literal text, so the image is sent once. Empty and
  whitespace-only text blocks are dropped, because the API rejects them. The reference
  text itself is *not* kept in the content — the image is at that spot — while the stored
  transcript keeps the raw prompt, so history still shows `[Image #1]`.
- **Pasted bytes become a file before anything else touches them.** The contract carries
  attachments as paths, so the one unavoidable crossing happens once, at paste time, as a
  **raw-body invoke** — bytes as a binary body, not a JSON array of numbers — with the media
  type and the percent-encoded filename in request headers. `src-tauri/src/paste.rs`
  decides where the file lives, exactly as the core decides where the history database
  lives; the webview never picks a location. The written name is sanitised, keeps the
  original extension when it already implies the same media type, and is disambiguated on
  collision, so the basename is what the card displays. **Pasted files are never swept**:
  history renders the same previews for past turns, so a sweep would hollow out old
  sessions.
- **Colouring a `<textarea>` is an overlay, not a rich editor.** The composer stays a real
  textarea — keyboard behaviour, accessibility and the existing tests depend on it — with
  its own text transparent, its caret kept, and a mirrored `aria-hidden` layer underneath
  carrying identical typography and padding. `MessageText` draws both that overlay and the
  user's bubble in the transcript, so a sent message looks like the message that was
  written. The colour is its own token (`--reference`), not the primary colour, which in
  the dark palette is too dark to read as text.
  - **A reference may differ in colour and in nothing else.** The caret is positioned by
    the textarea's metrics and the text you read is the overlay's, so any per-reference
    style that changes width — weight, tracking, size, family, padding — desyncs the two,
    and the error *accumulates*: `font-medium` on the span put the caret a character off
    after four references. Colour is the only property that costs nothing here.
- **Previews come from the asset protocol**, enabled in `tauri.conf.json` with the
  `protocol-asset` cargo feature; no ACL permission is involved, since Tauri 2 gates it by
  configuration alone. The scope is `**` on purpose: an attachment can be picked from
  anywhere and the app already opens arbitrary folders. `previewUrl` returns `null` rather
  than throwing outside a Tauri webview, and a dead path falls back to the icon the card
  used to show. **The card is the picture and nothing else** — a filename and a format chip
  are what you read when you cannot see which one it is, so showing the thing itself
  replaces them rather than joining them. The name stays as the image's `alt` and the
  card's hover title, which is also all that identifies a card whose file has gone.
- **Under jsdom there is no asset protocol either**, so a test that renders a non-empty
  attachment list installs the `convertFileSrc` fake next to the command fake — per test,
  because `clearMocks()` drops `window.__TAURI_INTERNALS__` between them.

Whether the macOS webview actually hands a pasted image to the page is the one thing no
seam can test; it is verified by hand in the running app. If it ever stops doing so, the
fallback is to read the clipboard in the core: the command loses its request body and
everything above it is unchanged.

### New projects

`templates/remotion/` is a real Remotion project checked in here and mapped into the
bundle by `tauri.conf.json`; Rust resolves it the same way it resolves the preview entry
(source tree in debug, resource dir in release) and passes it as
`REMOCN_STUDIO_TEMPLATE_DIR`. The one-composition invariant is *ours*, so the template
declares it — one `<Composition id="Main">` — rather than the app hoping a generator
produced it.

- **Two methods, because they fail differently.** `project.create` makes the folder and
  the row; `project.scaffold` streams `template` and `install`. The second is where the
  network is, so the chat is usable while `bun install` runs, and a failure leaves the
  project in place with a Retry.
- **Expansion never overwrites.** A file that already exists is skipped, which is what
  makes Retry safe once Claude has edited the scene. `package.json` is the one file the
  copy rewrites, to name the package after the folder — slugified, since npm names cannot
  hold spaces or capitals.
- **The linter has one exception for the template.** `useFilenamingConvention` is off
  under `templates/**`: every Remotion project has `src/Root.tsx`, and a scaffolded
  project spelled `root.tsx` would look wrong to anyone who has seen another one.

### What the agent knows

What makes this remocn studio and not a generic Claude Code GUI (#225). `agent/` is a real
Claude Code **plugin** checked in here and mapped into the bundle by `tauri.conf.json`; Rust
resolves it the way it resolves the template and passes it as `REMOCN_STUDIO_PLUGIN_DIR`, and
`pluginsFor` in `sidecar/claude/knowledge.ts` turns it into the SDK's `plugins` option. It
carries three vendored skills: `remocn`, `remotion-best-practices` and
`remotion-interactivity`.

- **A plugin, not the user's `~/.claude`.** Skills installed globally are invisible here:
  measured with an empty folder, `settingSources: ["project"]` lists 45 commands and none of
  them is a remocn skill, and reaching a global install means adding `"user"` — which also
  loads `~/.claude/settings.json`, `~/.claude/CLAUDE.md` and, on the author's machine, 106
  further commands, so the app would behave differently per user. The plugin route lists 48:
  exactly the three we ship, namespaced `remocn-studio:<name>`. `settingSources` stays
  `["project"]`, and nothing outside the app is ever written.
- **`skills:sync` produces real files, and that is load-bearing.** `~/.claude/skills/*` are
  symlinks into `~/.agents/skills/`, so a plain `cp -R` vendors dangling links and the plugin
  then loads *nothing*, with no error anywhere. The script runs `skills add … --copy` in a
  temp directory — never in the repo, whose "project" the CLI would resolve on its own — and
  copies with `dereference`. `skills:check` refetches and compares a sha256 per file, so
  upstream drift and a local edit fail the same way; `treeOf` rejects a symlink outright.
- **The vendored tree is excluded from every tool that would rewrite it.** `agent/skills` is
  force-ignored in `biome.jsonc` and `agent` is excluded in `tsconfig.json` — formatting it
  would make `skills:check` report drift forever, and the skills ship `.tsx` samples that
  import `remotion`, which is deliberately not a dependency here.
- **The vendored copy is the floor, not an override.** A project that installed any of these
  skills into its own `.claude/skills` gets the plugin dropped entirely rather than shadowed:
  both copies would otherwise load, since plugin skills are namespaced and cannot collide.
- **The conventions the skills cannot know** live in `sidecar/claude/conventions.ts` and ride
  on `systemPrompt` as `{ preset: "claude_code", append }` — the wire keeps `systemPrompt` and
  `appendSystemPrompt` as separate fields, so this adds to Claude Code's prompt rather than
  replacing it. They are the one-composition invariant (`Main`, scenes inside it via
  `Series`/`TransitionSeries`) and keeping the result editable.

### The preview

The pane runs **the project's own Remotion bundler with our entry instead of the Studio UI**.
Neither branch of #226 survived contact with a real project: a Vite host builds
`remocn-demo` without an error and emits 3 CSS class selectors where Remotion's
bundler emits 742, because `enableTailwind` is a splice of webpack *loaders*
(`style-loader`, `css-loader`, `@remotion/tailwind-v4`'s `@tailwindcss/webpack`)
and Vite cannot run those — it silently falls through to the project's
`postcss.config.mjs`, a different Tailwind with different source detection. And
Plan B was never necessary, because Remotion's webpack entry is an array whose
last element is a parameter:

```js
entry: [ fast-refresh, setup-environment, userDefinedComponent, react-shim, entry ]
```

`@remotion/studio/previewEntry` is only `Internals.waitForRoot((Root) => render(<Studio …/>))`.
Studio is a UI on top of the bundler, not part of it. `preview/entry.tsx` takes that
slot and mounts `<Player>` instead, so the pane is ours and the pixels are Remotion's.

- **Everything is resolved from the project**, never bundled here:
  `BundlerInternals.webpackConfig` *and* `webpack` itself come from the project's
  `@remotion/bundler`, the override from its `remotion.config.ts` via
  `ConfigInternals.getWebpackOverrideFn()`, and the entry point from the CLI's own
  `findEntryPoint` (reached through `@remotion/cli/package.json`, since the exports map
  blocks the deep path) with `ENTRY_CANDIDATES` as the fallback. `@remotion/player` is
  always present — it is a dependency of `@remotion/cli` and of `@remotion/studio`.
- **The opened folder is not the Remotion root.** `remotionRootOf` climbs to the nearest
  `package.json` first, exactly as the CLI does, and the host `chdir`s there — otherwise
  opening `src/demos/some-scene` reports "no Remotion entry point" for a folder that is
  part of a perfectly good project. Entry candidates are searched from that root, never
  from the folder the user happened to pick.
- **Which composition plays** is `folder → Main → first`, and the folder wins because it is
  the only thing the user actually pointed at: opening `src/demos/introducing-opus-5` in a
  project with forty compositions and no `Main` should not play `transition-lab`. The
  basename of the opened folder travels to the page as `window.remocn_preferred` and the
  entry prefers a composition with that id. The rule is strictly additive — no match means
  the `Main`-then-first order of #226 is unchanged — and the pane always says which of the
  three happened, so the pick is never silent.
- **`webpackOverride` can be async.** `remocn-demo`'s is. Not awaiting it puts a `Promise`
  into the config, which fails without a useful message.
- **The host is a child process with `cwd` set to the project**, because config files
  routinely resolve paths against `process.cwd()` — Remotion's own loader does
  `process.chdir(remotionRoot)` for the same reason. `sidecar/index.ts` re-execs itself
  with `--preview-host`, so there is one bundle and one Tauri resource rather than two.
- **One host at a time, keyed by project** (see #235): sessions in one project compile a
  byte-identical bundle, so a host per session is two compilers on one tree. A full
  compile of `remocn-demo` costs ~7 s and peaks at 1.67 GB, and the webpack filesystem
  cache does not help, so hosts are not kept warm. A stopped host loses nothing: the next
  start compiles from disk, and a host left running would rebuild on every agent edit for
  a pane nobody is watching.
- **The base config already pins `react`, `react-dom/client`, `remotion` and
  `@remotion/studio` to absolute paths**, which is why `preview/entry.tsx` can live
  outside the project at all. `@remotion/player` is the one alias we add.
- `preview/` is **excluded from `tsconfig.json`**: it imports `remotion` and
  `@remotion/player`, which are deliberately not dependencies here. The linter still
  covers it, and `lib/studio/preview.test.ts` decodes the exact message the entry posts,
  which is the only guard against that boundary drifting.
- The stream is the lifetime: `preview.start` is a long-lived request and stopping it is
  a fiber interrupt, which drops the `acquireRelease` that owns the child. There is no
  `preview.stop`.
- **`building` after `ready` is normal** — `ProgressPlugin` reports 100% after the first
  compile finishes. `usePreview` ignores progress once served, or the pane would replace
  a live player with a spinner.

### Pointing at an element, and commenting on it

Inspect mode: hover the frame, click the thing you mean, write what should change, and the
selection lands in the composer as `[Element #N]` — the second kind of composer reference,
alongside `[Image #N]` (#18). The message is still sent by hand.

- **Source resolution is React Grab, driven headlessly.** `grab`'s global build is served
  by the preview host at `/__remocn/grab.js` from a Tauri resource, resolved the way the
  template and the agent plugin are, and it goes in the page **before the project bundle**
  — bippy's `Object.defineProperty` patch has to be in place before React defines the
  DevTools hook. Measured: the hook is installed at script evaluation, so `init()` may be
  called later, which is what lets the container be the player's canvas. Keeping it out of
  the project's webpack is the point: that compile costs seconds and peaks over a
  gigabyte, and this is 380 KB it would otherwise carry.
- **Nothing reaches a third party.** `__REACT_GRAB_DISABLED__` is set in the page's globals
  so the bundle does not self-initialise, `init` is called with `telemetry: false`, and the
  `@import` of a Google-hosted font inside grab's shadow-DOM stylesheet is stripped by
  `withoutWebFonts` **when the file is served**. `sidecar/preview/grab.test.ts` reads the
  installed bundle and fails if a version bump reintroduces one — the alternative, a CSP on
  the preview page, would also block fonts the *project* legitimately loads.
- **`init({ enabled: false })` returns a stub, not a disabled API.** Read out of the bundle:
  that branch hands back `{ getSource: () => Promise.resolve(null), getStackContext: () =>
  Promise.resolve(""), … }`, `getPlugins()` is `[]`, and `setEnabled(true)` does not revive
  any of it. So `enabled: false` would resolve every source location to `null` and look
  exactly like a project whose sourcemaps are broken. `init` is always called with
  `enabled: true`; it is lazy, running on the first arm rather than at page load.
- **`init` does not take a `theme` — only plugins do.** The options `init` defaults are
  `{activationMode, keyHoldDuration, allowActivationInsideInput, activationKey, getContent,
  maxContextLines, freezeReactUpdates}`, and `Options` has no `theme` field either, so a
  theme passed to `init` is silently dropped — which is how the toolbar, the label and
  grab's default hue all survived being "turned off". The theme rides on
  `registerPlugin({ name, theme })`.
- **`theme.enabled` is a trap: turn the sections off, one by one.** It reads as the global
  switch, but the bundle only consults it *once, synchronously inside `init`*, to decide
  whether to mount the renderer at all — and a theme cannot be handed to `init`. A plugin
  registered afterwards is always too late for it. The per-section flags
  (`toolbar`, `selectionBox`, `elementLabel`, `dragBox`, `grabbedBoxes`) are reactive
  getters, so those *do* take effect from a plugin. Measured in the shipped bundle by
  counting nodes in grab's shadow root: control 25 nodes / 4 buttons, `theme.enabled: false`
  25 / 4 — unchanged — and `theme.toolbar.enabled: false` 4 / 0.
- **The container is `.__remotion-player`**, which is the Player's canvas div and not its
  outer container — `getContainerNode()` returns the outer one, which holds the transport
  controls too. That class name is `playerCssClassname`'s default and Remotion injects its
  own preview CSS against it, so it is load-bearing for Remotion rather than incidental.
- **`preview/` duplicates the message shape rather than importing it**, as it already
  duplicates the hot-reload path: it is compiled by the project's webpack and has no access
  to the app's alias. `lib/studio/preview.test.ts` decodes both directions, and that test is
  the only thing keeping the two in step. Every file under `preview/` needs its own entry in
  `tauri.conf.json`'s resources.
- **The channel is two-way and typed.** Page → app is a union discriminated by `type`
  (`composition`, `selection`, `rebuilt`); app → page is `inspect`, `freeze`, `seek`,
  addressed to the preview origin rather than `*`. Incoming messages are checked against
  the origin `preview.start` reported **before** decoding, because these payloads carry file
  paths that end up in a prompt; with no origin yet, nothing is accepted.
- **`getSource` gives the component, the stack gives the parents.** Grab's display-name
  accessor returns a Remotion wrapper; the source lookup returns the real scene, so the
  component name comes from there. `projectFrames` keeps only frames inside the Remotion
  root and outside `node_modules`, and drops the `apply` frame Remotion's dev-mode JSX proxy
  leaves in every stack. Sourcemap paths are relative to the Remotion root, which is not
  necessarily the opened folder, so the page carries `window.remocn_root` next to
  `remocn_preferred` and `absolutise` joins against it.
- **The scene comes from the fiber, its file does not.** Walking `fiber.return` for props
  that look like a `Sequence` (finite `from` *and* `durationInFrames`) gives the scene's
  identity and timing cheaply. Its own file and line are *not* available that way — for a
  transition series the inner sequence element is created by Remotion, so the nearest
  injected stack resolves into Remotion's code. The scene component's location is already
  correct in the element's own stack, which is where it comes from.
- **Hit-testing and the hover box are ours; grab is only a source resolver.** Grab's overlay
  is taken down wholesale (`theme.enabled: false`) and `activate()` is never called, so what
  is left of it is `getSource`, `getStack` and `getDisplayName`. `preview/picker.ts` picks
  the element and `preview/inspect.ts` draws the box, **inside the preview document**, so the
  highlight still shares a document with the cursor and cannot lag. Grab's own hit-test could
  not be steered: `Options` exposes no filter, its `ElementAtPointOptions.filter` is internal,
  and its arrow keys are *spatial* navigation between neighbours, not a climb to the parent.
- **The picker answers two questions grab got wrong.** First, *what is actually under the
  cursor*: it walks `elementsFromPoint` and takes the first element that **paints something
  at that point** — a background, a border, a shadow, a replaced element, or a text node whose
  own client rect contains the point — instead of the topmost transparent wrapper. Grab
  already drops `display:none`, `visibility:hidden` and `opacity:0`, and transparent overlays
  — but only ones covering ≥90% of the viewport on both axes, which a mid-sized animated
  wrapper sails past. Second, *how much of it you meant*: `climb` walks up while the element
  is an **inline wrapper** — inline-level and painting no surface of its own — and stops at
  the first block-level element, which is the line. That is deliberately *not* "a short
  element with siblings sharing its tag": that earlier rule missed the two commonest shapes
  a text animation actually has — a word wrapped in a wrapper of its own
  (`<span class=word><span>mind</span></span>`, where the inner span has no siblings) and a
  line that is one word long. Painting its own surface is what stops the climb at a
  highlighted chip inside a sentence, and block-level is what keeps a grid of cards from
  collapsing into the grid. Holding **Alt** turns both rules off and picks the literal
  topmost node. The rules are pure over the DOM and tested in jsdom.
- **Tags are compared by `localName`, never `tagName`, because of SVG.** `tagName` upper-cases
  HTML elements but leaves SVG ones as authored, so `<svg>` reports `"svg"` and a set of
  upper-cased names misses every icon in the project. That single mistake broke both halves
  at once: an icon counted as painting nothing, so the hit test walked past it, and it
  computed to `display: inline`, so `climb` stepped straight over it. Anything in the SVG
  namespace is now **a drawing**: it always paints — the browser's own SVG hit-testing is
  `visiblePainted`, so being returned by `elementsFromPoint` already proves the point is on
  drawn geometry, and `fill` would never show up as a `background-color` anyway — it is never
  an inline wrapper, and `climb` folds any shape inside it up to the outermost `<svg>`,
  because what you pointed at is the icon and not one of its paths. Alt still picks the path.
  HTML inside a `foreignObject` falls out of this by itself, being in the XHTML namespace.
- **Pointer events are swallowed while armed.** `pointerdown`, `pointerup` and `click` are
  captured on `window` and stopped inside the canvas — otherwise Remotion's `clickToPlay`
  would toggle playback under every pick. Hover is recomputed on a `requestAnimationFrame`
  tick rather than per event.
- **Markers and the comment card render in the app window**, over the iframe, in an
  `inset-0 pointer-events-none` overlay so hover and click still reach the page. Marker
  geometry is **normalised to the preview page's viewport**, which is exactly the iframe
  element's box, so a resize keeps markers on their elements; `cardPlacement` is a pure
  function over three rectangles and is tested without rendering anything.
- **The card is not a Popover on purpose.** A popover brings Esc-to-close, outside-click-to-
  close and a focus trap, and outside-click in this mode means "select the next element".
  While it is open the page is sent `freeze`, which stops the picker tracking and ignores
  clicks, so the frame does not flicker with highlights while you type.
- **The prompt keeps the token in the sentence and appends a block per selection at the end.**
  Unlike an image, an element's payload is dozens of lines, and splicing it inline would tear
  the sentence apart. There is one block per entry in the list, not per mention, so two
  selections of the same element stay separate and a repeated mention does not duplicate the
  payload. With no selections the content is byte-for-byte what it was.
- **Availability is narrow, and the reasons differ.** Inspect is off while the composer is
  locked, while the preview is not serving, and while the preview's project differs from the
  open session's — the preview follows the *selected* project and the chat follows the *open
  session's*, and those can diverge. Element references are dropped when the open session
  moves to another project; text and images are left alone. That drop fires only on a real
  switch, never on the first `null →` resolve at boot.
- **A rebuild clears the markers and disarms**, because a box drawn over the old render lies
  about the new one, and the page that comes back has forgotten it was armed. Unsent
  references and whatever was being typed are untouched — an agent saving a file must not
  delete your draft. Marking references *stale* per changed file is deliberately deferred.
- **A selection with no source is still usable**, travelling with markup, component name and
  frame, and says so on its chip. Failing closed would make the feature intermittently and
  silently useless.
- **Arming is acknowledged, so the button cannot lie.** The page answers every `inspect`
  command with a status — `armed`, `disarmed`, `inert`, `no-canvas`, `no-grab` — and whether
  it held a player ref to pause. The pane prints anything that is not a clean arm, including
  "the preview never answered" once the silence outlasts `PATIENCE`, which is what a stale
  compiled page looks like from the app's side. A disabled button carries the reason it is
  disabled on its tooltip. Both exist because the first version of this failed silently in
  three different places at once and none of them were distinguishable from the outside.
- `PromptElement` carries `fps` as well as `frame`, which the prototype's shape did not: it is
  what lets the chip read `0:01.4` rather than a frame number, and it makes the block's frame
  counts interpretable. `file` is nullable for the same reason the chip needs to say "no
  source".
- **The first resolution after a rebuild costs ~210 ms** — the sourcemap fetch and parse —
  and every one after it is 0 ms, so arming warms it up with a throwaway `getStack`.

## Layout

Flat root, no monorepo — per #218.

```
app/                  Next App Router (layout, page, globals.css)
components/ui/        shadcn/ui primitives (Base UI–backed)
components/studio/    app-level components (panes, sidecar status, quit guard)
hooks/                all behaviour: no logic inline in components
lib/                  cn helper, error formatting, lib/studio/* clients
preview/              what the *project's* webpack compiles instead of Studio's UI:
                      entry.tsx, the two-way bridge, hot reload, grab, source paths
shared/               ipc.ts: the typed contract; transcript.ts: the one fold;
                      references.ts: the one reader of `[Image #N]`/`[Element #N]`
sidecar/              bun: frame loop, method handlers, Agent SDK, SQLite history
sidecar/history/      driver seam, migrations, project and session stores, recorder
sidecar/scaffold/     what "New project…" expands and installs
templates/remotion/   that project, vendored here and shipped as a Tauri resource
agent/                the Claude Code plugin we hand the SDK: vendored skills
scripts/              build-time tooling; skills-sync.ts is the vendoring step
sidecar/preview/      the --preview-host child: project resolution, webpack watch, server
src-tauri/            Rust core (Tauri v2), the sidecar supervisor, pasted-image writes
public/               static assets
```

## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies

When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

`repos/` is gitignored and excluded from `tsconfig.json` and from Zed's file scan — the checkouts
are local reference material, not part of this project's build.

## Distilled agent patterns

`agent-patterns/` holds patterns already extracted from the vendored checkouts. Read the relevant
file there **before** the upstream guide: it is shorter, every API in it was verified against the
vendored source, and it records where the upstream docs drift from the actual code.

- `agent-patterns/effect-schema.md` — `Schema` in Effect v4 (`effect@4.0.0-beta.101`). Read before
  writing any Schema code. v4 rewrote Schema, so v3 knowledge from training data is wrong rather
  than merely stale — e.g. `Schema.decode` is no longer a decoder, and the `effect/schema` import
  path in the upstream guide does not resolve.
