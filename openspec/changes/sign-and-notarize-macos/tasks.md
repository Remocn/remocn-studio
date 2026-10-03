## 1. Build

- [x] 1.1 Add `src-tauri/Entitlements.plist` with bun's five entitlements and point `bundle.macOS.entitlements` at it.
- [x] 1.2 Build locally with the Developer ID and the App Store Connect key; confirm `Stapling app...`, `spctl -t exec` accepted, `syspolicy_check distribution` passed, and both `.app` and `bun` carry the five entitlements under the new identity.
- [x] 1.3 Notarize and staple the `.dmg` by hand and confirm `spctl -t open` accepts it.

## 2. Release job

- [x] 2.1 Store the six `APPLE_*` secrets in the repository.
- [x] 2.2 Write the App Store Connect key to a file before tauri-action, pass the `APPLE_*` variables, and add the `.dmg` notarize → staple → re-upload step.
- [x] 2.3 Replace the "Unsigned macOS build" release body.

## 3. Records

- [x] 3.1 CLAUDE.md: the two signatures, the variable names `build` actually reads, the release order and its new duration.
- [x] 3.2 `docs/decisions/updating-in-place.md` and `docs/decisions/the-sidecar.md`: signing is done and what it means for the updater archive and the bundled bun.
- [x] 3.3 Changeset.

## 4. Verification

- [ ] 4.1 First signed release through changesets; install on a clean macOS user from the `.dmg` with quarantine set and confirm no Gatekeeper dialog, a project opens, Export works, sign-in works.
- [ ] 4.2 Update v0.7.0 to the first signed release through the in-app updater and confirm it launches.
