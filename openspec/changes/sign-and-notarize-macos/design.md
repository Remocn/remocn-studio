## Context

Verified against tauri `dev` (`crates/tauri-bundler/src/bundle/macos/{app,sign,dmg}.rs`, `crates/tauri-macos-sign`, `crates/tauri-cli/src/interface/rust.rs`) and measured on the development Mac on 2026-09-14; the full log of the runs is in REM-413.

## Decisions

- **Signing is switched on by environment, not by config.** `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` make tauri-bundler import the `.p12` into a throwaway keychain and sign with it; `APPLE_SIGNING_IDENTITY` is set too so a wrong certificate fails the build instead of signing under another name. `bundle.macOS.signingIdentity` stays unset, so a local build without the variables is unsigned, as before.
- **The bundled bun keeps its five entitlements.** Oven ships `bun` signed with the hardened runtime and `allow-jit`, `allow-unsigned-executable-memory`, `disable-executable-page-protection`, `allow-dyld-environment-variables`, `disable-library-validation` (measured with `codesign -d --entitlements -`). tauri-bundler re-signs every `externalBin` with `codesign --force` and *our* entitlements file, and it applies one file to every target, so `src-tauri/Entitlements.plist` lists exactly those five and the main binary carries them too. Notarization accepted that on the first submission.
- **The `.dmg` is notarized in a step of its own.** The bundler notarizes and staples the `.app`, then only signs the `.dmg`; `spctl -a -t open` rejected the locally built image as "Unnotarized Developer ID". The step after tauri-action submits the `.dmg`, staples it, checks it with `spctl`, and re-uploads it with `gh release upload --clobber`. `latest.json` never references the `.dmg`, so the updater is untouched; the `.app.tar.gz` is made by the bundler from the already stapled `.app`.
- **Order inside the bundler**: sign inside out (bun, then the app binary, then the bundle) → `ditto` zip → `notarytool submit --wait` → `stapler staple` → `.dmg` → `.app.tar.gz` → minisign `.sig`.

## Measured

- First notarization from the new account: 52 minutes in "In Progress"; the second (the `.dmg`) 70 seconds. Not a failure mode, a new-developer review.
- `tauri build` reads `TAURI_SIGNING_PRIVATE_KEY` (text or path), not `TAURI_SIGNING_PRIVATE_KEY_PATH`, and with `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` unset it prompts and dies without a TTY — both after the bundles are on disk. CLAUDE.md corrected.
- OpenSSL 3's default `.p12` encryption fails `security import` with "MAC verification failed"; `-macalg sha1 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES` produces one the keychain accepts. Recorded in REM-413 for the certificate's renewal (it expires 2027-02-01).

## Risks

- A release now waits on Apple; the serial matrix means two notarizations per release. Accepted in REM-10.
- Existing installs update from an unsigned to a signed bundle; the keychain items they created carry the old ACL, so macOS asks once for access. Verified as part of REM-413's release checklist, not here.
