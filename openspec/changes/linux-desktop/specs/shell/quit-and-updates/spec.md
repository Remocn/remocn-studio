## ADDED Requirements

### Requirement: A Linux build its package manager installed never checks

The studio SHALL update itself only when it runs as a bundle a release ships — the `.app`, or an AppImage, `.deb` or `.rpm` — told by the marker tauri-bundler writes into the binary. A Linux build without it, which a distribution's package clears, SHALL NOT check for updates on launch or on demand, and SHALL say its package manager brings them.

#### Scenario: Running the AUR package

- **WHEN** the studio runs from a Linux package whose binary carries no bundle marker
- **THEN** no check is made, on launch or when *Check now* is called, and the summary reads that the package manager installed this build and brings its updates
- **AND** *Check now* is unavailable with that sentence on it, and neither "The studio checks for updates when it opens" nor the advice about installing is shown

#### Scenario: Running the release's own .deb

- **WHEN** the studio runs from the `.deb`, `.rpm` or AppImage a release ships
- **THEN** it checks once at launch, as any production build does

## MODIFIED Requirements

### Requirement: A missing build reading is not an error

Until the core has answered which build this is, the studio SHALL report that it is waiting for the core rather than showing a transport failure, and SHALL leave the check unavailable. A check that genuinely fails SHALL surface its message where the person asked for the check, and SHALL NOT put a banner on the shell. A release published without a build for this platform SHALL read as a sentence saying so, never as the updater's words about the manifest's `platforms` object, and a failed check SHALL NOT be summarised as this being the newest release.

#### Scenario: No core to ask

- **WHEN** the page runs without the Tauri core
- **THEN** the row reads that it is waiting for the core
- **AND** no error message is shown

#### Scenario: The check fails

- **WHEN** a check fails
- **THEN** its message is shown in the update surface only, and the summary says it could not tell whether a newer build is out
- **AND** the app is otherwise unchanged

#### Scenario: The newest release has no build for this system

- **WHEN** the newest release's manifest carries no entry for this platform — the macOS-only releases before Linux shipped, or one whose Linux job failed
- **THEN** the message says the newest release has no build for this system yet
