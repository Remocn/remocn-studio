## Context
Six supplied H.264 recordings are 1990×1080, silent, 11–38 seconds long, approximately 21 MiB total. Their frames were inspected to verify chapter mapping. Static Next export serves the desktop webview.

## Goals / Non-Goals
Ship the previously approved dialog using real media, with no dependency on Desktop paths or network. Do not teach basic chat or include REM-398.

## Decisions
- Use existing Base UI modal primitives, a six-item chapter list and one mounted native video. Native controls provide playback, seeking and fullscreen without duplicate custom buttons.
- Remux recordings without re-encoding, stripping metadata and moving the MP4 index to the front. Extract local JPEG posters. Larger application bundle is preferable to offline failures or third-party hosting.
- Pure catalog in lib/studio/onboarding.ts, lifecycle in use-onboarding, playback in use-onboarding-video. Components render hook state.
- Webview owns the `onboarding` setting with `dismissed` and `chapter` fields; old `toursSeen` does not suppress the new introduction. Unknown chapters fall back to Inspect. No protocol bumps or history migrations.
- Auto presentation waits for settings, project, idle work and absence of blocking surfaces. Explicit Settings entry opens above Settings and returns focus to its button. A new blocker temporarily hides an automatically opened overview without recording dismissal. An explicit request from Settings takes precedence so help remains available even during setup problems.
- Persist dismissal and chapter together through serialized writes; report save failures with a retry action rather than silently promising persistence.
- Respect reduced motion with poster/manual play; stop playback on unmount and preference changes. Rejected autoplay retains manual controls. Errors show a poster, short retry message and always-usable chapter navigation.

## Risks / Trade-offs
- Browser DOM tests cannot prove macOS webview playback: verify real playback/fullscreen and focus in the running app.
- Recordings show real app UI and are shipped as provided; no scene changes.
- Bundled media increases download size by approximately 21 MiB.

## Migration Plan
New and existing installations get one overview independent of old tip answers. Closing opts out of future auto display; Settings always reopens the last chapter. Remove old tip renderer, hook, catalog and their obsolete tests.

## Verification
- `bun run fix`, `bun run typecheck`, `bun run check`, focused tests and `bun run build` passed.
- The repository's `bun run test` command passed: 2,853 tests, 11 skipped, zero failures. A separate plain `bun test` run encountered shared test-state failures and was stopped; the prescribed parallel test runner passed.
- All six exported MP4s have exactly one video stream and no audio. All six posters and videos in the static export match their source hashes.
- DOM tests cover modal focus, Escape, outside clicks, Settings re-entry, persistence, media failure and reduced motion. Real macOS webview playback/fullscreen and visual checks at small window sizes remain manual checks; no development server was started.

## Visual revision
Following user review, cap the dialog at 896px, reduce padding and use a single 16px heading. Remove eyebrow, explanatory copy, numbered instructions, duration captions and duplicate playback controls. Keep a neutral selected chapter background with foreground text and consistent weight; use a compact chapter selector below the desktop breakpoint. Retain native video controls, failure retry, navigation and persistence.

## Motion
Use CSS transitions for a 240ms modal entrance with a shorter 150ms exit, an interruptible 240ms chapter highlight, and a 200ms incoming-video fade with an 8px directional hint. Only one video is mounted; there is no delayed media teardown or overlapping playback. Keyboard chapter changes are instant. Reduced motion removes translation and scale while retaining a short fade. Do not stagger the initial content or delay interaction.

## Stills instead of recordings

The recordings went stale as soon as the interface moved on (the canvas, layers rail and export dialog all changed after they were cut), and re-recording six videos for every UI change does not scale. Each chapter is now one WebP still, exported from Paper at 4× and resized to 2400×1303 with `cwebp -q 90` (25–50 KB each; a decoded 7960×4320 frame is ~137 MB of webview memory, and the cover shows three), taken from the running app and composed in the Paper file "Remocn Studio UI" (artboards `Onboarding 01…06`): the parts the chapter is about stay sharp, everything else is blurred and darkened. No callouts, numbers or captions sit inside the picture. A still is re-exported from Paper when the UI changes.

The dialog widens past its old 896px cap, because a still has to be read, not watched (see below for the final width). `use-onboarding-video` is gone; `use-onboarding-still` holds only the failed flag and a retry counter that remounts the image. The six MP4s and JPEG posters are removed from `public/onboarding/`.

## A cover and words

A still alone did not say what to do with it, and a plain list plus a picture did not make anyone want to look. The overview now opens (automatically, first run only) on a cover: the mark, "Welcome to Remocn Studio", and the first three stills dealt as a slightly fanned deck. Settings skips the cover, because a person asking for the overview again wants the content.

Each chapter is a two-column spread: the chapter number and name, a benefit-first title held close to them, and one or two sentences on how, set top-aligned with the still in a 22rem column (about 40 characters a line); the still on the right, inset by the same 32px as the text. The side list is replaced by six progress segments in the footer, which navigate as well (44px-tall hit areas, labelled `01 Inspect & edit` …). The dialog has an explicit width, `min(68rem, 100vw - 2rem)`: with only a max-width, the viewport grid's track grew to the stills' intrinsic 1990px and centred the dialog inside that, off the window's centre. A shader behind the cover was tried and dropped in review, as was a still bleeding to the edge. The copy lives in `lib/studio/onboarding.ts` beside the catalog.
