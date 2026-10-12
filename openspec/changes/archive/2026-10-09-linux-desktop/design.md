# Design

## Context

See `proposal.md` for the why. What was measured on Linux before this was written
(Arch, Hyprland on Wayland, webkit2gtk-4.1 2.52.6, bun 1.4.2, rustc 1.98.1), on
2026-10-02:

- `cargo check` on the Rust core fails at `tauri-build` with *resource path
  `binaries/bun-x86_64-unknown-linux-gnu` doesn't exist*, then with the missing
  `sidecar-dist/main.js`. With both in place it **passes with no source change**. The
  only output is four dead-code warnings that were already there.
- `bun run test` passes as is: 3353 pass, 18 skip, 0 fail. The happy-dom user agent
  is pinned to a Mac, so every shortcut assertion expects `⌘`.
- The `keyring` 3.6.3 source falls back to its `mock` store when no Linux backend
  feature is on (`src/lib.rs`: *fallback to mock if neither keyutils nor secret
  service is available*). `Cargo.toml` enables only `apple-native`, so on Linux
  every integration key is held in memory and lost on restart, and nothing reports
  an error.
- Tauri 2.11.5 resolves `app_data_dir` to `dirs::data_dir()/<identifier>` and
  `app_log_dir` to `dirs::data_local_dir()/<identifier>/logs`. Both are
  `$XDG_DATA_HOME` or `~/.local/share` on Linux. `crash::data_dir_for` returns `None`
  off macOS, so the core never reads consent there.
- `tauri-runtime-wry` 2.11.4 attaches a GTK edge-resize handler to undecorated
  windows (`undecorated_resizing.rs`, `mod gtk`), so a frameless window stays
  resizable without code of ours.
- `tauri-plugin-deep-link` 2.4.10 delivers links on Linux as argv, through
  single-instance, which `lib.rs` already wires. `register_all` writes a
  `~/.local/share/applications/<exe>-handler.desktop` that points at `$APPIMAGE`
  when set, otherwise at the current executable.
- `Window::set_badge_count` on Linux publishes through the Unity LauncherEntry
  protocol under `<package name>.desktop`. It is shown only by docks that implement
  that protocol.

## Goals / Non-Goals

**Goals:**

- A `bun tauri dev` and a `bun tauri build` that work on a stock Linux desktop with
  the Tauri prerequisites and libdbus.
- Every macOS-only mechanism gets a Linux counterpart behind a platform gate. No code
  path reachable on Linux shells out to a macOS binary, and no macOS behaviour changes.
- One codebase and one release for both platforms; nothing is forked.
- The look of the shell stays the same: the band, the shader, the inset card.

**Non-Goals:**

- Windows. `platform.ts` still knows it, but nothing is built or tested for it.
- Matching every desktop's conventions for control placement or badge rendering.

## Decisions

### 1. Frameless window, controls in the traffic-light slot

`src-tauri/tauri.linux.conf.json` replaces the window with one that has
`decorations: false`; Tauri merges a platform file over `tauri.conf.json`, whose
window keeps the macOS keys (`titleBarStyle`, `hiddenTitle`,
`trafficLightPosition`), so macOS is unchanged. The
`:root[data-platform="linux"]` override in `app/globals.css` that zeroes
`--titlebar-block-inset` and `--titlebar-inline-inset` is deleted, so Linux gets
the band and the insets the layout was built around. Several values in it are
hard-coded and only line up with the band: the sidebar's `mt-12`, the peek
panel's `pt-10`, and the edge strip's `top-12`.

A `WindowControls` component (Close, Minimise, Maximise) is mounted once at the
root, fixed in the top-left slot where the traffic lights sat, and rendered only
when `currentPlatform() === "linux"`. The webview owns the buttons. Each one calls
the window API (`close`, `minimize`, `toggleMaximize`), and the core performs it.
`close()` raises `CloseRequested`, which the existing `on_window_event` guard
already turns into the quit event. Close therefore reaches the same confirmation
as any other quit, with no new path.

