## Why

REM-651: 1.0.0 filed `Error: EPIPE: broken pipe, write` three times as an
unhandled rejection from the bundled sidecar, with a stack ending in
`~effect/Effect/evaluate` → `writeFast (internal:fs/streams:359:38)` → `write`.
Every process the bundle runs (the sidecar, the preview host, the tool host and
the render-config read) writes frames to standard output and log lines to
standard error, and each of those is a pipe to a parent that can leave first.
The core quits. The sidecar exits ahead of its preview host: the third event came
three seconds after REM-650's exit 0. An agent's CLI leaves its tool host behind.

In bun, a write into a pipe whose reader is gone does not throw. It returns false
and the stream emits `error`. With nobody listening, bun raises that as an
unhandled rejection, and crash reporting files it. Nothing in the app was wrong;
a parent had simply left. The process that hit it also carried on: a sidecar
whose stdout is gone but whose stdin is still open keeps working with no way to
answer. Measured: still running eight seconds later.

The ticket's working theory does not hold. It held that a synchronous throw inside
`Effect.sync` became a defect and leaked through a fire-and-forget
`Effect.runPromise`, but the write never throws (see design.md). The two
`runPromise` sites it named are sound as they are. In `project.move`, `move.ts`
awaits the promise. In `acp/turn.ts`, the promise runs `emit` and `record`,
which cannot fail: the first is a write, and the second already tolerates
history errors.

## What Changes

- Every entry point listens for `error` on its stdout and stderr before anything
  else runs, crash reporting included. A write into a pipe with no reader is
  dropped, never raised, so it is never reported.
- The sidecar, the preview host and the tool host each take a broken stdout as
  its reader leaving, and stop the way they do when their input closes. The
  sidecar logs *the host closed stdout*; the preview host logs *preview host
  stopping: the sidecar closed stdout*.

## Capabilities

### Modified Capabilities

- `sidecar/supervision`: gains *A closed pipe is a parent leaving, not a crash*.

## Impact

- Sidecar: `sidecar/pipes.ts` (new: the guard and `untilBroken`),
  `sidecar/index.ts`, `sidecar/serve.ts`, `sidecar/preview/host.ts`,
  `sidecar/tools/host.ts`.
- Shared contract, Rust core, webview: none. No frame changes and no protocol bump.

## Non-goals

- **Teaching the core's lifecycle allowlist the new sentence.** `lifecycle_reason`
  in `src-tauri/src/sidecar/mod.rs` reads the sidecar's last lifecycle line into a
  crash report. The core reads the sidecar's stdout until the process exits, so it
  closes that pipe while alive only if its own reader fails (`read_frames` stops on
  a read error). A report from that rare case says `said: nothing`. Adding the line
  is a follow-up that needs a Mac to compile and test.
- **Wrapping the `runPromise` sites the ticket named**, for the reasons above.
  A defect in `emit` or `record` is a real bug, and reporting it is correct.
- **Saving log lines when stderr is the pipe that broke.** There is nowhere left
  to write them; stdout and the work carry on.
