<p align="center">
  <img width="960" alt="Remocn Studio: one sentence in, a Remotion video out" src="docs/assets/remocn-studio.gif" />
</p>

<h1 align="center">Remocn Studio for Linux</h1>

<p align="center">
  <b>Ship a launch video without opening After Effects.</b><br />
  A Linux app where your own coding agent makes the video<br />
  as a real Remotion project you own, not a file you rent.
</p>

<p align="center">
  <a href="https://github.com/radiumcoders/Remocn-studio-Linux/releases/latest">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/Download_for_Linux.svg?logo=linux&size=lg&theme=violet&mode=dark" />
      <img alt="Download for Linux" src="https://shieldcn.dev/badge/Download_for_Linux.svg?logo=linux&size=lg&theme=violet&mode=light" />
    </picture>
  </a>
  &nbsp;
  <a href="https://remocn.studio">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/remocn.studio.svg?logo=lu:globe&size=lg&variant=outline&mode=dark" />
      <img alt="remocn.studio" src="https://shieldcn.dev/badge/remocn.studio.svg?logo=lu:globe&size=lg&variant=outline&mode=light" />
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/radiumcoders/Remocn-studio-Linux/releases"><img alt="Latest release" src="https://shieldcn.dev/github/release/radiumcoders/Remocn-studio-Linux.svg?variant=secondary" /></a>
  <a href="https://github.com/radiumcoders/Remocn-studio-Linux/actions/workflows/dev.yml"><img alt="CI status" src="https://shieldcn.dev/github/ci/radiumcoders/Remocn-studio-Linux.svg?workflow=dev.yml&branch=main&variant=secondary" /></a>
  <a href="#requirements"><img alt="Linux: x86_64 and aarch64" src="https://shieldcn.dev/badge/Linux-x86__64_%C2%B7_aarch64.svg?logo=linux&variant=secondary" /></a>
  <a href="LICENSE"><img alt="License" src="https://shieldcn.dev/github/license/Remocn/remocn-studio.svg?variant=secondary" /></a>
  <a href="https://github.com/Remocn/remocn-studio/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/stars/Remocn/remocn-studio.svg?variant=secondary" /></a>
  <a href="https://x.com/kapish_dima"><img alt="Follow on X" src="https://shieldcn.dev/x/follow/kapish_dima.svg?variant=secondary" /></a>
</p>

<p align="center">
  <a href="#the-pitch">The pitch</a> ·
  <a href="#you-direct-it-shoots">Directing</a> ·
  <a href="#how-a-video-gets-made">The pipeline</a> ·
  <a href="#on-set">On set</a> ·
  <a href="#the-cast">The cast</a> ·
  <a href="#behind-the-scenes">Build from source</a> ·
  <a href="#contributing">Contributing</a>
</p>



## The pitch

