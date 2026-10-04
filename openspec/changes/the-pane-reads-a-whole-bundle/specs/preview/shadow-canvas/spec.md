## MODIFIED Requirements

### Requirement: Native preview is the main workspace
The main Studio SHALL display a real opened video without an iframe, retaining
its project dependencies. Loading and runtime failures SHALL be visible in the
workspace, and SHALL NOT reload the Studio window. Only the bundle's own closing
source map line SHALL be pointed at the host; the same words anywhere else in its
code SHALL load as written.

#### Scenario: A supported project loads
- **WHEN** the user opens its video in the main Studio
- **THEN** the native surface renders the project's video with playback controls

#### Scenario: Loading fails
- **WHEN** the project's native runtime or styles cannot be loaded
- **THEN** the canvas explains the failure and offers Retry and Restart preview

#### Scenario: The project's code writes a source map comment of its own
- **WHEN** code in the bundle builds the words of a source map comment in a string
- **THEN** the bundle loads and the string keeps its words
- **AND** only the bundle's closing source map line is pointed at the host
