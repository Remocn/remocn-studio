---
"remocn-studio": minor
---

Remocn Studio now runs on Linux as well as macOS.

- **Install it your way.** Each release adds an AppImage, a `.deb` and an `.rpm`,
  for x86_64 and aarch64, beside the macOS `.dmg`. The AppImage carries the
  codecs that footage in the preview needs.
- **It updates itself on Linux too**, whichever of the three you installed.
- **The window draws its own frame on Linux.** Close, minimise and maximise sit
  at the top left of the title bar band, where macOS puts its traffic lights.
  Drag the band to move the window, double-click it to maximise, and drag any
  edge to resize.
- **No menu bar on Linux.** Every action is in the command palette (Ctrl+K), and
  every shortcut uses Ctrl.
- **Integration keys live in your system keyring** on Linux (GNOME Keyring or
  KWallet) and stay there across restarts.
- **Open in Terminal opens your terminal** on Linux: the one `$TERMINAL` names,
  or the first common one installed. Paste with Ctrl+Shift+V.
- **Install Node.js opens the Node.js download page** on Linux. Your
  distribution's package manager works too.
- **Your agent's command-line tool is found** in `~/.local/bin`, mise or asdf
  shims, Volta and pnpm, even when the studio starts from your app launcher.
- **Export folders in your home folder read as `~/…`** on Linux, as on macOS.
