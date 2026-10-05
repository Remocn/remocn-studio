## MODIFIED Requirements

### Requirement: Every turn carries the studio's own conventions

Every turn SHALL append the studio's conventions to the provider's own system prompt: the chat works on exactly one video, its lane is that video's folder under `src/videos/`, `Root.tsx` is never edited, a new scene is a component sequenced with `<Series>` or `<TransitionSeries>` in the video's `index.tsx`, given a short human `name`, and described in `studio.json` by a scene object (definition `scene`, label equal to that name) bound to the scene's root that its objects name as `parentId`, what is reused lives in `src/shared/`, an attached track's audiomap is timing evidence to be confirmed against the rendered mix, and the result stays editable as named components with plain props.

#### Scenario: The video is named

- **WHEN** the chat's video is known
- **THEN** the conventions name that slug, its folder and the composition it registers

#### Scenario: The video could not be read

- **WHEN** the chat's video row cannot be resolved
- **THEN** the conventions omit that one sentence and everything else is unchanged

#### Scenario: References in the message

- **WHEN** the message carries element references or backticked paths
- **THEN** the conventions explain that each element is described in a block at the end of the message, that requested changes are grouped by the component that owns them and are edited in that file, and that a backticked path was picked from the app's own file list

#### Scenario: A scene is sequenced

- **WHEN** the agent adds a scene to a video
- **THEN** the conventions have asked it to name the sequence, add the scene object with the same label bound to the scene's root, and parent the scene's objects to it
- **AND** an object drawn inside another object is parented to that object instead

#### Scenario: A Claude chat keeps the system prompt it started with

- **WHEN** a later turn of a Claude chat resumes the conversation
- **THEN** the provider sends the system prompt recorded on the chat's first turn, so the prompt prefix the provider caches does not change between turns
- **AND** conventions changed by an app update reach that chat only after the provider compacts it, and reach every new chat at once

### Requirement: A turn's briefs ride beside the conventions

A turn SHALL carry, beside the conventions, the briefs describing what the studio already did for it: the assets and media copied into the project, the project's brand snapshot (see `projects/project-settings-and-brand`), and on Pro the active pipeline stage's instructions (see `agent/pipeline`). The briefs SHALL ride in the turn's own message, never in the system prompt, so a brief that changes between turns leaves the system prompt as it was.

#### Scenario: A brand snapshot exists

- **WHEN** the project carries a brand snapshot
- **THEN** the turn is told it is authoritative after explicit instructions from the person, is not to be asked about again, and is never overridden by a moodboard

#### Scenario: No pipeline is active

- **WHEN** no stage is active, or the turn is on Free
- **THEN** no pipeline brief is attached

#### Scenario: A stage moves between turns

- **WHEN** the active stage changes between two turns of one chat
- **THEN** the second turn's message carries the new stage's brief and the system prompt is byte for byte the one the first turn sent
