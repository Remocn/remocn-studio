## MODIFIED Requirements

### Requirement: The properties pane exists only while it has something in it

The canvas inspector SHALL be visible by default and docked flush with the right
edge of the preview workspace whenever the canvas has room for it. Where it does
not have room, it SHALL start hidden and SHALL open floating over the canvas
below the toolbar. The inspector SHALL consist of a bar holding its views,
Layers (or the video's details when the object list is unavailable) and
Inspect, above a content area. The active view SHALL be marked; Inspect SHALL be
disabled without a selection. Clicking the active view SHALL hide the
inspector, and clicking another view SHALL switch to it.

The one control that shows and hides the inspector SHALL be in the canvas
toolbar, in the same place whether the inspector is open or closed. The
inspector's own bar SHALL NOT hold a show or hide control. The toggle SHALL
carry the Inspect view's icon, SHALL read as pressed while the inspector is
open, and its hint SHALL say that it shows or hides the layers and properties.
Hidden, the inspector SHALL keep selection and edits. The video SHALL NOT
automatically reframe when the inspector opens or closes.

While docked, the inspector SHALL start below the rulers' band, which SHALL run
unbroken above it without marks, and its bar SHALL sit on the same line as the
canvas toolbar, with rulers shown or hidden.

Export SHALL be in the preview pane's header, in Preview and Docs alike.
Playback controls SHALL remain beside the inspector without overlapping it.
What the properties controls edit belongs to preview/properties-pane.

#### Scenario: Nothing is selected
- **WHEN** the canvas opens or selection is cleared
- **THEN** the inspector shows its Layers view and its bar, with Inspect disabled

#### Scenario: An element with a schema is picked
- **WHEN** an element with editable properties is selected
- **THEN** the inspector shows its Inspect view with the element's properties

#### Scenario: An element with no schema is picked
- **WHEN** the selected element has no tunable properties
- **THEN** the inspector keeps its Layers view and the compact comment card is used

#### Scenario: The inspector is hidden
- **WHEN** the person presses the inspector toggle in the canvas toolbar while the inspector is open
- **THEN** the inspector hides, selection and edits are preserved, and the toggle stays where it was, no longer pressed
- **AND** pressing it again shows the inspector, and the toggle reads as pressed

#### Scenario: The inspector's bar has no show or hide control
- **WHEN** the inspector is open
- **THEN** its bar holds only its views, and the only show/hide control is the toolbar's toggle

#### Scenario: Hiding from the active view
- **WHEN** the person clicks the inspector's active view
- **THEN** the inspector hides exactly as with the toolbar toggle

#### Scenario: The bar lines up with the toolbar
- **WHEN** the inspector is docked, with rulers shown or hidden
- **THEN** its views and the toolbar's controls share one centre line
- **AND** with rulers shown, the rulers' band continues above the inspector with no empty gap between the band and its views

#### Scenario: A narrow canvas
- **WHEN** the canvas has no room to dock the inspector and the person presses the toggle
- **THEN** the inspector opens floating over the canvas below the toolbar, and the toggle reads as pressed

#### Scenario: Exporting from Preview
- **WHEN** the canvas is shown
- **THEN** Export is in the pane header, where it also is in Docs

#### Scenario: The preview is hidden
- **WHEN** the preview is hidden
- **THEN** the inspector is hidden with it
