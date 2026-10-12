# Contributing to Remocn Studio

Thanks for wanting to help. This page covers how to get the studio running
from source, how a change moves from an idea to a release, and what a pull
request needs before it can be merged.

## Before you start

- **Bugs.** Open an issue with what you did, what you expected and what
  happened. Include the studio version from Settings and which agent you use.
  On macOS, add the macOS version and the chip (Apple silicon or Intel). On
  Linux, add the distribution and its version, the desktop or window manager
  (and X11 or Wayland), and whether you run the AppImage, the `.deb` or the
  `.rpm`. The sidecar log often explains the rest: it is at
  `~/Library/Logs/com.remocn.remocn-studio/sidecar.log` on macOS and
  `~/.local/share/com.remocn.remocn-studio/logs/sidecar.log` on Linux.
  Read it before you attach it, since it can include project paths.
- **Features and larger changes.** Open an issue first and describe the
  problem you want to solve. The studio has a narrow shape on purpose: no
  timeline, no account and no telemetry. It's cheaper to agree on direction
  before anyone writes code.
- **Security issues.** Don't open a public issue. Report them privately through
  [GitHub security advisories](https://github.com/Remocn/remocn-studio/security/advisories/new).

## Setting up

You need macOS or Linux, [Bun](https://bun.sh) 1.4 (the exact version is
pinned in `packageManager` in `package.json`), and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/): a Rust
toolchain, plus the Xcode Command Line Tools on macOS, or WebKitGTK, libdbus
and GStreamer on Linux (the README lists the packages per distribution). To use the studio end to end, you
also need one of the supported agents installed and signed in. The README
lists them.

```sh
git clone https://github.com/Remocn/remocn-studio.git
cd remocn-studio
bun install
cp .env.example .env   # optional: a Pexels key turns on stock photos
bun tauri dev
```

`bun tauri dev` first fetches the bundled bun and bundles the sidecar
(`tauri:before-dev`), because the Rust build checks both exist; the first run
needs network for the bun download. In a debug build the Rust core then runs
the sidecar straight from `sidecar/`, so editing sidecar code needs a restart
and no build step.

Platform-specific code is gated, never forked: `#[cfg(target_os = ...)]` in the
Rust core, `process.platform` in the sidecar, and `currentPlatform()` or
`usePlatform()` from `lib/studio/platform.ts` in the webview. A change that
touches one platform's branch should say how it was tried on that platform;
the `rust core` CI job compiles the core on both.

## Where things are

[`CLAUDE.md`](CLAUDE.md) is the working manual: the map of the system, the
invariants, the tooling gotchas and the conventions for each part of the code.
Read the section for the area you're changing. It's written for coding agents,
and it serves people just as well.

Three places hold the rest:

- [`openspec/specs`](openspec/specs) is the source of truth for what the studio
  does. It has one spec per capability, written as requirements with
  WHEN/THEN scenarios.
- [`docs/decisions`](docs/decisions) records why each area works the way it
  does, including the measurements and the failed attempts. It's history, and
  where it disagrees with a spec, the spec wins.
- `repos/` is optional. It holds local, read-only checkouts of libraries such
  as Effect for reference, is gitignored, and nothing builds from it.

## Making a change

**Behavior changes go through [OpenSpec](https://github.com/Fission-AI/OpenSpec).**
Install the CLI with `npm i -g @fission-ai/openspec`. A change lives in
`openspec/changes/<name>/` as a proposal, a delta to the affected specs, a
design and a task list. When it ships, the delta is merged into
`openspec/specs`. If you use Claude Code, the `/opsx:explore`, `/opsx:propose`,
`/opsx:apply` and `/opsx:archive` commands in `.claude/` walk you through each
step. A pure refactor or a tooling change doesn't need a spec delta.

**Record user-facing changes with a changeset.** Run `bun run changeset`,
choose the bump and write one line for the changelog. Leave the version in
`package.json` alone, because the release workflow sets it.

**Follow the conventions in `CLAUDE.md`.** The main ones:

- The frontend is a Next.js static export with no server at runtime. Anything
  that needs a runtime goes to a Tauri command in Rust or to the bun sidecar.
- Effectful code is written with [Effect](https://effect.website) v4. Code in
  `lib/` returns an `Effect` that fails with a tagged error, and hooks run it.
- Behavior lives in hooks under `hooks/` and pure functions in `lib/studio/`.
  Components only render.
- `shared/ipc.ts` is the only contract between the webview and the sidecar.
  Every frame is decoded at the boundary, never cast. If you change a frame,
  bump the protocol version in both `shared/ipc.ts` and `src-tauri/src/ipc.rs`.
- Every failure a user can see is a readable sentence, never a raw error,
  protocol token or stack trace.

## Checks

CI runs these on every pull request, and all of them have to pass:

```sh
bun run check       # format and lint (Biome via Ultracite), read-only
bun run typecheck   # tsc --noEmit
bun run test        # bun test with happy-dom and Testing Library
bun run build       # the Next.js static export
```

`bun run fix` applies what `check` reports. Always run `typecheck` after it.
For Rust changes, also run `cargo check` in `src-tauri/`. While you iterate,
run only the tests you touched, for example
`bun run test hooks/use-tours.test.tsx`, and run the full suite once before you
push.

`bun run smoke:render` runs the real renderer against a fixture project. It's
slow and needs network the first time, so run it only when you touch export or
preview rendering.

## Pull requests

- Branch from `main`. Keep each pull request to one change.
- Write commit messages as plain sentences that say what the change does, for
  example *Walk a project's folders in name order, so the file limit stops at
  the same files everywhere*.
- In the description, say what changed and why. Link the issue and the
  OpenSpec change if there is one, and add a screenshot or a short recording
  for anything visible.
- Don't commit rendered videos, QA frames or other local output.
  `artifacts/`, `videos/`, `diagnostics/` and `output/` are gitignored for that
  reason.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers this project.
