## Why

REM-650: the first crash report from 1.0.0 in production was *the sidecar stopped
unexpectedly: the studio's helper stopped with exit code 0*, with nothing else in
the event. The sidecar exits 0 only when its own race ends: its input closed, the
core's process vanished, or it received SIGTERM, SIGINT or SIGHUP. The one thing
in the app that sends it SIGTERM is **Restart** (the sidecar status popover, the
composer's banner and the command palette), and the supervisor reported every
session that had reached ready as a crash, without asking whether the person had
just asked for it to end. So pressing Restart files an error in Sentry, which the
spec already says it must not: only a sidecar that stops *unexpectedly* is
reported.

The event also carried no way to tell a requested restart from a real exit, so
the cause had to be inferred from the code.

## What Changes

- The supervisor reads `restart_requested` as the session ends. A session that
  ended because Restart was pressed is logged as *restarted on request* and is not
  reported.
- A report that is still sent carries two tags beside the unchanged message: the
  sidecar's own last lifecycle line (`received SIGTERM`, `the host closed stdin`,
  `host <pid> is gone`, or `nothing`) and how many seconds it had been up. Only
  those fixed sentences pass; no other stderr line, which can hold paths, reaches
  the report. The message stays the same so every exit-0 still groups as one issue.

## Capabilities

### Modified Capabilities

- `shell/crash-reporting`: *The sidecar dying is reported by the core, once it
  had been serving* gains a scenario for Restart and says what the report carries.

## Impact

- `src-tauri/src/sidecar/mod.rs`, `src-tauri/src/crash.rs`. No frame, protocol or
  webview change.
