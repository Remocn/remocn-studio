## Context

See proposal.md for why. All measurements below were taken on bun 1.4.2, the
runtime the app ships (`packageManager`), on Linux. Pipe semantics for this case
are POSIX and match macOS.

### What bun does with a write into a pipe whose reader is gone

A probe wrote to `process.stdout` after its parent had closed the read end, and
ran once with a listener on the stream and once without.

- `write()` **returns `false` and does not throw.** A `try`/`catch` around it
  sees nothing, and neither would an `Effect.try` around the `Effect.sync` that
  makes the call.
- The stream then emits `error` with `code: "EPIPE"`, `errno: -32`,
  `syscall: "write"`.
- **With no `error` listener, bun raises it as an unhandled rejection** whose
  stack is `write (unknown)` → `writeFast (internal:fs/streams:359:38)` → the
  caller. Those are the frames in REMOCN-STUDIO-2, down to the line and column.
  The Sentry handler is the listener, so the rejection is reported.
- With any listener, nothing is raised.
- After that one event, the stream reads `errored` true and `writable` false.
  Later writes return `false`, `writableLength` stays 0 and no second event
  fires. Nothing is buffered, so dropping is already what bun does, and the
  guard does not need to touch `write`.
- SIGPIPE does not kill the process; bun ignores it.

A write into a **dead child's stdin**, which the sidecar does to its preview
host and the ACP CLIs, returns `false` and emits nothing. It is not a source.

### The real entry points, before and after

The test spawned `sidecar/index.ts` with its stdout read end destroyed and its
stdin held open, then did the same for `--preview-host` with no environment. The
release bundle `sidecar-dist/main.js` (`bun run sidecar:build`) behaved the same.

| process | `main` | this change |
|---|---|---|
| sidecar | the `ready` frame raised the EPIPE (`~effect/Effect/evaluate` → `runLoop` → `writeFast`); still running after 8 s, killed | logs *the host closed stdout*, exits 0 in about 0.7 s |
| preview host | the `failed` frame raised it from `preview/host.ts:155`; still running after 8 s, killed | logs *preview host stopping: the sidecar closed stdout*, exits 0 in about 0.2 s |

Which process sent which of the three 1.0.0 events cannot be recovered. 1.0.x
carries no debug IDs, because REM-652 landed after the tag. The timing points at
a preview host for the third event: it came 3 s after the sidecar's exit 0, and
a preview host's own parent check runs every 2 s.

## Decisions

### 1. A listener on each stream, installed once, ahead of everything

`guardPipes` in `sidecar/pipes.ts` puts a no-op `error` listener on
`process.stdout` and `process.stderr`. `sidecar/index.ts` runs it before
`startCrashReporting`, for the same reason that one runs ahead of the
entry-point choice: all four entry points are this bundle, so one call covers
them all. It runs before crash reporting because crash reporting's first act is
a write (`crashLine`).

*Alternatives.* A `try`/`catch` around each write, or `Effect.try` in the
channel: it catches nothing, because nothing throws. Wrapping
`process.stdout.write` to drop writes after a break: bun already drops them.
Listening only for `EPIPE` and rethrowing other codes: after any `error` the
stream is errored and unwritable, so the bytes are gone whatever the code, and a
rethrow would only file a report whose stack is entirely inside bun.

### 2. A broken stdout ends the process, the same way a closed stdin does

`untilBroken(outlet, reason)` is an `Effect.callback` that succeeds with
`reason` on the stream's `error`. It joins the existing lifecycle races in
`serve.ts` and `preview/host.ts`, and the tool host's `Promise.race`. So a
process whose reader has left runs its finalizers and exits 0. It no longer
works on with no one listening until the 2 s parent check, a signal, or (for a
tool host) the end of the turn. The MCP stdio transport listens to stdin for
`data` and `error` only, never `end`, so a tool host whose CLI had gone waited
for the sidecar's socket to close.

`untilBroken` checks `errored` before it subscribes. The preview host writes
frames while it boots, before its race starts, and a break during boot must
still end it. The probe covers this: it subscribes after the break and still
gets the reason.

### Ownership and failure direction

Each process owns its own guard; nothing crosses the wire, and there is no new
frame, method, setting or migration. The failure directions:

- **stdout broken:** the process stops and says why on stderr.
- **stderr broken:** log lines are dropped silently, because there is nowhere
  left to write them, and serving continues.
- **Either:** never a crash report, and never a sentence in front of the person,
  because the reader that would have shown one is the thing that left.

When the core is alive and its stdout reader has failed, the sidecar now exits
and is restarted instead of hanging. The core reports that as an exit 0 with
`said: nothing`; see proposal.md, Non-goals.