Double-click on the band is Tauri's own drag-region behaviour and needs
`core:window:allow-internal-toggle-maximize`. The buttons need `allow-close`,
`allow-minimize` and `allow-toggle-maximize`. A window operation that fails or is
ignored (a tiling window manager with no minimise) is dropped silently: it is
chrome, and the spec says no error is shown.

*Alternatives:*

- **Native decorations.** On Hyprland the result is no title bar at all; on GNOME
  it is a GTK header bar above the band. The hard-coded offsets would then leave
  3rem of dead space, and the shader preferences would do nothing.
- **Controls on the right.** This is what the person first picked. Panes run to
  the window's top edge on the right (the preview header, the chat when the
  preview is hidden, Docs, Settings), so each of them would need an inline-end
  inset. The left slot is already kept clear by `--titlebar-inline-inset` in every
  layout. Moving the controls later is a CSS change; the spec says "left edge" so
  it can be revisited deliberately.

### 2. No application menu on Linux

`useAppMenu` returns `false` without calling `installAppMenu` unless the platform
is `mac`. With `isMenuInstalled` false, `useShortcuts` already fires every
`owner: "menu"` shortcut from the webview, which is the same path the page uses
without a core today. Nothing new is needed for dispatch. Native context menus
(`lib/studio/context-menu.ts`) still use the Tauri menu API as popups and are
unaffected.

*Alternative:* a GTK menu bar attached to the window. It would render above the
webview, under no band, and duplicate the palette. The Edit menu's clipboard
items are not needed, because WebKitGTK handles Ctrl+C/V/X/Z in fields itself.

### 3. Secrets through the Secret Service, synchronously

`keyring` moves its feature list into target tables:

- `apple-native` under `cfg(target_os = "macos")`;
- `sync-secret-service` + `crypto-rust` under `cfg(target_os = "linux")`.

`sync-secret-service` uses `dbus-secret-service` over libdbus. It links
`libdbus-1` (installed everywhere; the `-dev` package is a build requirement) and
does no async work, so the existing blocking `keychain::{store, read, clear}` keep
their shape.

*Alternatives:*

- **`async-secret-service`.** It pulls in zbus with a runtime feature and runs its
  blocking facade on that runtime. `integrations/provider.rs` calls the keychain
  from inside Tauri's tokio commands, where nesting a runtime panics.
- **`linux-native` (kernel keyutils).** It does not survive a reboot.

Failure direction: with no Secret Service provider (a bare window manager with no
gnome-keyring or KWallet), `set_password` fails. The existing `refused()` turns
that into *The keychain refused: …* on the connection card, and no connection is
recorded. The user-facing word becomes *keyring*. A locked keyring raises the
provider's own unlock prompt.

### 4. The bundled runtime is `remocn-studio-bun`

`externalBin` becomes `binaries/remocn-studio-bun`. A `.deb`/`.rpm` installs
sidecar binaries beside the main one in `/usr/bin`, so a sidecar named `bun` would
collide with a distribution's or a user's `/usr/bin/bun`. `spawn::shipped_bun`
looks for `remocn-studio-bun` beside the executable. The re-execed hosts already
use `process.execPath`, so they follow without change.

What the sidecar starts still asks for `bun` by name: a turn's `bun add`, which the
conventions send to the project's own package manager (bun for a new project), and a
project's own scripts. Before the rename the core put the runtime's dir first on the
sidecar's `PATH`, and `Contents/MacOS/bun` answered. So `spawn::bun_dir` names the
dir to put first: the runtime's own when the file is already called `bun`, else
`<data dir>/bin` with a `bun` symlink to the runtime. The link is checked on every
launch, because an AppImage mounts at a new path each time, and replaced by a rename
so a second instance never finds it missing. A failure is a line in the sidecar log,
not a failed launch. The renamed runtime's own dir is no longer put on the `PATH`: on
a `.deb` it is `/usr/bin`, which would go ahead of everything the person set.

`scripts/fetch-bun.ts` maps:

- `x86_64-unknown-linux-gnu` → `bun-linux-x64-baseline`
- `aarch64-unknown-linux-gnu` → `bun-linux-aarch64`

It writes `binaries/remocn-studio-bun-<triple>`. x64 takes the **baseline** build
because the default one requires AVX2 and dies with SIGILL on older CPUs. A
desktop app cannot choose its CPU, and the sidecar is I/O bound.

