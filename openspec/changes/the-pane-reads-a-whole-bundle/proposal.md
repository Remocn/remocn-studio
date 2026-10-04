## Why

The first error v1.0.0 reported, REM-642 (Sentry REMOCN-STUDIO-1): the canvas preview's
runtime would not parse — *Unexpected end of script* on one Mac, *Unexpected token ':'.
Expected '}' to end an object literal.* on another — for projects that had compiled. Two
events from two installs, once each, both thrown where the webview inserts the bundle.

The host served `bundle.js` from disk, and webpack rewrites that file in place on every
compile: it truncates it and writes it again in chunks. A compile finishes, the pane is
told, and fetches — and if the agent's next save has started another compile by then, the
read races the write. The pane got a build cut short, or the start of one build joined to
the end of the next. Reproduced against the host's own server with a bundle rewritten the
way webpack writes it: every read under a steady rewrite came back torn, as those same
SyntaxErrors or as a response that never finished; none did once the bundle was answered
from a copy.

On screen that is a version that could not be shown: a failure on the first load, or the
stale notice after a rebuild, and the agent's last change missing until the next compile.

A second, separate fault sat on the line that threw: the webview pointed every
`sourceMappingURL=` it found anywhere in the bundle at the host, so a library that builds
that comment from parts in a string lost its closing quote to the URL encoder and the
whole bundle stopped parsing — every time, for that project. Not what Sentry caught, but
the same symptom, and found while looking.

## What Changes

- The host keeps a copy of the canvas bundle taken when webpack finishes writing it, and
  answers `bundle.js` from that copy: the last build that compiled, whole. A compile that
  fails keeps the previous copy. Everything else under the bundle's base — the source map,
  assets — is still served from disk.
- The webview resolves only the bundle's own closing `//# sourceMappingURL=` line.

## Non-goals

- No retry or integrity check in the webview: the copy removes the cause, and a parse
  failure that remains is a real one worth its report.
- Nothing more goes to Sentry. Crash reports carry no breadcrumbs by design, and the
  bundle's text is the person's project, which never leaves the machine.

## Capabilities

### Modified Capabilities

- `preview/live-preview`: *A rebuild reaches the pane* — the pane loads one whole build.
- `preview/shadow-canvas`: *Native preview is the main workspace* — only the bundle's own
  source map line is rewritten.

## Impact

- **Sidecar**: `sidecar/preview/native.ts` (the copy, taken in the watch callback),
  `sidecar/preview/server.ts` (`bundle.js` answered from it, through the same range
  handling as a file).
- **Webview**: `lib/studio/native-preview.ts` (the source map line).
- No IPC change. Linear: REM-642.
