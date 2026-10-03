## MODIFIED Requirements

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
