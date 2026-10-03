## ADDED Requirements

### Requirement: On Linux, notifications go through the desktop's notification service

On Linux the studio SHALL post notifications through the desktop's notification service over D-Bus, under the same master switch and per-event switches as on macOS. Because that service keeps no per-app settings row, a refusal SHALL be asked about again rather than answered by opening anything, and a desktop with no service running SHALL change nothing else about attention.

#### Scenario: Turning the switch on

- **WHEN** the person turns the master switch on for the first time on Linux
- **THEN** notifications are on, and the next event is posted through the desktop's notification service

#### Scenario: No notification service is running

- **WHEN** the desktop runs no notification service, as a bare window manager may not
- **THEN** posting fails without a message, the row is still marked unread, and nothing else about attention changes

#### Scenario: The desktop refused

- **WHEN** the desktop reports that the studio may not notify and *Grant permission* is pressed
- **THEN** the studio asks again, and no settings page is opened

## RENAMED Requirements

- FROM: `### Requirement: The Dock badge counts what waits on an answer`
- TO: `### Requirement: The launcher badge counts what waits on an answer`

## MODIFIED Requirements

### Requirement: Notifications are worded, name the video, and open its chat

A notification SHALL carry the video's name as its title and one worded sentence as its body — *finished*, *is waiting for your answer*, *Export finished*, *Export failed*, *The studio's helper stopped* — and SHALL never carry a protocol token, a raw error or a stack trace. Activating a notification SHALL bring the window forward and open the chat the event belongs to — for an export, the open chat of its video; for the sidecar, nothing beyond the window. When the operating system does not tell the studio which notification was activated, the window SHALL come forward and nothing else SHALL change: the unread mark on the row is where to go, and the studio SHALL never guess a chat to open.

#### Scenario: Clicking the notification

- **WHEN** the person clicks a notification for a turn that ended in a chat of the video *Intro*
- **THEN** the studio window comes to the front with that chat open

#### Scenario: The click cannot be attributed

- **WHEN** the desktop's notification service activates the studio without saying which notification was clicked
- **THEN** the window comes to the front, the open chat stays as it was, and the ended chat's row carries its unread mark

#### Scenario: A failure is worded

- **WHEN** an export fails with a renderer message
- **THEN** the notification says the export failed and the video's name, and the renderer's text stays in the pane under the preview

### Requirement: The launcher badge counts what waits on an answer

The studio SHALL publish a badge count with the number of permission cards and source questions waiting across every video, regardless of the window's focus, and SHALL clear it when nothing waits. On macOS the Dock SHALL show it on the studio's icon; on Linux a dock or task manager that shows launcher badges SHALL. The badge SHALL count cards, not turns, and SHALL need no consent since it leaves the app.

#### Scenario: Two chats are waiting

- **WHEN** one chat has a permission card and another has a source question outstanding
- **THEN** the published count is 2

#### Scenario: A card is answered

- **WHEN** the last outstanding card is answered or times out
- **THEN** the badge goes

#### Scenario: A running turn that asks nothing

- **WHEN** turns are running but none has asked anything
- **THEN** there is no badge

#### Scenario: A desktop without badges

- **WHEN** the desktop shows no launcher badges
- **THEN** publishing the count changes nothing visible and reports nothing
