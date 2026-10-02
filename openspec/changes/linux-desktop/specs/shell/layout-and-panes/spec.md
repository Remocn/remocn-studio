## ADDED Requirements

### Requirement: The window draws its own frame

The window SHALL carry no frame or title bar from the desktop. The title bar band at the top of the sidebar SHALL hold the studio's own Close, Minimise and Maximise controls at its left edge. Dragging the band SHALL move the window, double-clicking it SHALL toggle maximise, and dragging any edge of the window SHALL resize it. The webview owns the controls; the core performs the window operations. Close SHALL go through the same quit guard as any other quit (see `shell/quit-and-updates`).

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

The band at the top of the window, which carries the window's own controls, SHALL carry an animated field whose speed and hue follow what the studio is doing — calm while idle, faster while a turn runs, another hue while something waits or has failed. Showing the field SHALL be a preference (`titlebarShader`), animating it SHALL be a second preference (`titlebarMotion`), both on by default and both remembered. The band SHALL keep the same height either way, so nothing below it moves.

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

## REMOVED Requirements

### Requirement: The app menu carries the studio's own File and Project menus

**Reason**: A Linux desktop has no global menu bar. A GTK menu bar attached to the window would sit above the title bar band and duplicate the palette.
**Migration**: Every command that was in the File, Project, View and Video menus is in the command palette (Ctrl+K) with the same title, reason and shortcut, and every shortcut fires from the keyboard (see `shell/command-palette`). Projects are switched from the sidebar or the palette's Projects group. Clipboard and window shortcuts are the webview's and the desktop's own.
