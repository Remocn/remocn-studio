## RENAMED Requirements

- FROM: `### Requirement: The sidebar shows one of three views`
- TO: `### Requirement: The sidebar remembers the selected view`

## MODIFIED Requirements

### Requirement: The sidebar remembers the selected view

The sidebar SHALL show exactly one of Videos, Projects, Assets (labelled Library in navigation), Components, Shaders or Captions at a time, SHALL remember which across launches as `paneView` in `settings.json`, and SHALL move between them with a direction taken from their order — Videos is the root, so entering another view pushes and coming back pops.

#### Scenario: Opening Assets

- **WHEN** the person switches the sidebar to Assets
- **THEN** the view slides in from the direction its position implies
- **AND** the choice comes back on the next launch

#### Scenario: Picking the view already open

- **WHEN** the person picks the view that is already showing
- **THEN** nothing moves and nothing is written

#### Scenario: Opening Shaders and relaunching
- **WHEN** the person opens Shaders and relaunches Studio
- **THEN** Shaders is restored through the existing paneView preference

#### Scenario: A saved view is unknown
- **WHEN** a saved view is unsupported by the running version
- **THEN** navigation falls back to Videos without preventing the app from opening

#### Scenario: Opening Captions and relaunching
- **WHEN** the person opens Captions and relaunches Studio
- **THEN** Captions is restored through the existing paneView preference
- **AND** Captions follows Shaders in navigation order

### Requirement: The app menu carries the studio's own File and Project menus

The application menu SHALL offer New Video (⌘N), New Project (⇧⌘N) and Open Folder (⌘O) under File, followed by every known project as a checkable row that switches to it, and a Project menu with Project Settings, Rename, Locate Folder, Reveal in the file manager and Remove from Studio. A View menu SHALL offer Show or hide the sidebar (⌘B), Show or hide the preview (⌘\), the existing Videos, Assets and Components views (⌘1, ⌘2, ⌘3) and Shaders and Captions as checkable rows, Preview or Docs (⌘D), and Restart the studio's helper (⇧⌘R). A Video menu SHALL offer Export (⌘E), Inspect (⌘I), Snapshot (⇧⌘S), Stop the turn (⌘.), Previous video and Next video (⌥⌘↑, ⌥⌘↓). Every row SHALL come from the command registry in `shell/command-palette` with its shortcut beside it. A row that does not apply SHALL be disabled rather than dropped, so the menu keeps one shape. The standard Edit and Window menus SHALL be present, so the webview keeps its clipboard and window shortcuts.

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

#### Scenario: Opening Shaders from the command registry
- **WHEN** the person invokes Shaders from the palette or the native View menu where available
- **THEN** the same Shaders view opens and its checked state agrees across navigation readers
- **AND** existing shortcuts are unchanged; Shaders adds no shortcut in this change

#### Scenario: Opening Captions from the command registry
- **WHEN** the person invokes Captions from the palette or the native View menu where available
- **THEN** the same Captions view opens and its checked state agrees across navigation readers
- **AND** existing shortcuts are unchanged; Captions adds no shortcut in this change