### 5. One list of where CLIs live

There is one home-relative list, plus the system dirs, in two places that must
agree:

- `sidecar/agent/cli.ts` exports `USER_BIN_DIRS`. The four `cli.ts` files and
  `package-manager.ts` use it, and keep only their own extras (`.claude/local`).
- `src-tauri/src/sidecar/spawn.rs` has the same list. From it the core builds the
  `PATH` the sidecar and every agent CLI inherits.

The list is `.local/bin`, `.bun/bin`, `.npm-global/bin`, `.volta/bin`,
`.local/share/mise/shims`, `.asdf/shims`, `.local/share/pnpm` and `.yarn/bin`,
`Library/pnpm`, then `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin` and
`/usr/sbin`. `$NVM_BIN` is added when it is set. One list serves both platforms: a
dir that does not exist on this one is never matched.

The new dirs are **appended, never put ahead**. The core searches `~/.bun/bin`, the
`PATH` it was given, Homebrew and the system dirs — the order it always had, and the
one `sidecar/supervision` states — and only then the rest of the home dirs and
`$NVM_BIN`. The package managers' lookup keeps its own home dirs ahead of `PATH` as
before and appends the rest. A dir added for a launcher's minimal `PATH` therefore
finds a tool nothing earlier had, and never displaces one that was found before: put
first, an asdf or mise shim with no version set answers `node` with an error where
Homebrew's node used to run. The price is on Linux: started from a desktop entry, a
distribution's `/usr/bin/node` wins over a version manager's node.

A launcher started from a `.desktop` file gets the session's minimal `PATH`. These
dirs are where the agent CLIs and Node actually are, so this is the difference
between "Claude Code is not installed" and a working turn. A sidecar test reads
`spawn.rs` and fails when the two lists differ, the same way
`shared/protocol.test.ts` guards `PROTOCOL`.

*Alternative:* adopt the login shell's `PATH` (`$SHELL -ilc 'echo $PATH'`) at
startup. It costs a shell start on every launch and hangs on an interactive rc
file. It was kept as an open question rather than taken.

### 6. Terminal: the person's, found in order

`terminal.rs` keeps the macOS block under `cfg` and adds a Linux one. It tries, in
order:

1. `$TERMINAL`;
2. `xdg-terminal-exec`;
3. `x-terminal-emulator`;
4. the first of `kitty`, `alacritty`, `foot`, `ghostty`, `wezterm`, `kgx`,
   `gnome-terminal`, `konsole`, `xfce4-terminal`, `tilix` and `xterm` found on the
   search dirs.

The terminal is spawned detached with no arguments, which opens an empty window in
the home folder, and is not waited on. The core owns the choice; the Tauri command
`open_terminal` keeps its signature. When nothing is found it returns *No terminal
was found. Set $TERMINAL to the one you use.*, which the checklist already shows
under the steps. The hint after pressing becomes *Ctrl+Shift+V, then Enter*,
because Linux terminals paste with Shift.

### 7. Install Node.js opens a page on Linux

On Linux the Node row's button calls `openUrl("https://nodejs.org/en/download")`
through the opener plugin, which `opener:default` already allows for https, from the
webview. A failure is a `causeMessage` sentence in the checklist's own error line,
with the address shown, and a line under the button names the distribution's package
manager and version managers. On macOS the row keeps fetching the official `.pkg`
through `node.install` and opening it. `useEnvironment` and the checklist branch on
the platform; the `node.install` handler refuses off `darwin`, so the contract and
`SIDECAR_PROTOCOL` are unchanged.

*Alternative:* download the official `node-*-linux-*.tar.xz` and unpack it. The
spec forbids installing Node quietly into the home folder, and doing it into
`/usr/local` needs `pkexec`. Distributions package Node anyway.

### 8. Updates: the same updater on both

