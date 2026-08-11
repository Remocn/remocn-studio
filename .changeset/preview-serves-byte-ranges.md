---
"remocn-studio": patch
---

Video and audio play in the preview.

A composition that reached for a clip through `staticFile()` played in
`npx remotion studio` and hung on the Player's buffering spinner here. The
preview's own static server answered every request with `200` and the whole
file, chunked, with no `content-length` — and the macOS webview will not start
a `<video>` on that. It probes with `Range: bytes=0-1` first, and a response
that is not `206` ends the attempt; `OffthreadVideo` defaults to
`pauseWhenBuffering`, so a clip that never became playable read as a preview
loading for ever rather than as anything failing.

The server now answers byte ranges: `accept-ranges`, a real `content-length`,
`206` with a `content-range` for a range it can serve, `416` for one past the
end, and no body for a `HEAD`. Range parsing is a pure function with its own
tests, since it is the half that has edge cases. `.mov`, `.aac` and `.ogg` also
gained the media types they were missing — the library accepts all three, and
they were being served as `application/octet-stream`.

Files under `public/` are also cacheable now. Playing a scene means seeking the
video element once per frame, and every seek against a `no-store` response is a
refetch — as was the whole file on each loop. They carry `no-cache` and an ETag
of size and mtime instead, so the webview keeps the bytes and revalidates, and a
clip the agent replaces still invalidates. `bundle.js` keeps `no-store`, where a
cache hit outliving a rebuild is the failure that matters.
