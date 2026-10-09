# shell/command-palette Specification

## Purpose
One list of everything the studio can be asked to do, and the ways of asking — the application menu on macOS, the ⌘K (Ctrl+K on Linux) palette and the keyboard — that all read it, so a person can reach any action, video or project without the mouse and can learn every shortcut from the palette itself.

## Requirements

### Requirement: One registry, three readers that agree

The studio SHALL hold one registry of commands, each with one title, one group, whether it applies at this moment and — when it does not — the worded reason, and at most one shortcut. The application menu, the palette and the keyboard SHALL each read that registry and SHALL NOT carry an action, a title or a shortcut of their own. A shortcut SHALL belong to exactly one command, and a command that does not apply SHALL be disabled in every reader with the same reason rather than dropped from any of them. The application menu SHALL be installed on macOS only; on Linux the studio SHALL NOT install one, and the keyboard reader SHALL answer every shortcut the menu would have owned.

#### Scenario: Export cannot run

- **WHEN** Export is unavailable because the preview shows another project
- **THEN** the Video menu's Export row (on macOS), the palette's Export entry and the Export shortcut all refuse, and the palette and the menu carry the same reason Export's own button carries

#### Scenario: A shortcut is claimed twice

- **WHEN** two commands in the registry declare the same shortcut
- **THEN** the registry's test fails; the studio never ships with the conflict

#### Scenario: A reader without a core

- **WHEN** the page runs without the Tauri core
- **THEN** the palette and the keyboard still work from the same registry, and only the menu install is skipped

#### Scenario: No menu bar on Linux

- **WHEN** the studio starts on a Linux desktop
- **THEN** the window shows no menu bar, and every shortcut in the table is answered by the keyboard reader

### Requirement: The palette is one mixed list on ⌘K

⌘K SHALL open the palette over the window with its search field focused; ⌘K again and Escape SHALL close it. The list SHALL be grouped as Recent, Actions, Videos and Projects, in that order, and SHALL match the typed text against titles so that every word typed must be found in the title, case and accents ignored. Empty input SHALL show Recent first — the actions, videos and projects reached from the palette or the sidebar during this run, most recent first, at most eight — followed by every group. Enter SHALL run the highlighted entry and close the palette; a disabled entry SHALL show its reason and SHALL NOT run.

#### Scenario: Opening a video by name

- **WHEN** the person presses ⌘K, types *intro* and presses Enter
- **THEN** the video whose name contains *intro* opens, exactly as clicking it in the sidebar would, and the palette closes

#### Scenario: Reaching a chat

- **WHEN** the typed text matches a chat's title under a video
- **THEN** the chat is listed under its video's name, and Enter opens that chat

#### Scenario: Nothing matches

- **WHEN** no title contains every typed word
- **THEN** the list says nothing matches, in words, and Enter does nothing

#### Scenario: Escape closes only the palette

- **WHEN** Inspect is armed and the palette is open
- **THEN** Escape closes the palette and Inspect stays armed

#### Scenario: A disabled entry

- **WHEN** the highlighted entry is Snapshot while the preview is not running
- **THEN** the entry reads the same reason Snapshot's tooltip reads, and Enter leaves the palette open

### Requirement: Shortcuts are shown where the command is, and listed in Settings

Every command with a shortcut SHALL show it beside its title in the palette and, on macOS, in the menu, in the platform's glyphs: `⌘`, `⇧` and `⌥` on macOS, and `Ctrl`, `Shift` and `Alt` joined by `+` on Linux. The whole table SHALL also be readable in one place, the Hotkeys section of Settings, as a read-only list grouped by what the shortcut touches; see `shell/settings-page`.

#### Scenario: Learning a shortcut

- **WHEN** the person opens the palette and reads the Export entry
- **THEN** ⌘E is shown beside it on macOS, where the Video menu shows the same, and Ctrl+E on Linux

#### Scenario: Reading them all

- **WHEN** the person opens Settings › Hotkeys
- **THEN** every shortcut in the table is listed with its command, and nothing there can be edited

### Requirement: The shortcut table

The studio SHALL bind exactly these shortcuts, and no reader SHALL add another. Each command has one shortcut, written with ⌘ on macOS and Ctrl on Linux:

| macOS | Linux | Command |
| --- | --- | --- |
| ⌘K | Ctrl+K | Open the palette |
| ⌘N | Ctrl+N | New Video |
| ⇧⌘N | Ctrl+Shift+N | New Project |
| ⌘O | Ctrl+O | Open Folder |
| ⌘, | Ctrl+, | Settings |
| ⌘E | Ctrl+E | Export |
| ⌘I | Ctrl+I | Inspect |
| ⇧⌘S | Ctrl+Shift+S | Snapshot |
| ⌘B | Ctrl+B | Show or hide the sidebar |
| ⌘\ | Ctrl+\ | Show or hide the preview |
| ⌘1 ⌘2 ⌘3 | Ctrl+1 Ctrl+2 Ctrl+3 | Sidebar: Videos, Assets, Components |
| ⌘D | Ctrl+D | Preview or Docs |
| ⌥⌘↑ ⌥⌘↓ | Ctrl+Alt+↑ Ctrl+Alt+↓ | Previous or next video |
| ⌘. | Ctrl+. | Stop the running turn |
| ⇧⌘R | Ctrl+Shift+R | Restart the studio's helper |

A shortcut SHALL fire while the composer or any text field has focus, since none of the table's keys is one a text field owns on either platform; a key the text field does own — on Linux Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z, Ctrl+Shift+Z — SHALL never be bound. A shortcut SHALL fire once per press whichever reader received it.

#### Scenario: Export from the composer

- **WHEN** the caret is in the composer and ⌘E (Ctrl+E on Linux) is pressed
- **THEN** the Export dialog opens and the composer's text is untouched

#### Scenario: Next video while typing

- **WHEN** the caret is in the composer and ⌥⌘↓ (Ctrl+Alt+↓ on Linux) is pressed
- **THEN** the next video in the sidebar's order opens, and the draft in the composer stays with the chat it was typed in

#### Scenario: Stop with nothing running

- **WHEN** ⌘. (Ctrl+. on Linux) is pressed and no turn is running in the open video
- **THEN** nothing happens and nothing is reported

#### Scenario: A sidebar view while the sidebar is hidden

- **WHEN** ⌘2 (Ctrl+2 on Linux) is pressed while the sidebar is hidden
- **THEN** the sidebar shows, on Assets

### Requirement: Navigation commands come from the same lists the sidebar shows

The Videos and Projects groups SHALL list exactly the videos and chats of the open project and the known projects, in the sidebar's order, with the open one marked; a video or chat deleted from the sidebar SHALL leave the palette in the same moment.

#### Scenario: A video is deleted

- **WHEN** a video is deleted from the sidebar while the palette is closed
- **THEN** the next ⌘K does not list it

#### Scenario: The open chat

- **WHEN** the palette lists the chat that is already open
- **THEN** the entry is marked as open, and Enter on it only closes the palette
