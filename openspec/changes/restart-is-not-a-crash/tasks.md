## 1. Rust core

- [x] 1.1 In `supervise`, read `restart_requested` when the session ends and skip `crash::note_sidecar_crash` for a requested restart, logging *restarted on request* instead.
- [x] 1.2 Record the session's uptime and the last lifecycle line the sidecar wrote to stderr (`lifecycle_reason`, an allowlist of the sentences `sidecar/serve.ts` leaves with); unit-test the allowlist.
- [x] 1.3 `note_sidecar_crash` takes a `SidecarExit` and sends `sidecar.said` as a tag and `sidecar.uptime_secs` as an extra, the message unchanged.

## 2. Verification

- [x] 2.1 `cargo check`, `cargo check --features crash-reports`, `cargo test --lib sidecar`; add a changeset.
- [ ] 2.2 In a build with crash reports on: Restart from the sidecar popover sends nothing to Sentry and `sidecar.log` reads *restarted on request*; `kill -TERM` on the sidecar's pid from a terminal sends one event tagged `sidecar.said: received SIGTERM` with its uptime.
