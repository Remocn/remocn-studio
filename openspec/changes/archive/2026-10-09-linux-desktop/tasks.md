# Tasks

## 1. Build tooling: a Linux bun under its own name

- [x] 1.1 In `scripts/fetch-bun.ts`, replace the Darwin targets with `x86_64-unknown-linux-gnu` → `bun-linux-x64-baseline` and `aarch64-unknown-linux-gnu` → `bun-linux-aarch64`, and write `src-tauri/binaries/remocn-studio-bun-<triple>` (design §4). Verify: `bun run bun:fetch` writes `remocn-studio-bun-x86_64-unknown-linux-gnu`, and `--version` on it prints the `packageManager` version. *(Darwin targets restored in 10.1.)*
- [x] 1.2 In `tauri.conf.json`, set `externalBin` to `["binaries/remocn-studio-bun"]`. In `src-tauri/src/sidecar/spawn.rs`, make `shipped_bun` look for `remocn-studio-bun` beside the executable. Delete the stray `src-tauri/binaries/bun-x86_64-unknown-linux-gnu` copied in during exploration. Verify: `cargo check` in `src-tauri/` passes with only `binaries/remocn-studio-bun-*` present.

## 2. Shared contract: `node.install` leaves

- [x] 2.1 Remove the `node.install` method, its request and answer schemas, and the `NodeDownload` event from `shared/ipc.ts`. Bump `SIDECAR_PROTOCOL` 38 → 39 and `PROTOCOL` in `src-tauri/src/ipc.rs` 38 → 39. Verify: `bun run test shared/protocol.test.ts` passes, and `bun run typecheck` lists only the call sites removed in 3.1 and 7.3. *(Reverted in 10.2.)*

## 3. Sidecar

- [x] 3.1 Delete `sidecar/node-installer.ts` and `sidecar/node-installer.test.ts`, and drop the handler from `sidecar/handlers.ts`. Verify: `bun run test sidecar/handlers` (or the handler suite that lists methods) passes, and `rg node-installer sidecar` finds nothing. *(Reverted in 10.2.)*
- [x] 3.2 Add `USER_BIN_DIRS` (home-relative, plus `$NVM_BIN` when set) and the system dirs to `sidecar/agent/cli.ts`, per design §5. Use them in `sidecar/{claude,codex,copilot,grok}/cli.ts` and `sidecar/package-manager.ts`, and drop `/opt/homebrew/bin` and `Library/pnpm`. Verify: `sidecar/agent/cli.test.ts` (new or extended) asserts a CLI under `~/.local/share/mise/shims` and one under `~/.local/bin` are found from a minimal `PATH`. `sidecar/claude/cli.test.ts` and `sidecar/package-manager.test.ts` pass after updating their expected lists. *(macOS dirs restored in 10.4.)*
- [x] 3.3 Add a parity test in `sidecar/agent/cli.test.ts` that reads `src-tauri/src/sidecar/spawn.rs` and fails when its home-relative list differs from `USER_BIN_DIRS`. Verify: it fails with one dir removed from either side, and passes after 4.4.

## 4. Rust core