`tauri-plugin-updater` 2.10 installs an AppImage by replacing the file, and a `.deb`
or `.rpm` through `dpkg -i` or `rpm -U` after asking for administrator rights, picking
the format from how the running build was bundled. So the plugin, its capability,
`plugins.updater` and `createUpdaterArtifacts` stay as they are, and the Linux release
jobs sign their bundles with the same `TAURI_SIGNING_PRIVATE_KEY` and merge their
entries into the same `latest.json`. `hooks/use-updates.ts` is unchanged.

A build the updater cannot replace does not ask. `studio_build` answers
`updatesInPlace`, which is `tauri::utils::platform::bundle_type().is_some()`: the
marker tauri-bundler stamps into the binary (`__TAURI_BUNDLE_TYPE_VAR_DEB` and so
on), always the `.app` on a Mac. A distribution's package — the AUR's
`remocn-studio-bin` first — repacks the release's `.deb` and clears the marker,
because with `DEB` the updater would run `pkexec dpkg -i` over files pacman owns,
then fall back to a zenity password prompt and `sudo`. Cleared, the plugin is not
safe either: with no marker it falls through to `install_appimage` and tries to put
the AppImage in place of `/usr/bin/remocn-studio`. So `useUpdates` treats a
markerless production build like a development one — no launch check, `check`
refuses, *Check now* is unavailable — and says the package manager brings the
updates.

The plugin looks the platform up in `latest.json` before it compares versions
(`get_urls` runs ahead of the comparator), so a release without this platform's
entry fails every check, current or not. That is every release before the first
Linux one, and any release whose Linux job fails after the macOS jobs published.
`checkFailure` words the plugin's two `platforms` messages as *The newest release
has no build for this system yet*, and a failed check no longer reads as *This is
the newest release*.

*Alternative:* leave the updater off on Linux. Every Linux person would then be told
to fetch new versions by hand, for no gain: the key and the manifest already exist.

### 9. Wording, read from the platform helper

A Mac keeps every word it had; Linux reads the general sentence. Each line is read
from the platform — `useIsMac()` in a component, which answers true until mounted
(what the prerendered page carries, so a Mac never sees a word change), and a
`platform` argument defaulting to `currentPlatform()` in `lib/`:

| macOS (unchanged) | Linux |
| --- | --- |
| "Follows macOS" | "Follows the system" |
| "…whenever macOS asks to reduce motion" | "…whenever the system asks to reduce motion" |
| "Nothing leaves this Mac…" | "Nothing leaves this computer…" |
| "macOS asks once…" | the desktop's notification service |
| "this Mac's keychain" | "your system keyring" (`keyringName()`) |
| "macOS did not allow the studio…" | "The system did not allow the studio…" |
| "an empty Terminal window" | "an empty window of your terminal" (`terminalOpenHint()`) |
| the `macOS` fact row, `15.5` | `System`, `Ubuntu 24.04.1 LTS` |
| `macOS 15.5` in feedback | `System: Ubuntu 24.04.1 LTS` |
| "Show in Finder" | `Show in ${fileManagerName()}` |
| `⌘−`, `⌘0`, `⌘+` in `canvas-preview.tsx` | `Ctrl+…` through `modKeyCombo` |
| Hotkeys footnote: "…Use Ctrl instead of ⌘ on Windows." | "Shortcuts follow your platform." |

The two shortcuts that read `metaKey` alone — ⌘⌫ on a video or chat row and ⌘Z
after a canvas deletion — read `isModKey()`, which is ⌘ on a Mac and Ctrl
elsewhere; on Linux the Super key belongs to the desktop.

On macOS, *Grant permission* still opens the studio's row in System Settings once
macOS has refused. On Linux the desktop's notification service has no such row, so
it only re-requests, and the line names the desktop's own settings.

`commands.rs` keeps `sw_vers` on macOS, answering the bare version as before, and on
Linux reads `/etc/os-release`, falling back to `/usr/lib/os-release`. It answers
`PRETTY_NAME`, else `NAME VERSION_ID`, else `unknown`. The field stays `os`, so there
is no IPC change.

`test/register-dom.ts` keeps the macOS user agent, so every test that does not say
otherwise covers the platform the studio has always shipped on. A test of a Linux
branch switches with `withAgent(LINUX)` from `test/user-agent.ts` and puts `MAC`
back afterwards. `platform.test.ts` keeps testing all three platforms by argument.

