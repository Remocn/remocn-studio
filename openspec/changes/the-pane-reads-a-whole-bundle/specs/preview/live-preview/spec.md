## MODIFIED Requirements

### Requirement: A rebuild reaches the pane

When the project's files change and the host recompiles, the native surface SHALL prepare the new runtime out of sight beside the one on screen and swap to it only once it has drawn its first frame, preserving camera, frame, playback state and sound. The canvas SHALL NOT show a loading screen or an empty frame for a rebuild once a version has been shown. When the new version cannot be shown, the previous one SHALL stay on screen with a notice. The runtime the pane loads SHALL be one whole build, the last that compiled, even while a later compile is writing its output. Compile progress arriving after the first compile has settled SHALL NOT replace a playing preview with a progress screen. A compile that succeeds after a failed one SHALL be announced as ready again, so the pane that dropped the player for the compiler's messages mounts it again on its own.

#### Scenario: The agent writes to the project

- **WHEN** a turn edits a file the bundle includes and the host recompiles it
- **THEN** the current version keeps playing while the new runtime loads hidden
- **AND** the canvas swaps to the new runtime at the same frame, playback state and sound once it has drawn, without reloading the app window
- **AND** the studio is told the preview was rebuilt when the swap happens

#### Scenario: Rebuilds arrive faster than a version can draw

- **WHEN** another rebuild is announced while a new runtime is still loading
- **THEN** the loading runtime is discarded and only the latest one is prepared

#### Scenario: A new version cannot be shown

- **WHEN** the new runtime fails to load, throws while rendering, or has not drawn within 30 seconds
- **THEN** the previous version stays on screen and remains playable and editable
- **AND** a notice says the latest change could not be shown
- **AND** the next version that draws replaces it and clears the notice

#### Scenario: Progress after the preview is already serving

- **WHEN** the compiler reports progress once the preview has been served
- **THEN** the pane keeps playing
- **AND** the progress screen is not shown again

#### Scenario: A rebuild fails

- **WHEN** a recompile fails
- **THEN** the pane shows a readable native compilation failure with recovery actions
- **AND** the failure is remembered, so a render pinned to the bundle refuses rather than rendering from a broken one

#### Scenario: A failed rebuild is fixed

- **WHEN** the compile after a failed one succeeds
- **THEN** the studio is told the preview was rebuilt and then that it is ready
- **AND** the pane plays again without Restart being pressed, and no progress screen is left at 100%

#### Scenario: A compile writes while the pane is reading

- **WHEN** the host recompiles while the pane is still fetching the runtime it was told about
- **THEN** the pane receives one whole build, the last one that compiled
- **AND** never a build cut short, nor the start of one build joined to the end of another
