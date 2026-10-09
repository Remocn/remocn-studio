## Why

The website plays the new welcome video, but Open in Remocn Studio expands an older bundled copy with a dark shader and confetti. Reported in chat on 2026-09-16.

## What Changes

Sync the bundled welcome template and its components from the landing. New projects play the same 570-frame thank-you. Remove the shader dependency from the welcome scaffold.

## Non-goals

- No migration of existing user projects or change to the deep-link protocol.
- No remote template downloads or public release.

## Capabilities

- Modified: `projects/open-template-link`, documenting the welcome template supplied to new projects.

## Impact

Bundled template resources, sidecar dependency list and scaffold tests. No Rust or webview behavior changes.