### 10. Consent location

On macOS `crash::data_dir_for` keeps answering
`~/Library/Application Support/<identifier>`. On Linux it answers `$XDG_DATA_HOME/<identifier>` when
`$XDG_DATA_HOME` is absolute, else `$HOME/.local/share/<identifier>`. This is the
same directory `app_data_dir` resolves, which is where the webview's store writes
`settings.json`. Unknown platforms still answer `None`, so they fail toward
sending nothing.

### 11. Deep links

Packaged `.deb`/`.rpm` builds carry the scheme in their `.desktop` file through
the bundler. An AppImage has no installed `.desktop`, so `setup` calls
`deep_link().register_all()` on Linux only when `app.env().appimage` is set. A
failure is logged and does not stop the launch. Development builds do not
register, so the debug binary never claims the scheme on the developer's machine.

### 12. Packaging and CI

`bundle.targets` stays `"all"`, which is the `.app` and `.dmg` on macOS and the
AppImage, `.deb` and `.rpm` on Linux; `bundle.macOS` is untouched and `bundle.linux`
is added beside it. Remotion footage in the Player plays through WebKitGTK's
GStreamer backend, so the Linux bundles carry it:

- AppImage: `appimage.bundleMediaFramework: true`.
- `.deb` depends on `gstreamer1.0-plugins-good`, `gstreamer1.0-plugins-bad` and
  `gstreamer1.0-libav`.
- `.rpm` depends on `gstreamer1-plugins-good`.

`publish.yml` keeps the macOS jobs as they are and adds a `release-linux` matrix
after them: `ubuntu-22.04` for x86_64 and `ubuntu-22.04-arm` for aarch64. The oldest
glibc the AppImage then needs is 22.04's. It installs WebKitGTK, libdbus, patchelf
and GStreamer, and runs `tauri-action` with `--bundles appimage,deb,rpm`, the updater
signing key and `uploadUpdaterJson`. It waits for the macOS jobs (`needs`), because
tauri-action merges `latest.json` by reading the copy already on the release and two
writers at once drop a platform; `!cancelled()` still releases Linux when a macOS job
fails. `dev.yml` gains a `rust` job (`cargo check --features crash-reports` and
`cargo test`) on `ubuntu-22.04` and `macos-latest`, since each platform has code the
other never compiles.

## Risks / Trade-offs

- **[WebKitGTK is not WKWebView]** WebGL (the title-bar shader), WebCodecs h264
  (`lib/studio/proxy.ts`), autoplay and media codecs differ.
  → The shader and the proxy already probe and degrade. Footage playback depends on
  the GStreamer plugins listed in decision 12. A runtime checklist in `tasks.md`
  covers each.
- **[Ctrl+Alt+↑/↓ is a workspace switch on some desktops]** The desktop eats it
  before the webview sees it.
  → The palette still reaches previous and next video. Changing the key is a later
  spec change, not a blocker.
- **[A tiling window manager ignores minimise/maximise]**
  → Silent by design; the band and the controls still render.
- **[No Secret Service on a bare window manager]**
  → The refusal reaches the connection card as a sentence. Docs name gnome-keyring
  or KWallet as a requirement.
- **[A deb/rpm update asks for administrator rights]** The updater installs the
  package with `dpkg -i` or `rpm -U`.
  → The prompt is the platform's own; an AppImage updates without one.
- **[A change breaks the platform its author did not run]**
  → The `rust` CI job compiles the core on both; the webview tests run as macOS by
  default and cover each Linux branch by switching the user agent.
- **[The search-dir lists drift between Rust and TS]**
  → The parity test in decision 5.
- **[Software GL makes Linux exports slower than Mac ones]**
  → Already the spec'd behaviour off macOS and Windows; a project can choose a
  backend in its Remotion config.

