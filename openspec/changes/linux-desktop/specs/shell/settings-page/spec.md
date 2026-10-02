## ADDED Requirements

### Requirement: Notifications is a section with one master switch and a switch per event

Notifications SHALL offer a master switch that turns every notification on or off, a *Grant permission* button shown only when the operating system reports that the studio may not notify, and one switch per event — a turn that ended, the agent waiting for an answer, an export that finished or failed, the studio's helper stopping — each on until turned off and shown as off while the master switch is off. The master switch and every event switch SHALL be remembered, so turning the master switch back on restores each event's own choice. Notifications SHALL be posted through the desktop's own notification service; see `shell/attention`.

#### Scenario: Turning notifications on for the first time

- **WHEN** the master switch is turned on
- **THEN** the section reads as on, and the next event is posted through the desktop's notification service

#### Scenario: Permission is missing

- **WHEN** the section opens and the operating system reports that the studio may not notify
- **THEN** a *Grant permission* button is shown with a line saying nothing will arrive until notifications are allowed for the studio in the desktop's own settings

#### Scenario: The master switch goes off

- **WHEN** the master switch is turned off
- **THEN** every event switch reads as off and cannot be changed, and turning the master switch back on shows each event's own choice again

#### Scenario: One event turned off

- **WHEN** the switch for exports is turned off
- **THEN** an export that finishes posts nothing while a turn that ends still does

#### Scenario: No notification transport

- **WHEN** the page runs without the Tauri core
- **THEN** the master switch is unavailable, with the reason worded beside it, and *Grant permission* is not shown

### Requirement: Updates reads as this build and how it is replaced

Updates SHALL show the installed version, whether it is a development or production build, and the operating system it runs on — its name and version as the system itself reports them — with the studio's own sentence about how a new version arrives and an unavailable *Check now* beside it (see `shell/quit-and-updates`). No second card SHALL be drawn.

#### Scenario: A production build

- **WHEN** the person opens Updates in a production build
- **THEN** the build card names the version, *Production* and the operating system, and says a new version arrives as a new download or through the package manager

#### Scenario: The operating system cannot be read

- **WHEN** the core cannot read the operating system's name
- **THEN** the row reads a dash rather than failing the section

## RENAMED Requirements

- FROM: `### Requirement: Stock media holds a Pexels key on this Mac`
- TO: `### Requirement: Stock media holds a Pexels key on this computer`

## MODIFIED Requirements

### Requirement: Hotkeys lists every shortcut and changes none

Hotkeys SHALL list every keyboard shortcut the studio binds, grouped as Studio, Project, View and Video, each row naming the command and showing its keys as `Ctrl`, `Shift` and `Alt` key caps. The section SHALL be read-only: no shortcut can be changed, cleared or added from it, and the list SHALL be the same table the palette and the keyboard read.

#### Scenario: Reading the list

- **WHEN** the person opens Hotkeys
- **THEN** Export is listed under Video with Ctrl+E, and the next video with Ctrl+Alt+↓

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

## REMOVED Requirements

### Requirement: Updates reads as this build, then the release waiting for it

**Reason**: No release is ever found, so the second card and the newest-release sentence cannot occur.
**Migration**: Replaced by the added requirement, which shows the build, the operating system and how a new version arrives.

### Requirement: Notifications is a section with one master switch, a way to permission, and a switch per event

**Reason**: There is no macOS permission row to open.
**Migration**: Replaced by the added requirement, which keeps the master switch, the per-event switches and the transport-less case.
