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
  packaging; `--bundles app` skips the DMG. Since `createUpdaterArtifacts` is on,
  it now also wants the updater's signing key: export
  `TAURI_SIGNING_PRIVATE_KEY_PATH`, or pass `--no-sign` to skip the `.sig` — a
  bundle built that way cannot be released, only run. See *Updating in place*.
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
3. Merging that PR is the decision to release. The push it produces finds an
   empty `.changeset/`, so the *same* workflow takes its publish branch instead:
   `changeset tag` names `v<version>`, the job pushes it, and the action reports
   `published`.
4. That output — not the tag — releases the macOS build (Apple silicon + Intel)
   in the same run, which publishes the GitHub release with the bundles and
   `latest.json` attached.

The version script is named `version:packages`, not `version`, because npm and
bun treat a `version` script as an `npm version` lifecycle hook, which recurses.

Two things about step 4 are the way they are because the obvious versions of them
do not work, and both cost a silent non-release of 0.0.1 to find:

- **The build cannot be triggered by the tag.** A tag pushed with `GITHUB_TOKEN`
  does not start a workflow run, so `on: push: tags` never fires for a tag this
  workflow created. Hence the gate on the `published` output and a build in the
  same run — and hence no tag trigger in the file at all, since one would read as
  the mechanism while never running.
- **`changesets/action` is pinned to `v1.9.0` and takes v1's input names** —
  `version`, `publish`, `commit`, `title`, `createGithubReleases`. The v2 line
  renamed all of them to kebab-case, an unknown `with:` key is silently ignored,
  and `@v1` is a *branch*, not a tag. So `version-script` / `commit-message` /
  `pr-title` / `create-github-releases` did nothing, `push-git-tags` is not read
  by v1 at all, and a missing `publish` meant the action logged "Not publishing
  because no publish script found" and returned. `version PR` went green in 16s
  and no tag was ever created.

`publish` is `changeset tag`, not an npm publish — the package is private. The
action greps its stdout for `New tag:` to decide `published`, and that command
prints nothing once the tag is on the remote, which is what stops a later push to
`main` from releasing the same version twice.

### Updating in place

`tauri-plugin-updater` against this repo's own releases; the endpoint is
`releases/latest/download/latest.json`, which GitHub resolves to the newest
release that is neither a draft nor a prerelease.

- **The updater signature is not optional.** `pubkey` is a plain required `String`
  in the plugin's config — there is no unsigned mode to choose. It is a minisign
  key from `tauri signer generate` and has nothing to do with Apple code signing,
  which this app still does not do: the private half is the
  `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository
  secrets, and the CLI refuses to build when the configured pubkey has no private
  counterpart — or when the two do not match.
- **Step 4 stopped drafting because of this.** A draft's assets have no reachable
  download URL, so a drafted release can serve neither the manifest nor the
  `.app.tar.gz` it points at. Publishing on tag push is what makes the feature
  possible at all, not a change of taste.
- **`development` and `production` are different builds, and only one updates.**
  `studio_build` answers `{ environment, version }` off `cfg!(debug_assertions)`
  — the same signal `sidecar/spawn.rs` reads to decide where the sidecar script
  comes from — and `useUpdates` checks nothing at all in `development`. That is
  not politeness: in dev the executable is `target/debug/remocn-studio` rather
  than something inside a `.app`, and the plugin works out what to replace by
  climbing to `Contents/MacOS` from the current exe, so a check there fails on a
  path lookup and never reaches the network.
- **The two macOS jobs run one at a time.** `latest.json` carries a key per
  platform and tauri-action builds it by fetching the asset already on the release
  and merging its own entry in. Run in parallel, both fetch before either writes,
  and the loser's architecture silently vanishes from the manifest — an update
  that 404s for half the machines. `max-parallel: 1` is what makes the merge a
  merge, and it is the whole reason the matrix is serial.
- **Restarting is ours.** `Update::install` replaces the bundle and returns; it
  does not relaunch. `restart_studio` mirrors `quit_studio` in calling
  `confirm_quit()` first — otherwise the quit guard prevents `ExitRequested` — and
  additionally shuts the sidecar down by hand, because `AppHandle::restart` spawns
  the replacement and calls `exit(0)` itself, so the event loop never reaches the
  `RunEvent::Exit` where `Sidecar::shutdown` normally runs. `shutdown` guards on
  an atomic, so saying it twice costs nothing.
- **A missing build reading is not an error.** It means there is no core to ask —
  `bun dev` opened in a browser — and the row reads "Waiting for the Tauri core"
  instead of a transport message. A failed *check* does surface, inside the
  popover only, because a background poll must not put a banner on screen.
- **Progress is folded, not reported.** The plugin streams `Started` / `Progress`
  / `Finished` and each progress event carries only its own chunk length, so
  `advance` in `lib/studio/updates.ts` accumulates them into `{ received, total }`
  and is a pure function with its own tests. `Finished` settles `received` on
  `total`, or a bar whose last chunk was rounded away would stop at 99%.

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

### The agent seam

The turn machinery is provider-neutral (REM-251, phase 1): `handlers.ts` talks to
an **`AgentAdapter`** — `{ info, account, turn }` in `sidecar/agent/adapter.ts` —
and `sidecar/claude/` is the first adapter. What stays neutral lives in
`sidecar/agent/` (the permission gate's Effect skeleton, the mode switch, the
per-provider account cache, the registry); what speaks SDK stays in
`sidecar/claude/` (the `CanUseTool` guard, the in-process MCP servers, the
event translation, the failure classifier, the auth probe).

- **`shared/providers.ts` is the provider contract**: `AGENT_PROVIDERS`, the
  `AgentCapabilities` shape (`context`, `effort`, `modes`, `planTool`, `resume`,
  `thinking`) and the static `PROVIDER_INFO` table. The table is static on
  purpose — the webview and the sidecar ship in one bundle, so it cannot drift
  from the adapters the registry carries, and the composer's chips need no
  loading state. **Capabilities, not `if provider`**: the Mode and Effort chips
  render only when the provider claims them; context meter, thinking marker and
  plan checklist already degrade to nothing when their events never arrive.
- **The provider is a property of the session** — a column (migration 5, default
  `claude`), a field on `HistorySession` and on `agent.prompt`'s params (decoding
  default `claude`, so a session row or a stored turn written before the field
  existed still decodes). The webview
  reads it back into `TurnState` exactly as it does `sdkSessionId`, and only the
  session's own provider failing its login check locks the composer
  (`isBlocked(checks, provider)` — the account row's id *is* the provider id).
- **The tool dictionary crosses the wire as a verb.** A `tool_use` event and its
  stored activity entry carry `verb` — the adapter's translation of its own tool
  name into the neutral vocabulary (`read`/`edit`/`create`/`run`/`search`/`find`/
  `web`/`plan`/`task`/`subagent`) that `activity-icon.tsx` keys on, with the old
  name map behind it for rows stored before verbs existed and names no adapter
  translates. Detail rendering (`lib/studio/activity.ts`) and the task-checklist
  parser still read Claude's names; they move behind the seam when adapter #2
  needs them to.
- Still Claude-shaped, deliberately, until the next phases: the model picker,
  the `remocn-pipeline`/`remocn-library` servers (in-process SDK MCP → stdio MCP
  is phase 2), knowledge delivery (plugins are Claude Code's mechanism), and a
  handful of user-facing strings that say "Claude".

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
- **A turn carries more than a prompt.** `agent.prompt` takes the reasoning
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
  - **The mode belongs to the session** and travels on `agent.prompt` as
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
  - **The ask is a stream chunk of the turn** (`AgentEvent` `permission`), not a
    notification, so it belongs to the turn that raised it and dies with it. The
    answer is a *separate* `agent.permission` request, which works because
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
- Fonts come from `next/font/google` (DM Sans → `--font-sans`, Geist Mono →
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
- **The plan Claude writes is one checklist, derived the same way.** Claude Code
  plans with `TaskCreate`/`TaskUpdate`, not `TodoWrite`, and those calls used to
  render as a wall of wrench rows labelled with a truncated *description*.
  `lib/studio/tasks.ts` folds every task call of a turn into one checklist
  anchored at the first `TaskCreate`, which `lib/studio/runs.ts` emits in place of
  those entries before it groups the rest. Identity comes from the id in the
  create's `result` (`Task #1 created successfully: …`), with position among the
  creates as the fallback while the result is still in flight, since ids are
  assigned in order; an update naming an unknown id changes nothing rather than
  inventing a row. Because it is a pure function over the stored entries, a
  session reopened from SQLite renders the checklist the live turn showed, no
  `TranscriptEntry` variant was added and no migration was needed. A **failed**
  task call is not folded: it stays its own row with its error, as every failure
  does. **The task list belongs to the session, not the turn** — the tool numbers
  ids sequentially for the whole session and a plan written in one turn is
  routinely moved by updates in the next, so only where a plan is *anchored* is
  per turn: a later burst of creates opens its own checklist, in the order the
  conversation happened, while an update reaches its task wherever that task was
  written. Settling the list on every user message instead was the first version
  of this, and it cost every `TaskUpdate` of a second turn: the id matched
  nothing, so the call fell out of the checklist and drew a row saying "Updated
  task #6 description, status" while the plan above it stayed all-pending.
