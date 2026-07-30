---
"remocn-studio": patch
---

In-app updates over this repo's own GitHub releases.

The app asks `releases/latest/download/latest.json` once per launch, offers what
it finds in the sidebar footer, and installs and restarts on request. Download
progress is folded from the plugin's per-chunk events, so the bar reads a real
percentage rather than a spinner.

A `development` build — anything run from `bun tauri dev` — never checks at all.
It has no bundle to replace: the executable sits in `target/debug` rather than
inside a `.app`, which is what the updater resolves the install path from.

Two release-side consequences, both required by the mechanism rather than chosen.
Tagged releases are now published instead of drafted, because a draft's assets
have no reachable download URL for either the manifest or the `.app.tar.gz` it
points at. And the two macOS jobs run one at a time, because `latest.json` holds
a key per platform and is assembled by merging into the asset already on the
release — in parallel both read it before either writes, and one architecture
disappears from the manifest.

Updates are signed with the updater's own minisign key. That is unrelated to
Apple code signing, which this build still does not do.
