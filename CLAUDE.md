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

- `bun run build` — production build; **this is the typecheck** (`tsconfig.json`
  is `noEmit`, and Next 16 no longer runs a linter on build). Emits the static
  export to `out/`.
- `bun tauri build` — unsigned `.app` bundle.
- `bunx shadcn@latest add <component>` — add UI components (config in
  `components.json`).

There is no test runner, linter, or formatter configured.

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
