## ADDED Requirements

### Requirement: A newly inserted shader opens its own controls

After a matching insertion acknowledgement the webview SHALL select the new instance and open Inspect with its versioned controls and saved defaults. An existing shader SHALL be selectable from the object catalogue even when obscured or outside its current display interval. Reset SHALL use that instance's declared defaults and support Undo.

#### Scenario: Insertion is confirmed
- **WHEN** the preview confirms the new shader for the active video and generation
- **THEN** Inspect opens on that instance and every offered control changes its corresponding property

#### Scenario: A shader is hidden behind another shader
- **WHEN** the person selects it through the object catalogue
- **THEN** its own values remain available without selecting the covering instance instead

#### Scenario: A declared control cannot be supported
- **WHEN** a shader's field cannot be edited by this runtime
- **THEN** it is shown with an explanation rather than silently dropped or represented by a nonfunctional control

### Requirement: Shader palettes and dependent controls are explicit

Inspect SHALL offer adding, removing, recolouring and reordering palette entries within the shader's bounds. A completed gesture SHALL produce one managed operation. Dependent controls SHALL remain visible with a reason while inactive and retain their values. Conditional availability SHALL be computed from the instance's current values, including live edits.

#### Scenario: Reordering a palette by keyboard
- **WHEN** the person moves a colour using the keyboard alternative to dragging
- **THEN** the preview updates in the same way and the completed action has one Undo step

#### Scenario: A palette reaches its maximum
- **WHEN** the number of colours reaches the shader's limit
- **THEN** adding another colour is unavailable with an explanation while existing colours remain editable

#### Scenario: Perlin has one octave
- **WHEN** only one octave is selected
- **THEN** controls that need multiple octaves are unavailable with a reason and become editable again when multiple octaves are selected

#### Scenario: Saving a palette fails
- **WHEN** a palette operation is refused
- **THEN** the existing managed Retry or Discard flow preserves the attempted edit and does not claim it was saved

### Requirement: Shader timing and pattern controls keep their meaning

Inspect SHALL distinguish object opacity, scene-relative display timing and shader-slot order from the scale, rotation and offset of the internal pattern. Timing SHALL display in seconds using the video's frame rate and save on the frame grid. Invalid or out-of-scene intervals SHALL be refused without changing saved values. Order SHALL only affect shaders in the same slot. Exposed numeric bounds, integer steps and enumeration options SHALL follow the selected shader's descriptor.

#### Scenario: Changing pattern scale
- **WHEN** the person changes the shader's pattern scale
- **THEN** its pattern changes while its frame-sized placement remains unchanged

#### Scenario: Changing the display interval
- **WHEN** the person sets a valid start and end within the scene
- **THEN** the shader appears only in that scene-relative interval in preview and Export

#### Scenario: An invalid end is entered
- **WHEN** the end precedes the start or exceeds the scene
- **THEN** Inspect explains the invalid interval and preserves the saved timing

#### Scenario: A shader is brought forward
- **WHEN** the person changes its order in the shader slot
- **THEN** its order among that scene's shaders changes and scene foreground content remains above it
