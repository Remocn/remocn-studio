## Why

REM-152 (REMOCN-STUDIO-5): a webview report arrived as `MediaParserAbortError:
Aborted`, an unhandled rejection from inside `@remotion/webcodecs`. It came from
the background proxy conversion, `convertMedia` in `lib/studio/proxy.ts`. It is
not the failure. It is an echo of one.

When a conversion fails, for example when the encoder or decoder errors or a
frame cannot be processed, the library rejects `convertMedia` with that failure
and then aborts its own controller. Frames already moving through its pipeline
then call `checkForAbortAndPause` and throw `MediaParserAbortError('Aborted')`.
They throw it from a promise chain that nothing awaits once the decoder has been
closed. The real failure reached our handler, which, as specified, wrote it to
the console and left the asset on its original. The echo reached Sentry's global
handler.

So the report carried no cause, and the console line did not carry one either.
`errorMessage` keeps only `.message`, and the library words every such failure
as *Video encoder of track 1 failed (see .cause of this error)*, with the
encoder's own words in `.cause`. The root cause was lost in both places.

## What Changes

- The webview's crash reporter drops a `MediaParserAbortError`. Such an error
  exists only because a conversion was aborted. That conversion's failure has
  already been handled, so the abort is not a crash.
- The proxy's console line follows the `.cause` chain of a failed conversion,
  so it names what the encoder, decoder or frame queue actually reported.

## Capabilities

### Modified Capabilities

- `shell/crash-reporting`: *Only crashes are reported* gains the case of an
  error that echoes an expected failure.
- `library/asset-library`: *Footage too tall to seek previews from a proxy*.
  The reason written to the console for a failed conversion includes its cause.

## Impact

- **Webview**: `lib/studio/crash.ts` (`isStrayAbort` and the `beforeSend`
  check), `lib/studio/proxy.ts` (`reasonOf`), and tests beside each.
- **Shared contract, sidecar, Rust core**: none. No protocol bump, no migration,
  no settings key.

## Non-goals

- **Reporting a failed proxy conversion to Sentry.** It is an expected failure
  that the spec words for the console. Reporting handled failures would change
  what *Only crashes are reported* means, and that change belongs in its own
  ticket.
- **Patching `@remotion/webcodecs`.** The unawaited chain is in
  `videoFrameSorter`, and the fix belongs upstream. A local patch would have to
  be carried across every Remotion bump.
- **Cancelling a conversion when the library pane unmounts.** `proxyFor` does
  not pass an abort signal to `convertMedia`, so interrupting the worker leaves
  the encode running to the end. That is a separate behaviour, and wiring it in
  would produce more of the same echoes, which this change now drops.
- **The webview SDK's default integrations.** `integrations: [...]` in
  `@sentry/react` 10 is merged with the defaults rather than replacing them
  (`getIntegrationsToSetup`). The webview therefore also runs `globalHandlers`,
  which is how this echo was caught at all, plus `browserSession` and
  `httpContext`. The comment there says otherwise. This is recorded as a
  separate finding, not changed here.
