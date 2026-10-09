# shell/settings-page Specification

## Purpose
Settings as a full-window page over an inert shell rather than a dialog: the section rail, the ways in and out, and what each section offers — appearance, behaviour, stock media, updates, AI accounts, the open project, and feedback.

## Requirements

### Requirement: Settings takes the window and the shell stays alive underneath

Settings SHALL cover the whole window with a section rail on the left and one readable column on the right, with nothing floating over the shell and nothing dimmed behind it. The shell SHALL stay mounted underneath and SHALL take no keys and no focus while Settings is open, and the preview's page, a running turn and the sidecar's connection SHALL be exactly where they were when Settings closes.

#### Scenario: Opening Settings during a turn

- **WHEN** Settings is opened while a turn is running
- **THEN** the turn keeps running and its transcript keeps growing underneath
- **AND** closing Settings returns to it with nothing reloaded

#### Scenario: Reaching the shell while Settings is up

- **WHEN** the person tabs or clicks where the shell would be
- **THEN** nothing in the shell receives the key or the click

#### Scenario: The page is named

- **WHEN** assistive technology reads the window
- **THEN** the page is one region named Settings, not a dialog

### Requirement: Settings opens from several places, each on the section it is about

Settings SHALL open from the Settings row in the sidebar's footer, from ⌘, anywhere in the app, from the account row in the sidebar's footer, from the trial card's Upgrade, from a provider's *Sign in* in the model menu, and from Project Settings in the application's Project menu. The last four SHALL open on the section they concern, and the model menu's entry SHALL additionally bring that provider's row into view and mark it.

#### Scenario: The keyboard shortcut

- **WHEN** the person presses ⌘, anywhere in the app
- **THEN** Settings opens, whether or not the sidebar is showing

#### Scenario: Signing a provider in from the composer

- **WHEN** the person picks *Sign in* on a provider in the model menu
- **THEN** Settings opens on AI Accounts with that provider's row scrolled into view and outlined

#### Scenario: The gear opens where it left off

- **WHEN** Settings is opened from the sidebar's Settings row or with ⌘,
- **THEN** it opens on the section that was last open, and on Appearance the first time

#### Scenario: Project Settings from the menu

- **WHEN** Project Settings is chosen in the application's Project menu
- **THEN** Settings opens on the Project section bound to the open project

### Requirement: Escape leaves, unless something else answered it first

Escape SHALL close Settings, and SHALL do so only when nothing else on the page has already answered it — a menu or a popover that consumes Escape SHALL keep it. The rail's Back row SHALL be the other way out.

#### Scenario: Escape with a menu open

- **WHEN** a menu inside Settings is open and Escape is pressed
- **THEN** the menu closes and Settings stays open

#### Scenario: Escape with nothing open

- **WHEN** Escape is pressed and nothing else wanted it
- **THEN** Settings closes and the shell becomes live again

### Requirement: Unsaved project changes hold the page

While the open project's settings have unsaved changes, Settings SHALL refuse to change section and refuse to close, and SHALL say so in place rather than discarding the edit.

#### Scenario: Leaving with an unsaved edit

- **WHEN** the person changes a project setting and then picks another section or closes the page
- **THEN** the section does not change and the page does not close
- **AND** the page says to save or cancel the project changes first

#### Scenario: The edit is saved or cancelled

- **WHEN** the project's changes are saved or cancelled
- **THEN** the hold is released and the page can be left

### Requirement: The rail lists the sections and flags a waiting update

The rail SHALL list Project, Account, Appearance, Behavior, Notifications, Hotkeys, Stock media, Updates, AI Accounts and Feedback, each with a one-line description shown as the heading of the section it opens, and SHALL mark the open one. The Updates row SHALL carry a dot whenever a release is waiting, so the page never hides it.

#### Scenario: Switching section

- **WHEN** the person picks a row in the rail
- **THEN** that section's heading, description and body replace the column on the right

#### Scenario: A release is waiting

- **WHEN** a newer release has been found
- **THEN** the Updates row carries a marker announcing that an update is available

