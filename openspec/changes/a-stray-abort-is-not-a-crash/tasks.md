## 1. Webview

- [x] 1.1 `lib/studio/crash.ts`: `isStrayAbort`, and `beforeSend` answers `null` for it; tested in `lib/studio/crash.test.ts`.
- [x] 1.2 `lib/studio/proxy.ts`: `reasonOf` follows `.cause`, used by `proxyFor`; tested in `lib/studio/proxy.test.ts`.

## 2. Verification

- [x] 2.1 Probe the library's `videoFrameSorter` with an abort while a frame is in flight: `MediaParserAbortError: Aborted` is raised unhandled (see design.md).
- [x] 2.2 `bun run check`, `bun run typecheck`, the touched test files, then the full `bun run test`; add a changeset.
- [ ] 2.3 In a release build with crash reports on: save a clip taller than 1080 lines to the library and make its conversion fail (or wait for one that does). No `MediaParserAbortError` reaches Sentry, and the `[proxy] … was left on its original:` line in the Web Inspector names the encoder's or decoder's own reason.