- [x] 4.1 In `Cargo.toml`, move `keyring`'s features into target tables: `apple-native` for macOS, `sync-secret-service` + `crypto-rust` for Linux. Remove `tauri-plugin-updater` from `Cargo.toml`, `lib.rs` and `capabilities/default.json`. Verify: `cargo check` passes, and `cargo tree -e features -i keyring` shows `sync-secret-service` on Linux. *(Updater restored in 10.3.)*
- [x] 4.2 Add a `#[cfg(target_os = "linux")]` `open_terminal` to `src-tauri/src/terminal.rs` with the lookup order of design §6, spawned detached and not awaited, and the worded error when nothing is found. Keep the macOS body under its `cfg`. Verify: a unit test in `terminal.rs` over an injected lookup covers `$TERMINAL` first, the list order, and the not-found sentence. `cargo test terminal` passes.
- [x] 4.3 In `crash.rs`, make `data_dir_for` answer the XDG location on Linux (design §10). Verify: unit tests cover an absolute `$XDG_DATA_HOME`, a relative one (ignored), only `$HOME`, and neither (`None`). `cargo test crash` passes.
- [x] 4.4 In `spawn.rs`, replace `FALLBACK_DIRS` with the home-relative list plus the system dirs, matching `USER_BIN_DIRS`, and include them in `search_dirs()`. Verify: the parity test from 3.3 passes, and `cargo test sidecar` passes.
- [x] 4.5 In `commands.rs`, replace `macos_version`/`sw_vers` with an `os_version()` that reads `/etc/os-release`, then `/usr/lib/os-release`, and answers `PRETTY_NAME`, else `NAME VERSION_ID`, else `unknown`. Verify: unit tests over sample file contents cover all three answers. *(`sw_vers` kept on macOS in 10.5.)*
- [x] 4.6 In `lib.rs` `setup`, call `app.deep_link().register_all()` on Linux only when `app.env().appimage.is_some()`, and log a failure without returning it (design §11). Verify: `cargo check`. Runtime coverage is in 9.3.
- [x] 4.7 Update `tauri.conf.json`: *(Superseded by 10.1.)*
  - remove `titleBarStyle`, `hiddenTitle` and `trafficLightPosition`, and add `"decorations": false`;
  - remove `bundle.macOS`, `createUpdaterArtifacts` and `plugins.updater`;
  - set `targets` to `["appimage","deb","rpm"]`;
  - add `bundle.linux` with `appimage.bundleMediaFramework: true`, the deb `depends` and the rpm `depends` from design §12;
  - drop `icon.icns` from `icon`.

  Delete `src-tauri/Entitlements.plist` and `src-tauri/assets/dmg/`. Verify: `cargo check` passes, and `bun tauri build --no-bundle` compiles.
- [x] 4.8 In `capabilities/default.json`, add `core:window:allow-close`, `allow-minimize`, `allow-toggle-maximize` and `allow-internal-toggle-maximize`. Remove the `x-apple.systempreferences` opener scope and `updater:default`. Verify: `cargo check` regenerates the schemas without error. *(Updater and `x-apple` scope restored in 10.3.)*

## 5. Webview: window frame and menu

- [x] 5.1 Delete the `:root[data-platform="linux"]` inset override in `app/globals.css`, so Linux keeps the band and the insets. Fix the titlebar comments that name macOS as the only owner of the slot. Verify: `components/studio/titlebar.test.tsx` passes.
- [x] 5.2 Add `hooks/use-window-controls.ts`, which exposes `close`, `minimize` and `toggleMaximize` over `getCurrentWindow()` and drops failures silently. Add `components/studio/window-controls.tsx`, which renders three labelled buttons (Close, Minimise, Maximise) only when `currentPlatform() === "linux"`, fixed in the traffic-light slot above the drag region. Mount it once at the root. Verify: `hooks/use-window-controls.test.tsx` (with `mockIPC`) asserts each button sends its window command and a rejected command shows nothing. `components/studio/window-controls.test.tsx` asserts it renders on a Linux agent and not on a Mac one.
- [x] 5.3 In `hooks/use-app-menu.ts`, skip `installAppMenu` and answer `false` unless the platform is `mac` (design §2). Verify: `hooks/use-app-menu.test.tsx` asserts no menu IPC is sent on Linux and `useShortcuts` then fires a menu-owned shortcut such as Ctrl+E.

## 6. Webview: tests run as Linux *(Superseded by 11.4.)*

- [x] 6.1 Register a WebKitGTK user agent (`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)`) in `test/register-dom.ts`. Update the `⌘` assertions in:
  - `lib/studio/command-registry.test.ts`
  - `components/studio/settings-page.test.tsx`
  - `hooks/use-row-menus.test.tsx`
  - `hooks/use-deletion.test.tsx`
  - `hooks/use-command-palette.test.tsx`
  - `hooks/use-canvas-rulers.test.tsx`
  - `hooks/use-canvas-layers.test.tsx`
  - `components/studio/command-palette.test.tsx`

  `lib/studio/platform.test.ts` keeps passing the platform explicitly. Verify: each listed file passes on its own.

