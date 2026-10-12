# preview/properties-pane Specification

## Purpose
The properties pane: a fourth panel beside the chat and the preview that opens on an element picked in the preview and lets its declared parameters be edited live, so what is being judged is the frame itself. What the person sets either reaches the agent as a request or is written into the code, which `preview/write-to-code` owns.

## Requirements

### Requirement: A geometry gesture is one atomic property edit

A managed operation MAY contain additional field changes on the same object.
The writer SHALL validate every before-value, definition and resulting value
before changing any field, then replace the document once. Reusing an operation
ID with a different set of changes SHALL fail; retrying an identical operation
SHALL remain idempotent. Undo SHALL validate and invert every field together.
The inspector SHALL display each field's pending value and preserve a failed
gesture for Retry or Discard. Discard SHALL restore every affected field. Export
SHALL remain unavailable during a gesture, its save and the preview receipt wait.

#### Scenario: A left-edge resize changes X and width

- **WHEN** a resize commits both coordinates
- **THEN** they share one operation and one file replacement
- **AND** one Undo restores both original values

#### Scenario: One field changes concurrently

- **WHEN** any field's before-value differs from the current document
- **THEN** the whole gesture fails without writing any of its fields
- **AND** its pending values remain available for the existing recovery actions

### Requirement: The pane exists only while there is something in it

The studio SHALL open the properties pane when a picked element resolves to at least one component declaring an editable parameter, and SHALL keep it out of the layout entirely at every other moment. An element that resolves to no such component SHALL instead get the compact comment card anchored over the frame. Closing the pane SHALL restore the values it arrived with.

#### Scenario: An element with editable parameters is picked

- **WHEN** a pick resolves to a component that declares parameters the pane can edit
- **THEN** the properties pane is added to the window as its own resizable panel beside the preview
- **AND** the pane opens on the innermost such component rather than on any ancestor

#### Scenario: An element with nothing to tune is picked

- **WHEN** a pick resolves to no component declaring editable parameters
- **THEN** no properties pane is added
- **AND** the compact comment card is drawn over the frame instead

#### Scenario: The pane is closed

- **WHEN** the person closes the pane, from its × or from Cancel
- **THEN** every value the pane changed is restored in the preview
- **AND** the pane leaves the window

#### Scenario: Inspect is turned off with the pane open

- **WHEN** the person disarms Inspect while the pane is open
- **THEN** the pane stays open on the element it was opened for, with its values still live
- **AND** only Cancel or Add ends it

### Requirement: The chain of components is offered, innermost first

The studio SHALL collect every component around the picked element that declares parameters, order them innermost first, and show one at a time with a switcher. Switching SHALL be a local move that asks the preview for nothing. A link whose whole declaration is framing plumbing SHALL be dropped unless it is the innermost one. The pane SHALL be titled by the name the component declares for itself and subtitled by what it is inside and the file and line it is written at.

#### Scenario: A word inside a component is picked

- **WHEN** the picked element sits inside a markup primitive which sits inside a component with its own parameters
- **THEN** the pane opens on the primitive, and the component is offered in the switcher
- **AND** the switcher is not drawn at all when there is only one link

#### Scenario: Another link is chosen

- **WHEN** the person chooses another link in the switcher
- **THEN** that link's own fields replace the ones on screen with no round trip to the preview
- **AND** edits already made on the previous link are kept and still count towards Add

#### Scenario: The open link is pointed at

- **WHEN** the pane is showing a link
- **THEN** that link's element is boxed inside the preview
- **AND** moving a value does not repaint the box, while switching links moves it

#### Scenario: The component declares no name

- **WHEN** the open component carries no declared name
- **THEN** the title falls back to the component's own name with the markup-primitive spelling stripped
- **AND** the subtitle reads "no source" when there is no file behind it

### Requirement: Every key the component declares is answered

The studio SHALL draw a row for every declared key whose value it can read, and SHALL NOT drop a key in silence. A value that does not match its declared type SHALL be coerced where that is unambiguous and otherwise kept as a read-only row that says so. A key the component's runtime holds no value for at all SHALL be omitted, and a key the declaration marks as belonging to a timeline rather than a property list SHALL be hidden.

#### Scenario: A number is declared as one of a set of text options

- **WHEN** the runtime holds a number for a key declared as a set of text options, and its text form is one of them
- **THEN** the row is drawn as that option and stays editable

#### Scenario: A value with a unit is declared as a number

- **WHEN** the runtime holds a string carrying a unit for a key declared as a number
- **THEN** the row is drawn read-only showing that value, so it is visible and cannot be dragged

