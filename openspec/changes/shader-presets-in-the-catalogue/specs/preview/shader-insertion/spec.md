## ADDED Requirements

### Requirement: A preset is added as its shader with the preset's values

Choosing a preset card SHALL insert an instance of the preset's shader, labelled with the preset's name and starting from the preset's values, through the same target, preparation, confirmation and recovery as that shader. The sidecar SHALL resolve the preset from the card it was asked for; the webview SHALL NOT supply the values. The project SHALL receive only the resources its shader needs. Reset on that instance SHALL return to the preset's values. Retrying or recovering a preset insertion SHALL resolve to the same instance, whether the request names the preset or its shader.

#### Scenario: Adding a preset
- **WHEN** the person chooses Warp Silk with a scene targeted
- **THEN** a Warp instance labelled Warp Silk is saved in that scene with Silk's colors, shape and speed
- **AND** its properties pane shows Warp's controls set to those values

#### Scenario: The preset's shader is already prepared
- **WHEN** a video already contains a Warp and the person adds Warp Silk
- **THEN** no shader resource in the project is written or replaced, and no package is installed

#### Scenario: Resetting a tuned preset
- **WHEN** the person changes Warp Silk's colors and then chooses Reset shader
- **THEN** the instance returns to Silk's values, not to Warp's defaults

#### Scenario: The commit reply for a preset is lost
- **WHEN** the person retries a Warp Silk insertion whose instance was already saved
- **THEN** the existing receipt and instance are returned without duplication or an "already belongs to a different request" failure

#### Scenario: The sidecar is asked for an unknown preset
- **WHEN** an insertion names a card that is neither a described shader nor a described preset
- **THEN** nothing is prepared or saved and the person sees that this shader cannot be added