Describe the video you want. A coding agent builds it as a real
[Remotion](https://www.remotion.dev) project. You watch the live preview change
while it works, and export an mp4 when it looks right.

This isn't another AI video editor. There's no timeline, no keyframes and no
track management. You write prompts, point at things and give notes.

**Not a generator. Not a template.** AI video tools usually make you pick one:
generate pixels you can't edit, or drag in templates everyone recognizes.
Remocn Studio takes a third route. The agent writes the motion design as code
and takes direction as you watch.

|                     | Pixel generators    | Template editors       | **Remocn Studio**               |
| ------------------- | ------------------- | ---------------------- | ------------------------------- |
| What you get        | A video file        | Someone else's layout  | **A Remotion project**          |
| Changing one word   | Generate it again   | Hunt for the layer     | **Say it, or click it**         |
| What it looks like  | Close enough        | Everyone else's video  | **Your brand**                  |
| Where it lives      | Their cloud         | Their account          | **A folder on your disk**       |

## You direct. It shoots.

Remocn Studio puts you in the director's chair. You watch the take, then give
notes:

> "Fix the text here."
> "The animation is too fast here."
> "Why did everything break here?"

There are three ways to say *here*:

- **Type it.** Plain words in the chat, taken exactly as you wrote them.
- **Point at it.** Click any element in the preview. Playback pauses and the
  properties pane opens, with type, spacing and easing curves as controls you
  can drag. Every change is saved into the source. You can double-click text
  to rewrite it in place, or drag an object to move or resize it. Add the
  element to the chat and it goes along with your message as `[Element #1]`.
- **Frame it.** Drag a **Snapshot** box over the frame and the crop goes into
  the chat as a picture, ready to talk about.

## How a video gets made

You don't get a prompt box that hopes for the best. You get a production
pipeline with seven stages. At every stage the agent writes a document into
your project, so you can read, edit or overrule each decision.

| #   | Stage        | In the app you'll see            | It leaves behind                                                    |
| --- | ------------ | -------------------------------- | ------------------------------------------------------------------- |
| 1   | Analysis     | *Analysing the material*         | `analysis.md`: audience, promise, format, what's missing            |
| 2   | Brand        | *Collecting the brand*           | `brand.md`, plus your original logos, copied unchanged              |
| 3   | Script       | *Writing the script*             | `script.md`: every shot, its message, its timing                    |
| 4   | Motion       | *Defining the motion language*   | `motion.md`: which component plays which shot                       |
| 5   | Build        | *Building the video*             | The scenes themselves, plus keyframes it rendered to check its work |
| 6   | Choreography | *Choreographing the whole video* | `choreography.md`: rhythm, continuity, reading time                 |
| 7   | Review       | *Reviewing the result*           | `review.md`: every note, closed with evidence                       |

The agent doesn't guess what looks good. A curated set of motion design skills
ships with the app: easing, pacing, typography animation, and a record of what
has failed on screen before. Before calling a video done, the agent runs
`design_check`, which measures the rendered frames for readability, timing and
handoffs.

## On set

<table>
  <tr>
    <td width="33%" valign="top">
      <img alt="Inspect and edit" src="public/onboarding/inspect.webp" /><br />
      <b>Inspect &amp; edit</b><br />
      <sub>Click an element and tune its type, tracking, easing and copy. The value goes back into the code.</sub>
    </td>
    <td width="33%" valign="top">
      <img alt="Snapshot" src="public/onboarding/snapshot.webp" /><br />
      <b>Snapshot</b><br />
      <sub>Drag a box over the frame. It lands in the chat as a picture.</sub>
    </td>
    <td width="33%" valign="top">
      <img alt="Assets and stock" src="public/onboarding/assets.webp" /><br />
      <b>Assets &amp; stock</b><br />
      <sub>Save clips, images and audio once, then say "use the intro clip".</sub>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img alt="Components" src="public/onboarding/components.webp" /><br />
      <b>Components</b><br />
      <sub>Save an animation that works as a component and reuse it in any project. The remocn motion set comes built in.</sub>
    </td>
    <td width="33%" valign="top">
      <img alt="Project brand" src="public/onboarding/brand.webp" /><br />
      <b>Project brand</b><br />
      <sub>Drop in a <code>DESIGN.md</code> or set the name and colors once. Every new video starts on brand.</sub>
    </td>
    <td width="33%" valign="top">
      <img alt="Export" src="public/onboarding/export.webp" /><br />
      <b>Export</b><br />
      <sub>MP4, WebM, GIF or ProRes, up to 4K, rendered by the project's own Remotion.</sub>
    </td>
  </tr>
</table>

Also in the kit:

- **Every platform's shape.** Export presets for YouTube, Shorts · Reels ·
  TikTok and Instagram Feed: wide, vertical and square.
- **A moodboard before a single frame.** No brand yet? The agent can build a
  moodboard from stock photos and work from its palette and type.
- **Sound and music.** Connect your own ElevenLabs account to generate sound
  effects and music from the chat. Each paid request waits for your approval.
- **Motion roles.** Every bundled component is tagged with its job: entry,
  emphasis, exit, scene or transition. The agent picks the one that fits the
  moment.

## The cast

You don't need an API key or a separate token bill. The studio drives the
command-line tool of a coding agent you already use, signed in with the
subscription you already pay for.

<p align="center">
  <a href="https://docs.claude.com/en/docs/claude-code/setup"><img alt="Claude Code" src="https://shieldcn.dev/badge/Claude_Code.svg?logo=claude&size=default&variant=secondary" /></a>
  <a href="https://developers.openai.com/codex/cli"><img alt="Codex" src="https://shieldcn.dev/badge/Codex.svg?logo=ri:TbBrandOpenai&size=default&variant=secondary" /></a>
  <a href="https://docs.github.com/copilot/how-tos/copilot-cli"><img alt="GitHub Copilot" src="https://shieldcn.dev/badge/GitHub_Copilot.svg?logo=githubcopilot&size=default&variant=secondary" /></a>
  <a href="https://grok.com/build"><img alt="Grok Build" src="https://shieldcn.dev/badge/Grok_Build.svg?logo=x&size=default&variant=secondary" /></a>
</p>

| Agent                                                                  | Sign in on this computer with                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Claude Code](https://docs.claude.com/en/docs/claude-code/setup)       | `claude auth login` (signing in to Claude Desktop doesn't count) |
| [Codex CLI](https://developers.openai.com/codex/cli)                   | `codex login`                                                     |
| [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli) | `copilot login`                                                |
| [Grok Build](https://grok.com/build)                                   | `grok login`                                                      |

You don't have to memorize these. The studio shows the exact install and
sign-in commands for each agent and can open your terminal for you to paste
them into.

## It's real code, and it's yours

Every video is a standard Remotion project in a folder on your disk. You can
open it in your editor, commit it to git and take it anywhere. There's no
proprietary format and no lock-in.

```text
my-launch/                          an ordinary Remotion project
├── .remocn/project.json            name, identity, brand
├── public/brand/                   your logo, copied as-is
├── src/
│   ├── Root.tsx
│   └── videos/
│       ├── registry.tsx            every video registers here
│       └── launch-teaser/
│           ├── index.tsx           the scenes: TSX you can read
│           ├── assets/
│           └── docs/               analysis → brand → script → … → review
└── package.json                    remotion, pinned
```

## House rules

- **The agent stays in its folder.** File edits inside your project run
  without interrupting you. Any shell command, or any path outside the
  project, gets a permission card first. You choose the mode (auto, accept
  edits or plan), and there's no mode that bypasses the cards.
- **Nothing leaves your computer without your consent.** There's no telemetry, and
  crash reports are opt-in.
- **Your agent setup stays untouched.** The studio brings its own skills to
  every agent and never writes into `~/.claude`, `~/.codex`, `~/.copilot` or
  `~/.grok`.
- **Your project stays yours.** The studio writes into your project only what
  a turn or one of your own actions asked for.

## Requirements

- Linux on x86_64 or aarch64 with glibc 2.35 or newer (Ubuntu 22.04, Debian 12,
  Fedora 36, Arch and anything newer)
- A Secret Service keyring — GNOME Keyring or KWallet — if you connect an
  integration; its key is stored there
- One of [the cast](#the-cast), installed and signed in on this computer

## Installing

Every [release](https://github.com/radiumcoders/Remocn-studio-Linux/releases/latest) carries
three builds of the same app:

| File        | Install with                                                        |
| ----------- | ------------------------------------------------------------------- |
| `.AppImage` | `chmod +x Remocn*.AppImage` and run it; footage codecs are inside   |
| `.deb`      | `sudo apt install ./Remocn*.deb` (Debian, Ubuntu, Mint, Pop!_OS)     |
| `.rpm`      | `sudo dnf install ./Remocn*.rpm` (Fedora, openSUSE, RHEL)            |

The studio doesn't update itself. A new version is a new download from the
releases page, or a package upgrade.

The window draws its own frame — close, minimise and maximise sit at the top
left — and there is no menu bar: every action is in the command palette
(`Ctrl+K`). The studio's log is at
`~/.local/share/com.remocn.remocn-studio/logs/sidecar.log`.

The studio's environment checklist checks both, along with the project's
Remotion version and dependencies, and offers a fix for anything that's
missing.

## Behind the scenes

Want to build it yourself? You need Linux, [Bun](https://bun.sh) 1.4 (the
exact version is pinned in `packageManager`), a Rust toolchain, and the
[Tauri prerequisites for Linux](https://v2.tauri.app/start/prerequisites/#linux)
plus libdbus and GStreamer:

```sh
# Arch
sudo pacman -S --needed webkit2gtk-4.1 libsoup3 gtk3 librsvg libayatana-appindicator \
  dbus patchelf unzip gst-plugins-base gst-plugins-good gst-plugins-bad gst-libav
# Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libdbus-1-dev libssl-dev patchelf file unzip \
  gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav
# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel librsvg2-devel dbus-devel \
  libappindicator-gtk3-devel openssl-devel patchelf unzip \
  gstreamer1-plugins-good gstreamer1-plugins-bad-free
```

```sh
git clone https://github.com/radiumcoders/Remocn-studio-Linux.git
cd Remocn-studio-Linux
bun install
cp .env.example .env   # optional: a Pexels key turns on stock photos
bun tauri dev
```

| Command                     | What it does                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| `bun run check`             | Format and lint in one read-only pass (what CI runs)                |
| `bun run fix`               | Apply the fixes `check` reports                                     |
| `bun run typecheck`         | `tsc --noEmit`                                                      |
| `bun run test`              | The test suite: bun test, happy-dom, Testing Library                |
| `bun run smoke:render`      | Run the real renderer against a fixture project (slow, needs network) |
| `bun tauri build`           | An AppImage, a `.deb` and an `.rpm` in `src-tauri/target/release/bundle/` |
| `bun tauri build --bundles deb,rpm` | The packages alone — the AppImage step fails on Arch and other gdk-pixbuf 2.44+ systems; CI builds it on Ubuntu |

The studio has three layers. A **Tauri v2** core in Rust owns the window
and the system keyring. The webview is a **Next.js** static export. A
**bun sidecar** built on Effect runs the agents, the history, the preview host
and the renderer. The map of the system and the working rules are in
[`CLAUDE.md`](CLAUDE.md).

## Contributing

Bug reports, fixes and ideas are welcome. Start with
[`CONTRIBUTING.md`](CONTRIBUTING.md). It covers setting up, the checks CI
runs, and what a pull request needs.

What the studio does is specified in [`openspec/specs`](openspec/specs): one
spec per capability, each written as requirements with scenarios. To change
behavior, open an OpenSpec change. To ship it, record it with
`bun run changeset`. The reasoning behind each area, including the
measurements and the failed attempts, is in [`docs/decisions`](docs/decisions).

Found a security issue? Please report it privately through
[GitHub security advisories](https://github.com/radiumcoders/Remocn-studio-Linux/security/advisories/new)
instead of opening an issue.

## Built with

<p align="center">
  <img alt="Tauri v2" src="https://shieldcn.dev/badge/Tauri_v2.svg?logo=tauri&variant=secondary" />
  <img alt="Rust" src="https://shieldcn.dev/badge/Rust.svg?logo=rust&variant=secondary" />
  <img alt="Next.js 16" src="https://shieldcn.dev/badge/Next.js_16.svg?logo=nextdotjs&variant=secondary" />
  <img alt="React 19" src="https://shieldcn.dev/badge/React_19.svg?logo=react&variant=secondary" />
  <img alt="TypeScript" src="https://shieldcn.dev/badge/TypeScript.svg?logo=typescript&variant=secondary" />
  <img alt="Effect v4" src="https://shieldcn.dev/badge/Effect_v4.svg?logo=effect&variant=secondary" />
  <img alt="Bun" src="https://shieldcn.dev/badge/Bun.svg?logo=bun&variant=secondary" />
  <img alt="Tailwind CSS v4" src="https://shieldcn.dev/badge/Tailwind_v4.svg?logo=tailwindcss&variant=secondary" />
  <img alt="shadcn" src="https://shieldcn.dev/badge/shadcn.svg?logo=shadcnui&variant=secondary" />
  <img alt="SQLite" src="https://shieldcn.dev/badge/SQLite.svg?logo=sqlite&variant=secondary" />
  <img alt="Remotion" src="https://shieldcn.dev/badge/Remotion.svg?logo=lu:clapperboard&variant=secondary" />
</p>

## Credits

- Rendering is powered by the open-source [Remotion](https://www.remotion.dev)
  framework. Remotion has its own
  [license terms](https://www.remotion.dev/license), and companies may need a
  company license.
- The motion components come from [remocn](https://remocn.dev)

Remocn Studio is released under the [MIT License](LICENSE). © 2026 Remocn.
This Linux fork is based on [Remocn/remocn-studio](https://github.com/Remocn/remocn-studio).
