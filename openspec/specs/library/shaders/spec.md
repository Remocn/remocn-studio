# library/shaders Specification

## Purpose
Provides a dedicated catalogue of bundled shaders and stable control descriptions so a person can choose a shader for direct insertion and tune the resulting instance.

## Requirements

### Requirement: Shaders has its own searchable catalogue

The webview SHALL list the bundled Shaders category in a dedicated view with names, posters, search and moving hover previews where supplied. The listing SHALL cover the full shipped category, including Paper and custom shaders. Shader-based typography and transitions SHALL remain in their own categories. Cards SHALL use prepared media rather than mounting a live shader for every tile.

#### Scenario: Browsing the shipped catalogue
- **WHEN** the person opens Shaders
- **THEN** the shipped Shaders entries appear as directly addable cards without a Delete action
- **AND** searching filters their names and an empty result names the query

#### Scenario: A clip fails to load
- **WHEN** a card's moving preview cannot be loaded
- **THEN** the card retains its poster or named fallback and remains usable

#### Scenario: Catalogue resources are absent
- **WHEN** the bundled catalogue cannot be found or read
- **THEN** the view explains its empty or failed state and does not offer an insertion it cannot prepare

### Requirement: Shader controls have a versioned description

The sidecar SHALL supply a versioned description for each directly addable shader, identifying its implementation, dependencies, supported controls, defaults, bounds, steps, enumeration options, palette limits and control dependencies. Descriptions SHALL match the shipped implementation rather than unpinned website defaults. Unsupported properties SHALL NOT be advertised as editable.

#### Scenario: Paper and custom implementations differ
- **WHEN** the person selects a shader with its own set of parameters
- **THEN** its controls and defaults correspond to that implementation rather than a generic set inferred from another shader

#### Scenario: A descriptor is invalid or missing
- **WHEN** an entry has no valid compatible control description
- **THEN** its insertion is unavailable with an explanation while other entries remain usable

### Requirement: Existing shader instances retain their authored version

Preparing a shader SHALL preserve the implementation, control description and defaults used by existing instances in the project. An application update SHALL NOT silently replace authored shader files or change saved instances. The sidecar SHALL refuse incompatible resource collisions with a worded recovery explanation.

#### Scenario: A newer Studio opens a video
- **WHEN** the video's saved shader uses an older supported descriptor and implementation
- **THEN** its saved appearance and controls remain tied to that version

#### Scenario: A target resource was edited
- **WHEN** insertion encounters a conflicting authored file at a required path
- **THEN** that file is preserved and insertion either uses an isolated compatible version or reports why it cannot proceed

#### Scenario: An existing descriptor uses different JSON formatting
- **WHEN** the required descriptor already exists with identical JSON data but different whitespace or object-key order
- **THEN** insertion reuses the existing file without rewriting it
- **AND** the preparation journal pins the accepted file's actual bytes so subsequent changes are still detected before activation and during recovery
- **AND** changed defaults, revisions, properties or array order remain incompatible resource collisions
