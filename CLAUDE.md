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

## Layout

Flat root, no monorepo — per #218.

```
app/                  Next App Router (layout, page, globals.css)
components/ui/        shadcn/ui primitives (Base UI–backed)
components/studio/    app-level components (panes, title bar, sidecar status)
hooks/                all behaviour: no logic inline in components
lib/                  cn helper, error formatting, lib/studio/* clients
shared/ipc.ts         one typed message contract for Rust ↔ webview ↔ sidecar
sidecar/              bun: frame loop, method handlers; later Agent SDK, Vite, export
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