- **The plan also sits on top of the composer.** `TaskDock` is a section of the
  `DockStack` in the composer's own `max-w-2xl` column, collapsed to the task in
  hand — its `activeForm` — with the count on the right, and it opens *upwards*
  into the whole list. The stack has no bottom radius and no gap under it, so it
  abuts the composer and reads as a drawer behind it; overlapping the composer to
  get that effect is what the first two versions did, and each of them ended up
  putting an edge or a shadow of ours across the input. The queue is the stack's
  other section — see *The next message waits its turn*. It lived in the transcript's
  left gutter first, measured against the pane with a `ResizeObserver` and three
  visibility rules; sharing the composer's column deletes all of that — a pane
  resize reflows both together and there is nothing left to measure. Expanded or
  collapsed is `taskDock` in `settings.json`, so a plan left open comes back open.
  The checklist **stays in the transcript too**: there it is a record of what
  happened, and it is the only copy a session reopened from history can anchor in
  the right place.
- **A subject wraps; it never truncates.** A plan whose every row ends in an
  ellipsis is a plan you cannot read, and the block is free to grow downwards
  where it is not free to grow sideways — so rows wrap, the running one carries a
  surface, and the whole list scrolls with no fade over it. That is also why
  `PANEL_MIN` is a *readability* floor rather than exactly half of `PANEL_MAX`:
  below it a wrapped 14px line stops being worth reading, and the button says
  more than four clipped words would.
- **Depth is a token, not a border.** `--elevation-floating` in `app/globals.css`
  is a translucent ring plus ambient layers, so it composites over whatever of
  the transcript is behind it instead of being tuned to one background; the dark
  palette collapses it to a white ring with one wide ambient shadow, because a
  stacked shadow cannot be seen on a dark surface but this one floats over
  scrolling content. The shell's `rounded-xl` over `p-1.5` puts the rows'
  `rounded-lg` exactly a padding's width inside it, so the corner gap stays even.
- **Hiding is the user's, and it is remembered.** The panel's × folds it into the
  button, whose popover carries a pin to bring it back, and the choice is
  `taskDock` in `settings.json`. Hiding by hand can only ever *narrow* what the
  room allows, never widen it: with no room for the button either, there is
  nothing to hide and nothing to restore.
- **The pane's running row reads the same plan.** `rowOf` in `lib/studio/groups.ts`
  derives the open plan from the turn's entries with the same `currentTasks`, so
  `Running · 2m` becomes `Registering the scene · 1/3 · 2m` — the running task's
  `activeForm`, how many of the plan are done, and the elapsed time it already
  showed. It is derived **only while the turn runs**: a settled row stays one
  quiet line, and walking a finished session's entries on every minute tick would
  cost the whole pane something nobody is reading. The row is still one line; the
  checklist itself belongs to the transcript.
- **The thinking marker reads the running task's `activeForm`** — the
  present-continuous phrase the tool carries — falling back to its subject, and to
  "Thinking…" when nothing is in progress.
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
- **A folder that is gone leaves the list.** `paneSections` splits `paneGroups`'
  output into the projects still on disk and the ones that are not, and the pane
  renders the second half under a *Moved or deleted* heading. It partitions
  *after* the promotion above, so filtering preserves relative order and
  promotion becomes per-section for free — a missing project with a waiting
  session rises within its own half and can never outrank a live one. Splitting
  is all it does: a moved project keeps its sessions, its rollup and its
  transcripts, because the history is still worth reading and `Locate…` still
  reconnects it. The heading is a plain `<h3>`, not `SidebarGroupLabel` with a
  `render` prop: `useHeadingContent` cannot see children through `useRender`'s
  indirection and fails the check, and the primitive's own behaviour is all
  `collapsible=icon` handling that a `collapsible="none"` sidebar never uses.
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

### The next message waits its turn

Send during a running turn queues the message instead of dropping it, and the
queue is a field on `TurnState` like everything else about a turn — so it belongs
to the session, dispatches while you are looking somewhere else, and is gone on
relaunch. The sidecar and `shared/ipc.ts` are untouched: a queued message becomes
an ordinary `agent.prompt` when its turn comes.

- **This started as a silent data loss.** The textarea was never disabled on
  `isRunning`, so you could type — and Enter then cleared the field and every
  attachment list while `sendTurn` dropped the call on its `fibers.current.has`
  guard. `onSubmit` answers with a boolean now and `submit` clears only on a
  `true`, which also covers the other refusal (no project open) rather than only
  the one this feature added.
- **One fiber per session is the constraint, not a limitation to route around.**
  Two prompts on one `sdkSessionId` would fork two CLI processes against one SDK
  session and take `nextOrdinal` twice, so serialising is the design and the
  queue is what makes waiting visible. Streaming into the live turn through the
  SDK's already-open input generator is the v2 branch, and a different contract.
- **A queued message is captured whole, at the moment it was written** — text,
  attachments, elements, assets, media, *and* the model, effort, frame and
  project the composer was set to. Only the **mode** and the **provider** are re-read at
  dispatch, from the turn that just ended — the mode because approving a plan
  mid-turn changes the mode the session is in and the follow-up belongs in that
  one, the provider because it is a property of the session, not of the message. Capturing the frame at
  enqueue is the point of doing it this way round: "make this bit slower" means
  the frame you were looking at when you wrote it, not the one on screen three
  minutes later.
- **Dispatch is decided outside the state updater.** `nextQueued` is pure and is
  called on the pre-settle snapshot; the updater only drops the head it names.
  Reading the head *inside* the updater would send twice under StrictMode, which
  double-invokes updaters in dev.
- **Three things hold the queue where it is**, all of them "not what the person
  meant": a turn stopped by hand (a deliberate cancel, which reaches `onExit` as
  an interrupt), a turn that failed, and a permission still unanswered. The last
  one is `nextQueued`'s only reason to read `permissions`, since the settled state
  has none by then.
- **Recursion goes through a ref.** The `onExit` that dispatches lives inside the
  function it calls, so `launcher.current = launch` — the same shape `useComposer`
  uses to read the live text — keeps `sendTurn` a plain "start or enqueue" and the
  chaining out of it.
- **The queue is the second drawer, and it shares the plan's chrome.**
  `DockStack` in `components/studio/dock.tsx` is the geometry both use — the
  `max-w-2xl` column, the `px-3` inset that makes a strip narrower than the
  composer, `bg-card`, and the top radius; `DockSection` is one line of it, with
  the disclosure and the count. Rows under the composer were the first version and
  they grew the input downwards one line per message, which is the thing a queue
  must not do: collapsed, this is one line whatever is in it. The radius belongs to
  the *stack* rather than to each section, or two open drawers would leave a notch
  where their corners meet, and `empty:hidden` is what keeps the wrapper from
  painting a strip when neither has anything to say.
- **The plan is above the queue, and the queue is against the composer**, because
  the queue is the composer's own outbox: a message you just queued has to land
  where you were typing. The plan is context and moves up a line to make room.
- **A queued row wraps, exactly as a plan row does.** Collapsed, the strip
  truncates the message that goes out next; open, the rows wrap — a queue you
  cannot read is not a queue you can edit. `useQueue` is the only place the turn
  map and the composer meet: clicking a row drops it from the queue and restores it
  whole, which needs the composer's stores to take items back, so `restore` exists
  on each of them. Editing needs an empty composer and the row's title says so —
  overwriting a draft to recover an older one is a trade nobody asked for.
- **The queue's open state is not remembered, where the plan's is.** `taskDock`
  lives in `settings.json` because a plan outlives the turn that wrote it; a queue
  drains as its turns settle, so it is `useDisclosure` and starts collapsed.
- **A restored selection comes back without its rectangle.** The queue carries
  `PromptElement`, which is what the turn sends; the marker geometry is inspect's
  and is drawn only for selections made in the armed session, so a zero rect draws
  nothing rather than drawing a box over a frame that has since rebuilt.
