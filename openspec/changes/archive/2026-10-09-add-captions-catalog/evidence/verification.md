# Caption catalogue verification — 2026-10-08

## Implemented and checked

The bundle contains the exact 31 styles at
`d6cd742fa4f3ab0a74fecf2ac93f1542fa2ea8f7` and their `caption-core` dependency.
They round-trip as ordinary component assets, with no motion role or helper card.
Every pre-existing source hash in the old lock is preserved (only the index hash
changes); there are no edits to previously bundled registry source files.

All 31 posters and clips were rendered from upstream examples. Clips total
2,024,653 bytes and posters 505,193 bytes (2,529,846 bytes combined). ffprobe
reports 6 seconds for each clip, 186 seconds in total. The contact sheet
`catalogue.jpg` was visually inspected. The original whole-catalogue render
wall-clock duration was not retained; task 2.2 remains open for that measurement
and a documented representative playback review.

Card and hook tests cover delayed keyboard focus, muted looping, unmount cleanup,
reduced-motion explicit Play, failed playback poster fallback, filtering,
loading/error/retry, locked selection and ordinary component regression. The real
shell integration test in `app/page.test.tsx` selects Karaoke and Subtitle,
repeats Karaoke, checks one attachment per style and the existing draft, and
switches through Components and Shaders. Selection uses the ordinary composer
path; turn tests exercise the trusted asset brief after Send.

The user reported “Проверил - работает” in the running app. This records the
user's successful check, without inferring that every accessibility, restoration
or transcription acceptance scenario was exercised. No development server was
started by the agent.

## Actual local recognition and rendering

A real speech file was transcribed on macOS arm64 using
`@remotion/install-whisper-cpp` 4.0.534, whisper.cpp 1.5.5, `tiny.en`, language
`en`, token-level timestamps and `--no-gpu`. The output contains 23 tokens:
“And so my fellow Americans ask not what your country can do for you ask what
you can do for your country.” The final measured recognition took 607.3 ms,
excluding installation and model download. The earlier independent run took
942.6 ms. The actual audio, timings and source SHA-256 are retained under
`test/fixtures/captions/` with attribution. The publication helper accepts this
output; separate tests reject invalid data, changed media/track, uncovered
segments, existing corrected data and cancelled publication.

The earlier WebGPU probe with `@remotion/whisper-webgpu` 4.0.534 and
`@huggingface/transformers` 4.3.1 terminated its process with
“No supported adapters”. It did not successfully recognize speech. The guide
therefore runs the native probe in a separate process and treats failure as a
reason to use the CPU fallback. No remote transcription service was used.

`REMOCN_CAPTION_RENDER=1 bun test sidecar/preview/caption-render.test.ts` passed:
1 test, 6 assertions, 14.89 seconds for the test. It uses project-local Remotion,
renderer, bundler and captions 4.0.520, the copied Karaoke/core implementation,
and saved real timings. The clip trims 1 second, plays at 1.5× and starts in a
Sequence at frame 30. Repeated out-of-order captures match, frames before/after
the scene are blank, an intentionally broken renderer rejects, and MP4 frame 60
matches the still with average channel difference below 4/255. The test compares
decoded pixels, not encoded PNG bytes. Evidence: `caption-middle.png`,
`caption-start.png`, `caption-end.png`, `captions.mp4`.

Chromium required execution outside the sandbox. Initial fixture-test iterations
caught an incorrectly supplied failure prop and unsupported ffmpeg output/filter
options; those were corrected, and the final test passed. Recognition is absent
from the render fixture. Native Studio Preview/Snapshot verification is still
separate from this Chromium proof.

## Final checks

- `bun run fix` on touched application/tooling/test files: passed.
- `bun run check`: passed, 1,206 files.
- `bun run typecheck`: passed, both app and preview projects.
- Initial touched regression group: 302 passed across 20 files. Added hook/card
  tests and the real-shell caption scenario also passed.
- Final `bun run test`: **3,814 passed, 20 skipped, 0 failed**, 13,720 assertions,
  354 files, 37.63 seconds. Opt-in Chromium/platform tests are not included in
  that total; the caption rendering test was run separately above.
- An earlier full run had 2 shell-test failures plus an unhandled pending query
  (New video/chevron). After the shell mock was extended to answer the bundled
  library request, the final suite passed. No production workaround was added.
- `bun run remocn:check`: passed. Existing registry hashes unchanged.
- `openspec validate add-captions-catalog --strict`: passed.

## Remaining acceptance work

The unchecked tasks retain their full acceptance requirements. No completed
agent chat from speech selection through transcription to Export has been
recorded, including corrected-word reuse on a style change, ambiguous/missing
sources, line-only SRT, denied preparation and cancellation. The scoped guidance,
placement tests and CPU smoke are not substitutes for that agent acceptance run.
Linux recognition and a successful WebGPU recognition run remain unverified.
The user's app check does not establish the entire native Preview/Snapshot,
restoration and reduced-motion acceptance matrix. These limitations are why this
change is not ready to archive as fully verified.

The overlapping shell/role delta text preserves Shaders, adds Captions after it,
keeps both categories out of Components, and retains the sidebar requirement
rename from `add-shaders-to-video`. Reconcile again if that active change moves
before syncing or archiving either change; no main specs were synced here.
