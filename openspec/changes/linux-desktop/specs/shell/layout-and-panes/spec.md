## ADDED Requirements

### Requirement: On Linux the window draws its own frame

On Linux the window SHALL carry no frame or title bar from the desktop; on macOS it keeps the overlay title bar and its traffic lights, and none of this applies. The title bar band at the top of the sidebar SHALL hold the studio's own Close, Minimise and Maximise controls at its left edge. Dragging the band SHALL move the window, double-clicking it SHALL toggle maximise, and dragging any edge of the window SHALL resize it. The webview owns the controls; the core performs the window operations. Close SHALL go through the same quit guard as any other quit (see `shell/quit-and-updates`).

#### Scenario: Closing from the band

- **WHEN** the person presses the band's Close control while a turn is running
- **THEN** the quit confirmation appears, exactly as for any other quit, and the window stays open

#### Scenario: Maximising

- **WHEN** the person double-clicks an empty part of the band, or presses Maximise
- **THEN** the window fills the screen's work area
- **AND** the same gesture again restores its previous size and position

#### Scenario: Moving and resizing

- **WHEN** the person drags the band or an edge of the window
- **THEN** the window moves or resizes, and no part of the band but its controls swallows the drag

#### Scenario: The sidebar is hidden

- **WHEN** the sidebar is collapsed
- **THEN** the controls stay at the top-left corner of the window, and the chat pane's header keeps clear of them by the same inline inset the layout already reserves

#### Scenario: A window manager that ignores a request

- **WHEN** the desktop does not honour minimise or maximise, as some tiling window managers do
- **THEN** pressing the control changes nothing and reports nothing; the studio never shows an error for a window operation

## MODIFIED Requirements

### Requirement: The title bar band carries a shader that can be turned off

The band at the top of the window — under the traffic lights on macOS, carrying the window's own controls on Linux — SHALL carry an animated field whose speed and hue follow what the studio is doing — calm while idle, faster while a turn runs, another hue while something waits or has failed. Showing the field SHALL be a preference (`titlebarShader`), animating it SHALL be a second preference (`titlebarMotion`), both on by default and both remembered. The band SHALL keep the same height either way, so nothing below it moves.

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

On macOS, the application menu SHALL offer New Video (⌘N), New Project (⇧⌘N) and Open Folder (⌘O) under File, followed by every known project as a checkable row that switches to it, and a Project menu with Project Settings, Rename, Locate Folder, Reveal in the file manager and Remove from Studio. A View menu SHALL offer Show or hide the sidebar (⌘B), Show or hide the preview (⌘\), the three sidebar views Videos, Assets and Components (⌘1, ⌘2, ⌘3) as checkable rows, Preview or Docs (⌘D), and Restart the studio's helper (⇧⌘R). A Video menu SHALL offer Export (⌘E), Inspect (⌘I), Snapshot (⇧⌘S), Stop the turn (⌘.), Previous video and Next video (⌥⌘↑, ⌥⌘↓). Every row SHALL come from the command registry in `shell/command-palette` with its shortcut beside it. A row that does not apply SHALL be disabled rather than dropped, so the menu keeps one shape. The standard Edit and Window menus SHALL be present, so the webview keeps its clipboard and window shortcuts. On Linux no application menu SHALL be installed: a GTK menu bar would sit above the title bar band and duplicate the palette, so every row's command is reached from the palette with the same title, reason and shortcut, and projects are switched from the sidebar or the palette's Projects group.

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

#### Scenario: Linux has no menu bar

- **WHEN** the studio runs on Linux
- **THEN** no menu bar is shown, and New Video, Export and every other row are in the palette with their Ctrl shortcuts