- **Element references are not dropped on a project change here**, unlike in the
  composer: every queued message carries the project it was written in and is
  dispatched into that project's session, so its `[Element #N]` can never point
  somewhere the message is not going.

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
carries three vendored skills — `remocn`, `remotion-best-practices` and
`remotion-interactivity` — and one of our own, `video-lessons`.

- **`video-lessons` is ours, and it sits *beside* the vendored three rather than inside one.**
  `skills:check` walks each vendored skill and reports any file upstream does not have as
  `extra`, so a page added under `remotion-best-practices/` fails CI — and `skills:sync` would
  `rm -rf` it on the next refresh. The sync script only ever touches the skills named in its
  own `SOURCES`, so a sibling folder is invisible to both halves. `VENDORED` therefore stays
  the vendored three (it is also the collision check `pluginsFor` runs against a project's own
  `.claude/skills`) and `SHIPPED` is what the plugin actually carries; a test pins that the
  folder list equals `SHIPPED` and that every skill names itself after its folder.
- **The whole document lives in `SKILL.md`, not split across reference pages.** A skill's own
  body is injected by the harness, but a page it points at is fetched with the `Read` tool —
  and the plugin dir is outside the opened folder, so every such read would raise an
  Allow/Deny card mid-turn. One self-contained file is what makes the knowledge free to use.
  Read out of the CLI binary: plugin skills are discovered by scanning `skills/` for
  `SKILL.md` (no `plugin.json` entry needed, which is why the vendored three work with none),
  and one is skipped when it *"exceeds N byte limit"* — the limits in the binary are 128 KB
  and up, against 44 KB here.
- **The mandate to read it is a system-prompt line, and it is conditional.** `conventionsFor`
  appends it only when `pluginsFor` actually returned the plugin, because a project that
  installed its own copy of a vendored skill gets the plugin dropped *wholesale* — ordering a
  turn to invoke `remocn-studio:video-lessons` when nothing loaded it would be an instruction
  to fail. `LESSONS_SKILL` lives in `knowledge.ts` with the rest of the inventory and the
  prompt reads it from there, so the name in the sentence and the folder on disk cannot drift.
