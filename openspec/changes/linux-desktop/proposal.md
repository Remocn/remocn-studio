# Proposal

## Why

Remocn Studio builds only for macOS. The Rust core already compiles on Linux. What fails is
around it: there is no Linux bun to ship, and secrets are silently kept in `keyring`'s
in-memory mock store. Crash consent is never read off macOS. Several helpers are
macOS-only (`osascript`, `sw_vers`, a `.pkg` Node installer). The menu and the title bar
are built for AppKit, and the release pipeline builds only for Apple. This change adds
Linux as a second platform from the same codebase, and leaves macOS as it is. No Linear
issue; it started as the `radiumcoders/Remocn-studio-Linux` fork.

## What Changes

- **Builds and releases for Linux** beside macOS: bun is fetched for x86_64 and aarch64
  Linux as well as macOS, and a release adds an AppImage, a `.deb` and an `.rpm`, built on
  Ubuntu after the macOS jobs, to the same GitHub release and the same `latest.json`.
- **Secrets persist on Linux** in the desktop's Secret Service keyring; macOS keeps the
  login keychain.
- **On Linux the window draws its own frame** (`tauri.linux.conf.json`). The title-bar band
  keeps its shader and gains close, minimise and maximise where the traffic lights sit on
  macOS. Drag the band to move the window, double-click it to maximise, and drag an edge to
  resize.
- **No application menu bar on Linux.** The palette and the keyboard read the registry
  with `Ctrl` shortcuts. Projects are switched from the sidebar and the palette. macOS keeps
  its menu.
- **Open in Terminal** opens the person's own terminal on Linux; macOS keeps Terminal.app.
- **Install Node.js** opens the Node.js download page on Linux; macOS keeps the `.pkg`.
- **Updates in place on both.** The updater installs the AppImage, `.deb` or `.rpm` the
  person runs, signed with the same key as the macOS archives.
- **Wording follows the platform**: Finder or Files, the keychain or the system keyring,
  `⌘` or `Ctrl`. Diagnostics read `sw_vers` on macOS and `/etc/os-release` on Linux, and
  consent lives under XDG directories on Linux.
- **CLIs are found where either platform installs them**: Homebrew and `~/Library/pnpm`
  beside `~/.local/bin`, mise and asdf shims, Volta, pnpm. One list serves the sidecar and
  the core.
- **CI compiles the Rust core on both** platforms for every pull request.

## Non-goals

- **Windows, Flatpak and Snap.** A sandbox would block the agent CLIs and project folders.
- **Hardware GL for export.** Linux keeps the software backend the render-settings spec
  already prescribes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shell/layout-and-panes`: on Linux the band carries the window controls and no app menu
  is installed.
- `shell/command-palette`: the menu reader is macOS-only; shortcuts in each platform's
  glyphs.
- `shell/settings-page`: notification permission and hotkey wording per platform.
- `shell/attention`: notifications through the desktop's service on Linux.
- `shell/crash-reporting`: consent under XDG directories on Linux.
- `projects/dependency-install`: on Linux, Install Node.js opens the download page.
- `projects/environment-checklist`: on Linux, Open in Terminal uses the person's terminal.
- `projects/project-lifecycle`: projects are switched without a File menu on Linux.
- `projects/project-settings-and-brand`: Show in Files on Linux.
- `sidecar/supervision`: the log path on Linux; `bun` naming the shipped runtime for what the
  sidecar starts; the order the added CLI dirs are searched in.

## Impact

- **Shared contract:** unchanged; `node.install` stays and the sidecar refuses it off
  macOS.
- **Sidecar:** one shared list of CLI search dirs replaces the per-CLI copies, searched
  after `PATH` and the system dirs so it never shadows what was found before.
- **Rust core:**
  - `keyring` features per platform.
  - The bundled runtime is renamed `remocn-studio-bun` on both, so a `.deb` never claims
    `/usr/bin/bun`; a `bun` link in the data folder keeps `bun` naming it for everything
    the sidecar starts.
  - Linux versions of the terminal launcher, the consent location, the OS version, behind
    `cfg(target_os)`.
  - `tauri.linux.conf.json` for the frameless window; Linux bundle settings in
    `tauri.conf.json`.
- **Webview:** window controls, per-platform menu, wording, Node install and notification
  permission; tests keep the macOS user agent and switch to Linux through
  `test/user-agent.ts`.
- **Tooling and docs:** `fetch-bun.ts`, `publish.yml`, `dev.yml`, `README.md`,
  `CONTRIBUTING.md`, `CLAUDE.md` and `openspec/config.yaml`.
