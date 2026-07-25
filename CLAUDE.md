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
- `cn()` in `lib/utils.ts` (clsx + tailwind-merge) composes all classNames.
- Path alias `@/*` maps to the repo root.
- Fonts come from `next/font/google` (Manrope → `--font-manrope`, Geist Mono →
  `--font-geist-mono`) and are self-hosted into the export at build time. Note
  this means **`bun run build` needs network on a cold cache.**

## Layout

```
app/                  Next App Router (layout, page, globals.css)
components/ui/        shadcn/ui primitives (Base UI–backed)
components/           app-level components (theme-provider, later: studio panes)
lib/utils.ts          cn helper
src-tauri/            Rust core (Tauri v2)
public/               static assets
```

Planned, per #218 — keep the flat root, no monorepo:

```
sidecar/              bun: Agent SDK host, Vite preview server, export
shared/ipc.ts         one typed message contract for Rust ↔ webview ↔ sidecar
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