- **`"../agent": "agent"` maps the whole folder** in `tauri.conf.json`, so a new skill needs no
  resource entry — unlike `preview/`, which is listed file by file.

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
- **The static server answers byte ranges, and a video does not play without them.**
  Serving `public/` as one `200` with a chunked body and no `content-length` is enough for
  every image and font, and it is not enough for a `<video>`: the macOS webview probes with
  `Range: bytes=0-1` and abandons the element when the answer is not a `206`. Nothing
  reports that. `OffthreadVideo` renders `VideoForPreview` in the Player and defaults to
  `pauseWhenBuffering`, so a clip that never becomes playable shows up as a preview that
  loads for ever — a symptom that names neither the file nor the server. Remotion's own
  studio server does the same thing (`@remotion/studio-server`'s `serve-static.js`), which
  is why the same project plays under `npx remotion studio` and hung here. `sendFile` now
  sends `accept-ranges` and a real `content-length` always, `206` with a `content-range`
  for a range, `416` past the end and no body for a `HEAD`; `sidecar/preview/range.ts` is
  the pure parser, tested on its own, and an unreadable header is *ignored* rather than
  refused, as RFC 7233 requires.
- **`public/` revalidates, the bundle does not store.** `no-store` everywhere was the first
  version of the above and it is wrong for media specifically: the Player syncs a video's
  `currentTime` to the composition frame, so a scene is a stream of seeks, and a response
  the webview may not keep is one it has to refetch on each of them — plus the whole file
  again on every loop. Public files therefore carry `no-cache` and an ETag of size and
  mtime, which is a revalidation the agent's own edits invalidate for free; `If-None-Match`
  answers `304`, and a stale `If-Range` drops the range rather than splicing bytes from a
  file that has since changed. `bundle.js` and the render page keep `no-store`, where a
  cache hit surviving a rebuild is the failure that matters and there is no seeking to pay
  for. `sidecar/preview/caching.ts` holds the tag and the header parse, tested on their own.

### Footage the preview cannot afford

A video asset taller than the composition previews from a **proxy** — a 1080p h264
re-encode — while the export and the snapshot keep the original. The reason is one
measurement, and it is not the one the symptom suggested.

- **The cost is the seek, not the decode.** Measured in WebKit on a 15s clip: playing
  3840×2160 presented 24.4 fps with a 33ms median gap between frames — the hardware
  decoder keeping up — against 28.1 fps and the same median at 1920×1080. But a
  **seek** cost **59ms** at 4K against **6ms** at 1080p, and the tail was 97ms against
  84ms. Remotion's preview seeks constantly: `use-media-playback.js` sets
  `seekThreshold` to `playing ? 0.15 : 0.01`, so while the Player is paused *every*
  frame step is a seek, and 59ms is nearly two frame budgets at 30fps. A clip mounting
  mid-transition pays it at the worst possible moment. So `PROXY_HEIGHT` is 1080
  because that is where a seek stops costing a frame, not because it is a round number
  — and a 1080p source is left alone rather than re-encoded for nothing.
- **The substitution is two static bases, and the render page never sees a proxy.**
  `pageOptions` takes the base as an argument now: `previewPage` gets `previewBase`,
  `renderPage` keeps `staticBase`. The server resolves the first proxy-first and the
  second never, so `staticFile("library/clip.mp4")` is untouched in the project's code,
  the preview streams 1080p, and an export — which loads the render page — carries the
  original. The proxy answers under the original's URL with **its own** size and ETag,
  so a clip whose proxy lands mid-session invalidates what the webview cached rather
  than being pinned to whichever it saw first; the media type stays the URL's.
- **Matching is by content, because the file the preview asks for is a copy.**
  Insertion copies a library asset into the project's `public/library/`, so a proxy
  keyed by path would only ever serve the one folder. `sidecar/preview/proxies.ts`
  hashes the served file — about 40ms on 15MB, paid once per file per host, on the
  range probe a webview opens a video with — and looks it up against an index built
  from the library manifests. One proxy therefore covers every project the asset
  reached, and footage nobody put in the library is simply never matched.
- **The index is re-read on a timer, not on a signal.** A conversion takes minutes and
  lands mid-session; a scan of a few dozen small manifests every few seconds is cheaper
  than a channel between the sidecar and the host that would have to be kept in step.
  The lookup is synchronous because it happens inside the request handler, where a
  fiber would reorder the response — the same rule the `Channel` decoders follow.
- **The converter is ours, not the project's.** `@remotion/webcodecs` is a dependency of
  the *app* — 1.4MB, one transitive dep, no peer on `remotion` — dynamically imported so
  it is its own chunk. That does not break "the pixels come from the project's Remotion":
  a proxy is never in the render path. `canEncode()` asks
  `VideoEncoder.isConfigSupported` at run time rather than trusting the Safari reading,
  and a webview without an encoder records the decision and keeps playing originals.
- **0.58× realtime is what makes this a backfill.** Even with hardware encoding, a
  two-minute clip is three and a half minutes of work, so `useBackfilledProxies` is
  modelled exactly on `useBackfilledThumbnails`: sequential, each slug marked as its own
  turn begins, failures remembered for the session. The asset is usable the moment it
  lands; until its proxy exists the preview streams the original, which is slower to
  seek and never broken. `proxied` on the manifest is what stops a file already at the
  target, or a webview with no encoder, being measured again on every listing.
- **The proxy lives inside the asset folder**, as `proxy.mp4` beside `preview.png`, so
  deleting an asset takes its proxy with it and the undo window needs no new code.

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

### Taking a picture of the frame, and sending it

Snapshot: pause, click the frame for the whole thing or drag a rectangle for part of it, and
the pixels land in the composer as an ordinary attachment with an `[Image #N]` token (#21).
It answers *look at this*, where Inspect answers *change this*, which is why the two are
separate buttons and mutually exclusive rather than one mode with a switch.

- **A snapshot is a `PromptAttachment` and nothing new.** The feature adds a way to *create*
  one; `shared/ipc.ts`, the transcript fold, the history store, `content.ts`, the cards and
  `[Image #N]` are all untouched, so history, deletion and renumbering are correct on day one
  because they are not being changed. `useComposer.capture(file)` is `onPaste` without the
  clipboard, so the file goes through the same raw-body invoke into `pasted-images` — which
  is also why a snapshot survives on disk and old sessions keep their pictures.
- **One bundle serves the Player and the renderer**, because `@remotion/bundler`'s `bundle()`
  only puts `@remotion/studio/renderEntry` into the same `entry` slot `preview/entry.tsx`
  occupies. Measured on `remocn-demo`: the hybrid costs ~20 KB over Player-only, against a
  second full compile (~7 s, 1.67 GB peak) for a second bundle. Three things make it work,
  and each cost a failed run:
  - The alias `@remotion/studio/renderEntry$` goes **before** the base config's aliases —
    Remotion pins `"@remotion/studio"` to a *file* and webpack matches by prefix, so the
    subpath otherwise resolves to `dist/index.js/renderEntry`. It resolves to
    `dist/esm/renderEntry.mjs`, exactly as `bundle()` does.
  - A `{ include: renderEntry, sideEffects: true }` module rule, so nothing can tree-shake a
    module imported purely for `window.getStaticCompositions`.
  - The page needs `#video-container`, `window.siteVersion = "11"` and
    `window.remotion_version`; `video-container` is read at module scope, so it has to be in
    the HTML before the bundle loads.
- **Two pages, one bundle, and each page is what decides which half runs.** The preview page
  carries `#__remotion-studio-container` and no `#video-container`; the render page, served
  at `/__remocn/render/index.html`, carries the opposite. Our entry already returns early
  when `getPreviewDomElement()` is null, so the Player simply never mounts for a render — no
  new flag was needed. The render page's siblings resolve from the same prefix, so
  `bundle.js` and its sourcemap load next to it.
- **The preview page sets `remotion_puppeteerTimeout` on purpose.** It is the only signal
  `renderEntry` has for "headless", and in its absence the index branch mounts a read-only
  **Studio** into `#video-container` and flips `remotion_isStudio`. Setting it to 30000 — the
  value `delayRender` already defaults to — makes that branch return early and changes nothing
  else, since `isRendering` additionally requires `NODE_ENV` to be production. Verified in a
  real headless Chrome against `remocn-demo`: `remotion_isStudio` false, `#video-container`
  absent, the Player mounted with a 1280×720 canvas.
- **The render page declares `NODE_ENV=production`, and that is load-bearing.** The first
  working end-to-end render came out **blank white**: the preview compiles with
  `environment: "development"`, so `getRemotionEnvironment().isRendering` was false and
  Remotion rendered nothing into the portal. The page sets
  `window.process = {env:{NODE_ENV:"production"}}` before the bundle, and
  `remotion_envVariables` to `""` — with a truthy value `setup-environment` overwrites
  `NODE_ENV` with the compiled one, and with a falsy one it assigns nothing and ours survives.
  With that, the still is **byte-identical** to `npx remotion still` on the same frame.
- **Only frames may reach the host's stdout, and third parties do not know that.** Remotion
  forwards browser console output to stdout during a render, which put `[Tab 0, …]` lines into
  the frame channel. The host swaps `process.stdout.write` and the stdout `console` methods
  onto stderr at startup, keeping the real writer for `write()`. Patching `console` as well as
  the stream is not belt and braces: under bun `console.log` bypasses `process.stdout.write`.
- **The host is asked over its own stdin**, in the frames it already answers in — no second
  transport for one method. `preview.still` carries `{ projectId, composition, frame }` and
  answers with a path; the supervisor keeps a registry of running hosts keyed by project and
  a pending map keyed by request id, so a still for a project with no preview fails with a
  sentence rather than hanging. Stopping the preview fails everything still pending.
- **Cropping and downscaling happen in the webview, through `<canvas>`.** The host renders a
  full frame to a temp file, the webview reads it over the asset protocol, crops, downscales
  to ≈1568 px on the long edge and hands the bytes to the invoke that already stores pasted
  images. No image library reaches the sidecar or Rust. Cropping *before* downscaling is what
  keeps detail in a small region.
  - **The still is loaded `crossOrigin="anonymous"`, and it has to be.** The asset protocol is
    a different origin from the window, so a plain `<img>` load taints the canvas and
    `toBlob()` throws `SecurityError` — WKWebView words it *"The operation is insecure."*, with
    nothing in it to say which operation. Tauri answers every asset request with
    `Access-Control-Allow-Origin: <window_origin>` (`protocol/asset.rs`), so asking for CORS is
    all it takes. Displaying an attachment never needed this, which is why the cards worked
    long before the first snapshot did.
- **The rectangle is normalised to the composition in the page**, which is why a box drawn on
  a small preview crops the same region on a large render — the app only ever multiplies by
  the resolution `selectComposition` reported. That is a different transform from Inspect's,
  which normalises to the page viewport to draw markers; both are pure and tested.
  `.__remotion-player`'s rect *is* the video box (the Player scales that div by transform), so
  the contain-fit in `videoBox` is a no-op there and insurance if that ever changes.
- **A tiny drag is a click**, so a shaky hand cannot hand you a four-pixel picture, and the
  marquee is drawn inside the preview document for the same reason Inspect's box is.
- **Each capture sweeps the stills folder first** and writes a uniquely named file, which is
  safe because the composer refuses a second capture while one is in flight — and that refusal
  is also what story "a second of work must not read as a dead button" is made of.
- **`ensureBrowser` runs before every render with its progress surfaced.** It is the one place
  this feature touches the network. The render also carries a `delayRender` timeout and the
  whole capture an outer one, so a scene that never resolves fails with a sentence instead of
  hanging the app.
- **The render options come from `remotion.config.ts` too**, read the way the CLI reads them:
  `renderOptionsOf` loads the config and then asks `@remotion/renderer`'s own option objects
  for their values, so `Config.setChromiumOpenGlRenderer`, `setDelayRenderTimeoutInMilliseconds`,
  the chrome mode and the rest apply to a snapshot exactly as they apply to `npx remotion
  still`. That is the whole point of rendering through the project's renderer, and it is why
  there is **no invented default**: `--gl=angle` changes the pixels of a render that uses no
  WebGL at all (verified: different hash, visually identical antialiasing), so defaulting it
  would move every project's snapshot away from what its own export produces.
  - **A WebGL scene is the case this decides.** Remotion's default GL backend is `null` — no
    `--use-gl` flag — so the render browser has no GL context, a shader never compiles, and a
    component that only calls `continueRender()` after a successful draw hangs until the
    timeout. `remocn-neon`'s aurora fails identically under the stock `npx remotion still`,
    which is the tell that this is the project's setting to make and not ours to guess. The
    failure says so: a message mentioning `delayRender()` gets the reason and the config line
    appended to it.
- **A capture costs one page load, and it used to cost two.** Measured on `remocn-demo`:
  `openBrowser` 195 ms, `newPage` 187 ms, **`goto` 3319 ms** — the navigation *is* the cost, and
  it is the project's doing, not Remotion's: that one page pulls **19.9 MB over 71 requests, 64
  of them fonts**, because `@remotion/google-fonts` fetches at runtime and holds a
  `delayRender` until it is done. `selectComposition` and `renderStill` are ~2.9 s each for
  exactly that reason — one page load apiece.
  - **Reusing the browser buys nothing** (5799 ms → 5900 ms across a shared instance, measured):
    Remotion opens a fresh page per call and the cache does not carry, so there is no pool here
    and no state to manage.
  - **What does buy something is not measuring twice.** The `VideoConfig` from
    `selectComposition` is cached per composition in the host and passed straight to
    `renderStill`, so a capture navigates once: **8.4 s → ~3.6 s**. The cache is dropped in the
    same callback that notifies the page of a rebuild, so a recompile can never be captured
    against a stale composition.
  - **And doing it before the click.** Arming Snapshot fires `preview.warm`, which measures the
    composition while the user is still aiming — 4.4 s that used to sit inside the first click.
    Commands are handled sequentially on the host's stdin, so a click that lands mid-warm waits
    for it rather than starting a second navigation.
  - **A capture navigates zero times, because the page stays open.** `renderStill` is a
    sequence — size the page, `setPropsAndEnv` (which navigates), `remotion_setBundleMode`,
    `seekToFrame`, `takeFrame` — and only the navigation is slow. `sidecar/preview/session.ts`
    holds the page open past the first four steps, so a capture is just the last two:
    **83–122 ms**, byte-identical to `npx remotion still` on the same frame. That is the whole
    point of Snapshot being a *look at this* gesture: it has to answer at the speed of a click.
  - **The price is naming five of Remotion's internal modules** — `set-props-and-env`,
    `seek-to-frame`, `take-frame`, `puppeteer-evaluate` and `openBrowser` — reached the way
    `dist/options/*` and `@remotion/cli/dist/entry-point.js` already are. `warmInternalsOf`
    returns `null` if any export moves, and the host then falls back to `renderStill` per
    capture: slower, never wrong. An upgrade can cost the speed but not the feature.
  - **The session is keyed by composition and dropped on rebuild**, in the same callback that
    forgets the measurement — a page holding the old bundle would capture code that no longer
    exists. The webview already disarms on rebuild, so re-arming re-warms.
  - **Two orderings are load-bearing and cost three iterations to find.** The viewport is set
    *before* navigating, as `renderStill` does. And `remotion_calculateComposition` cannot
    replace `selectComposition` on the warm page without `waitForReady` between the evaluation
    `setBundleMode` and the call — without it the page reports *"Available compositions:"* and
    nothing else, because `setBundleMode` re-renders asynchronously. Measuring still costs its
    own navigation; it is cached, so only the first arm pays.
  - **Do not trust a stored hash as a fidelity baseline.** A PNG rendered hours earlier
    disagreed with a fresh one, and the warm session was blamed for it — but the stock CLI
    produced the *new* hash twice in a row. Whatever the project's runtime font loading resolves
    to is machine state, not a property of the renderer. Compare against a control rendered in
    the same session, or the comparison measures the clock.
  - **The floor for the warm-up is the project's.** One navigation is ~3.3 s, and a project that
    loads six Google font families with every weight pays most of it. Remotion says so in its
    own log — *"Consider loading fewer weights and subsets by passing options to loadFont()"* —
    and that is a change in the project, not here.
- **This was the first slice of Export**, which needs the same three things: the renderer
  resolved from the project, the browser provisioned, and progress reported. See *Exporting*.

### Exporting an mp4

The Export button renders the playing composition to `out/<Composition>.mp4` through the
**project's own** `@remotion/renderer`, with progress, cancellation and a reveal in Finder (#227).
Format and quality settings, a queue and Lambda are out of scope: this renders h264, and every
other knob comes from the project's `remotion.config.ts`, read the way a snapshot reads it.

- **There is no second bundle, and that is the feature.** #227 says "bundle the project, render
  the composition" — but the preview host has *already* compiled that project and is serving the
  render page it compiled, so `preview.export` renders from the same `serveUrl` a snapshot uses.
  A second `bundle()` would cost another ~7 s and 1.67 GB peak for a byte-identical result, and it
  could differ from what is on screen — which is exactly what the acceptance criterion "content
  matches the preview" forbids. So bundling progress is the preview's existing `building` events,
  and Export is unavailable until the preview is serving rather than starting its own compile.
- **The renderer is resolved, then checked.** `renderMedia` and `makeCancelSignal` come off the
  same project module the stills already use; `exporterOf` refuses a Remotion too old to export
  with rather than throwing `undefined is not a function` mid-render. `agreedVersionIn` then reads
  `remotion`, `@remotion/renderer` and `@remotion/bundler` out of the project's `node_modules` and
  refuses when they disagree, naming **every** package that drifted — a renderer a hundred patches
  from the `remotion` the preview compiled would not match the preview, which is the one thing an
  export must never do.
- **The render writes a dotfile and is renamed at the end.** A cancel or a failure must not leave
  a half-written `Main.mp4` that looks finished, and must not destroy the export from ten minutes
  ago; rendering to `out/.Main-<token>.mp4` and renaming on success gets both, since the rename is
  atomic and the cleanup only ever removes the partial. The removal is an `acquireRelease` acquired
  *before* the render, so it releases *after* it — finalizers run in reverse.
- **Cancelling waits for Remotion to stop before deleting anything.** `Effect.callback`'s cleanup
  runs on interruption and is awaited, so it calls Remotion's `cancel()` and then awaits the
  `renderMedia` promise settling. Without that wait the partial file would be removed while ffmpeg
  was still writing it, and the write would recreate it. Ten seconds is the grace; past that the
  file is removed anyway, because a renderer ignoring its own cancel signal must not hang a quit.
- **The export is forked, because the host's stdin loop is sequential.** `Stream.runForEach` over
  stdin serves one command at a time, so a `cancel` frame arriving during a three-minute render
  would not be *read* until the render finished. The export therefore goes into a `FiberMap` keyed
  by request id: `FiberMap.remove` is the interrupt, `FiberMap.size` is the one-at-a-time gate, and
  keying by id means a late cancel for a finished export cannot kill the next one. The map belongs
  to the host's scope, so quitting interrupts the render, which is what runs the cleanup above —
  and the host is already in the sidecar's process group, so its Chrome goes with it.
- **The webview cancels by interrupting a fiber, and the frame reaches the host.** `ask`'s
  interruption finalizer in `sidecar/preview/supervisor.ts` now sends `{type:"cancel", id}` to the
  host, guarded on `pending.delete(id)` returning true so a request that already answered cannot
  emit a spurious cancel. `causeMessage` returns null for an interrupt, so a deliberate cancel
  leaves no error on screen.
- **Progress is folded in the host and worded in the webview.** `renderMedia` reports
  `{renderedFrames, encodedFrames, progress, stitchStage}` and the host turns it into one
  `progress` event; `exportStatus` in `lib/studio/export.ts` decides whether that reads
  *Rendering — 64/300 frames*, *Encoding*, or *Combining the audio and the video*. Same split as
  `lib/studio/runs.ts` against the transcript fold: numbers cross the wire, sentences do not. The
  frame count is seeded from the measured composition so the first event already has a denominator,
  and `stitchStage` is normalised to the two values the schema knows — an unknown future stage
  would otherwise fail the stream decode and drop the chunk.
- **There is no outer wall-clock timeout**, unlike a snapshot's. A long render is the normal case;
  a frame that never resolves is already bounded by the project's own `delayRender` timeout, and
  that failure arrives with the WebGL explanation the stills share.
- **A rebuild does not cancel a running export.** Remotion loads the page once per tab when the
  render starts, so an agent saving a file mid-render does not swap the code under it — and killing
  a three-minute render because a file changed would be worse than the risk. The composition
  measurement is still dropped on rebuild, so the *next* export measures again.
- **The export state carries the project it belongs to.** Switching projects therefore hides that
  result without a reset effect, and switching *back* shows a render that is still going. A running
  export in another project is the reason the button can be disabled, and it says so rather than
  going quiet.
- **Measured against `remocn-demo`**, driving the host by hand: `thumb-introducing-remocn` exports
  to a 29,974-byte h264 1280×720 mp4 with an AAC track, and the frame decoded out of it is the real
  cover art — the *blank white* the render page's `NODE_ENV=production` exists to prevent. On the
  1012-frame `introducing-remocn`, progress climbed by frame count and a cancel at 152 frames left
  the 42 MB mp4 an earlier CLI render had put in `out/` **byte-identical**, with no partial beside
  it. `SIGTERM` to the host alone — harsher than a quit, which signals the whole process group —
  exited 0 and left no `chrome-headless-shell` behind.
- **`contact-sheet` cannot be exported, and that is the project's doing**: it loads
  `staticFile("thumb-previews/introducing-opus-5.png")`, which is not on disk, so the render fails
  on the image and would fail the same way under `npx remotion render`. Worth knowing before
  reaching for it as a cheap export target.

### The environment checklist

`project.check` runs when a folder is opened and answers, in one report, the things the app depends
on but does not own (#228). It renders above the composer — an approval is a thing to answer, and so
is this — and renders **nothing at all** once every row is `ok` or `pending`, which is what "gets out
of the way" means. It re-runs on opening a project, on Recheck and after an install, never per turn.

- **Authentication is a control request, not a turn.** `Query.accountInfo()` opens the CLI, asks, and
  closes: measured 1.6 s logged in, 0.7 s logged out, and no model call in either. Logged out answers
  `{ tokenSource: "none", apiProvider: "firstParty" }`; logged in answers `email` +
  `subscriptionType` + `apiProvider` and **no `tokenSource` at all**, so `tokenSource === "none"` is
  the discriminator and everything else is authenticated. A non-`firstParty` `apiProvider` is
  authenticated externally (AWS creds, gcloud ADC) and says so.
- **"claude on PATH" is not the check, because the SDK carries its own CLI** (`extractFromBunfs.js`
  and `manifest.zst.json`; `pathToClaudeCodeExecutable` is only an override). #228's two distinct
  states are therefore *could not start* and *not logged in* — a launch failure and a login failure,
  which is the split that matters since the fixes differ.
- **Only being logged out locks the composer.** A folder that is not a Remotion project does not:
  asking Claude to set one up is a reasonable next move, and refusing to talk to it would remove the
  only tool that could fix it.
- **`bun install --dry-run --frozen-lockfile` never looks at `node_modules`.** Measured: byte-identical
  output and exit 0 with `node_modules` deleted, because it only resolves the graph. It exits 1 for
  exactly one thing — `package.json` drifted from `bun.lock` — and it writes nothing at all, no
  lockfile and no `node_modules`, which is what makes it safe to run against the user's project. So it
  is the *drift* half of the dependency check and cannot be the *installed* half.
- **Resolution cannot be the installed half either, and that one is a trap.** Under bun,
  `createRequire(…).resolve()` answers out of **`~/.bun/install/cache`** — `typescript` resolved to
  `~/.bun/install/cache/typescript@7.0.2@@@1/package.json` for a project with no `node_modules`
  directory whatsoever. Worse, the drift check *populates* that cache, so running it made the next
  installed-check lie about the same project. `isInstalled` therefore looks for
  `<dir>/node_modules/<name>/package.json` on disk, walking up so a workspace hoist still counts, and
  bun's cache never does. This is also why `resolveFrom` in `sidecar/preview/project.ts` is a
  can-I-import check and not an is-it-installed one.
- **Offline is not an accusation.** `driftFrom` reports drift only when bun's error line mentions the
  lockfile; any other non-zero exit — a network failure, most likely — reports nothing rather than
  telling the user their lockfile is wrong.
- **One root cause is one row.** A folder with no `package.json` used to produce three failures
  (not a Remotion project, dependencies unknown, no entry point) for one fact. `checksFor` now omits
  the rows that are unanswerable rather than failing them: no manifest drops dependencies *and*
  entry, and a manifest without `remotion` drops entry alone, since dependencies is still true and
  still fixable.
- **The composition row is the preview's answer, not a second one.** The page already posts
  `{ compositionId, reason, total }` and `usePreview` already keeps it; `compositionRow` folds that
  into the checklist, so `total === 0` fails and `reason !== "main"` warns. Until the preview has
  compiled, the row is `pending` — which is quiet, or a project whose preview is not running would
  show the checklist forever. It is folded in **only when the preview's project is the open session's
  project**, because those two can diverge exactly as they do for Inspect.
- **The account probe is cached per sidecar process** and `force` — Recheck — is what clears it, so
  switching projects does not pay for it again. Warm, a whole report costs 250–800 ms.

### The asset library

Save something once and reuse it in every other video: an image, a video, a sound, or a finished
Remotion component (REM-8). It is a drawer at the foot of the left pane, and its assets reach a turn as
`[Asset #N]` — the **third** reference kind, beside `[Image #N]` and `[Element #N]`.

- **The library is a folder, not a database.** `assets/<slug>/` plus a `manifest.json` under
  `app_data_dir/library`, which Rust resolves and hands over as `REMOCN_STUDIO_LIBRARY_DIR` exactly
  as it does the history's `REMOCN_STUDIO_DATA_DIR`. Listing is a folder scan with no index to keep
  in step, and previews load over the asset protocol for free. The Schema lives in
  `shared/library.ts` next to the IPC contract, because the webview reads a manifest's fields on the
  card and the sidecar writes them.
- **The slug is the folder and never moves.** Renaming rewrites `name` in the manifest, so a
  reference already in a composer, and a copy already in a project, cannot be orphaned by a rename.
  A second asset of the same name gets `-2`.
- **Insertion is a copy, made before the turn starts.** `agent.prompt` carries the picked assets
  positionally (`assets[i]` ↔ `[Asset #{i+1}]`, the same invariant `[Image #N]` has) and
  `placeAssets` copies them in: media to `public/library/`, a component to `src/library/<slug>/`,
  resolved against `remotionRootOf(cwd)` rather than the opened folder. Three things fall out of
  doing it here rather than letting the agent fetch them: **zero permission cards** — the library is
  outside `cwd`, so an agent `Read` there would raise one every time; **zero tokens** spent retyping
  code that already exists; and a byte-for-byte copy rather than a paraphrase.
- **It never overwrites**, the same rule the scaffold has: an existing file is skipped and the block
  says *already in the project, untouched*, so an edit the agent made in an earlier turn survives a
  second insertion. A fresh copy is something the user asks for in words.
- **The block is the only thing the agent is told.** `assetBrief` names what was copied, what was
  skipped, `staticFile("library/…")` for media, and — checked with the same `isInstalled` the
  environment checklist uses — which npm packages are missing, for the agent to `bun add` through
  the ordinary Bash card. Nothing is written to `package.json` behind the turn's back.
- **A deleted asset is a sentence, not a failure.** `placeAssets` answers with a placement whose
  `reason` says the asset is gone; the turn runs. A copy that genuinely fails becomes a `notice` and
  the turn still runs, because the words the person wrote are worth more than the attachment.
- **The agent saves components, the UI saves media** — the split is about who knows the boundaries.
  The agent wrote the code and knows the import graph, so it gathers the files, names them and calls
  `save_asset` on a second in-process MCP server, `remocn-library`, modelled on `remocn-pipeline`
  and auto-allowed by the same rule in `permission.ts`: the library is app data, and `save_asset`
  only ever reads from `cwd` and writes into the library. There is no file-tree picker, because the
  studio's user does not read code.
  - **Which is why the pane lists again when a turn settles.** A component reaches the library
    through the sidecar's own MCP tool, so nothing in the webview is on that path and a save landed
    on disk that the list — read once, at boot — could not know about; a component saved by the
    agent appeared only after a relaunch. `useLibrary` takes `hasRunningTurns` and refreshes on its
    falling edge, which is the only moment the library can have changed behind the pane's back. The
    refresh is **quiet**: it does not raise `isLoading`, or every turn would end in a flash of
    skeletons reporting nothing.
- **Files keep their shape relative to what they share.** `layoutOf` takes the common ancestor of
  the saved paths and stores names relative to it, so `Scene.tsx` + `lib/ease.ts` land under
  `src/library/<slug>/` with the relative import between them still correct. Flattening would break
  every component with a helper.
- **Dedupe is by content hash, and it remembers a "no".** Each manifest carries the sha256 of its
  files and `dismissed.json` carries the hashes of files the person declined, so `library.offer`
  answers with only what is worth asking about — a long session must not re-ask about the same
  picture every turn. Two identical files in one offer are one row.
- **The end-of-turn card does not lock the composer.** It is permission-card *styled* and
  attention-shaped, but a save is not a thing the turn is waiting on; striking a file out of it is a
  decline, and a save that fails leaves its file on the card rather than reporting success.
- **A preview is best-effort, exactly like the context reading.** `library.save` from the agent
  renders one frame through the existing `preview.still` machinery, using the composition and frame
  the pane says are on screen — which the turn carries as `playing`, because the sidecar has no
  other way to know what the person is looking at. A failure never fails the save: the card falls
  back to the type icon. A single-file image is its own preview and needs no render at all.
- **Asset references are not project-scoped**, which is the point of them, so — unlike element
  references — switching projects leaves them in the composer. Picking the same asset twice reuses
  the number it already has, so the list and the text cannot disagree and a row keeps its own key.
- **The library opens out of the sidebar's bottom edge, and is not a tab.** A segmented
  Projects | Assets switcher was the first version and it read as a foreign control: it sat between
  the wordmark and New Project, and three things then competed for the top of the pane. `AssetsDrawer`
  is instead one 36px strip pinned above the footer — icon, label, count, chevron — that opens
  upward into the grid, the same shape the plan drawer opens out of the composer. Closed, the pane
  looks exactly as it did before assets existed; open, the drawer is capped at three fifths of the
  height so the project list it slid over is still there.
- **The state is `assetsDrawer`, a boolean, remembered in `settings.json`.** It was `paneTab` with
  `"projects" | "assets"` while the switcher existed; keeping that name after the tabs went would
  have left the setting describing a control that is not there.

### Video and audio in the composer

A picture and a clip are both media the person hands over, and they are carried by two different
lists, because **the API has an image block and nothing else**. `attachments` stays images-only and
keeps the `[Image #N]` invariant; `media` is video and audio, and has no reference kind at all.

- **A clip is copied, not encoded.** `placeMedia` puts each one in `public/library/` before the turn
  — the same `copyInto` the assets use, so it never overwrites — and `mediaBrief` gives the agent the
  `staticFile()` path rather than the one on the person's disk, which is outside `cwd` and would
  raise a permission card on every read. Sending it as a base64 block was never an option; dropping
  it silently was the alternative, and this is the one that makes an attached clip usable.
- **No `[Media #N]`.** Relabelling `[Image #N]` to something that covers both would stop every
  stored transcript colouring its own references, and a fourth kind would duplicate what the asset
  trailer already does for a case — two or three named files — that a sentence handles. The trailer
  names each file, so "use the intro clip" resolves without a token.
- **`MediaType` is a widening of `ImageMediaType`, not a sibling**, so an image attachment is a valid
  `PromptMedia` and `library.offer`/`dismiss`/`save` took the wider type without a second path. One
  `MediaRow` renders all three kinds — a `<video>` is its own thumbnail, audio gets the icon — which
  is why `AttachmentRow` is gone rather than living beside it and drifting.
- **Only playable files reach the media list.** `useMedia` filters on `isPlayable`, so a picture
  dropped into it would still go to the model rather than being copied into `public/`.
- **A video card shows its first frame, and that takes two nudges.** A `<video>` paints nothing until
  it has decoded a frame, and *seeking to the time it already sits at fires no seek at all* — so
  frame zero is the one time you cannot ask for. `VideoThumbnail` asks for a tenth of a second both
  ways: `#t=` on the URL, and `currentTime` set from `onLoadedMetadata`. Neither is reliable alone on
  a custom protocol; together they cost one seek. `firstFrameAt` halves the duration for a clip too
  short for that tenth, and it is the single definition both the card and the extractor read.
- **A video saved to the library gets a real still, taken once.** `firstFrame` in
  `lib/studio/thumbnail.ts` decodes the frame into a `<canvas>` and hands the PNG to the same
  raw-body invoke a pasted image uses; `AssetDraft.preview` carries its path and the sidecar files it
  as `preview.png`. The pane then renders an `<img>`, so a library of thirty clips decodes no video
  to draw its list. **The `<video>` is still the fallback** — for assets saved before this existed,
  and for any frame that would not decode — which is why the tile is never a bare icon for a video.
  - **`crossOrigin = "anonymous"` is not optional here.** The asset protocol is a different origin
    from the window, so a plain load taints the canvas and `toBlob()` throws — the same trap, and the
    same fix, as a snapshot's still.
  - **A thumbnail is decoration and never fails a save.** `copiedPreview` swallows a picture that
    would not copy and the asset lands with `preview: null`, exactly as the component preview and the
    context-window reading do.
  - **The fallback heals itself, because it would otherwise decode on every visit.** Base UI's
    `Tabs.Panel` defaults to `keepMounted: false`, so leaving the Assets tab unmounts every row and
    coming back remounts them — a `<video>` fallback would decode a frame again each time, and a clip
    that cannot decode would retry for ever and still show nothing. `useBackfilledThumbnails` takes
    the frame once, files it through `library.preview`, and the next mount is an `<img>`. It runs
    **sequentially** — decoding a library's worth of video at once is the cost this avoids, not a
    faster way to pay it — and marks each slug as *its own turn begins*, not up front, so a tail cut
    short by a new listing is retried rather than lost, while a failure is remembered for the session.
  - **`useCaret` returns a memoised handle.** It used to build a fresh object every render, which
    reminted every composer callback closing over it — `pick`, `write`, `select` — and through them
    defeated the `memo` on the asset rows, re-rendering the whole panel on every keystroke. The
    composer reads the live text from a ref for the same reason.

### The library is a grid of cards

The panel is a two-column grid of the `Attachment` primitives — `AttachmentMedia variant="image"`
over an `AttachmentTitle` — rather than a list of rows with an icon and a type label.

- **One still per kind, one field to hold it.** A video shows a frame; a sound shows its waveform,
  drawn from peaks by `peaksFrom` and baked to a PNG. Both land in the same `preview.png`, so the
  manifest field, the backfill, the `<img>` in the tile and the drop handling were all written once
  and neither kind is a special case downstream.
- **The waveform's colour is baked, so it cannot follow the theme.** It is a mid tone chosen to read
  against the card's muted background in both, rather than a token that would be right in one and
  invisible in the other. Peak normalisation is what stops a quiet recording drawing as a flat line.
- **`duration` is measured during the decode that was already happening** — `video.duration` while
  seeking for the frame, `AudioBuffer.duration` while decoding for the waveform — so the badge costs
  no extra pass. `clipTime` is `mm:ss` until a clip earns an hour. A length that was never measured
  badges nothing rather than showing `00:00`.
- **The card's click target is `AttachmentTrigger`**, which is `absolute inset-0 z-10`, and Delete
  is an `AttachmentAction` inside `AttachmentActions` at `z-20`. So the whole card inserts the asset
  except that button, with no hit-testing of our own — the two are siblings, not nested, so the
  trigger's handler never sees the delete click and nothing has to stop propagation.
- **Deleting forgives, exactly as deleting a session does.** The tile leaves the grid at once and
  `library.remove` is held behind an undo window — `Effect.sleep` in a forked fiber — with the
  toast's Undo a fiber interrupt that puts the card back at its old index. Quitting inside the
  window drops the delete rather than rushing it: the asset comes back next launch, which is the
  failure direction that keeps data. It is one button rather than a menu, so there is no
  confirmation dialog to dismiss; the window *is* the confirmation.
  - **The refresh above and this window have to agree.** A pending delete is still on disk, so a
    listing taken inside it would put the row back and read as the delete having failed. `load`
    therefore filters the rows against the held deletes.
- **The kind moved from a visible second line into the trigger's `aria-label`.** The tile now says
  what it is by showing it; a screen reader still hears "Neon Title, Component".

### Dragging into the library, or into the message

`onDragDropEvent` from Tauri, not HTML5 drag events: with `dragDropEnabled` on — the default — the
webview never fires them for files, and a `File` from a WKWebView drop carries no path anyway. The
event gives absolute paths, which is what the library wants and what keeps a 200 MB video off the
IPC.

- **The hit test is arithmetic, and it is tested.** Tauri reports the pointer in physical pixels from
  the window's top-left; `titleBarStyle: "Overlay"` means the webview fills the window, so dividing
  by `devicePixelRatio` lands in the client coordinates `getBoundingClientRect()` is measured in.
  `isInside` in `lib/studio/drop.ts` is pure and pinned by tests, because the drag itself is the one
  part no seam can exercise.
- **Anything that is not media is refused out loud.** A dropped `.tsx` is not an asset the panel can
  make — a component's boundaries are the agent's to work out — so the pane says what it skipped
  rather than saving half a drop in silence. The same sentence names where they did not go, because
  there are two places they could have gone.
- **The composer is the second zone, and there is still one watcher** (REM-255). `useFileDrops` owns
  the only `onDragDropEvent` subscription and asks `zoneAt` — an ordered list of boxes, first match
  wins — which zone a point is in; the two zones are disjoint on screen today, so the order is
  insurance rather than arbitration, and a zone whose box is `null` is simply not on screen. Two
  listeners racing over the same drop is the thing this avoids: each one would have to know the
  other's rectangle to stay out of its way.
- **A dropped file is sorted by kind, not by where it landed.** Pictures go to `attachments` with an
  `[Image #N]` written at the caret, exactly as a paste does — the gesture is the same one — and
  video and audio go to `media`, which carries no reference kind. A mixed drop splits across both,
  and each list filters the paths itself, so the split is the two `arriving` functions that already
  existed rather than a third place that decides what an image is.
- **A locked composer is not a zone.** Waiting on a permission card, a folder that is gone, a
  blocking environment check: `isComposerOpen` goes false, the box leaves the hit test and the ring
  never lights, so the composer cannot promise something it would drop on the floor. A composer that
  is not rendered at all — the new-project wizard, a transcript still loading — falls out for free,
  since its ref is null.
- **A drop that misses both zones is silent.** It also puts the left pane back: a drag that passed
  over the library to reach the composer switched the view to Assets on the way, and letting go
  anywhere reverts it.

### Tagging a file

`@` in the composer opens a list of the project's files; picking one writes its path in backticks
into the sentence being typed (REM-249). A query beginning `/` or `~` browses the whole filesystem
instead.

- **A tagged file is plain text, and that is the design.** A fourth reference kind beside
  `[Image #N]`, `[Element #N]` and `[Asset #N]` would need a field on the stored `TranscriptEntry`
  and a change in the recorder — the argument that already sank `[Media #N]` — and it would buy
  nothing, because a file needs neither a splice nor a trailer: **the path is the whole payload**.
  So `shared/references.ts`, `shared/transcript.ts`, the history store and `content.ts` are all
  untouched, and a reopened session renders what was sent because nothing about sending changed.
- **Reading the file costs nothing to arrange.** The agent's `cwd` *is* the project, and every path
  inside it is auto-allowed by the gate, so a relative path raises no card and nothing has to be
  resolved or attached on our side. A path outside the folder goes through the ordinary Allow/Deny
  card — that is the #223 invariant working, not a gap.
- **Two methods, because they are cached by different keys.** `project.files` walks the project once
  per project and the webview filters the result on every keystroke; `files.list` reads one folder
  and is cached per folder. Folding both into one "suggest" method would put an IPC round trip on
  every keystroke and make the list's responsiveness the sidecar's problem. `~` is expanded in the
  sidecar, because the webview has no home directory to expand it against.
- **The walk skips what a person would never tag** — `node_modules`, `out`, `dist`, `build`,
  `coverage`, `target`, `tmp`, and every dot entry — and stops at 4000 files, reporting `truncated`
  rather than trimming in silence. Reaching what it skipped is what typing an absolute path is for.
- **The composer owns the text, so it owns the mention**, exactly as it owns the references:
  `useMentions` holds the candidates, the query and the highlighted row and decides nothing about
  the text, while `useComposer` runs `insertMention` / `openFolder` against the live field. Its
  `onKeyDown` is consulted **first** and answers whether it took the key, so Escape closes the list
  instead of clearing the composer and Enter picks a file instead of sending the message — and when
  nothing matched, Enter falls straight through and sends, because a list with no rows must not
  swallow a keystroke.
- **Drilling into a folder does not wait for a round trip.** `choose` knows exactly what the text
  will become — `@` plus the folder plus a slash — so it sets its own query at the same moment it
  asks the composer to write it, rather than waiting for a `sync` that a programmatic `setValue`
  never fires.
- **A space ends a mention, unless the path is absolute.** `~/My Movies/` is a folder people really
  have, and the drill-down produces exactly that text; a relative query keeps the Claude Code rule
  that a space is the end of the token.
- **Escape is remembered per token.** The dismissed `@`'s offset is kept, so typing on into the same
  word does not bring the list back — while a different `@`, or moving away and starting another,
  opens it as usual.
- **A row leads with the mark of what the file *is*.** `lib/studio/file-icons.ts` maps a name to a
  kind and `components/studio/file-icon.tsx` maps that kind to a glyph — the same two-step
  `activity-icon.tsx` uses, and for the same reason it uses a `Map` rather than a `Record`: the key
  comes from a filename, so `constructor.js` would otherwise resolve off `Object.prototype`.
  Brand marks come from **Simple Icons** (`@icons-pack/react-simple-icons`) — React on a `.tsx`,
  TypeScript, JSON, Markdown, CSS — and everything with no brand to speak of falls to lucide's
  `File*` family by category: image, video, audio, font, archive, text.
  - **Imported one file at a time**, `@icons-pack/react-simple-icons/icons/SiReact`, never from the
    package root: that barrel re-exports 10,359 icons and there is no reason to hand it to the
    bundler and hope. Measured on a *clean* `out/`, sixteen brand marks cost **26 KB**.
    Measure it that way or not at all — chunk filenames carry a content hash, so a stale `out/`
    keeps every previous build's chunks and reads as a megabyte of growth that never happened.
  - **They are monochrome by construction.** Each component defaults to `color="currentColor"` and
    only paints its brand colour when asked with `color="default"`, so the column inherits
    `text-muted-foreground` like every other icon in the app. The marks are *filled* where lucide's
    are 1.5px outlines, which reads heavier at the same box — `scale-90` on the branded ones is
    what evens the two out.
  - Each Simple Icon renders a `<title>`, so the glyph is `aria-hidden`: the row's own text is what
    a screen reader should read, not "React Intro.tsx src/scenes".
- **The list scrolls to the row the keyboard is on**, which it has to: twelve rows do not fit in
  `max-h-64` and the arrows used to walk the highlight straight out of the visible part.
  `useKeptInView` is a layout effect on the row itself with `block: "nearest"`, so a row already in
  view costs nothing. Its trigger is `${keyed}:${index}` rather than the active index alone, and
  both halves earn their place: `keyed` counts *arrow presses*, so a row that is merely re-rendered
  is not dragged back into view, and `index` catches the case `keyed` cannot — a filter that keeps
  the highlighted row but moves it, where the row is the same component instance and nothing else
  would change. Hovering can only ever re-scroll a row the cursor is already on, which `nearest`
  makes a no-op.
- **The path is coloured, and colouring it costs nothing extra.** `MessageText` already draws both
  the composer's overlay and the user's bubble, so splitting its *text* segments once more — into
  plain runs and backticked paths — lights the mention in both places and in history, where the
  stored prompt is the same string. It is deliberately **not** a segment kind in
  `shared/references.ts`: `dropReference` walks those segments and treats anything that is not
  `text` as a reference to renumber, so a fourth kind there would make a typed path behave like an
  attachment. Splitting inside the renderer keeps that fold untouched.
- **A chip, and one that costs no layout.** `.file-mention` in `app/globals.css` is a background, a
  radius and a shadow — nothing that takes width. The overlay's own metrics are what position the
  caret in the textarea beneath it, so padding, a border, tracking or a weight would drift the two
  apart a character at a time; that is the accumulating error `font-medium` on a reference already
  cost once. The side air is therefore an **offset** shadow rather than a spread one: a spread would
  grow the chip vertically too, and a path that wraps — the normal case for an absolute one — would
  stack its lines' alpha where they met. `box-decoration-break: clone` is what gives each wrapped
  fragment its own rounded chip instead of one box torn across three lines.
- **The chip is `currentColor`, so one rule serves both surfaces.** It is drawn over the composer,
  where the text is `foreground`, and inside the sent bubble, which is `bg-primary` with
  `text-primary-foreground`. A fixed tint had to read on both: `--reference` teal was the first
  version and it was legible on neither. A mix of the *inherited* colour is right on each by
  construction, which is also why a file mention no longer speaks the reference colour that
  `[Image #N]` does — the two now differ in kind, a chip against a coloured word.
- **Only a path lights up, not every code span.** A backticked run counts when it holds a `/` or is
  a bare name with a real extension, so `` `src/Root.tsx` ``, `` `~/My Movies/clip.mp4` `` and
  `` `package.json` `` colour while `` `Main` `` and `` `TransitionSeries` `` — the words the
  conventions themselves put in backticks — stay plain.
- **Both pure halves are tested without rendering anything**: `lib/studio/mentions.ts` (what counts
  as a mention, where a folder query splits, the ranking, what is a path) and `sidecar/files.ts`
  (what the walk skips, the limit, `~` expansion) — and the wiring is tested through `useComposer`
  against a fake IPC, which is the only place the two meet.

## Layout

Flat root, no monorepo — per #218.

```
app/                  Next App Router (layout, page, globals.css)
components/ui/        shadcn/ui primitives (Base UI–backed)
components/studio/    app-level components (panes, sidecar status, quit guard)
hooks/                all behaviour: no logic inline in components
lib/                  cn helper, error formatting, lib/studio/* clients
preview/              what the *project's* webpack compiles instead of Studio's UI:
                      entry.tsx, the two-way bridge, hot reload, grab, source paths,
                      the element picker and the snapshot marquee
shared/               ipc.ts: the typed contract, and the media types it carries;
                      providers.ts: the provider registry, capabilities and the
                      neutral tool verbs; transcript.ts: the one fold;
                      references.ts: the one reader of `[Image #N]`/`[Element #N]`/
                      `[Asset #N]`; library.ts: the asset manifest format
sidecar/              bun: frame loop, method handlers, SQLite history;
                      files.ts is the project walk and the folder read behind `@`
sidecar/agent/        the provider-neutral seam: AgentAdapter, the permission
                      gate's skeleton, the mode switch, account cache, registry
sidecar/claude/       the Claude Code adapter: Agent SDK session, event and
                      failure translation, the CanUseTool guard, auth probe,
                      tool-name→verb vocabulary
sidecar/history/      driver seam, migrations, project and session stores, recorder
sidecar/library/      the asset library: the folder store, the copy into a project,
                      and the remocn-library tools the agent saves through
sidecar/scaffold/     what "New project…" expands and installs
templates/remotion/   that project, vendored here and shipped as a Tauri resource
agent/                the Claude Code plugin we hand the SDK: vendored skills, plus
                      video-lessons — our own record of what failed on screen
scripts/              build-time tooling; skills-sync.ts is the vendoring step
sidecar/preview/      the --preview-host child: project resolution, webpack watch, server,
                      stills for Snapshot and the mp4 export
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
