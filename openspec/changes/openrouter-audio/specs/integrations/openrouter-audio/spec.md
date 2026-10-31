## ADDED Requirements

### Requirement: OpenRouter is a separate audio connection
The studio SHALL verify OpenRouter keys with a read-only account request and retain secrets in the system keychain. Generation SHALL use the selected connection's provider and credentials.

#### Scenario: Add OpenRouter
- **WHEN** a valid OpenRouter key is entered in Integrations
- **THEN** an OpenRouter audio connection becomes available to the agent
- **AND** no secret enters chat or project files

### Requirement: OpenRouter audio uses the appropriate model and endpoint
The studio SHALL support Eleven v4 narration, Seed Audio sound effects, and Lyria 3 Pro music. It SHALL validate inputs before paid dispatch and preserve the model and provider in saved audio metadata.

#### Scenario: Generate narration
- **WHEN** narration is requested using an OpenRouter connection
- **THEN** full Eleven v4 is required and alternative speech models are rejected before dispatch
- **AND** the selected built-in voice and script are sent through the speech endpoint after approval

#### Scenario: Recover an interrupted request
- **WHEN** an approved generation loses its response
- **THEN** the operation remains inspectable without automatically repeating a paid request
- **AND** incomplete audio is not imported as a successful result

#### Scenario: Reuse generated audio
- **WHEN** the person selects Use in video or regenerates OpenRouter narration
- **THEN** the studio preserves narration intent, connection and voice, with Eleven v4 for new generation

### Requirement: Existing ElevenLabs assets remain readable
The studio SHALL retain direct ElevenLabs generation and decode existing operations and library assets without OpenRouter metadata.

#### Scenario: Open an existing library
- **WHEN** a legacy ElevenLabs sound or music asset is read
- **THEN** its provenance and playback remain available

### Requirement: Audio direction follows the video
The studio SHALL instruct the agent to plan narration emotion, delivery and sound cues from the actual script, scene actions and timing. New narration SHALL use Eleven v4, including regeneration of an older Turbo asset. Historical assets SHALL remain readable.

#### Scenario: Direct the soundtrack
- **WHEN** narration and sound effects are requested for a video
- **THEN** the agent plans vocal delivery per scene and applies concise inline audio tags
- **AND** effects are planned as separate cues with timestamps, durations and levels relative to narration
- **AND** visual inspection is not reported as verification of audio quality

#### Scenario: Seed is not enabled
- **WHEN** OpenRouter cannot route a Seed Audio request
- **THEN** the failure identifies the model and HTTP status and directs the person to check provider access and terms
- **AND** the studio does not automatically retry or substitute another provider
