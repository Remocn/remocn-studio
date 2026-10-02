# Design records

Why the studio is the way it is — the measurements, the failed runs and the alternatives that were
ruled out — one file per area, moved out of CLAUDE.md on 2026-09-11 when OpenSpec became the source of
truth. **These files record decisions; they do not define behaviour.** What the studio does is
specified under [`openspec/specs/`](../../openspec/specs/); a record that disagrees with its spec is
history, and the fifty disagreements known at the time of the move are in
[`drift-2026-09-11.md`](drift-2026-09-11.md).

**These records describe the macOS build this Linux fork came from.** Where Linux diverges — the
frameless window, no menu bar, the Secret Service keyring, the packaging, the updater left off —
the record is `openspec/changes/linux-desktop/design.md` (under `openspec/changes/archive/` once
archived); read the files here for the why, never for a platform fact.

When a decision changes, the change's `design.md` is the new record; append to the file here only if
the reasoning is worth keeping beside the old one.

| Record | Specifies behaviour in |
|---|---|
| [Updating in place](updating-in-place.md) | `shell/quit-and-updates` |
| [Crash reports, with consent](crash-reports-with-consent.md) | `shell/crash-reporting` |
| [The first second](the-first-second.md) | `shell/startup` |
| [The agent seam](the-agent-seam.md) | `agent/providers`, `agent/turns`, `agent/studio-tools`, `agent/design-check` |
| [The sidecar](the-sidecar.md) | `sidecar/supervision`, `sidecar/ipc-contract`, `agent/permissions` |
| [Project → video → chat](project-video-chat.md) | `projects/project-lifecycle`, `projects/videos` |
| [History](history.md) | `history/transcript-store` |
| [The pane never hides what needs you](the-pane-never-hides-what-needs-you.md) | `history/chat-pane` |
| [Turns run in the provider, not in the pane](turns-run-in-the-provider.md) | `agent/turns`, `composer/message-composition` |
| [The next message waits its turn](the-next-message-waits-its-turn.md) | `composer/message-composition`, `agent/turns` |
| [Pasting a picture, and pointing at it](pasting-a-picture.md) | `composer/references` |
| [New projects](new-projects.md) | `projects/project-lifecycle` |
| [Opening a link](opening-a-link.md) | `projects/open-template-link` |
| [What the agent knows](what-the-agent-knows.md) | `agent/knowledge` |
| [One bundle, four runtimes](one-bundle-four-runtimes.md) | `agent/knowledge` |
| [Reading what the pipeline wrote](reading-what-the-pipeline-wrote.md) | `agent/pipeline` |
| [The preview](the-preview.md) | `preview/live-preview` |
| [Footage the preview cannot afford](footage-the-preview-cannot-afford.md) | `library/asset-library`, `preview/live-preview` |
| [Pointing at an element, and commenting on it](pointing-at-an-element.md) | `preview/inspect` |
| [Tuning what you pointed at](tuning-what-you-pointed-at.md) | `preview/properties-pane` |
| [Writing the value into the code](writing-the-value-into-the-code.md) | `preview/write-to-code` |
| [Taking a picture of the frame, and sending it](taking-a-picture-of-the-frame.md) | `preview/snapshot` |
| [Exporting an mp4](exporting-an-mp4.md) | `export/mp4-export`, `export/render-settings-and-browser` |
| [The environment checklist](the-environment-checklist.md) | `projects/environment-checklist` |
| [Tips, not a tour](tips-not-a-tour.md) | `shell/tips` |
| [Signing in, and what a trial card is for](signing-in.md) | `account/sign-in` |
| [The line between Free and Pro](the-line-between-free-and-pro.md) | `account/plans-and-entitlement` |
| [Settings is a page, not a dialog](settings-is-a-page.md) | `shell/settings-page` |
| [The title bar's shader is a preference](the-title-bars-shader-is-a-preference.md) | `shell/layout-and-panes` |
| [Upgrading from the app](upgrading-from-the-app.md) | `account/plans-and-entitlement` |
| [A project installs with its own package manager](a-project-installs-with-its-own-package-manager.md) | `projects/dependency-install` |
| [The asset library](the-asset-library.md) | `library/asset-library` |
| [Entry, emphasis, exit](entry-emphasis-exit.md) | `library/components-and-roles` |
| [The moodboard](the-moodboard.md) | `library/moodboard` |
| [Video and audio in the composer](video-and-audio-in-the-composer.md) | `composer/references` |
| [A track carries its audiomap](a-track-carries-its-audiomap.md) | `library/asset-library` |
| [The library is a grid of cards](the-library-is-a-grid-of-cards.md) | `library/asset-library` |
| [Dragging into the library, or into the message](dragging-into-the-library-or-the-message.md) | `composer/references` |
| [Tagging a file](tagging-a-file.md) | `composer/file-mentions` |
