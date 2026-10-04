## 1. Sidecar

- [x] 1.1 In `sidecar/preview/native.ts`, read `bundle.js` in the watch callback after a compile that succeeded, keep it as the build with its generation, and expose it as `script()`; a read that fails is a failed compile
- [x] 1.2 In `sidecar/preview/server.ts`, answer `<base>/bundle.js` from `script()` through `sendBody`, shared with `sendFile`, and 404 before a build has compiled
- [x] 1.3 Tests: the copy outlives a rewrite of the file, survives a failed rebuild, and an unreadable bundle fails prepare (`native.test.ts`); the server answers the copy, a range of it, and nothing before a build (`server.test.ts`)

## 2. Webview

- [x] 2.1 In `lib/studio/native-preview.ts`, rewrite only the bundle's closing `//# sourceMappingURL=` line
- [x] 2.2 Test: a bundle whose code builds the comment in a string loads, keeps the string, and has its own line pointed at the host (`native-preview.test.ts`)

## 3. Wrap up

- [x] 3.1 `bun run check`, `bun run typecheck`, `bun run test`, changeset
- [ ] 3.2 In the running app: have the agent make several quick edits in one turn and watch the canvas follow each without the stale notice; Sentry REMOCN-STUDIO-1 stays quiet on the next release
