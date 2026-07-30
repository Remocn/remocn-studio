---
"remocn-studio": patch
---

Sidecar runtime and IPC: the Tauri core owns one bun process, supervises it across crashes, and bridges it to the webview over a single typed message contract — request/response plus streaming. The title bar shows whether the sidecar is up, and opens onto its pid, its log file and a restart.

The contract is Effect `Schema`, so every frame crossing a boundary is decoded rather than cast, and both sides are typed from one declaration. Effectful code returns `Effect` with tagged errors end to end: cancellation is fiber interruption, subscriptions are scoped resources, and each sidecar request answers exactly once from a finalizer — so a cancelled or killed request still replies instead of leaving the caller waiting.
