## Implementation

- [x] Sync the composition, schema and referenced components from the landing.
- [x] Remove the unused shader dependency and update scaffold coverage.
- [x] Add the release changeset and specification delta.

## Verification

- [x] Run focused scaffold/deep-link tests, lint and typecheck.
- [x] Expand and render a fresh welcome project.
- [x] Run the full suite once.
- [x] Build the local app and verify its bundled template.

## Results

- 27 focused tests passed; full suite: 2871 passed, 11 skipped, 0 failed. Lint and typecheck passed.
- A fresh scaffold using Remotion 4.0.520 passed TypeScript and rendered all 570 frames with Cyrillic props.
- The bundled and installed template match the landing composition and its five components.
- Local unsigned 0.8.1 app installed at `/Applications/remocn-studio.app`; prior bundle backed up under `~/Library/Application Support/Remocn Studio/local-build-backups/20260916-202341/previous-bundle`. App launched successfully.
- Browser security blocked the automatic external-protocol navigation. User must press Open in Remocn Studio manually to verify that final handoff. Existing projects intentionally keep their source.
