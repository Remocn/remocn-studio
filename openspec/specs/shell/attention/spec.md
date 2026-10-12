# shell/attention Specification

## Purpose
How the studio calls a person back when something needs them and they are looking elsewhere: one chain of increasingly loud surfaces — the pane, the chat's row, a system notification — gated on where the person is, plus the Dock badge that counts what is waiting on an answer.

## Requirements

### Requirement: An attention event climbs one chain

The studio SHALL treat these as attention events: a turn that ended, a permission card or source question that appeared, an export that finished or failed, and a sidecar that stayed down after its retries. For each event the studio SHALL show it in its own pane; SHALL additionally mark the chat's row when that chat is not the one on screen; and SHALL additionally post a system notification when the window is not focused. The chain SHALL be the same for every event, and no event SHALL skip a step or add a surface of its own.

#### Scenario: The chat is on screen and the window is focused

- **WHEN** a turn ends in the chat the person is looking at
- **THEN** the chat pane shows the result and nothing else changes

#### Scenario: Another chat is open

- **WHEN** a turn ends in a chat that is not on screen while the window is focused
- **THEN** that chat's row carries the unread mark and no notification is posted

#### Scenario: The window is not focused

- **WHEN** a turn ends while another app is in front
- **THEN** the chat's row carries the unread mark if the chat is not on screen
- **AND** a system notification is posted

#### Scenario: A card appears while the person is away

- **WHEN** a permission card or source question appears in any chat while the window is not focused
- **THEN** a notification is posted saying the agent is waiting on an answer, naming the video

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

### Requirement: Notifications are off until asked for, per event, and the OS is asked once

Notifications SHALL be off until the person turns the master switch on in Settings › Notifications, and the studio SHALL request the operating system's permission only at that moment or when *Grant permission* is pressed, never at launch. Each event SHALL have its own switch, on by default, and an event whose switch is off SHALL post nothing while the others still do. While the master switch is off no notification SHALL be posted. When the operating system has refused, the section SHALL say so in words and *Grant permission* SHALL open the studio's row in System Settings, and the studio SHALL post nothing until the refusal is lifted.

#### Scenario: Turning the switch on

- **WHEN** the person turns the master switch on for the first time
- **THEN** macOS asks whether the studio may notify, and notifications are on only if the answer is yes

#### Scenario: The OS refused earlier

- **WHEN** *Grant permission* is pressed and macOS had already refused
- **THEN** the studio's row in System Settings opens, and the section reads that notifications are off there

#### Scenario: Off means silent

- **WHEN** the master switch is off and a turn ends while the window is not focused
- **THEN** no notification is posted and the row is still marked unread

#### Scenario: One event off

- **WHEN** the export switch is off and an export finishes while the window is not focused
- **THEN** no notification is posted for it, and a turn that ends in the same minute is still posted

#### Scenario: The plugin is unavailable

- **WHEN** the studio runs without the notification transport, such as in a browser
- **THEN** the master switch is unavailable with the reason worded beside it, and nothing else about attention changes

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

### Requirement: Attention never fails the work it reports on

A notification or badge that cannot be posted SHALL be logged and dropped; it SHALL never surface as an error in the pane, and SHALL never change the state of the turn, the export or the sidecar it reports on.

#### Scenario: Posting throws

- **WHEN** the notification transport rejects a post
- **THEN** the turn's result is shown exactly as it would have been, and the failure goes to the log only

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
