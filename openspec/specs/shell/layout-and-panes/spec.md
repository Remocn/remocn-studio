# shell/layout-and-panes Specification

## Purpose
The shape of the window: the sidebar beside the resizable chat, preview and properties panes, how each is shown, hidden and remembered, the Preview and Docs switch in the preview's header, the theme, and the title bar band the shell breathes through, which also carries the window's own controls.

## Requirements

### Requirement: The window is a sidebar beside a resizable group

The window SHALL hold a fixed-width sidebar and, beside it, a resizable group of the chat pane and the preview pane, with the properties pane as a third member of that group while it has something in it. The divider between chat and preview SHALL be draggable, and each pane SHALL keep a minimum width of its own.

#### Scenario: Resizing the panes

- **WHEN** the person drags the divider between the chat and the preview
- **THEN** both panes resize and neither goes below its own minimum width

#### Scenario: The sidebar is not resizable

- **WHEN** the person looks for a divider between the sidebar and the panes
- **THEN** there is none: the sidebar has one width and only ever collapses

#### Scenario: A pane slide is running

- **WHEN** the sidebar or the preview is opening or closing
- **THEN** the preview keeps the width it had until the animation settles
- **AND** the compiled page inside it is not relaid out while the slide runs

### Requirement: A pane layout is remembered per pane combination

The width the person drags the panes to SHALL be remembered across launches, and SHALL be stored separately for each set of panes the resizable group holds — the chat with the preview, and the chat with the preview and the properties pane. A width stored for one set SHALL NOT be read back into another. Hiding the preview SHALL collapse it within the same set rather than storing a layout of its own.

#### Scenario: Coming back to a resized window

- **WHEN** the person resized the panes and relaunches
- **THEN** the panes come back at the widths they were left at

#### Scenario: The properties pane opens

- **WHEN** the properties pane appears beside a chat-and-preview layout
- **THEN** the layout stored for the three panes is read back, not the one stored for two

#### Scenario: Nothing was ever dragged

- **WHEN** the person has never moved a divider
- **THEN** the panes take their default proportions and nothing is stored

### Requirement: The preview is shown by default and toggled from either header

The preview SHALL be shown by default once there is a project, SHALL be hidden and shown from a button in the preview's own header and a button in the chat pane's header, and the choice SHALL persist across launches as `previewPane` in `settings.json`.

#### Scenario: Hiding the preview

- **WHEN** the person presses *Hide the preview* in the preview's header
- **THEN** the preview slides away and the chat takes the window
- **AND** a *Show the preview* button appears in the chat pane's header

#### Scenario: A studio with no projects

- **WHEN** no project exists and the person has never chosen
- **THEN** the preview is not shown

#### Scenario: The preview is hidden, not unmounted, for Docs

- **WHEN** the pane is switched to Docs
- **THEN** the preview is hidden rather than taken down
- **AND** the page it holds is not reloaded when the person switches back

### Requirement: A preview dragged shut is the same as a preview hidden

Collapsing the preview panel by dragging the divider past its minimum SHALL be treated as hiding the preview, so the toggle that brings it back is the one already on screen. A collapse reported while the preview is already hidden SHALL be ignored, and a layout stored collapsed SHALL heal itself on the next launch.

#### Scenario: Dragging the divider all the way over

- **WHEN** the person drags the divider past the preview's minimum width
- **THEN** the preview is recorded as hidden
- **AND** *Show the preview* appears in the chat pane's header
- **AND** the choice survives a relaunch, and so does the way back

#### Scenario: The studio collapses the panel itself

- **WHEN** the panel reports a collapse that the studio asked for because the preview was already hidden
- **THEN** nothing more is recorded and the state does not change

### Requirement: The properties pane exists only while it has something in it

The canvas inspector SHALL be visible by default and flush with the top and
right edges of the preview workspace. It SHALL consist of a vertical bar of
icon buttons along its outer edge and a content area beside it. The bar SHALL
hold the inspector's views — Layers (or the video's details when the object list
is unavailable) and Properties — then Snapshot, and a control that collapses and
expands the content area. The active view SHALL be marked; Properties SHALL be
disabled without a selection. Clicking the active view's icon SHALL collapse the
content area, and clicking any view's icon while collapsed SHALL expand it on
that view. Collapsed, only the bar SHALL remain, with selection and edits
preserved. The video SHALL NOT automatically reframe when the inspector
collapses or expands. Export SHALL be in the preview pane's header, in Preview
and Docs alike. Playback controls SHALL remain beside the inspector without
overlapping it. What the properties controls edit belongs to
preview/properties-pane.

#### Scenario: Nothing is selected
- **WHEN** the canvas opens or selection is cleared
- **THEN** the inspector shows its Layers view and its bar, with Properties disabled

#### Scenario: An element with a schema is picked
- **WHEN** an element with editable properties is selected
- **THEN** the inspector shows its Properties view with the element's properties

#### Scenario: An element with no schema is picked
- **WHEN** the selected element has no tunable properties
- **THEN** the inspector keeps its Layers view and the compact comment card is used

#### Scenario: The inspector is hidden
- **WHEN** the person clicks the active view's icon or the collapse control
- **THEN** only the bar remains, selection and edits are preserved, and any view's icon expands it again

#### Scenario: Exporting from Preview
- **WHEN** the canvas is shown
- **THEN** Export is in the pane header, where it also is in Docs

#### Scenario: The preview is hidden
- **WHEN** the preview is hidden
- **THEN** the inspector is hidden with it

### Requirement: The sidebar collapses and is remembered

The sidebar SHALL be collapsible from the button on its own brand row and from a button in the chat pane's header, and the choice SHALL persist across launches as `projectsPane` in `settings.json`. While collapsed it SHALL take no focus and no keys.

