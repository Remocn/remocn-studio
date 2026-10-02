## ADDED Requirements

### Requirement: The version reads the same on both surfaces

The sidebar's version row and Settings' Updates section SHALL read one state, and SHALL NOT disagree about which build is running or why it is not checked.

#### Scenario: Reading the version

- **WHEN** the person reads the sidebar's version row and then Settings › Updates
- **THEN** both name the same version, and neither offers an update

### Requirement: The build reading waits for the core

Until the core has answered which build this is, the studio SHALL report that it is waiting for the core rather than showing a transport failure, and SHALL leave the check unavailable.

#### Scenario: No core to ask

- **WHEN** the page runs without the Tauri core
- **THEN** the row reads that it is waiting for the core
- **AND** no error message is shown

## RENAMED Requirements

- FROM: `### Requirement: A development build never checks`
- TO: `### Requirement: No build checks for updates`

## MODIFIED Requirements

### Requirement: No build checks for updates

The studio SHALL NOT check for, download or install an update, on launch or on demand, in a development build or a production one. Settings › Updates SHALL say in one sentence how a new version arrives: a development build updates when it is rebuilt, and a production build updates with a new download from the fork's releases or through the package manager that installed it. *Check now* SHALL be unavailable and SHALL carry that sentence.

#### Scenario: Running from a development build

- **WHEN** the studio is a development build
- **THEN** no check is made and the summary reads that this build updates when it is rebuilt
- **AND** *Check now* is unavailable with that sentence on it

#### Scenario: A production build launches

- **WHEN** the studio is a production build
- **THEN** no check is made, on launch or later, and no request leaves the app for a release manifest
- **AND** the summary reads that a new version arrives as a new download or through the package manager, and *Check now* is unavailable with that sentence on it

## REMOVED Requirements

### Requirement: Updates come from the studio's own newest release

**Reason**: The upstream manifest and signing key belong to upstream Remocn. The fork holds no private key to sign its own releases, so a check would either fail or trust a manifest without Linux builds.
**Migration**: A person updates by downloading the newest AppImage, `.deb` or `.rpm` from the fork's releases, or through their package manager. Re-enabling in-app updates is a separate change that brings a fork-owned key.

### Requirement: Download progress is folded into one reading

**Reason**: Nothing is downloaded once the studio no longer installs updates.
**Migration**: None needed.

### Requirement: Installing replaces the build and restarts the studio

**Reason**: The studio no longer installs updates; see the removal of the update check.
**Migration**: Replace the AppImage or upgrade the package, then start the studio again.

### Requirement: A missing build reading is not an error

**Reason**: Its check-failure scenario cannot occur once nothing is checked.
**Migration**: Replaced by "The build reading waits for the core", which keeps the waiting state.

### Requirement: One update reading, two surfaces

**Reason**: No check runs and no release waits, so the surfaces have only the version to agree on.
**Migration**: Replaced by "The version reads the same on both surfaces".