#### Scenario: A value nothing can read

- **WHEN** the runtime holds a value that matches none of the declared shapes
- **THEN** the row is drawn read-only, labelled as the value in code, printed safely
- **AND** a value that cannot be printed at all costs its own row and not the whole selection

#### Scenario: A key with no value

- **WHEN** the component declares a key its runtime holds no value for
- **THEN** no row is drawn for it, rather than a row reading nothing

#### Scenario: A label would be prose

- **WHEN** the declared description of a key is longer than 24 characters
- **THEN** the row is labelled with the key's own name, humanised and in sentence case
- **AND** the description is drawn as prose under the control, where it has the pane's width to wrap in

### Requirement: Sections are ordered like an inspector and remember their fold

The studio SHALL group rows by what each key means and draw the groups in one fixed order: Transform, Layer, Typography, Fill, Stroke, Parameters, Entry, Exit, Effects, Timing. A section heading SHALL fold its rows, and the set of folded section names SHALL be remembered as `collapsedPropGroups` in `settings.json`.

#### Scenario: An element opens with many groups

- **WHEN** an element declares keys across several groups
- **THEN** the sections are drawn in that order, with any group the studio does not know about last

#### Scenario: A section is folded

- **WHEN** the person folds a section
- **THEN** its rows are hidden and the count of rows in it is shown on the heading
- **AND** the rows are hidden rather than taken down, so they keep whatever was being typed in them

#### Scenario: Another element is picked

- **WHEN** the person folds a section and then picks another element
- **THEN** that section is still folded
- **AND** a group neither element had is open rather than arriving shut, what is stored being the folded names

### Requirement: Each value is edited by the instrument its kind deserves

The studio SHALL draw one control per row chosen by the key's declared kind: a number as a field that takes a drag, the arrow keys, and typing, painting how far along a bounded value is behind it; a pair that is a place on the frame as a two-dimensional pad; any other two-part value as labelled axes; an easing as a curve editor with presets; a colour as its own text beside a swatch that opens a picker; a true/false as a switch; a set of options as a menu; a picture as a picker over the project's own `public/` folder; and a run of words as a text area. Opacity SHALL read as a percentage and be stored as a fraction.

#### Scenario: A place on the frame is edited

- **WHEN** the key is a translation, a transform origin or a normalised coordinate holding two numbers
- **THEN** it is drawn as one pad whose point moves both numbers at once
- **AND** the pad's vertical axis is mirrored inside its own range, a pad's vertical axis growing upward where all three of those keys measure downward

#### Scenario: An easing is edited

- **WHEN** the key's name ends in easing and it holds four numbers
- **THEN** the curve's two handles are draggable and its four numbers are editable
- **AND** the preview dot runs the element's own window, falling back to 1.8 seconds when the element has no window

#### Scenario: An easing that can only be named

- **WHEN** the key's name ends in easing and it holds one of a set of named curves
- **THEN** the curve is drawn for the named value with its handles inert, the key being unable to hold an arbitrary curve

#### Scenario: A spring's three numbers

- **WHEN** a section holds keys ending in damping and stiffness under one common prefix, with mass optional
- **THEN** the spring's response is drawn above the first of those numbers as a readout
- **AND** the three numbers keep their own controls under it

#### Scenario: A picture is chosen

- **WHEN** the person opens a picture row's picker
- **THEN** the options are the images in the project's own `public/` folder, by the names the code would use
- **AND** the pane holds the name rather than the preview's own URL, and offers no upload

#### Scenario: A two-part value cannot be parsed

- **WHEN** a two-part value is written in a form the studio cannot split
- **THEN** the row falls back to a plain text field rather than guessing at its halves

### Requirement: An edit reaches the frame at once, and says where it lands

The studio SHALL apply every edit to the running preview, coalescing the edits made within one animation frame into one command per key. A key the code animates SHALL keep animating through the edit, with the frame the value was judged at travelling with it, and SHALL be badged in the pane. A key the code computes SHALL still be previewable while the pane is holding a value for it. Where one call site renders several instances, the pane SHALL say that an edit moves all of them.

#### Scenario: A value is dragged

- **WHEN** the person drags a value
- **THEN** the pane holds the new value immediately and one command per key goes to the preview on the next animation frame
- **AND** the frame on screen at that moment is remembered for that key

#### Scenario: An animated key is edited

- **WHEN** the key's value is animated in the code
- **THEN** the row carries an animated badge and the animation keeps running, the edit moving the value it lands on