## 7. Webview: behaviour and wording

- [x] 7.1 Updates (design §8): in `hooks/use-updates.ts`, `unavailableOf` answers the new-download sentence for a production build, and the launch check is gated on `unavailable === null`. Verify: a new `hooks/use-updates.test.tsx` (with `mockIPC` for `studio_build`) asserts no updater IPC on a production build, the sentence on *Check now*, and the development sentence unchanged. *(Reverted in 10.3.)*
- [x] 7.2 Notifications: remove `openNotificationSettings` and the `x-apple` URL from `lib/studio/notifications.ts`. *Grant permission* in `hooks/use-notification-consent.ts` only re-requests. Reword the Settings lines per the `shell/settings-page` delta. Verify: `lib/studio/notifications.test.ts`, `hooks/use-notification-consent.test.tsx` and `components/studio/settings-page.test.tsx` pass with the new wording. *(macOS path restored in 10.6.)*
- [x] 7.3 Node row: `lib/studio/environment.ts` gets `openNodeDownload` (`openUrl` from the opener plugin, failing with a tagged error), and the download state and percentage leave `hooks/use-environment.ts`. The row in `environment-checklist.tsx` says the page opens and that a package manager works too, with the offline sentence per the `projects/dependency-install` delta. Verify: `lib/studio/environment.test.ts` and `components/studio/environment-checklist.test.tsx` assert the URL opened, no sidecar call, and the failure sentence with the address. *(macOS path restored in 10.2.)*
- [x] 7.4 Terminal hint: `provider-steps.tsx` shows *Ctrl+Shift+V, then Enter* through a `terminalPasteHint()` in `lib/studio/platform.ts`, and the button's title names "your terminal". Verify: `lib/studio/platform.test.ts` covers the hint, and `components/studio/environment-checklist.test.tsx` reads it after Open in Terminal.
- [x] 7.5 Wording sweep (design §9), each change with its own test: theme caption "Follows the system", the reduced-motion line, the `System` fact rows, and `Show in ${fileManagerName()}` (`settings-page.tsx`, `project-settings-section.tsx`); the keyring lines (`integrations-section.tsx`); the permission sentence (`lib/studio/failure-text.ts`); the OS line (`lib/studio/feedback.ts`); and `modKeyCombo` zoom hints (`canvas-preview.tsx`). Verify: `settings-page.test.tsx`, `integrations-section.test.tsx`, `failure-text.test.ts` and `feedback.test.ts` pass with updated expectations, and `rg -n "macOS|Finder|this Mac|⌘" components hooks lib app` finds only comments or mac-branch code.

## 8. Packaging, CI and docs

- [x] 8.1 Rewrite the release job in `.github/workflows/publish.yml` as the `ubuntu-22.04` / `ubuntu-22.04-arm` matrix with the apt list and `--bundles appimage,deb,rpm` (design §12). Remove every `APPLE_*` step, the App Store Connect key, the DMG notarization and the updater signing env. Add a `rust` job to `.github/workflows/dev.yml` running `cargo check` and `cargo test` after the same apt install. Verify: `bunx --bun actionlint` (or `gh workflow view` after push) reports no syntax errors, and the `rust` job's commands pass locally. *(Superseded by 10.7.)*
- [x] 8.2 Delete `openspec/changes/sign-and-notarize-macos/`. Rewrite `openspec/config.yaml`'s context for a Linux desktop app: Tauri on WebKitGTK, bun shipped beside the binary, the GitHub Actions Linux release, the Secret Service keyring. Edit the Purpose lines of `openspec/specs/shell/command-palette/spec.md` (two readers, Ctrl+K) and `openspec/specs/shell/layout-and-panes/spec.md` (the band carries the window controls) directly. Verify: `bunx @fission-ai/openspec validate --all --strict` passes. *(Restored in 10.8.)*
- [x] 8.3 Rewrite `CLAUDE.md` for Linux: *(Both platforms in 10.8.)*
  - What this is: a Linux desktop app and fork of Remocn Studio.
  - Commands: the AppImage/deb/rpm build; no signing variables; `remocn-studio-bun`; the apt/pacman/dnf prerequisites including libdbus and the GStreamer plugins.
  - Tests: happy-dom registers a WebKitGTK agent.
  - Releases: the Linux matrix, no notarization, no updater.
  - Working rules:
    - the log at `~/.local/share/com.remocn.remocn-studio/logs/sidecar.log`;
    - notifications through the desktop service;
    - the keyring being the Secret Service, with gnome-keyring or KWallet required;
    - the frameless window and its controls;
    - no app menu;
    - the CLI search-dir parity between Rust and TS.

  Verify: `rg -n "macOS|WKWebView|notariz|Library/Logs|keychain" CLAUDE.md` finds only statements about the upstream or the compiled-out macOS branches.
