---
"remocn-studio": minor
---

Remocn Studio now runs on Linux.

- **Install it your way.** Each release has an AppImage, a `.deb` and an `.rpm`,
  for x86_64 and aarch64. The AppImage carries the codecs that footage in the
  preview needs.
- **The window draws its own frame.** Close, minimise and maximise sit at the
  top left of the title bar band. Drag the band to move the window, double-click
  it to maximise, and drag any edge to resize.
- **No menu bar.** Every action is in the command palette (Ctrl+K), and every
  shortcut uses Ctrl.
- **Integration keys live in your system keyring** (GNOME Keyring or KWallet)
  and stay there across restarts.
- **Open in Terminal opens your terminal**: the one `$TERMINAL` names, or the
  first common one installed. Paste with Ctrl+Shift+V.
- **Install Node.js opens the Node.js download page.** Your distribution's
  package manager works too.
- **Your agent's command-line tool is found** in `~/.local/bin`, mise or asdf
  shims, Volta and pnpm, even when the studio starts from your app launcher.
- **Updates come as a new download** or through your package manager. The studio
  does not update itself.
