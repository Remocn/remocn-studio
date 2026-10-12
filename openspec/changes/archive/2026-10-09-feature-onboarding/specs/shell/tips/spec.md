## REMOVED Requirements

### Requirement: A tip appears when its feature does, not at first launch
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: One tip at a time, in catalog order
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: Nothing competes with something already asking
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: A tip points at its own anchor, or shows nothing
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: "Got it" is remembered, clicking away is not
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: "Show me" only reveals, and counts as an answer
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: Tips can be replayed from Settings
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

## ADDED Requirements

### Requirement: A six-chapter feature overview replaces tips
The webview SHALL offer Inspect and properties, Snapshot, Assets and stock, Components, Brand and DESIGN.md, and Export, in that order, each with one bundled still of the real Studio interface — the parts the chapter is about in focus, the rest dimmed and blurred — and a short English chapter label, a benefit-first title and one or two sentences on how to use it. It SHALL NOT include project/chat tutorials, background work or unfinished integrations.

#### Scenario: Choosing a chapter
- **WHEN** a person chooses any chapter or uses Back/Next
- **THEN** its still appears in place of the previous one and the chosen chapter is remembered

### Requirement: Introduction waits for an idle workspace
The overview SHALL open automatically only after settings load, a working project opens, setup completes and no task or blocking surface needs attention. Closing via X, Escape, Skip or Done SHALL persist dismissal; an outside click SHALL NOT dismiss it.

#### Scenario: Setup or work in progress
- **WHEN** the project is not ready, settings are loading, Settings is open, or a task/blocker is active
- **THEN** the automatic overview is withheld until those conditions clear

#### Scenario: Returning after closing
- **WHEN** the person closes the overview and restarts
- **THEN** it does not automatically return, even if some chapters were not viewed

#### Scenario: Persistence fails
- **WHEN** saving an overview preference fails
- **THEN** a plain-language notice and retry action remain available

### Requirement: Replay is always available
Settings SHALL offer Explore Studio regardless of previous viewing, project availability or setup problems; an explicit request takes precedence over automatic-show blockers. It SHALL reopen the last selected chapter. Old tip answers SHALL NOT mark this overview dismissed.

#### Scenario: Older installation
- **WHEN** an installation has answered old tips but never dismissed the overview
- **THEN** it receives the new overview once an idle workspace is ready

#### Scenario: Unknown saved chapter
- **WHEN** the stored chapter is unavailable
- **THEN** the overview opens Inspect

### Requirement: A picture never blocks learning
Each chapter SHALL show a single still, bundled for offline use, at the size the stills were made for. Nothing SHALL play, move on its own or advance chapters.

#### Scenario: The picture fails to load
- **WHEN** a chapter's still cannot load
- **THEN** a short notice with Retry replaces it and chapter navigation remains usable

### Requirement: The first showing opens on a cover
When the overview opens automatically, it SHALL first show a cover — the Studio mark, a welcome line and a fanned stack of chapter stills — with Take the tour and Skip. Opening it from Settings SHALL skip the cover and show the last chapter. Previous on the first chapter SHALL return to the cover.

#### Scenario: First run
- **WHEN** the overview opens automatically
- **THEN** the cover is shown, and Take the tour opens chapter one

#### Scenario: Replay from Settings
- **WHEN** the person chooses Explore Studio in Settings
- **THEN** the last selected chapter is shown without the cover

### Requirement: Overview is keyboard accessible and fits the window
The modal SHALL use a wide layout: the chapter's position, title and explanation on one side and its still on the other, the whole dialog centred in the window and never scrolling sideways. Chapters SHALL be chosen from a row of six segments that also shows progress; there SHALL be no side list. Chapter labels SHALL remain readable in both themes with a neutral selected state and constant font weight. The modal SHALL hold focus, support keyboard navigation, restore focus when closed and provide compact chapter selection on narrow windows.

#### Scenario: Closing from Settings
- **WHEN** the person closes the overview opened from Settings
- **THEN** focus returns to Explore Studio


#### Scenario: Chapter transition
- **WHEN** a person chooses another chapter with a pointer
- **THEN** the selection highlight moves to the chapter and its still fades in with a small directional hint
- **AND** keyboard chapter changes are instant and reduced motion removes positional movement