- [x] 8.4 Rewrite `README.md` and `CONTRIBUTING.md`: install from the AppImage, `.deb` or `.rpm`; the build prerequisites per distribution; the log path; how updates arrive. Add a line to `docs/decisions/README.md` saying the records describe the macOS build this fork came from, and that `openspec/changes/linux-desktop/design.md` is where Linux diverges. Verify: every command in the README's build section runs as written on this machine, except `bun tauri dev`, which the person runs. *(Both platforms in 10.8.)*
- [x] 8.5 Add a changeset with `bun run changeset` (minor) describing the Linux port in the person's words: AppImage/deb/rpm, the own window frame, no menu bar, keys in the system keyring, updates by download. Verify: a new file under `.changeset/`.

## 9. Integration checks

- [x] 9.1 Run `bun run fix`, `bun run check`, `bun run typecheck`, the test files touched above, then the full `bun run test` once. Verify: all pass, and the suite count is the baseline (3353 pass, 18 skip) adjusted for added and removed tests, with 0 fail.
- [x] 9.2 Run `bun run sidecar:build` and `cargo test` in `src-tauri/`, then `bun tauri build`. Verify: a `.deb` and an `.rpm` appear under `src-tauri/target/release/bundle/`, `dpkg -c` on the `.deb` lists `usr/bin/remocn-studio-bun`, not `usr/bin/bun`, and its desktop entry carries `Exec=remocn-studio %u` and the scheme's MimeType. (The AppImage step cannot run on a gdk-pixbuf 2.44 host; see design.md *Risks* and 9.4.)
- [x] 9.3 Ask the person to run `bun tauri dev` (and the built AppImage once) and check:
  - (a) The band shows with its shader, and the three controls sit top-left: Close raises the quit guard mid-turn, Maximise and a double-click on the band toggle size, dragging the band moves the window, and an edge resizes it.
  - (b) No menu bar shows, and Ctrl+K, Ctrl+E and Ctrl+B work with the caret in the composer.
  - (c) Adding an integration key survives a restart, and it is visible in Seahorse or KWallet under `com.remocn.remocn-studio`.
  - (d) Open in Terminal opens their terminal.
  - (e) The Node row opens the download page.
  - (f) Settings › Updates shows the OS name, and *Check now* finds the newest release.
  - (g) A turn with Claude Code starts when the app is launched from the desktop launcher, not only from a shell.
  - (h) Footage plays in the preview, and an export finishes.
  - (i) A notification arrives while another window is focused, and clicking it opens the chat.
  - (j) `xdg-open 'remocn-studio://…'` reaches the running AppImage.

  Verify: the person's answers recorded under *Risks* in `design.md`. A failure in (c), (g) or (h) blocks archiving.
- [x] 9.4 The first release run of `publish.yml` builds the AppImage on `ubuntu-22.04` and `ubuntu-22.04-arm`. Verify: the release carries `.AppImage`, `.deb` and `.rpm` for both architectures, and the AppImage starts on this Arch machine.

## 10. Both platforms from one codebase

