---
"remocn-studio": minor
---

Footage bigger than the composition previews from a proxy.

A 4K clip made the preview crawl, and the reason was not the one it looked
like. Measured in WebKit on a 15s clip: linear playback of 3840×2160 was almost
fine — 33ms between frames at the median, the hardware decoder keeping up — but
a **seek** cost 59ms against 6ms at 1920×1080, ten times worse. Remotion's
preview seeks constantly: `seekThreshold` is 0.01s while the Player is paused,
so every step, every scrub and every stop on a frame is one, and 59ms is nearly
two frame budgets at 30fps. That is what a clip mounting mid-transition ran into.

So a video asset taller than 1080p now gets a 1080p h264 proxy, made in the
webview with `@remotion/webcodecs` — the encoder is there and configures for
hardware, asked at run time rather than assumed. The preview page and the render
page are served under different static bases: the preview resolves a file to its
proxy, the render page never does, so an export and a snapshot still carry the
original and "content matches the preview" holds everywhere it can be seen. A
1080p file is left exactly as it is, since it already seeks inside a frame.

Matching is by content hash, so one proxy covers every project the asset was
inserted into. Conversion runs 0.58× realtime even with hardware encoding, which
is why it is a background backfill and not a step of saving: the asset is usable
the moment it lands, and until its proxy exists the preview streams the original
— slower to seek, never broken. A webview with no encoder, and a clip already at
the target, both record the decision so it is taken once.
