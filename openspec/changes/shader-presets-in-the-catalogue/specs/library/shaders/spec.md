## MODIFIED Requirements

### Requirement: Shaders has its own searchable catalogue

The webview SHALL list the bundled Shaders category in a dedicated view with names, posters, search and moving hover previews where supplied. The listing SHALL cover the full shipped category, including Paper and custom shaders and every shipped preset of a shader, each preset as its own card under its own name. Shader-based typography and transitions SHALL remain in their own categories. Cards SHALL use prepared media rather than mounting a live shader for every tile.

#### Scenario: Browsing the shipped catalogue
- **WHEN** the person opens Shaders
- **THEN** the shipped Shaders entries appear as directly addable cards without a Delete action
- **AND** searching filters their names and an empty result names the query

#### Scenario: Presets appear beside their shader
- **WHEN** the person opens Shaders after a remocn update that ships presets of Warp
- **THEN** Warp and each of its presets, such as Warp Silk, appear as separate cards with their own posters
- **AND** searching "silk" finds Warp Silk and searching "warp" finds Warp and all its presets

#### Scenario: A clip fails to load
- **WHEN** a card's moving preview cannot be loaded
- **THEN** the card retains its poster or named fallback and remains usable

#### Scenario: Catalogue resources are absent
- **WHEN** the bundled catalogue cannot be found or read
- **THEN** the view explains its empty or failed state and does not offer an insertion it cannot prepare

## ADDED Requirements

### Requirement: A preset is a checked starting point for its shader

The Studio SHALL describe each directly addable preset by the shader it starts from, its name, and its starting values. Each value SHALL name a control the shader's description declares and SHALL fall within that control's bounds, steps, options and palette limits. A control the preset does not set SHALL start at the shader's own default. The starting values SHALL equal the look the bundled remocn preset ships. A bundled preset the Studio cannot describe faithfully SHALL be excluded from the catalogue with its reason recorded, never offered with altered values. Every bundled preset SHALL be either described or excluded, and that SHALL be checked before release.

#### Scenario: A preset sets some of its shader's controls
- **WHEN** Mesh Gradient Aurora is described
- **THEN** its colors, distortion, swirl and rotation are Aurora's values
- **AND** every other Mesh Gradient control starts at Mesh Gradient's own default

#### Scenario: A preset holds a value outside its control
- **WHEN** a bundled preset sets a control beyond the bounds its shader declares, such as a softness of 1.5 on a control from 0 to 1
- **THEN** it does not appear in Shaders, and the reason is recorded beside the catalogue
- **AND** every other preset and shader appears and can be added

#### Scenario: A preset's bundled source changes upstream
- **WHEN** an update to the vendored remocn presets adds a preset or changes a preset's look without the Studio's description following it
- **THEN** the mismatch is caught before release rather than shipping a card whose look differs from its poster

#### Scenario: A preset's shader has no Studio description
- **WHEN** a bundled preset starts from a shader the Studio cannot add
- **THEN** the preset is not offered, and the check before release names it