#### Scenario: Hiding the sidebar

- **WHEN** the person hides the sidebar
- **THEN** it slides away, the panes take the space, and *Show the project list* appears in the chat pane's header

#### Scenario: Tabbing while it is closing

- **WHEN** the sidebar is hidden or hiding
- **THEN** nothing inside it can be reached by keyboard

### Requirement: The sidebar shows one of three views

The sidebar SHALL show exactly one of Videos, Assets or Components at a time, SHALL remember which across launches as `paneView` in `settings.json`, and SHALL move between them with a direction taken from their order — Videos is the root, so entering another view pushes and coming back pops.

#### Scenario: Opening Assets

- **WHEN** the person switches the sidebar to Assets
- **THEN** the view slides in from the direction its position implies
- **AND** the choice comes back on the next launch

#### Scenario: Picking the view already open

- **WHEN** the person picks the view that is already showing
- **THEN** nothing moves and nothing is written

### Requirement: The preview's header switches between Preview and Docs

The preview pane's header SHALL NOT carry a Preview / Docs switch while the pane shows the preview. Docs SHALL be opened with ⌘D, the View menu, the command palette or a stage row, and while the pane is in Docs its header SHALL carry a Preview button in place of a title that returns to the preview. The choice and the open document SHALL be kept per video for as long as the app runs and SHALL NOT be written to disk, so moving to another video and back lands on the tab that was open and a relaunch starts on the preview.

#### Scenario: Reading a document and coming back

- **WHEN** the person opens Docs on one video, moves to another video, and returns
- **THEN** the first video is still in Docs, on the document that was open
- **AND** the second video is on its own choice

#### Scenario: Relaunching

- **WHEN** the app is relaunched
- **THEN** every video starts on the preview

#### Scenario: Docs is open

- **WHEN** the pane is in Docs
- **THEN** Inspect and Snapshot leave the header
- **AND** Export stays
- **AND** a Preview button returns the pane to the preview

#### Scenario: The preview is shown

- **WHEN** the pane shows the preview
- **THEN** its header carries no Preview / Docs switch
- **AND** ⌘D still opens Docs

### Requirement: The studio is dark by default and follows the system only if asked

The theme SHALL be dark until a choice is made, and Appearance SHALL offer Dark, Light and System. The choice SHALL persist across launches and SHALL be applied to the document without a flash of the wrong theme.

#### Scenario: A first launch

- **WHEN** nobody has chosen a theme
- **THEN** the studio is dark, whatever the operating system's appearance is

#### Scenario: Choosing System

- **WHEN** the person picks System
- **THEN** the studio follows the operating system's appearance from then on

### Requirement: The title bar band carries a shader that can be turned off

The band under the traffic lights SHALL carry an animated field whose speed and hue follow what the studio is doing — calm while idle, faster while a turn runs, another hue while something waits or has failed. Showing the field SHALL be a preference (`titlebarShader`), animating it SHALL be a second preference (`titlebarMotion`), both on by default and both remembered. The band SHALL keep the same height either way, so nothing below it moves.

#### Scenario: Turning the shader off

- **WHEN** the person turns *Show the shader* off in Appearance
- **THEN** the band is the sidebar's own plain colour
- **AND** *Animate it* is disabled, since there is nothing left to animate
- **AND** both choices come back on the next launch

#### Scenario: Turning only the motion off

- **WHEN** the person turns *Animate it* off
- **THEN** the field holds one frame and its hue still follows the mood

#### Scenario: The system asks to reduce motion

- **WHEN** the operating system asks for reduced motion
- **THEN** the field holds one frame regardless of the preference

#### Scenario: No project yet, or no WebGL

- **WHEN** no project has been opened, or the webview cannot give the page a WebGL context
- **THEN** the band is drawn plain rather than failing

### Requirement: The app menu carries the studio's own File and Project menus

The application menu SHALL offer New Video (⌘N), New Project (⇧⌘N) and Open Folder (⌘O) under File, followed by every known project as a checkable row that switches to it, and a Project menu with Project Settings, Rename, Locate Folder, Reveal in the file manager and Remove from Studio. A View menu SHALL offer Show or hide the sidebar (⌘B), Show or hide the preview (⌘\), the three sidebar views Videos, Assets and Components (⌘1, ⌘2, ⌘3) as checkable rows, Preview or Docs (⌘D), and Restart the studio's helper (⇧⌘R). A Video menu SHALL offer Export (⌘E), Inspect (⌘I), Snapshot (⇧⌘S), Stop the turn (⌘.), Previous video and Next video (⌥⌘↑, ⌥⌘↓). Every row SHALL come from the command registry in `shell/command-palette` with its shortcut beside it. A row that does not apply SHALL be disabled rather than dropped, so the menu keeps one shape. The standard Edit and Window menus SHALL be present, so the webview keeps its clipboard and window shortcuts.

#### Scenario: Switching project from the menu

- **WHEN** the person picks another project under File
- **THEN** the studio switches to it, exactly as clicking it in the sidebar would

#### Scenario: No project is open

- **WHEN** nothing is open
- **THEN** every Project row is disabled, New Video is disabled, and every Video row is disabled

#### Scenario: The open project's folder is gone

- **WHEN** the open project's folder is not on disk
- **THEN** Reveal in the file manager is disabled while Locate Folder stays available

#### Scenario: Docs is open

- **WHEN** the pane is in Docs
- **THEN** Inspect and Snapshot are disabled under Video, the palette carries the reason the header's buttons would carry, and Export stays enabled

#### Scenario: The sidebar view is checked

- **WHEN** the sidebar shows Assets
- **THEN** Assets is the checked row under View

#### Scenario: There is no Tauri core to install a menu into

- **WHEN** the page runs without the core
- **THEN** the install fails silently and the app keeps whatever menu it had
