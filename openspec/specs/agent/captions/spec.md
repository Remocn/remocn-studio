# agent/captions Specification

## Purpose
Make selected caption styles actionable in an ordinary agent turn by identifying speech, obtaining reliable timing data and applying the supplied renderer while preserving reusable transcripts.

## Requirements

### Requirement: A caption turn uses the selected bundled component

On Send, the sidecar SHALL resolve caption selections from its bundled catalogue, place their registry dependencies through the existing component-copy path and give the agent a caption-specific brief naming the selected implementations. The agent SHALL use those implementations in preference to a generic caption default or a recreated effect. Sending a single caption reference without explanatory text SHALL request its application to the current video's speech.

#### Scenario: A selected style is sent
- **WHEN** a person sends a caption style reference
- **THEN** the agent receives the selected style identity, project-local file locations, missing dependencies and caption preparation instructions
- **AND** demonstration timing fixtures are not copied as the video's transcript

#### Scenario: Files already exist
- **WHEN** a selected style shares files already in the project
- **THEN** placement preserves and reports the existing files
- **AND** the agent resolves incompatible code or packages explicitly rather than silently replacing them or claiming success

#### Scenario: A selected bundle entry is missing
- **WHEN** the referenced style can no longer be resolved
- **THEN** the turn receives a worded explanation that it was not copied
- **AND** the agent does not substitute another style without the person's direction

### Requirement: The agent identifies the speech and style assignment

The agent SHALL prioritize explicitly referenced media and scenes, then inspect the current video's speech. It SHALL proceed when the source and style assignment are unambiguous and ask in chat when they are not. The workflow SHALL NOT invent speech or generate a voiceover merely because a caption style was selected.

#### Scenario: The video has one voiceover
- **WHEN** one style is sent and the current video has one unambiguous speech source
- **THEN** the agent uses that source without requiring a separate source-selection screen

#### Scenario: More than one source or assignment is plausible
- **WHEN** several speech sources or several selected styles have no clear assignment
- **THEN** the agent asks which source or style assignment to use before applying captions

#### Scenario: No speech is available
- **WHEN** no supplied or project media contains usable speech
- **THEN** the agent explains that captions need speech or a suitable timed transcript and requests the missing input
- **AND** it does not insert demonstration text into the video

### Requirement: Missing timing data is obtained within the agent turn

The agent SHALL reuse a suitable source-matched transcript or obtain one through local transcription within the ordinary turn. It SHALL check execution support, respect existing permissions and report preparation progress through chat. Word-animated styles SHALL use word-level timestamps; line timings SHALL NOT be presented as accurate word timings. The agent SHALL NOT silently upload media to a cloud transcription service.

#### Scenario: No transcript exists
- **WHEN** a speech source is known and no suitable transcript exists
- **THEN** the agent prepares local transcription, obtains timed captions and saves validated data before applying the style

#### Scenario: Only line-timed subtitles exist
- **WHEN** an ordinary line-timed subtitle file is supplied for a word-animated style
- **THEN** the agent obtains word timings from the speech source or explains the missing timing data
- **AND** it does not invent equal-duration word timings

#### Scenario: Local transcription is unavailable or fails
- **WHEN** the machine cannot run the available local backends, model preparation fails or the required language cannot be established
- **THEN** the agent explains the reason and a concrete next step in chat, asking for input when needed
- **AND** it preserves valid existing transcript data and does not report captions as completed

#### Scenario: Permission is denied or the turn is stopped
- **WHEN** preparation is denied or the caption turn is cancelled
- **THEN** the workflow respects the existing permission and cancellation rules
- **AND** incomplete output does not replace a valid transcript or become a completed caption result

### Requirement: Transcripts survive style changes and remain bound to their source

The agent SHALL save validated transcripts in the project together with sufficient source identity and timing-origin information to check reuse. Changes to style or placement SHALL reuse valid data. Source changes SHALL invalidate incompatible transcript reuse, while user corrections to a still-valid transcript SHALL be preserved.

#### Scenario: Only the style changes
- **WHEN** a person applies another style to unchanged speech
- **THEN** the agent reuses the saved transcript without retranscribing

#### Scenario: Media changes at the same path
- **WHEN** the source bytes or relevant audio track change despite the same filename
- **THEN** the agent does not silently reuse timings from the previous source

#### Scenario: A corrected transcript is reused
- **WHEN** the source is unchanged and the person has corrected transcript text
- **THEN** changing the style preserves the corrections

### Requirement: Captions follow the authored media timing in every output

The agent SHALL align captions with the actual speech placement, including trims, playback rate and scene offsets, and place them readably within the video. Preview, Snapshot and Export SHALL consume the saved transcript and selected implementation without performing transcription during rendering. The agent SHALL verify representative caption frames and timing before reporting success.

#### Scenario: A trimmed clip starts later in the video
- **WHEN** captioned media is trimmed, retimed or placed after the start of the video
- **THEN** the displayed words follow the audible speech using the appropriate time mapping

#### Scenario: The video is exported
- **WHEN** a captioned video is previewed, captured or exported
- **THEN** each output uses the same saved caption data and renderer without requesting transcription

#### Scenario: The selected style fails to render
- **WHEN** dependencies, caption data or authored integration prevent successful rendering
- **THEN** the failure is visible in the existing preview or chat error path
- **AND** the agent does not report the caption request as successfully completed