#### Scenario: Several instances share one call site

- **WHEN** the open component is one of several instances rendered from the same place in the code
- **THEN** the header badges which instance the pane opened on, out of how many
- **AND** the pane says that a change here moves all of them

#### Scenario: The element is not on screen

- **WHEN** a value is set while the element is not on screen at the current frame
- **THEN** the change is refused with a sentence naming the frame and the frames the element runs between

### Requirement: A timing edit replays the element's own window

The studio SHALL schedule one replay of the picked element's own window 250 milliseconds after the last edit to a key in Entry, Exit, Effects or Timing, or to any key whose name ends in easing, and SHALL skip it entirely while the preview is already playing. Picking an element SHALL NOT move the frame. The pane SHALL carry a time strip reading the current frame beside the element's window, a range that seeks within it, and Replay.

#### Scenario: A burst of easing edits

- **WHEN** the person drags an easing handle repeatedly
- **THEN** exactly one replay runs, 250 milliseconds after the last of them

#### Scenario: An edit that changes no timing

- **WHEN** the person edits a colour or a size
- **THEN** nothing is replayed and the frame on screen stays the one being judged

#### Scenario: The element has no timed window

- **WHEN** the picked element sits in no timed scene
- **THEN** the strip shows the frame alone, with no range, and Replay is off with the reason on its tooltip

#### Scenario: The preview is playing

- **WHEN** a timing edit is made while the preview is playing
- **THEN** no replay is scheduled

### Requirement: A refusal belongs to the row that asked for it

The studio SHALL render the preview's refusal of a change under the control that asked for it, roll that control's value back to what it was, and keep the pane open. A refusal naming no key SHALL be rendered once at the foot of the pane. A later success SHALL clear only a refusal recorded for that same key on that same component, and a success for a request the pane never recorded SHALL clear nothing.

#### Scenario: One row is refused

- **WHEN** the preview refuses a change to one key
- **THEN** the message is drawn under that row and the row shows its previous value
- **AND** every other row is unmarked

#### Scenario: Another row then succeeds

- **WHEN** a change to a different key succeeds while a refusal is showing
- **THEN** the refusal stays where it is

#### Scenario: An untracked success arrives

- **WHEN** a success arrives for a request the pane is not tracking, such as one raised by a reset or a rebuild
- **THEN** the standing refusal is left alone

#### Scenario: The project's runtime cannot apply live changes

- **WHEN** the project's own preview runtime cannot apply parameter overrides at all
- **THEN** the change is refused with a sentence saying so, rather than reverting in silence

### Requirement: A reset names paths, never a whole component

Every reset the studio sends SHALL name the exact keys it is taking back. Resetting the whole selection — Reset all, Cancel, picking another element, a rebuild, or removing the chip from the composer — SHALL cover every link of the chain and not only the one on screen, and SHALL never be sent as an unqualified "drop everything on this component".

#### Scenario: One row is reset

- **WHEN** the person resets a single row
- **THEN** only that key is taken back, on the component that owns it

#### Scenario: Reset all with edits on two links

- **WHEN** the person has edited keys on two links of the chain and presses Reset all
- **THEN** both links' changed keys are taken back, each on its own component

#### Scenario: An ancestor is shared with another chip

- **WHEN** a card is cancelled whose chain includes an ancestor another chip has already added a change on
- **THEN** only the keys this card moved are taken back, and the other chip's change stays live

#### Scenario: Nothing has moved

- **WHEN** a reset is asked for and no value has moved
- **THEN** no command is sent at all

### Requirement: Reverting unsent edits says so, with an undo

When the person picks another element while the open pane is holding unsent changes, the studio SHALL revert those changes, raise a message naming how many were reverted and on which component, and offer an undo for ten seconds. Taking the undo SHALL first abandon whatever card is open, then re-send every reverted value and reopen the card it came from. Cancel SHALL revert without a message, its own tooltip already saying that it restores the original values.

#### Scenario: Picking elsewhere with edits pending

- **WHEN** the person picks a different element while unsent edits are open
- **THEN** those edits are reverted and a message says how many and on what

#### Scenario: The undo is taken

- **WHEN** the person takes that undo
- **THEN** any card opened since is abandoned first, the reverted values are set again, and the earlier card is reopened

#### Scenario: The window closes

- **WHEN** ten seconds pass without the undo being taken
- **THEN** the revert stands and the message is gone

#### Scenario: Edits that were already added

- **WHEN** the pane holds only changes that have already been added to the composer and the person picks elsewhere
- **THEN** nothing is reverted

