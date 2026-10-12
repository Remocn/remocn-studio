## 1. Sidecar

- [x] 1.1 `sidecar/pipes.ts`: `guard` and `guardPipes` (a no-op `error` listener on stdout and stderr) and `untilBroken(outlet, reason)`, which reads `errored` first; tested in `sidecar/pipes.test.ts`.
- [x] 1.2 `sidecar/pipes.probe.ts`, run by that test under the shipped bun with its stdout closed: unguarded, it shows bun's unhandled rejection; guarded, nothing is raised and a late `untilBroken` still answers.
- [x] 1.3 `sidecar/index.ts` runs `guardPipes` ahead of `startCrashReporting`, covering all four entry points.
- [x] 1.4 `untilBroken(process.stdout, …)` joins the races in `sidecar/serve.ts` (*the host closed stdout*), `sidecar/preview/host.ts` (*the sidecar closed stdout*) and the tool host's `main` in `sidecar/tools/host.ts`.

## 2. Verification

- [x] 2.1 `bun run check`, `bun run typecheck`, `bun run test sidecar/pipes.test.ts`, then the full `bun run test`; add a changeset.
- [x] 2.2 Spawn `sidecar/index.ts`, and then `--preview-host`, with stdout closed, both from source and from `bun run sidecar:build`'s `main.js`: on `main` each raises the EPIPE and is still running 8 s later; with this change each logs its reason and exits 0 in under a second.
- [ ] 2.3 In a release build with crash reports on: open a project with the preview running, quit the app, then press Restart on the helper. No `EPIPE` event reaches Sentry, and `sidecar.log` ends with the sidecar's usual lifecycle line.
