## Why

Every macOS release so far has been unsigned. A person who downloads the `.dmg` meets "cannot be opened because the developer cannot be verified" and a right-click workaround the release notes had to explain — the distribution blocker recorded in REM-10. The Apple Developer Program account exists since 2026-09-14 and the Developer ID Application certificate is issued (REM-413), so the release can carry a signature and a notarization ticket.

## What Changes

- `bun tauri build` signs with the Developer ID, notarizes and staples the `.app` whenever the `APPLE_*` variables are present; without them it stays unsigned, as before.
- `src-tauri/Entitlements.plist` carries the five hardened-runtime exceptions the bundled bun ships with, so re-signing it does not strip JavaScriptCore's JIT rights.
- The release job supplies the certificate and the App Store Connect key from repository secrets, and adds one step after tauri-action that notarizes and staples the `.dmg` itself, which the bundler only signs.
- The release body no longer tells people to bypass Gatekeeper.
- CLAUDE.md and two design records describe the two signatures (Apple, minisign) and their order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — this is release tooling. No spec under `openspec/specs` mentions the unsigned state; what the person sees on first launch changes, but no requirement described it.

## Impact

`.github/workflows/publish.yml`, `src-tauri/tauri.conf.json`, a new `src-tauri/Entitlements.plist`, `CLAUDE.md`, `docs/decisions/the-sidecar.md`, `docs/decisions/updating-in-place.md`, one changeset. No IPC, sidecar, Rust, webview or dependency change. Six new repository secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_CONTENT`).

## Non-goals

- The first-run onboarding screen — stays in REM-10.
- Windows and Linux signing (REM-274, REM-275).
- Trimming the entitlement set below bun's five; REM-413 lists that as an optional follow-up once a release has shipped.