### Requirement: Add keeps the card and rebases its baseline

Add SHALL hand the pane's changes to the composer, leave the pane open on the same element with the values still live in the frame, empty the comment field, and rebase the baseline to the values just sent, so a second Add carries only what has changed since the first. Add SHALL count every changed key across the whole chain, plus an edited run of words, and show that count on its own button.

#### Scenario: Add with changes on two links

- **WHEN** the person has changed a value on the open link and another on a link they switched away from
- **THEN** the Add button counts both
- **AND** both are handed over

#### Scenario: A second Add

- **WHEN** the person presses Add, changes one more value and presses Add again
- **THEN** the second message carries only the value changed since the first

#### Scenario: The same element is clicked again

- **WHEN** the person clicks the element the pane is already open on
- **THEN** nothing is reverted and the chain is not reopened at its innermost link

### Requirement: Words the runtime cannot hold are asked for instead

Where the project's own runtime exposes no live field for an element's words, the studio SHALL show a Text section above everything else carrying the element's own words, marked as sent to the agent rather than previewed. Editing it SHALL change no pixels, SHALL count as one of the changes on Add, and SHALL reach the agent as a request against the element's own words. Where the runtime does expose a live field for the words, no such section SHALL be drawn.

#### Scenario: A runtime with no text field

- **WHEN** the picked element's innermost component declares no live field for its words
- **THEN** the Text section is drawn with the element's words and the note that it is not previewed

#### Scenario: A runtime with a text field

- **WHEN** the innermost component does declare a live field for its words
- **THEN** no Text section is drawn, the live field being what moves the frame

#### Scenario: The words are edited and added

- **WHEN** the person edits the words and presses Add
- **THEN** nothing in the preview changes, the change is counted, and the agent is asked for it
- **AND** the draft is rebased, so a second message does not ask for it twice

### Requirement: What the agent is asked for is grouped by who owns it

The changes the pane hands over SHALL reach the agent as a list of key, previous value and new value, grouped under a heading naming the component that owns them, the name it declares for itself, and the file and line it is written at. A change whose previous value was sampled from the running preview rather than read out of the code SHALL be marked so the agent is told to move the value the animation lands on rather than pin the frame.

#### Scenario: A chain's changes reach the agent

- **WHEN** a message carries changes made on two different components of one chain
- **THEN** each component's changes sit under their own heading with that component's file and line

#### Scenario: A sampled previous value

- **WHEN** a change's previous value was taken from the running preview at a frame
- **THEN** the line names the frame it was sampled at and says to change the landing value, not the frame

### Requirement: A chip in the composer keeps the whole chain

A selection added to the composer SHALL carry every link of its chain, which of them the message was written from, the baseline values of each, the element's window, its words and the loaded font families. Reopening the chip SHALL restore the pane on the link the message was written from. Removing the chip SHALL reset every link the message carried.

#### Scenario: A chip is reopened

- **WHEN** the person clicks a chip written from an ancestor link
- **THEN** the pane reopens on that link, not on the innermost one
- **AND** the time strip, the words and the font list come back with it

#### Scenario: A chip is removed

- **WHEN** the person removes a chip whose message changed values on two links
- **THEN** both links' keys are reset in the preview

#### Scenario: A rebuild happened first

- **WHEN** the project has rebuilt since the chip was added
- **THEN** the chip is marked stale, and reopening or resetting it does nothing

### Requirement: Managed properties save independently of the composer

For managed objects the pane SHALL show declared controls, save completed edits directly, retain selection across rebuilds and offer conflict-aware Undo. Switching selection SHALL NOT revert saved changes. Pending or failed writes SHALL be distinguished from saved values and prevent an export that would omit them.

#### Scenario: A sibling is picked
- **WHEN** a property is changed and another object is picked
- **THEN** the first edit is saved without Add or Send

#### Scenario: Saving fails
- **WHEN** a property cannot be saved
- **THEN** the pane retains the draft with an actionable error and does not claim success

#### Scenario: The saved file has not reached the compiled preview
- **WHEN** a property has been saved but the runtime has not acknowledged its operation receipt
- **THEN** export remains unavailable and the pane distinguishes this from an unsaved draft

### Requirement: Managed controls use DialKit and preserve gesture boundaries

The pane SHALL render supported fields with the existing DialKit controls, reuse
DialKit sliders for all numeric values, including timing, and group fields by declared group.
The studio SHALL persist collapsed groups using the existing pane preferences.

