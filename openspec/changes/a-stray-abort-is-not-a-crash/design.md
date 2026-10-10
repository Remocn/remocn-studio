## Context

See proposal.md for why. Measured against `@remotion/webcodecs` and
`@remotion/media-parser` 4.0.481, the versions in `bun.lock`, under bun 1.4.2.

### Where the echo comes from

`convertMedia` passes every failure through `abortConversion`, which first
rejects the promise the caller awaits and then calls `controller.abort()`. After
the abort, `checkForAbortAndPause` in media-parser's controller throws
`new MediaParserAbortError('Aborted')`. That is the exact message in
REMOCN-STUDIO-5.

Most call sites catch it. `videoFrameSorter.inputFrame` in `sort-video-frames.js`
does not. It chains `promise = promise.then(() => inputFrame(frame))`, and the
only thing that awaits `promise` is the decoder's next `output`. The abort closes
the decoder, so there is no next output.

A probe drove the library's own `webcodecsController` and `videoFrameSorter`.
The sorter's output was shaped like `reencode-video-track.js`: it waits on the
next stage and then checks for abort. The probe fed it five frames and aborted
while one was in flight. Result: `unhandledRejection: MediaParserAbortError
Aborted`. When it aborted with no frame in flight, nothing was raised, because
the abort empties the sorter's queue. So the echo depends on timing, and a
failure mid-encode is the case that produces it.

## Decisions

### 1. Drop it in the webview reporter's `beforeSend`, by name

`isStrayAbort(hint.originalException)` matches an `Error` whose `name` is
`MediaParserAbortError`. Media-parser's own `hasBeenAborted` matches the same
way, because a worker does not share the class. Matching by name keeps the
1.4 MB chunk out of the crash module.

Every `MediaParserAbortError` comes from an aborted controller. In this webview,
the only controller is the one `convertMedia` creates, and it aborts only after
rejecting with the real failure. Dropping the error therefore loses nothing.

*Alternatives.*
- A `window` `unhandledrejection` listener that calls `preventDefault`: Sentry's
  browser instrumentation wraps `window.onunhandledrejection` and does not read
  `defaultPrevented`, so the event would still be sent.
- `ignoreErrors` in `eventFiltersIntegration`: it matches message strings, and
  `Aborted` is too generic to match on.
- Passing our own controller and swallowing the error at its source: the
  rejection is created inside the library's chain, and nothing outside it can
  attach a handler.

### 2. Follow `.cause` for the proxy's console line only

`reasonOf` joins the messages along the `.cause` chain with `: `. It uses an
error's name when the message is empty, because a WebCodecs `DOMException` can
carry an empty message. It stops after five links, so a cycle ends. It is used
only in `proxyFor`. `errorMessage` stays as it is, because it words sentences
for the UI, and a chain of library messages is not one.

## Failure direction

Proxy conversion keeps its specified behaviour: nothing is shown and the
original plays. What changes is that the console now names the cause. No new
state, wire or setting.