- **[The AppImage cannot be built on this Arch machine]** Measured on
  2026-10-02, there were two failures. linuxdeploy's bundled `strip` rejects
  `.relr.dyn` sections; `NO_STRIP=true` gets past it. Then
  `linuxdeploy-plugin-gtk` copies `gdk_pixbuf_binarydir`
  (`/usr/lib/gdk-pixbuf-2.0/2.10.0`), which gdk-pixbuf 2.44.7 no longer installs
  because loading moved to glycin.
  → The release AppImage is built on Ubuntu 22.04 (gdk-pixbuf 2.42, no RELR),
  where neither happens. Locally, `--bundles deb,rpm` succeed: the `.deb` carries
  `usr/bin/remocn-studio-bun` and a desktop entry with
  `MimeType=x-scheme-handler/remocn-studio;`. Its unpacked `usr/` tree runs in
  place, because Tauri resolves resources at `<exe>/../lib/<productName>` first.
- **[The bundler's desktop entry had no `%u`]** The default template wrote
  `Exec=remocn-studio`, so a launcher had no field code through which to hand
  the app a `remocn-studio://` link.
  → `src-tauri/linux/remocn-studio.desktop` is the `desktopTemplate` for deb and
  rpm, with `Exec={{exec}} %u` and the scheme's `MimeType`.

- **[Runtime checks of task 9.3, measured 2026-10-09]** A release `.deb` of
  `linux-runtime-fixes`, run in place and as the installed AUR package, on Omarchy
  (Hyprland 0.56, Wayland), webkit2gtk-4.1 2.52.6, quickshell as the notification
  service, gnome-keyring 50. Driven through WebKitGTK's remote inspector on a
  headless output so the desktop kept its focus.
  - (a) The band, shader and controls render; Close raises the quit guard mid-turn
    and *Keep working* keeps the turn. Maximise and the band's double-click do
    nothing here because Omarchy sets `suppress_event = "maximize"` on every
    window; minimise does not exist on Hyprland. Dragging and edge resizing were
    not exercised (no pointer could be synthesised). **Still to check on GNOME or
    Plasma.**
  - (b) No menu bar; Ctrl+K, Ctrl+B, Ctrl+E, Ctrl+, , Ctrl+Shift+R and Ctrl+Shift+S
    work with the caret in the composer.
  - (c) The Secret Service backend round-trips across processes and `secret-tool`
    sees the entry under the service name; a rejected ElevenLabs key is worded and
    stores nothing. A real key surviving a restart was not tried (no key).
  - (d) `open_terminal` spawns `$TERMINAL`, and with it unset `xdg-terminal-exec`,
    detached, without arguments, in the home folder.
  - (e) Not reachable: a bun project needs no Node, so the Node row never shows.
  - (f) The OS reads `Omarchy`; the check failed with the plugin's raw `platforms`
    message, now worded (decision 8).
  - (g) A Claude Code turn ran and edited the project, from the session `PATH` and
    with providers still found from a bare `/usr/local/bin:/usr/bin:/bin`.
  - (h) An mp4 export finished (H.264 1920×1080, 150 frames, swangle) and Snapshot
    attached its still. Footage was not tried: this host lacks gst-plugins-good,
    -bad and gst-libav. **Still to check.**
  - (i) The notification is posted (`Notify` with app `remocn-studio`, the video's
    name and *The turn finished.*), but with no actions and no hints, so on most
    desktops a click cannot bring the window forward. **Open.**
  - (j) A second launch with a `remocn-studio://` argument reached the running
    instance, which worded the unknown route.
- **[A new project's checklist read the folder mid-scaffold]** It reported all
  dependencies missing while the scaffold was installing them, offered a second
  install, and stayed until Recheck. `isSettingUp` holds the checklist until the
  scaffold stops running, as `previewTarget` already held the preview.

## Migration Plan

There are no users of a Linux build yet, and nothing in history or settings
changes shape on either platform. The sidecar protocol is unchanged. The bundled
runtime is renamed `remocn-studio-bun` on macOS too, so run `bun run bun:fetch`
after pulling; the core makes `<data dir>/bin/bun` itself on the next launch. Rollback is reverting the change; there is no data to convert.

## Open Questions

- Whether the login shell's `PATH` should be adopted at launch in addition to the
  fixed list (decision 5). This can be measured after the list ships.
- The exact `.rpm` package names for libav on Fedora versus openSUSE. The `.rpm`
  depends only on plugins-good until this is checked on each.