### Requirement: Appearance offers the theme and the title bar band

Appearance SHALL offer Dark, Light and System as three tiles with the current one marked, and a Title bar group with a live sample of the band and two switches: *Show the shader* and *Animate it*, the second disabled while the first is off. Both switches SHALL be remembered.

#### Scenario: Changing the theme

- **WHEN** the person picks a theme tile
- **THEN** the whole app changes to it at once, Settings included

#### Scenario: Turning the shader off

- **WHEN** *Show the shader* is turned off
- **THEN** the sample above the switches goes plain
- **AND** *Animate it* becomes unusable

### Requirement: Behavior offers library suggestions, feature overview and privacy
Behavior SHALL offer a Suggestions group with the library-offer switch and an always-available Explore Studio button, and a Privacy group holding crash-report consent.

#### Scenario: Turning library suggestions off
- **WHEN** the switch is turned off
- **THEN** the preference is written down and a turn that ends no longer offers its media

#### Scenario: Opening the overview
- **WHEN** Explore Studio is pressed
- **THEN** the feature overview opens above Settings at its remembered chapter without resetting dismissal

### Requirement: Behavior says what a crash report carries before asking for it

The crash-report row SHALL be off unless it is switched on, SHALL say what is sent and that it is off unless turned on, SHALL state that prompts, conversations with the agent and the contents of project files are never included and that paths are stripped of the home folder, and SHALL say plainly when the running build would report nothing whatever the switch says.

#### Scenario: A person reading the row

- **WHEN** Behavior is opened on a build that has never been asked
- **THEN** the switch is off
- **AND** the row carries both the opt-in wording and the never-sent wording

#### Scenario: A development build

- **WHEN** the running build is a development build
- **THEN** the row additionally says this build reports nothing either way

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

### Requirement: Updates reads as this build, then the release waiting for it

Updates SHALL show the installed version, whether it is a development or production build, and the macOS it runs on, with the studio's own sentence about the state of the check and a *Check now* beside it. A release that is ready SHALL be a second card with its notes and an install button, and SHALL exist only while there is one.

#### Scenario: Nothing newer

- **WHEN** the check finds nothing newer
- **THEN** the build card says this is the newest release and no second card is drawn

#### Scenario: A turn is running

- **WHEN** a release is waiting while a turn is running
- **THEN** the card says installing restarts the app and stops the turn

### Requirement: AI Accounts lists every provider with its own probe's answer

AI Accounts SHALL list every provider the studio knows with the answer of that provider's own probe — the sentence, any detail, and a chip saying *Signed in*, *Action needed*, *Check* or *Checking* — and SHALL offer Recheck for the whole group. A provider that has not been probed SHALL read *Not checked yet*, never as signed out. Where a provider has setup steps, they SHALL unfold under its sentence; where the fix is a command, it SHALL be shown and copyable.

#### Scenario: A provider that is not signed in

- **WHEN** a provider's probe says it is not signed in
- **THEN** its row says so, carries its sign-in steps, and its chip reads *Action needed*

#### Scenario: A provider with no answer yet

- **WHEN** a provider has no probe result
- **THEN** its row reads *Not checked yet* with no verdict chip

#### Scenario: Rechecking

- **WHEN** Recheck is pressed
- **THEN** every provider is asked again and the rows show they are being checked

### Requirement: Feedback is an email the person sends themselves

Feedback SHALL open the person's own mail client with a message addressed to the studio's intake address, a subject, a prompt for what happened, a reminder to attach screenshots, and — below a rule — the facts it carries: the studio's version, whether the build is development or production, the operating system's name and version, and the agent the open chat is on. Nothing SHALL be sent by the app itself, and the same four facts SHALL be listed on the page so what leaves is readable before the button is pressed.

#### Scenario: Sending feedback

- **WHEN** *Email feedback* is pressed
- **THEN** the mail client opens with the subject, body and the four facts already filled in
- **AND** nothing has left the app

#### Scenario: No mail client

- **WHEN** the mail client cannot be opened
- **THEN** the failure is shown on the page and nothing else happens
