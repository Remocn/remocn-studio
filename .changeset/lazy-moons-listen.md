---
"remocn-studio": patch
---

The sidecar reported itself as `starting` forever after launch, so the first message of a session failed with "the sidecar did not come up in time" and only a manual Restart brought it back. The supervisor published every phase with `watch::Sender::send`, which drops the value and leaves the old one in place when no receiver is alive — and receivers only exist while `wait_ready` is waiting. Every transition before the first request, `ready` included, went nowhere: `sidecar_status` kept reading `starting`, and `wait_ready` then waited 20 s for a change that had already happened. Publishing with `send_replace` stores the phase unconditionally.

The webview no longer depends on catching the status event either: it re-reads the status until the phase settles, so a window that finishes loading after the sidecar came up shows the truth instead of a stale phase, and identical readings no longer re-render.

The composer now follows that phase: Send is refused with an inline restart while the sidecar is down, and a start-up is spelled out rather than spent silently waiting.
