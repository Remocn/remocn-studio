<p align="left">
  <img alt="header" src="https://shieldcn.dev/header/transparent.svg?mode=dark&amp;align=left&amp;border=false&amp;image=https%3A%2F%2Fremocn.dev%2Fstudio.png&amp;overlay=0" />
</p>

![badge group](https://shieldcn.dev/group/github/kapishdima/remocn-studio/stars+github/kapishdima/remocn-studio/license+x/follow/kapish_dima.svg?variant=secondary)

# remocn studio

**A local desktop app that turns "I want a video" into a real Remotion project.**

Open a folder, describe the video in chat, and watch Claude write actual Remotion TSX into it —
previewed live in the app and exported to mp4 without touching a terminal.

[remocn.dev](https://remocn.dev) · [design record](https://github.com/Remocn/remocn/issues/218)

> **Status: early prototype, personal use.** Not a product release, not packaged, macOS only.
> See [Status](#status) for what actually runs today.

## What it is

remocn studio is a Tauri desktop app wrapped around `@anthropic-ai/claude-agent-sdk` and the
[remocn](https://remocn.dev) component set. It is closer to a purpose-built Claude Code GUI than
to a video editor:

- **Claude produces code, not a spec.** The agent writes real Remotion TSX into the folder you
  opened, the same way Claude Code plus the remocn skill work today. You keep a normal Remotion
  project you can open in any editor afterwards.
- **Open any folder.** Point it at an existing Remotion project. The app owns neither the entry
  point, nor the Remotion version, nor the build config.
- **Preview and export are the project's own.** Preview compiles your source; export runs through
  the project's own `@remotion/renderer`, resolved from its `node_modules` — never a version the
  app bundles, so the mp4 cannot silently diverge from what you previewed.
- **Uses your Claude subscription.** Auth is picked up from the already-logged-in Claude Code
  CLI. No API key, no separate OAuth.

**This is not [studio.remocn.dev](https://remocn.dev).** That is a separate, hosted, spec-driven
web editor built on one generic composition plus a JSON project format. This repo is the local
desktop app where the agent writes real code. The two share a name and nothing else.

## How it works

```
┌──────────┬─────────────────────┬──────────────┐
│ sessions │ chat                │ preview      │
│          │                     │              │
│ history  │ streamed assistant  │ <Player>     │
│ (SQLite) │ text + action lines │ + export     │
└──────────┴─────────────────────┴──────────────┘
        Tauri v2 (Rust core)  ⇄  bun sidecar
                                 ├─ Claude Agent SDK
                                 ├─ preview dev server
                                 └─ export (project's renderer)
```

- **Three panes**, exactly one active session at a time — the left pane is an archive, not
  multitasking.
- **Action lines.** Each tool call collapses to one compact line (`Edit src/Scene.tsx`,
  `Bash bun add …`) that expands into a real diff or command output.
- **Split permissions.** Read/Glob/Grep/Write/Edit inside the opened folder run automatically.
  Bash, and any path resolving outside the folder, raise an Allow/Deny card in the transcript.
- **One composition.** A project has a single composition with id `Main`; every scene lives inside
  it via `Series` / `TransitionSeries`. No composition selector.
- **Own history.** Every stream event is written to our own SQLite schema; only the SDK
  `session_id` is kept, for resume. The Claude Code transcript format is not a public contract.

## Requirements

- macOS (nothing in the code is macOS-specific, but that is all that is tested)
- [Claude Code](https://claude.com/claude-code) installed **and logged in**, with a Pro/Max
  subscription — the app is inert without it
- [bun](https://bun.sh) and a Rust toolchain
- A Remotion project to open, with its dependencies installed

The app checks all of this when you open a folder and reports each failure as a readable line with
a next step, rather than as a blank pane.

## Getting started

```bash
bun install
bun tauri dev      # dev build
bun tauri build    # unsigned .app
```

`bun run build` produces the Next.js static export in `out/` and is also the project's typecheck.

## Stack

Tauri v2 (Rust core) · Next.js App Router in `output: "export"` · React 19 · Tailwind v4 ·
shadcn/ui (`base-luma`, so the primitives are `@base-ui/react`, not Radix) · bun sidecar hosting
the Agent SDK, the preview server and the export.

There is no Node server at runtime: Tauri serves a static bundle, and anything needing a real
runtime lives in Rust or in the sidecar. See [`CLAUDE.md`](./CLAUDE.md) for the architecture notes
that matter when changing this.

## Status

Built and verified:

- [x] Next.js static export wired into Tauri, `bun run build` and `bun tauri dev` both clean
- [x] Tailwind v4 with remocn's design tokens, dark-first
- [x] shadcn/ui on `base-luma` / Base UI

Everything below is designed but not yet built — tracked as issues on the main repo:

| | |
| --- | --- |
| [#219](https://github.com/Remocn/remocn/issues/219) | app shell — three panes |
| [#220](https://github.com/Remocn/remocn/issues/220) | sidecar runtime and IPC |
| [#221](https://github.com/Remocn/remocn/issues/221) | Agent SDK session stream |
| [#222](https://github.com/Remocn/remocn/issues/222) | chat transcript, action lines, diffs |
| [#223](https://github.com/Remocn/remocn/issues/223) | permission cards |
| [#224](https://github.com/Remocn/remocn/issues/224) | sessions and SQLite history |
| [#225](https://github.com/Remocn/remocn/issues/225) | vendored remocn skill + sync step |
| [#226](https://github.com/Remocn/remocn/issues/226) | preview host + `<Player>` |
| [#227](https://github.com/Remocn/remocn/issues/227) | export to mp4 with progress |
| [#228](https://github.com/Remocn/remocn/issues/228) | environment checklist |

**Definition of done for the prototype:** open a real Remotion project, ask Claude in the app to
build a scene, watch the edits land as action lines, approve the one Bash call it needs, see the
result in the player, and export an mp4 — without touching a terminal.

Commercial use of the Remotion Player and renderer requires a Remotion Company License; this
prototype is personal use.

## License

[MIT](./LICENSE)
