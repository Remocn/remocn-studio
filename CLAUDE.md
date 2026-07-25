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
- **Three panes:** sessions | chat | preview, exactly one active session.
- **Own SQLite history** — the CLI transcript format is not a public contract.
- **Permissions split:** file tools inside the opened folder run automatically;
  Bash and any path outside the folder raise an Allow/Deny card.
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
  `base-luma`; every `components/ui/*` file imports from `@base-ui/react/*`.
  Prop names and composition patterns differ from Radix — check the actual
  primitive import before editing a component.
- **Tailwind v4, CSS-first.** No `tailwind.config.*`. Theme lives in
  `app/globals.css` via `@theme inline` and CSS variables (`:root` / `.dark`),
  colors in `oklch()`, radius scale derived from `--radius`. Tokens are copied
  from remocn.dev — the `.dark` set is the warm obsidian palette (`#141318`).
- `app/globals.css` imports `shadcn/tailwind.css`, which supplies the `data-open`
  / `data-checked` / … custom variants the base-luma components compile against.
  Do not drop that import.
- **Dark-first**, and deliberately not following the OS: `components/theme-provider.tsx`
  sets `defaultTheme="dark"`, `enableSystem={false}`.
- **Assistant markdown is [Streamdown](https://streamdown.ai)**, not `react-markdown`.
  Two lines in `app/globals.css` are load-bearing: `@import "streamdown/styles.css"`
  (the `animated` reveal keyframes) and `@source "../node_modules/streamdown/dist/*.js"`
  — Streamdown ships Tailwind utility classes inside its compiled JS, so without
  that the markdown renders unstyled. It expects the shadcn tokens, which the
  base-luma palette already supplies.
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
  it never fails the turn.
- **Permissions are a `canUseTool` gate, not a permission mode.** The turn runs on
  `permissionMode: "default"` so every call reaches `sidecar/claude/gate.ts`.
  `review()` in `sidecar/claude/permission.ts` resolves each path field — symlinks
  and `..` included, walking up to the nearest existing ancestor so a file that is
  about to be created still resolves — and auto-allows the file tools when
  everything lands inside `params.cwd`. Bash always asks; so does a tool with no
  path rule.
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
  transaction. The schema *will* change; adding an entry is the whole ceremony.
- **`bun:sqlite` cannot be imported by the test suite** — Vitest's workers run
  under Node, which has no `bun:` loader — so the store is written against a
  three-method `SqlDriver`. Production binds it to `bun:sqlite` in
  `sidecar/history/sqlite.ts` (imported only from `index.ts`); the tests bind it
  to `node:sqlite` and exercise the real SQL. Those suites need
  `// @vitest-environment node`: the default jsdom environment refuses to bundle
  Node built-ins, and `vitest.setup.ts` skips its DOM teardown when there is no
  `window`.

The pane on top of it: sessions newest first, selecting one loads its blocks and
rebinds the agent to *that* session's folder, and switching stops the running
turn — the chat pane is keyed on a token that only an explicit select or New
changes, so a remount is the interrupt. A session row is created by the first
turn and arrives in the webview as the `history` chunk at the head of that turn's
stream, which is why the list can show a brand-new session without a round trip
and without racing the turn that created it.

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

## Layout

Flat root, no monorepo — per #218.

```
app/                  Next App Router (layout, page, globals.css)
components/ui/        shadcn/ui primitives (Base UI–backed)
components/studio/    app-level components (panes, title bar, sidecar status)
hooks/                all behaviour: no logic inline in components
lib/                  cn helper, error formatting, lib/studio/* clients
preview/              the entry the *project's* webpack compiles instead of Studio's UI
shared/               ipc.ts: the typed contract; transcript.ts: the one fold
sidecar/              bun: frame loop, method handlers, Agent SDK, SQLite history
sidecar/history/      driver seam, migrations, store, per-turn recorder
sidecar/preview/      the --preview-host child: project resolution, webpack watch, server
src-tauri/            Rust core (Tauri v2), including the sidecar supervisor
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
