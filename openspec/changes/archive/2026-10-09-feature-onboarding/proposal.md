## Why
REM-378 replaces terse tips with demonstrations of Studio tools. The user supplied six silent recordings and explicitly excluded REM-398 on 2026-09-20.

## What Changes
- Six freely navigable chapters, one still each: Inspect, Snapshot, Assets, Components, Brand, Export.
- One automatic introduction after setup and an idle project; dismissal persists and Settings can reopen the last chapter.
- Bundle the stills offline; a still that fails to load offers Retry and never blocks navigation.
- Remove anchored tips.

## Non-goals
No AI-chat/project tutorials, background-work chapter, or future integrations chapter (REM-412 remains separate).

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `shell/tips`: Replace anchored tips with a feature overview.
- `shell/settings-page`: Replace Replay tips with always-available Explore Studio.

## Impact
Webview hooks, components, local settings and static assets. No sidecar, IPC or Rust changes.