- [x] 10.1 `tauri.conf.json` keeps upstream's macOS window, `bundle.macOS`, `targets: "all"`, `icon.icns`, `createUpdaterArtifacts` and `plugins.updater`, plus `bundle.linux`; `tauri.linux.conf.json` replaces the window with the frameless one. `Entitlements.plist` and `assets/dmg/` are restored. `fetch-bun.ts` carries all four targets and, run by hand, fetches the host OS's two. Verify: `cargo check` and `cargo test` pass on Linux.
- [x] 10.2 `node.install`, `sidecar/node-installer.ts` and the download state come back; the handler refuses off `darwin`, `useEnvironment` opens the download page off macOS, and the checklist renders the installer or the page per platform. `SIDECAR_PROTOCOL` and `PROTOCOL` are back at 38. Verify: `environment-checklist.test.tsx` covers both platforms.
- [x] 10.3 The updater plugin, `updater:default`, the `x-apple` opener scope and the upstream `use-updates.ts` are restored on both platforms (design §8).
- [x] 10.4 `USER_BIN_DIRS` gains `Library/pnpm` and `SYSTEM_BIN_DIRS` gains `/opt/homebrew/bin` and `/usr/sbin`, in TS and in `spawn.rs`. Verify: the parity test passes.
- [x] 10.5 `os_version` uses `sw_vers` on macOS (as `macOS <version>`) and os-release on Linux; `data_dir_for` answers `~/Library/Application Support` on macOS; the terminal helpers and the keyring wording are gated by `cfg(target_os)`.
- [x] 10.6 *Grant permission* opens System Settings on macOS once refused and re-asks on Linux; the Settings lines and the keychain/keyring wording read the platform. `test/user-agent.ts` switches tests to a macOS agent. Verify: notification-consent, settings-page and platform tests cover both.
- [x] 10.7 `publish.yml` keeps the signed macOS jobs and adds `release-linux` after them, signing for the updater and uploading `latest.json`; `dev.yml`'s `rust` job runs on `ubuntu-22.04` and `macos-latest`.
- [x] 10.8 README, CONTRIBUTING, CLAUDE.md, `docs/decisions/README.md`, `openspec/config.yaml`, the spec Purpose lines and this change's proposal, design and deltas describe both platforms; `sign-and-notarize-macos` is restored.
- [x] 10.9 On a Mac, run `bun tauri dev` and check the traffic lights, the menu bar, the keychain prompt, Terminal.app, the Node `.pkg`, and System Settings from *Grant permission* behave as before. Verify: the `rust core (macOS)` CI job passes.

## 11. Review follow-ups

- [x] 11.1 `spawn::bun_dir` puts `<data dir>/bin`, holding a `bun` link to the shipped runtime, first on the sidecar's `PATH`, so `bun` still names the studio's runtime for turns and project scripts (design §4, `sidecar/supervision` delta). Verify: `cargo test` covers the link, its replacement when the runtime moves, and its place first on the `PATH`.
- [x] 11.2 `Cargo.lock` is staging's again plus the keyring backend's crates, and `@tauri-apps/api` and `@tauri-apps/plugin-updater` are back at staging's versions: removing and re-adding the updater had moved tauri to 2.12.1, tao, wry, muda and window-vibrancy with it. Verify: the lockfile differs from staging only by `dbus-secret-service` and its dependencies.
- [x] 11.3 The new home dirs are searched after `PATH` and the system dirs, in `spawn.rs` and in `sidecar/package-manager.ts` (design §5). Verify: `cargo test` and `sidecar/package-manager.test.ts` pin the order.
- [x] 11.4 `test/register-dom.ts` keeps the macOS user agent; Linux tests switch with `withAgent(LINUX)` (design §9). Verify: the `⌘` assertions are back and every Linux test names its platform.
- [x] 11.5 A Mac keeps its own wording and Linux gets the general sentence (design §9 table); `os_version` answers the bare `sw_vers` version on macOS. Verify: settings-page, feedback, failure-text and platform tests cover both.
- [x] 11.6 ⌘⌫ on a row and ⌘Z on the canvas read `isModKey()`, so Linux takes Ctrl. Verify: `use-row-menus.test.tsx` and `use-canvas-layers.test.tsx` cover Linux.
