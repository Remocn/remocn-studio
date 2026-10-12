## 1. Catalog and settings
- [x] 1.1 Bundle six verified recordings/posters and define catalog; test lib/studio/onboarding.test.ts.
- [x] 1.2 Implement persistent dismissal, last chapter and blocked/idle/manual opening in use-onboarding; test hooks/use-onboarding.test.tsx.

## 2. Dialog
- [x] 2.1 Implement video playback hook and six-chapter modal; test hooks/use-onboarding-video.test.tsx and components/studio/onboarding-dialog.test.tsx.
- [x] 2.2 Replace tips in provider and Settings; remove obsolete tip implementation and update settings checks.

## 3. Verification
- [x] 3.1 Add changeset and update recording guide to six chapters.
- [x] 3.2 Run fix, typecheck, check, touched tests, full suite once and static build; verify bundled media. Record desktop-only playback/focus checks.

## 4. Stills

- [x] 4.1 Replace the six recordings and posters with Paper-exported WebP stills in `public/onboarding/`; update the README gallery.
- [x] 4.2 Swap the video for a still with a load-failure retry (`use-onboarding-still`), widen the dialog; update `components/studio/onboarding-dialog.test.tsx`.
