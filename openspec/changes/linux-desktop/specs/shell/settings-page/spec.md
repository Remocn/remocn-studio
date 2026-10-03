## RENAMED Requirements

- FROM: `### Requirement: Stock media holds a Pexels key on this Mac`
- TO: `### Requirement: Stock media holds a Pexels key on this computer`

## MODIFIED Requirements

### Requirement: Notifications is a section with one master switch, a way to permission, and a switch per event

Notifications SHALL offer a master switch that turns every notification on or off, a *Grant permission* button shown whenever the operating system has not allowed the studio to notify, and one switch per event — a turn that ended, the agent waiting for an answer, an export that finished or failed, the studio's helper stopping — each on until turned off and shown as off while the master switch is off. The master switch and every event switch SHALL be remembered, so turning the master switch back on restores each event's own choice. On macOS, *Grant permission* SHALL ask macOS when it has never been asked and SHALL open the studio's row in System Settings when macOS has already refused. On Linux, notifications are posted through the desktop's own notification service, which keeps no per-app row to open, so *Grant permission* SHALL ask again and the line SHALL say notifications must be allowed in the desktop's own settings; see `shell/attention`.

#### Scenario: Turning notifications on for the first time

- **WHEN** the master switch is turned on and macOS has never been asked
- **THEN** macOS asks whether the studio may notify, and the section reads as on only if the answer is yes

#### Scenario: Permission is missing

- **WHEN** the section opens and macOS has not allowed the studio to notify
- **THEN** a *Grant permission* button is shown with a line saying why nothing will arrive until it is pressed

#### Scenario: macOS refused

- **WHEN** *Grant permission* is pressed and macOS has already refused
- **THEN** the studio's row in System Settings opens, and the line says notifications are off there

#### Scenario: The Linux desktop has not allowed it

- **WHEN** the section opens on Linux and the desktop reports that the studio may not notify
- **THEN** *Grant permission* is shown with a line saying nothing will arrive until notifications are allowed for the studio in the desktop's own settings, and pressing it asks again rather than opening anything

#### Scenario: The master switch goes off

- **WHEN** the master switch is turned off
- **THEN** every event switch reads as off and cannot be changed, and turning the master switch back on shows each event's own choice again

#### Scenario: One event turned off

- **WHEN** the switch for exports is turned off
- **THEN** an export that finishes posts nothing while a turn that ends still does

#### Scenario: No notification transport

- **WHEN** the page runs without the Tauri core
- **THEN** the master switch is unavailable, with the reason worded beside it, and *Grant permission* is not shown

### Requirement: Hotkeys lists every shortcut and changes none

Hotkeys SHALL list every keyboard shortcut the studio binds, grouped as Studio, Project, View and Video, each row naming the command and showing its keys as key caps in the platform's glyphs — `⌘`, `⇧` and `⌥` on macOS, `Ctrl`, `Shift` and `Alt` on Linux. The section SHALL be read-only: no shortcut can be changed, cleared or added from it, and the list SHALL be the same table the palette and the keyboard read.

#### Scenario: Reading the list

- **WHEN** the person opens Hotkeys
- **THEN** Export is listed under Video with ⌘E on macOS and Ctrl+E on Linux, and the next video with ⌥⌘↓ or Ctrl+Alt+↓

#### Scenario: Nothing to edit

- **WHEN** the person looks for a way to change a shortcut
- **THEN** there is none; the rows carry no control

### Requirement: Stock media holds a Pexels key on this computer

Stock media SHALL take a Pexels API key, SHALL say that it is kept in the studio's data folder on this computer and goes nowhere but Pexels, and SHALL offer to remove a key that is saved. It SHALL say plainly when there is no key that stock search stays empty until there is one.

#### Scenario: Saving a key

- **WHEN** a key is pasted and saved
- **THEN** the field reports that a key is saved and offers Remove

#### Scenario: Saving fails

- **WHEN** the key cannot be written
- **THEN** the failure is shown under the field and nothing claims a key was saved

### Requirement: Feedback is an email the person sends themselves

Feedback SHALL open the person's own mail client with a message addressed to the studio's intake address, a subject, a prompt for what happened, a reminder to attach screenshots, and — below a rule — the facts it carries: the studio's version, whether the build is development or production, the operating system's name and version, and the agent the open chat is on. Nothing SHALL be sent by the app itself, and the same four facts SHALL be listed on the page so what leaves is readable before the button is pressed.

#### Scenario: Sending feedback

- **WHEN** *Email feedback* is pressed
- **THEN** the mail client opens with the subject, body and the four facts already filled in
- **AND** nothing has left the app

#### Scenario: No mail client

- **WHEN** the mail client cannot be opened
- **THEN** the failure is shown on the page and nothing else happens
