# Proposal

## Why

This repository is a Linux fork of Remocn Studio (`radiumcoders/Remocn-studio-Linux`), and
upstream builds only for macOS. The Rust core already compiles on Linux. What fails is
around it: there is no Linux bun to ship, and secrets are silently kept in `keyring`'s
in-memory mock store. Crash consent is never read off macOS. Several helpers are
macOS-only (`osascript`, `sw_vers`, a `.pkg` Node installer). The menu and the title bar
are built for AppKit, and the release pipeline notarizes for Apple. No Linear issue; this
is fork work.

## What Changes

- **Builds and releases for Linux**: bun is fetched for x86_64 and aarch64 Linux, and a
  release produces an AppImage, a `.deb` and an `.rpm` on Ubuntu. **BREAKING:** the macOS
  bundle, the DMG, Apple signing and notarization, and the open `sign-and-notarize-macos`
  change are removed.
- **Secrets persist** in the desktop's Secret Service keyring.
- **The window draws its own frame.** The title-bar band keeps its shader and gains close,
  minimise and maximise where the traffic lights sat. Drag the band to move the window,
  double-click it to maximise, and drag an edge to resize.
- **No application menu bar.** The palette and the keyboard read the registry with `Ctrl`
  shortcuts. Projects are switched from the sidebar and the palette.
- **Open in Terminal** opens the person's own terminal.
- **Install Node.js** opens the Node.js download page.
- **Updates are not checked** until the fork has its own signing key. Settings says how a
  new version arrives.
- **Wording follows Linux**: the operating system, Files, the system keyring, and `Ctrl`.
  Diagnostics read `/etc/os-release`, and consent lives under XDG directories.
- **CLIs are found where Linux installs them**: `~/.local/bin`, mise and asdf shims, Volta,
  pnpm. One list serves the sidecar and the core.

## Non-goals

- **Keeping macOS buildable.** Existing macOS `cfg` branches stay where they compile out,
  but nothing is tested or released for macOS.
- **Windows, Flatpak and Snap.** A sandbox would block the agent CLIs and project folders.
- **Re-enabling updates.** That needs a fork-owned key and is a separate change.
- **Hardware GL for export.** Linux keeps the software backend the render-settings spec
  already prescribes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shell/layout-and-panes`: the band carries the window controls; the app menu is removed.
- `shell/command-palette`: two readers, with `Ctrl` glyphs.
- `shell/quit-and-updates`: no update check, download or install.
- `shell/settings-page`: Linux wording for notifications, stock media, updates, hotkeys and
  feedback.
- `shell/attention`: no macOS permission flow.
- `shell/crash-reporting`: the personal-machine scenario is not worded for a Mac.
- `projects/dependency-install`: Install Node.js opens the download page.
- `projects/environment-checklist`: Open in Terminal uses the person's terminal.
- `projects/project-lifecycle`: projects are switched without a File menu.
- `projects/project-settings-and-brand`: Show in Files.
- `sidecar/supervision`: the log is revealed in the file manager.

## Impact

- **Shared contract:** `node.install` and its download event leave `shared/ipc.ts`, so
  `SIDECAR_PROTOCOL` and `PROTOCOL` bump together.
- **Sidecar:** the Node installer is removed, and one shared list of CLI search dirs
  replaces the per-CLI copies.
- **Rust core:**
  - Linux `keyring` features; the updater dependency is dropped.
  - The bundled runtime is renamed `remocn-studio-bun`, so a `.deb` never claims
    `/usr/bin/bun`.
  - Linux versions of the terminal launcher, the consent location, the OS version and the
    search dirs.
  - `tauri.conf.json`: decorations off and Linux bundle targets.
- **Webview:** window controls, no menu install, Linux wording, updates disabled, and tests
  on a Linux user agent.
- **Tooling and docs:** `fetch-bun.ts`, `publish.yml`, `README.md`, `CONTRIBUTING.md`,
  `CLAUDE.md` and `openspec/config.yaml`.
