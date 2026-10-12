## Purpose

Let people browse the supplied remocn caption styles, preview their motion and reference chosen styles in a message before speech or a transcript is available.

## ADDED Requirements

### Requirement: Captions has a dedicated searchable catalogue

The webview SHALL show all 31 caption styles from the pinned remocn caption set in a dedicated Captions view. Each card SHALL identify its style by title and show a representative poster. Search SHALL filter titles without motion-role grouping. Shared helpers SHALL NOT appear as styles. Bundled styles SHALL have no Delete action.

#### Scenario: Browsing the supplied set
- **WHEN** the bundled resources are available and Captions is opened
- **THEN** all 31 styles are discoverable, including Karaoke, Subtitle and Speaker
- **AND** helper entries are absent and the same caption entries are absent from Components

#### Scenario: Searching without a match
- **WHEN** a title query matches no style
- **THEN** the view shows a named empty search result and clearing the query restores the catalogue

#### Scenario: Bundled resources are unavailable
- **WHEN** the bundled caption set is unavailable or its listing fails
- **THEN** the pane shows an empty-state explanation or a worded error with retry as appropriate
- **AND** the composer draft and other sidebar views remain usable

### Requirement: Caption previews demonstrate the shipped implementation

Each style SHALL have a preview rendered from its supplied remocn implementation using demonstration timing data. The webview SHALL show a muted looping preview after deliberate hover or keyboard focus, keep idle cards still and stop playback when the preview closes. Failed playback SHALL fall back to the poster. Reduced-motion preferences SHALL prevent automatic playback and allow explicit playback.

#### Scenario: A style is previewed
- **WHEN** a person rests the pointer on a caption card or focuses its preview trigger
- **THEN** an enlarged preview demonstrates that style after the preview delay without requiring speech media in the project

#### Scenario: Moving away
- **WHEN** the preview closes
- **THEN** its clip stops playing and other idle cards remain still

#### Scenario: A preview cannot play
- **WHEN** a clip fails to load or decode
- **THEN** its poster and style name remain visible and selecting the style still works

#### Scenario: Reduced motion is enabled
- **WHEN** a person with reduced motion enabled focuses or hovers a card
- **THEN** its poster remains still until playback is explicitly requested

### Requirement: Selecting a caption style adds a composer reference

The webview SHALL add the selected style as an ordinary asset attachment and positional reference in the composer, preserving existing draft content. Selection SHALL NOT send the message, start transcription or modify project files. Existing composer availability rules SHALL apply; speech media SHALL NOT be required to choose a style.

#### Scenario: A style is selected before media exists
- **WHEN** a person with an available composer selects Karaoke without speech media in the video
- **THEN** the composer contains the Karaoke attachment and its asset reference
- **AND** no turn or project write begins until Send

#### Scenario: Multiple styles are selected
- **WHEN** a person selects two different caption styles
- **THEN** both remain referenced in the draft so the person can describe their intended uses

#### Scenario: The same style is picked again
- **WHEN** a style already attached to the draft is selected again
- **THEN** the same attached asset identity is reused without creating a second attachment

#### Scenario: A selection is removed
- **WHEN** the style attachment or its reference is removed
- **THEN** the existing composer removal and renumbering rules apply

#### Scenario: The composer is unavailable
- **WHEN** existing project or chat conditions prevent adding a component
- **THEN** caption selection follows the same disabled state and explanation without silently dropping the selection
