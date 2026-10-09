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

A **local desktop app for macOS and Linux** (Tauri v2: WKWebView on macOS, WebKitGTK on Linux) that turns "I want a video" into a real Remotion
project: a coding agent — the person's own Claude Code, Codex, GitHub Copilot or Grok Build,
signed in with their own subscription — writes actual Remotion TSX into a folder on disk, and
the app previews the result live, lets the person point at an element and tune it, and exports
an mp4 through the project's own renderer. Original design record and work list:
[Remocn/remocn#218](https://github.com/Remocn/remocn/issues/218) and its children; tickets are
Linear REM-nnn.

**One codebase, two platforms.** Where Linux differs from macOS — the frameless window and
its own controls instead of traffic lights, no menu bar, the Secret Service keyring instead of
the login keychain, AppImage/deb/rpm instead of the `.dmg`, the terminal launcher, the Node.js
download page instead of the `.pkg` — is recorded in `openspec/changes/linux-desktop/design.md`
(archived under `openspec/changes/archive/` once merged). Platform code is gated, never
forked: `#[cfg(target_os = ...)]` in Rust, `process.platform` in the sidecar,
`currentPlatform()` / `usePlatform()` in the webview. `docs/decisions/` was written for the
macOS build; read it for the why, and check a platform fact against the code.

**This is not `studio.remocn.dev`.** That one — sketched in the remocn repo's `RENDER_SDK.md`
§13 — is a hosted, spec-driven web editor built on one generic composition plus a JSON spine.
Different product. Do not carry its timeline / project-JSON design into this repo.

### Where the truth lives

- **`openspec/specs/<domain>/<capability>/spec.md` is the source of truth for what the studio
  does.** Forty-one capabilities in nine domains (`shell/ sidecar/ projects/ agent/ history/
  composer/ preview/ export/ library/`), each a set of requirements with WHEN/THEN
  scenarios, verified against the code on 2026-09-11. Read the capability a change touches
  before planning it; `openspec list --specs` names them all.
- **Every behaviour change is an OpenSpec change.** `/opsx:explore` to think it through,
  `/opsx:propose` for proposal + delta spec + design + tasks, `/opsx:apply` to build,
  `/opsx:archive` to merge the delta into the main spec. `openspec/config.yaml` carries the
  planning context and the per-artifact rules. A pure refactor or tooling change sets
  `skip_specs: true` rather than inventing a requirement.
- **`docs/decisions/` is the design record** — why each area is the way it is, the
  measurements and the failed runs, one file per area, moved out of this file on 2026-09-11.
  It is history, not authority: where a record and a spec disagree, the spec is right.
  `docs/decisions/drift-2026-09-11.md` lists the fifty disagreements known at the move. A new
  decision goes in the change's `design.md`, not here.
- **This file is the working manual** — rules, commands, tooling gotchas, conventions, and a
  map of the system. Add a tooling fact or a working rule here; nothing else.

## Commands

The lockfile is `bun.lock`; use bun.

- `bun run check` — formatter **and** linter in one pass, read-only. This is what
  CI runs; it fails on violations rather than fixing them.
- `bun run fix` — apply the fixes `check` reports.
- `bun run typecheck` — `tsc --noEmit`, then `tsc -p tsconfig.preview.json` over
  `preview/`. Keep this in the loop: Next 16 no longer
  lints on build, and it is the only gate over `components/ui/**`, where the
  linter is deliberately off.
- `bun run test` — `bun test`, three worker processes, one fresh global per file.
  `test:watch` and `test:coverage` also exist. See *Tests*.
- `bun run build` — Next static export into `out/`. Needs network on a cold cache
  (fonts are self-hosted at build time).
- `bun run bun:fetch` — download the bun runtime the app ships into the
  gitignored `src-tauri/binaries/` as `remocn-studio-bun-<triple>`, pinned to
  `packageManager` in `package.json`: aarch64 and x64 for macOS, and for Linux
  the **baseline** x64 build (the default one needs AVX2 and dies with SIGILL on
  older CPUs) and aarch64. With `TAURI_ENV_TARGET_TRIPLE` unset it fetches both
  architectures for the host's operating system; the Tauri CLI sets it for
  `tauri:before-dev` and `tauri:before-build`, which both run it (with
  `sidecar:build`), so `bun tauri dev` and `bun tauri build` fetch only their own. It is named
  `remocn-studio-bun`, not `bun`, on both platforms, because a `.deb` installs
  sidecars into `/usr/bin`. Needs network the first time only. A bare `cargo check` fails at
  `tauri-build` until this file and `sidecar-dist/main.js` exist. See
  `docs/decisions/the-sidecar.md`.
- `bun run sidecar:build` — bundle `sidecar/` into `sidecar-dist/main.js`, which
  ships as a Tauri resource. **Only release builds need this** — in debug the
  core runs `sidecar/index.ts` from the repo, so there is nothing to rebuild.
  `bun tauri build` runs it via `tauri:before-build`.
- `bun tauri build` on macOS — the `.app` bundle, unsigned unless the `APPLE_*` variables
  from `publish.yml` are exported (see REM-413). `--no-bundle` compiles without
  packaging; `--bundles app` skips the DMG. Since `createUpdaterArtifacts` is on,
  it now also wants the updater's signing key: export `TAURI_SIGNING_PRIVATE_KEY`
  (the key text **or a path to the key file** — `build` reads only that variable;
  `TAURI_SIGNING_PRIVATE_KEY_PATH` is read by `tauri signer sign` alone, and
  exporting it here ends the build with *A public key has been found, but no
  private key* after the bundles are already on disk) **and**
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""` — the key has no password, but with the
  variable unset the CLI prompts for one, and in a non-interactive shell that
  prompt dies as *Device not configured (os error 6)*, again after the bundles
  are on disk. Or pass `--no-sign` to skip the `.sig` — a bundle built that way
  cannot be released, only run. See `docs/decisions/updating-in-place.md`.
- `bun tauri build` on Linux — an AppImage, a `.deb` and an `.rpm` under
  `src-tauri/target/release/bundle/`, with the same updater signing variables as
  macOS (or `--no-sign`) and no Apple ones. `--bundles appimage` (or `deb`,
  `rpm`) builds one format. The AppImage carries GStreamer
  (`bundleMediaFramework`) so footage plays in the preview, which means the
  build host needs the GStreamer plugins installed too.
  **The AppImage does not build on Arch (or any distribution on gdk-pixbuf
  2.44+).** linuxdeploy's bundled `strip` cannot read `.relr.dyn` sections
  (`NO_STRIP=true` gets past that), and then `linuxdeploy-plugin-gtk` fails
  copying `/usr/lib/gdk-pixbuf-2.0/2.10.0`, which gdk-pixbuf 2.44 no longer has
  (image loading moved to glycin). Measured 2026-10-02. On such a machine build
  `--bundles deb,rpm`; the release AppImage is built by CI on Ubuntu 22.04, where
  neither happens. The `.deb`'s `usr/` tree runs from any folder — the core looks
  for resources at `<exe dir>/../lib/Remocn Studio` first — so
  `ar p <deb> data.tar.gz | tar xz -C <dir>` and `<dir>/usr/bin/remocn-studio`
  runs a release build without installing it.
- **Build prerequisites** — the Tauri Linux set plus libdbus (the keyring) and
  GStreamer (footage in WebKitGTK). Arch: `webkit2gtk-4.1 libsoup3 gtk3
  librsvg libayatana-appindicator dbus patchelf gst-plugins-base gst-plugins-good
  gst-plugins-bad gst-libav`. Debian/Ubuntu: the apt list in `publish.yml`.
  Fedora: `webkit2gtk4.1-devel gtk3-devel librsvg2-devel dbus-devel
  libappindicator-gtk3-devel gstreamer1-plugins-good gstreamer1-plugins-bad-free`.
- `bunx shadcn@latest add <component>` — add UI components (config in
  `components.json`).
- `bun run skills:sync` — refresh the vendored agent skills under `agent/skills`
  from upstream; `bun run skills:check` is the read-only half CI runs. Both need
  network. See `docs/decisions/what-the-agent-knows.md`.
- `bun run crash:verify` — stand a local server in Sentry's place and measure
  what crash reporting actually sends, across consent given, withheld and
  flipped mid-process. Needs no Sentry account. See
  `docs/decisions/crash-reports-with-consent.md`.
- `bun run smoke:render` — install the fixture project under
  `test/fixtures/render-smoke/`, make its media, and run the **real** renderer
  against it: WebGL with and without a backend, all four formats, audio,
  calculateMetadata, odd dimensions. Needs network the first time (a Remotion
  install and Chrome Headless Shell) and takes minutes. `bun run test` skips
  these when the fixture is not installed. `bun run smoke:assets` is the media
  step alone. See *Renderer smoke tests* in `docs/decisions/exporting-an-mp4.md`.
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

`bun test` + React Testing Library + happy-dom (`bunfig.toml`, `test/`). Tests
import from `bun:test` — `mock` for a function, `mock.module` for a module,
`spyOn`, `jest.useFakeTimers` — and `@/*` resolves through `tsconfig.json`
natively. It was Vitest + jsdom until 2026-09-07, and the move was measured
before it was made: the same 2406 tests took 34–61 s of wall clock and 120–160
CPU-seconds there, against **10.6 s and 28 CPU-seconds** here — three quarters
of the Vitest run was standing up a jsdom per file and re-importing the module
graph, not running tests.

**Bun 1.4 is the floor, and it is the runtime the app ships.** `--parallel`
and `--isolate` arrived in 1.4; under 1.3 every file shared one global and one
module registry, so a `mock.module` in one suite reached every suite after it
and settings-page found picker's fixture in its DOM. `packageManager` is one
version for the tests and for the `remocn-studio-bun` shipped beside the binary, which is why bumping
it is a release decision and not a test-config one.

**Three workers, one fresh global per file.** `--parallel=3` in the `test`
script (bun's default is every core, which on the fanless MacBook the app is
developed on is eight processes at full tilt) and it implies `--isolate`, so a
module mock cannot leak. `test:watch` passes `--isolate` by hand for the same
reason. **While iterating, run only the files you touched** —
`bun run test hooks/use-tours.test.tsx` — and the full suite once before a
commit. `--timeout=15000` sits above Testing Library's `asyncUtilTimeout` — 5 s locally, 10 s
under `CI`, where the runner is about four times slower and the heaviest shell mounts
crossed 5 s a different file each run — or a query that will never resolve dies as
"timed out" instead of "unable to find element".

**happy-dom is registered by the first preload, and the order is the point.**
`test/register-dom.ts` does nothing but `GlobalRegistrator.register()`;
`test/setup.ts` imports Testing Library, and ESM hoists its imports above any
statement in the same file — `@testing-library/dom` binds `screen` to
`document.body` at import time, so one file doing both registered the DOM
*after* the library had looked for it, and 283 tests failed with *a global
document has to be available*. Every file, DOM or not, gets the DOM: bun has
no per-file environment and the pure suites were measured not to care.

**A failed jest-dom assertion used to cost 2.6 seconds, and `waitFor` pays it
per poll.** bun's `expect` words a received value by walking the object, and a
happy-dom node is a graph of symbol-keyed internals; JSC's sampling profiler
put 2.6 s of one composer test inside `stringify`. `test/setup.ts` wraps every
jest-dom matcher so `utils.stringify` prints a node as its (truncated)
`outerHTML`, the way pretty-format's DOM plugin does. The matcher context
cannot be proxied — `isNot` is a brand-checked getter — so the utils object is
patched in place, once.

**Two tests skip themselves on happy-dom, by probe.** Its selector parser
rejects an escaped quote inside an attribute value and it puts HTML inside a
`foreignObject` in the SVG namespace; `preview/anchor.test.ts` and
`preview/picker.test.ts` each probe the DOM once and `it.skipIf` the case,
so they run again the day the implementation catches up. `bun:test`'s typings
are stricter than Vitest's — `toEqual(expected: T)` against the received type —
and `test/matchers.d.ts` widens the four structural matchers back to `unknown`
rather than casting two dozen literals.

**happy-dom reports the host OS, and the tests assume a Mac.** Its default user
agent is built from `process.platform`, so on the Linux CI runner
`currentPlatform()` answered `linux` and every shortcut rendered as `Ctrl+…`
while the tests looked for `⌘`; `test/register-dom.ts` registers the DOM with a
macOS user agent, the platform the studio has shipped on from the start, so
every test that does not say otherwise covers it. A test about the Linux
branch calls `withAgent(LINUX)` from `test/user-agent.ts` and puts `MAC` back
in an `afterEach`.

**happy-dom is not a Tauri webview.** There is no `window.__TAURI_INTERNALS__`,
so any `invoke()` that reaches the real transport throws. Tests touching IPC
must install a fake with `mockIPC` from `@tauri-apps/api/mocks`; `test/setup.ts`
calls `clearMocks()` after each test so one test's fake cannot leak into the
next. `app/page.test.tsx` is the worked example. A `mock.module` is not hoisted,
so a module already imported keeps its binding live rather than being replaced:
a suite that swaps one export imports the real module first and spreads it into
the factory.

**A mounted pane is not a ready one.** `turn.send` returns false while
`projectId` or `videoId` is still null — both arrive over IPC — and the Send
button stays enabled throughout, so a test that types and presses as soon as
the textarea exists watches the click do nothing and then spends its whole
`waitFor` budget on a send that never started. The composer's harness waits for
a probe that reads "ready" first: with every mocked IPC answer 250 ms late,
thirteen of that file's tests fail without the wait and none with it.

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
   `latest.json` attached. Each build is signed with the Developer ID from the
   `APPLE_*` secrets, notarized and stapled by tauri-bundler (sign inside out →
   notarize the `.app` → staple → `.dmg` → `.app.tar.gz` for the updater), and
   a step after tauri-action notarizes the `.dmg` itself, which the bundler
   only signs. Notarization waits on Apple — minutes normally, 52 for the
   account's very first submission — so a release is slower than the build.
   After both macOS jobs, the Linux build follows: x86_64 on `ubuntu-22.04` and
   aarch64 on `ubuntu-22.04-arm`, one after the other, each adding an AppImage, a
   `.deb` and an `.rpm` (each with its updater `.sig`) to the same release and
   its entries to the same `latest.json`. Never in parallel with macOS:
   tauri-action merges `latest.json` by reading the asset already there, so two
   writers drop a platform. 22.04 is deliberate — an AppImage runs on any glibc
   at least as new as the one it was built on.

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
  *is* the feature — "the studio's helper is not running" has to reach the UI.
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

### Map of the system

One seam per line: what it owns, the specs that define it, the records that explain it.

- **Webview** (`app/`, `components/`, `hooks/`, `lib/`) — the Next static export: three
  resizable panes (videos | chat | preview) plus the properties pane, the composer, the
  Settings page, tips, the splash. Behaviour lives in `hooks/` and pure `lib/studio/*`;
  components render and decide nothing. Specs `shell/*`, `history/chat-pane`, `composer/*`.
  Records: `the-first-second`, `the-pane-never-hides-what-needs-you`, `settings-is-a-page`,
  `tips-not-a-tour`, `the-title-bars-shader-is-a-preference`.
- **Rust core** (`src-tauri/`) — the window, Tauri commands, the sidecar supervisor, the
  integrations' secrets in the keychain or the Secret Service keyring, deep links, the
  updater, the terminal launcher, pasted-image writes, the asset protocol, panics. Specs `sidecar/supervision`, `shell/quit-and-updates`,
  `shell/crash-reporting`, `projects/open-template-link`. Records: `the-sidecar`,
  `updating-in-place`, `crash-reports-with-consent`, `opening-a-link`.
- **Sidecar** (`sidecar/`) — one bun process, Effect end to end, stdio frames in, stderr as
  the log; SQLite history, the agent adapters, the stdio-MCP tool hosts, the preview host,
  stills and export, the library. Spec `sidecar/ipc-contract`. Record: `the-sidecar`.
- **Project → Video → Chat** — a project is a folder and a row (`.remocn/project.json` carries
  identity, name, revision and brand); a video is `src/videos/<slug>/` registered by
  `src/videos/registry.tsx` at the entry point, never by editing `Root.tsx`; chats hang under
  videos; **the open chat determines everything** (the composition the preview plays, the
  folder in the conventions, the target of Export, Inspect and Snapshot); one running turn
  per video. Specs `projects/*`, `history/transcript-store`. Records: `project-video-chat`,
  `history`, `new-projects`, `the-environment-checklist`,
  `a-project-installs-with-its-own-package-manager`.
- **The agent seam** (`sidecar/agent`, `sidecar/claude`, `sidecar/codex`, `sidecar/acp`,
  `sidecar/copilot`, `sidecar/grok`, `sidecar/tools`) — provider-neutral turns behind an
  `AgentAdapter`; the permission gate and the three modes (auto, acceptEdits, plan — never
  bypass); four adapters; the one skills bundle in `agent/skills/` delivered to all four
  runtimes; the studio's tools as stdio-MCP servers (`remocn-design`, `remocn-library`,
  `remocn-pipeline`) behind a unix-socket gateway; the seven-stage pipeline and
  `design_check`. Specs `agent/*`. Records: `the-agent-seam`, `turns-run-in-the-provider`,
  `the-next-message-waits-its-turn`, `what-the-agent-knows`, `one-bundle-four-runtimes`,
  `reading-what-the-pipeline-wrote`.
- **The composer** — text taken verbatim; `[Image #N]`, `[Element #N]`, `[Asset #N]` are the
  three reference kinds and `shared/references.ts` is their one reader; video and audio ride
  as media with no reference; drops come from Tauri with absolute paths; `@` tags a file as
  plain text; the queue and plan drawers. Specs `composer/*`. Records: `pasting-a-picture`,
  `video-and-audio-in-the-composer`, `dragging-into-the-library-or-the-message`,
  `tagging-a-file`.
- **The preview host** (`sidecar/preview`, `preview/`) — the project's own webpack and
  `@remotion/bundler` with `preview/entry.tsx` in the Studio's slot; one host per project,
  one bundle for the Player and the renderer; Inspect, the properties pane, write-to-code
  through the project's own codemods, Snapshot. Specs `preview/*`. Records: `the-preview`,
  `footage-the-preview-cannot-afford`, `pointing-at-an-element`,
  `tuning-what-you-pointed-at`, `writing-the-value-into-the-code`,
  `taking-a-picture-of-the-frame`.
- **Export** — the project's own `@remotion/renderer` against a pinned copy of the compiled
  bundle; one browser and GL policy for every renderer-backed operation; the project's own
  render settings read in a process of their own. Specs `export/*`. Record: `exporting-an-mp4`.
- **The library** (`sidecar/library`) — a folder of assets under app data; agent-saved
  components, UI-saved media, stock photos, the moodboard, the bundled remocn components with
  their motion roles. Specs `library/*`. Records: `the-asset-library`,
  `the-library-is-a-grid-of-cards`, `a-track-carries-its-audiomap`, `entry-emphasis-exit`,
  `the-moodboard`.
- **No account, no plan** — there is no remocn sign-in and no paid tier (REM-520); every
  feature is available to everyone. `legacy_account.rs` deletes what an older build left
  (the keychain `session-token` and the plan cache in app data) once. Records `signing-in`,
  `the-line-between-free-and-pro` and `upgrading-from-the-app` are history only.

### Invariants to plan with

- No SSR features; anything that needs a runtime goes to a Rust command or the sidecar.
- `shared/ipc.ts` is the only webview↔sidecar contract; every boundary is decoded, never
  cast. A frame change bumps `SIDECAR_PROTOCOL` **and** `PROTOCOL` in `src-tauri/src/ipc.rs`;
  `shared/protocol.test.ts` fails when they differ.
- File tools inside the opened folder run without a card; Bash and any path outside the
  folder always ask. `bypassPermissions` and `dontAsk` are never offered.
- Preview, stills and Export resolve Remotion from the project's `node_modules`; the app
  bundles no Remotion, and nothing is written into the person's project except what a turn
  or an explicit gesture asked for.
- Nothing reaches a third party without consent: crash reports are opt-in, there is no
  telemetry, and the skills bundle never writes into `~/.claude`, `~/.codex`, `~/.copilot`
  or `~/.grok`.
- History is the studio's own SQLite, written by the sidecar; the CLI transcript format is
  not a contract. `shared/transcript.ts` holds the one fold both sides run.
- Every user-facing failure is a worded sentence — never a protocol token, a raw renderer
  message or a stack trace. Degrade to a notice; fail the turn only when the words
  themselves cannot be delivered.
- Vocabulary in the UI: Project, Video, Chat, turn, permission card, Inspect, Snapshot,
  Export, library, Docs, plan. "Composition" and "session" never appear in user-facing text.

### Working rules by seam

- **Sidecar**: anything written to stdout that is not a frame breaks the protocol — use
  `log()`, which goes to stderr and then to
  Tauri's `app_log_dir`: `~/Library/Logs/com.remocn.remocn-studio/sidecar.log` on macOS,
  `~/.local/share/com.remocn.remocn-studio/logs/sidecar.log` on Linux (under
  `$XDG_DATA_HOME` when it is set). Debug runs `sidecar/index.ts` from
  the repo (edit and restart, no build step); release runs the bundled `sidecar-dist/main.js`.
  `bun build --env` takes exactly one glob (`REMOCN_STUDIO_*`) and silently drops a second;
  runtime env vars are read by bracket access so the substitution never touches them.
  `--preview-host`, `--tools-host` and `--render-config` re-exec the same bundle.
- **Notifications in dev on macOS**: `tauri-plugin-notification` signs a development post with
  `com.apple.Terminal`, whatever terminal launched `bun tauri dev`, so nothing arrives until
  Terminal is allowed under System Settings › Notifications. A bundle posts under the app's own
  identifier and needs its own row there. The plugin also answers *granted* for every
  permission query on desktop, so a refusal in System Settings is invisible to the app.
- **Notifications on Linux** go through the desktop's notification service over D-Bus (mako, dunst,
  swaync, GNOME Shell, Plasma). A bare window manager with no daemon running shows nothing
  and reports nothing. The plugin answers *granted* for every permission query on desktop,
  so *Grant permission* never shows in practice; there is no per-app settings row to open,
  so a refusal is asked about again where macOS opens System Settings.
  The launcher badge goes out over the Unity LauncherEntry protocol and is shown only by
  docks that implement it (Plasma, Dash to Dock, Plank).
- **On Linux the window draws its own frame.** `src-tauri/tauri.linux.conf.json` replaces the
  window with one that has `decorations: false` (macOS keeps the overlay title bar and its
  traffic lights); `components/studio/window-controls.tsx`
  draws Close, Minimise and Maximise in the top-left slot `--titlebar-inline-inset` keeps
  clear, mounted once in `app/page.tsx` and rendered only for the `linux` platform. Close
  calls `window.close()`, so it reaches the core's `CloseRequested` guard like any other
  quit. Edge resizing is tauri-runtime-wry's own GTK handler for undecorated windows; a
  double-click on a `data-tauri-drag-region` toggles maximise. Each control needs its
  `core:window:allow-*` permission in `capabilities/default.json`.
- **No menu bar.** `useAppMenu` installs nothing unless the platform is `mac` — on Linux
  Tauri would attach a GTK menu bar above the band — and answers `false`, so
  `useShortcuts` fires every menu-owned shortcut itself.
- **Where CLIs are found**: a launcher started from a desktop entry gets the session's
  minimal `PATH`. `USER_BIN_DIRS` in `sidecar/agent/cli.ts` (`~/.local/bin`, mise and asdf
  shims, Volta, pnpm, …) is what every CLI lookup falls back to, and `HOME_BIN_DIRS` in
  `src-tauri/src/sidecar/spawn.rs` is the same list for the `PATH` the core hands the
  sidecar; `SYSTEM_BIN_DIRS` likewise. Both lists serve both platforms (Homebrew and
  `~/Library/pnpm` sit beside the Linux dirs) — a dir that does not exist is never matched. `sidecar/agent/cli.test.ts` reads `spawn.rs` and fails when they differ — edit
  both. **The home dirs are searched last**, after `~/.bun/bin`, `PATH` and the system dirs
  (the package managers keep their own home dirs ahead of `PATH`): put first, an asdf or
  mise shim with no version set answers `node` with an error where Homebrew's node runs.
- **`bun` on the sidecar's `PATH`**: the shipped runtime is `remocn-studio-bun`, so a `.deb`
  never claims `/usr/bin/bun`, but turns and project scripts run `bun` by name.
  `spawn::bun_dir` puts `<data dir>/bin`, holding a `bun` link to the runtime, first on the
  sidecar's `PATH`, and checks the link on every launch — an AppImage mounts somewhere new
  each time.
- **Open in Terminal** (`src-tauri/src/terminal.rs`) asks Terminal.app through `osascript` on
  macOS. On Linux it spawns, detached and with no
  arguments, `$TERMINAL`, then `xdg-terminal-exec`, `x-terminal-emulator`, then the first
  of a fixed list of common terminals found on the search dirs.
- **Rust**: the `crash-reports` Cargo feature is off by default and switched on by the
  release job and checked by `dev.yml`'s `rust` job (`cargo check --features
  crash-reports`, `cargo test`) on both macOS and Linux. The core reads crash consent from
  `~/Library/Application Support/<identifier>` on macOS and `$XDG_DATA_HOME/<identifier>` (or
  `~/.local/share/<identifier>`) on Linux before the app is built.
  `ClientOptions` is `#[non_exhaustive]` — build it by assignment.
- **Preview entry** (`preview/`): compiled by the *project's* webpack, so it has no access to
  the app's alias and must never pull `effect`. `preview/protocol.ts` (types only) is the one
  statement of every command and message; `lib/studio/preview.ts` `import type`s it and proves
  its decoding Schema equal per message type (`messagesAgree`/`commandsAgree`), so a renamed
  field is a `typecheck` error, and `preview/protocol.test.ts` runs what the real senders post
  through that Schema. A preview module takes its commands with `route(consumer, handlers)`,
  checked against `CommandConsumers`. Excluded from `tsconfig.json` but type-checked by
  `tsconfig.preview.json` (the second half of `bun run typecheck`, against `remotion` and
  `@remotion/player` installed as type-only devDependencies at the template's version);
  every non-test file needs its own entry in `tauri.conf.json`'s resources.
- **Templates and skills**: `templates/remotion/` and `agent/` are Tauri resources
  (`"../agent": "agent"` maps the whole folder, so a new skill needs no resource entry).
  `agent/skills` is force-ignored by Biome and excluded from `tsconfig.json`; `skills:check`
  reads any edit there as drift, so our own skills live beside the vendored three, never
  inside one. `templates/**` is exempt from `useFilenamingConvention` (`src/Root.tsx`).
  `templates/remotion/video-templates/` is a hand-synced copy of the landing's composition.
- **Settings** live in `settings.json` through `plugin-store`; `useHydratedSettings` is the
  one hook not to modernise (see *Effect*). Per-project settings live in the project's
  `.remocn/project.json`; export settings under `export:<projectId>`. The `integrations` key
  holds connection **metadata only** — id, provider, name, account label, capabilities and a
  reference to a keychain entry. Every secret is in the login keychain under
  `com.remocn.remocn-studio` / `integration:<connectionId>`, one entry per connection, read
  and used only by Rust. An unsigned debug build therefore raises the system's keychain prompt
  **once per connection** after each `cargo build`; a signed release asks once. Nothing in the app can suppress it.
  On Linux every secret is in the desktop's Secret Service keyring instead
  (GNOME Keyring or KWallet; Seahorse shows them), same service and user, read only by Rust.
  `keyring` is built with `sync-secret-service` + `crypto-rust` on Linux — **without a
  backend feature keyring 3 silently falls back to an in-memory mock store** and every key is
  gone on restart. With no Secret Service running, saving a key fails as *The system keyring
  refused: …* on the connection card; a locked keyring raises the provider's own unlock
  prompt.
- **History**: schema changes are one more entry in `MIGRATIONS` in
  `sidecar/history/migrations.ts`, applied in one transaction with foreign keys off. There
  are no users yet, so a migration may drop rather than convert.

## Layout

Flat root, no monorepo — per #218.

```
app/                  Next App Router (layout, page, globals.css)
components/ui/        shadcn/ui primitives (Base UI–backed)
components/studio/    app-level components (panes, sidecar status, quit guard)
hooks/                all behaviour: no logic inline in components
lib/                  cn helper, error formatting, lib/studio/* clients
preview/              what the *project's* webpack compiles instead of Studio's UI:
                      entry.tsx, surface.ts (the one environment the runtime
                      reads — a configured shadow-root surface, or an error),
                      the two-way bridge, hot reload, source paths,
                      the element picker, anchor.ts (the per-instance selector a
                      selection is identified by), stack.ts (the JSX call site
                      Remotion records, which is where a value is written),
                      assets.ts (the one reader of an `asset` value, both ways)
                      and the snapshot marquee
shared/               codemod.ts: what the studio may write and what it must ask for;
                      crash.ts: the consent contract and the one path scrubber;
                      export.ts: the export model — formats, quality per codec,
                      the short-side resolution, the presets, and the output
                      size Remotion really produces;
                      ipc.ts: the typed contract, and the media types it carries;
                      slug.ts: the one reader of a name into a composition id;
                      deep-link.ts + templates.ts: the one reader of a remocn-studio://
                      link, and the templates it may name;
                      providers.ts: the provider registry, capabilities and the
                      neutral tool verbs; transcript.ts: the one fold;
                      references.ts: the one reader of `[Image #N]`/`[Element #N]`/
                      `[Asset #N]`; library.ts: the asset manifest format;
                      motion.ts: the movement taxonomy — roles, the props each
                      expects, and the dictionary of named behaviours;
                      pipeline.ts: the seven stages, their templates, and
                      `docsFolderOf` — the one place a video's documents live
sidecar/              bun: frame loop, method handlers, SQLite history;
                      crash.ts gates @sentry/bun on the consent Rust passes in;
                      contained.ts is the one containment check the permission
                      gate and the document reader share;
                      documents.ts lists and reads a video's stage documents;
                      files.ts is the project walk and the folder read behind `@`;
                      package-manager.ts is the one reader of a project's lockfile;
                      node-installer.ts fetches and opens the Node LTS installer
sidecar/agent/        the provider-neutral seam: AgentAdapter, the permission
                      gate (gate.ts owns the one ask: remembered approvals, the
                      card, the wait, the mode), the mode switch, account cache,
                      registry, turn.ts — `runTurn`, the whole turn behind
                      `agent.prompt`, with turn-tools.ts serving it —
                      knowledge.ts — the one locator/attach contract for the
                      shipped skills bundle — and instructions.ts: the
                      conventions, the stage brief and the three strings
                      every adapter places
sidecar/claude/       the Claude Code adapter: Agent SDK session, event and
                      failure translation, the CanUseTool guard, auth probe,
                      tool-name→verb vocabulary
sidecar/codex/        the Codex adapter: SDK thread per turn, the item-stream
                      translator, sandbox mapping, `codex login status` probe,
                      CLI resolution, and home.ts — the mirrored CODEX_HOME the
                      bundled skills arrive through
sidecar/acp/          the Agent Client Protocol bridge: the JSON-RPC peer, the
                      update translator, the permission mapping, prompt blocks
sidecar/copilot/      the Copilot adapter over that bridge: CLI resolution,
                      spawn flags, the in-band failure classifier, ACP probe
sidecar/grok/         the Grok Build adapter, second rider on the bridge
sidecar/tools/        the studio's own tools as stdio MCP: specs, execution,
                      the unix-socket gateway and the --tools-host child
sidecar/history/      driver seam, migrations, project, video and session stores,
                      recorder
sidecar/library/      the asset library: the folder store and the copy into a project,
                      roles.ts — the motion role of every shipped remocn component —
                      and moodboard.ts: the board's HTML template, its render and its
                      idempotent store
sidecar/scaffold/     what "New project…" expands and installs
                      and templates.ts — the bundled project templates a link can open
templates/remotion/   that project, vendored here and shipped as a Tauri resource
                      plus video-templates/, the landing's welcome composition copied in
agent/                the one skills bundle every provider loads: vendored skills,
                      plus video-lessons and motion-design — our own record of what
                      failed on screen and the motion bar it has to clear
scripts/              build-time tooling; skills-sync.ts is the vendoring step,
                      fetch-bun.ts pulls the bun runtime the app ships, and
                      crash-sink.ts / sourcemaps.ts are crash reporting's
                      verification and its release step
sidecar/preview/      the --preview-host child: project resolution, webpack watch, server,
                      stills for Snapshot and the mp4 export; browser.ts is the one
                      GL policy and its probe, failure.ts the one classifier,
                      config.ts + config-host.ts the project's render settings read
                      in a process of their own, job.ts the copy a render is pinned
                      to; statics.ts lists the
                      project's public/ for the pane's asset picker; codemod.ts
                      drives the project's own @remotion/studio-codemods and answers
                      with text, never with a write
src-tauri/            Rust core (Tauri v2), the sidecar supervisor, pasted-image writes;
                      crash.rs reads the consent and holds the panic reporter;
                      legacy_account.rs forgets an older build's sign-in once
public/               static assets
openspec/             the source of truth: specs/ per capability, config.yaml, archived changes
docs/decisions/       the design records moved out of CLAUDE.md; history, not authority
docs/plans/           per-feature design and implementation plans, by date
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

### Shader insertion runtime (REM-724)

New videos use `studio-objects-v7` and a source-bound `studio-shaders.json`.
Studio-created videos also carry `studio-origin.json` with their original
`createdWithStudioVersion`. Preserve it; never backfill it from the running app
or the project's package version. Structural shader preparation accepts verified 1.0.0-format videos without
origin metadata. A known creation version below stable 1.0.0 or invalid recorded
metadata blocks adaptation; never infer a missing creation version. Structured
adapters bind local scene/timing dependencies and migrate participating hooks
with the provider. Already-connected compatible slots remain usable without origin.
Provider and hooks must use the same context; v5/v6 hooks cannot read a v7
provider. Keep old runtimes immutable and preserve inserted shader records,
permanent scene/slot IDs and operation history when editing a video. The first
implementation slice exposes Mesh Gradient; the remaining catalogue is gated
on the first complete preview/export proof in `add-shaders-to-video`.

`REMOCN_SHADER_RENDER=1 bun test sidecar/preview/shader-render.test.ts` runs the
one-shot Chromium frame proof using the installed `test/fixtures/render-smoke`
renderer. `REMOCN_SHADER_CAPTURE_DIR` optionally retains PNG evidence. This does
not start the app's dev server and does not replace WebKit or encoded-export
verification. A sandboxed macOS Chromium launch may require escalation.

### Assisted shader preparation

- `agent.prompt.shaderPreparation` starts only from the explicit Prepare video action, in a new chat. The sidecar chooses a temporary workspace; IPC never accepts a caller-supplied workspace path. Keep the selected provider and its normal permission gate.
- Validate the copied source, document, origin and project bundle before activating source edits. Wait for checked live shader targets before completing preparation; an agent's final response is not readiness. Shader card clicks remain agent-free.
- Structural/compiler failures return to the configured agent in the same preparation chat and copy, for at most three total attempts. Restore generated connections before repair while keeping agent edits. Cancellation, provider/scope failures and activation/preview failures are terminal. The automatic connector requires direct AbsoluteFill scene roots with local managed bindings; preparation instructions must explain custom wrapper expansion as well as static timing.
- A temporary workspace's SDK session must not be bound to the original project. Keep its transcript, discard its resume token, and recover interrupted activation from the preparation journal using content checks. Preserve independently changed source and retain installed versioned shared resources.

### Caption catalogue tooling

- `bun scripts/remocn-sync.ts --captions` imports the separately pinned caption batch without refreshing other categories. `remocn/lock.json` records `captionsPin`; new manifests carry `sourcePin`. `REMOCN_SOURCE` can point at a local remocn Git checkout: tooling reads the pinned commit, not working-tree files.
- Preview examples resolve `.tsx` and `.ts` helpers at each manifest's pin. Each revision has its own example directory. `bun run remocn:check` verifies source hashes; posters and clips remain outside the lock.
- Studio caption guidance and the transcript helper live under our own `agent/skills/motion-design/rules/`, reached by the selected asset's scoped brief. Keep upstream skill copies unchanged so `skills:sync` preserves Studio guidance.