#### Scenario: Continuous adjustment
- **WHEN** a number or color is adjusted repeatedly during one pointer gesture
- **THEN** preview updates immediately and the completed gesture saves once

#### Scenario: Color notation
- **WHEN** a supported CSS color is entered in the color control
- **THEN** the saved value is normalized to hex without discarding its alpha

### Requirement: Animation controls use seconds and named easing presets

Timing fields with frame units SHALL display seconds using the composition's actual
FPS and save values on their declared frame grid. Timing SHALL remain unavailable
until FPS is known. New generated animations SHALL expose second-based timing and
wired editable easing fields; the pane SHALL visualize recognized named easing curves.

#### Scenario: A frame-based duration is edited
- **WHEN** a 30-frame duration is inspected at 60 FPS
- **THEN** the pane shows 0.5 seconds and saves edits back as frame values

#### Scenario: An easing preset is selected
- **WHEN** the user selects an option of a declared easing enum
- **THEN** its scalar value is previewed and saved through the normal managed operation flow

### Requirement: Rebuilding preserves playback position

The preview SHALL preserve the current frame and playback state when properties
trigger rebuilding, including a full iframe reload. Restored frames SHALL be
clamped to the new duration and SHALL NOT leak into a different composition.

#### Scenario: A property is changed at 13 seconds
- **WHEN** saving triggers a rebuild while preview is paused at 13 seconds
- **THEN** the rebuilt preview remains paused at the corresponding frame

### Requirement: Header actions remain outside the scrolling property list

The managed pane SHALL place its object selector, save status and recovery actions
in an automatically sized header. Only the property list SHALL scroll. The object
selector SHALL use DialKit and preserve stable object IDs as selection values.

#### Scenario: There are many editable properties
- **WHEN** the user scrolls a long list of properties while changes are pending
- **THEN** the header status and Discard action remain separate from the property controls

### Requirement: Custom easing curves are editable as one property

The pane SHALL render easing fields with draggable Bezier handles, coordinate
controls and preset selection. Drafts SHALL update preview and each completed
gesture SHALL save the entire tuple as one operation with checked Undo.

#### Scenario: A custom overshooting curve is edited
- **WHEN** the user edits an easing field to [0.2,-0.3,0.8,1.4]
- **THEN** preview and export use that curve, and Undo restores all four prior coordinates

#### Scenario: An older animation declares an easing enum
- **WHEN** its consumer still expects a named preset
- **THEN** the pane retains preset-only behavior until the document and consumer are explicitly migrated

### Requirement: Managed properties use task-oriented presentation

The header SHALL contain one DialKit element selector, Delete, Undo and close actions with
labels, and compact save status. The body SHALL separate Appearance and Animation
with keyboard-accessible tabs. Generated field labels SHALL be readable English;
stored IDs and explicitly authored labels SHALL remain unchanged. Unknown fields
SHALL remain accessible rather than being discarded by presentation heuristics.

#### Scenario: Editing a heading
- **WHEN** a heading exposes typography, colors, layout and motion
- **THEN** Appearance shows its text, colors and layout while Animation shows timing and motion controls
- **AND** X/Y and width/height can share rows, with secondary text spacing and Bezier coordinates disclosed separately

#### Scenario: Spring controls
- **WHEN** an object exposes a boolean spring switch and physical spring parameters
- **THEN** the physical settings are available while that switch is enabled

#### Scenario: Switching tabs with a draft
- **WHEN** the user switches property categories with pending edits
- **THEN** the edits are committed through the existing managed save path

### Requirement: The header offers Delete, and says when it cannot

The header SHALL offer Delete for the open object, managed or not, with the behaviour of `preview/inspect`. Pending drafts SHALL be discarded rather than saved when the object is deleted. When the open element is one of several instances drawn from one place in the code, the action SHALL read *Delete all N*. When deletion is impossible — a scene, an object not painted at the current frame, an element whose place in the code the studio cannot find, or a managed video on a runtime that cannot remove — the action SHALL be disabled and SHALL say why.

#### Scenario: One of four cards from one line

- **WHEN** the pane is open on the second of four cards drawn from the same call site
- **THEN** the action reads *Delete all 4*, and choosing it removes the line that draws them

#### Scenario: An element with no place in the code

- **WHEN** the open element's call site could not be found
- **THEN** Delete is disabled and says the studio could not find this element in the code

#### Scenario: Deleting with a draft

- **WHEN** a value is mid-edit and Delete is chosen
- **THEN** the draft is dropped, no property operation is written, and the object is removed

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
