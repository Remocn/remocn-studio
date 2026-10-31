## ADDED Requirements

### Requirement: OpenRouter is a separate audio connection
The studio SHALL verify OpenRouter keys with a read-only account request and retain secrets in the system keychain. Generation SHALL use the selected connection's provider and credentials.

#### Scenario: Add OpenRouter
- **WHEN** a valid OpenRouter key is entered in Integrations
- **THEN** an OpenRouter audio connection becomes available to the agent
- **AND** no secret enters chat or project files

### Requirement: OpenRouter audio uses the appropriate model and endpoint
The studio SHALL support Eleven v4 and v4 Turbo narration, Seed Audio sound effects, and Lyria 3 Pro music. It SHALL validate inputs before paid dispatch and preserve the model and provider in saved audio metadata.

#### Scenario: Generate narration
- **WHEN** narration is requested using an OpenRouter connection
- **THEN** Eleven v4 is the default and v4 Turbo can be selected
- **AND** the selected built-in voice and script are sent through the speech endpoint after approval

#### Scenario: Recover an interrupted request
- **WHEN** an approved generation loses its response
- **THEN** the operation remains inspectable without automatically repeating a paid request
- **AND** incomplete audio is not imported as a successful result

#### Scenario: Reuse generated audio
- **WHEN** the person selects Use in video or regenerates OpenRouter narration
- **THEN** the studio preserves narration intent and the selected connection, model, and voice

### Requirement: Existing ElevenLabs assets remain readable
The studio SHALL retain direct ElevenLabs generation and decode existing operations and library assets without OpenRouter metadata.

#### Scenario: Open an existing library
- **WHEN** a legacy ElevenLabs sound or music asset is read
- **THEN** its provenance and playback remain available
