# shell/crash-reporting Specification

## Purpose
Crash reports from the three processes the studio is made of — the webview, the Rust core and the sidecar with its re-execed hosts — sent only with the person's consent, carrying the error and where in the code it happened and nothing that describes the person, their machine or their work.

## Requirements

### Requirement: Consent is opt-in, and it is asked first

Crash reporting SHALL be off until the person turns it on, stored as `crashReports` in `settings.json`, and a setting that has never been answered SHALL read as off in every process. Consent SHALL be the first of the conditions checked, and a withheld consent SHALL be the recorded reason rather than any other condition.

#### Scenario: A studio nobody has asked

- **WHEN** the setting has never been written
- **THEN** every process reads consent as off and starts no reporter

#### Scenario: A settings file that cannot be read

- **WHEN** the settings file is absent, unreadable or malformed
- **THEN** the core reads consent as off, which is the direction that sends nothing

#### Scenario: A refusal on a build that could report

- **WHEN** consent is withheld on a production build with a report destination configured
- **THEN** nothing is started, and the reason recorded is the withheld consent

### Requirement: Three conditions decide, and a missing destination reads as a refusal

A reporter SHALL start only when consent is given, the build is a production build, and a report destination is configured. A development build SHALL never report, whatever the switch says. A build with no destination configured SHALL behave exactly as a withheld consent.

#### Scenario: A development build with consent given

- **WHEN** consent is on and the build is a development build
- **THEN** nothing is started and the reason recorded is the development build

#### Scenario: A production build with no destination

- **WHEN** consent is on, the build is a production build and no destination is configured
- **THEN** nothing is started, and nothing about the app behaves differently from a withheld consent

#### Scenario: All three agree

- **WHEN** consent is on, the build is a production build and a destination is configured
- **THEN** the reporter is started and the decision is logged

### Requirement: The reporter is loaded only when it will be used, and a failed load is never a failed boot

The sidecar SHALL load its reporting library only once consent, the build and the destination have all agreed, never on the way to deciding. A library that cannot be loaded SHALL be one more reason the reporter is off, recorded with the reason, and SHALL NOT stop the process from starting.

#### Scenario: The library cannot be loaded

- **WHEN** the reporting library cannot be resolved and consent is on
- **THEN** the sidecar records that the reporter is off because the library could not be loaded
- **AND** the sidecar starts normally and serves requests

#### Scenario: Consent is off

- **WHEN** consent is off
- **THEN** the reporting library is not loaded at all

### Requirement: Consent reaches the sidecar at spawn and again while it runs

The core SHALL read the consent out of `settings.json` at the moment it spawns the sidecar and pass it on the spawn, so a crash in the sidecar's first seconds is reported when it was consented to. The webview SHALL additionally tell the sidecar every time the setting changes, so turning the switch off bites now rather than at the next launch. Both SHALL be the same code path in the sidecar and SHALL be idempotent.

#### Scenario: A crash before any webview has connected

- **WHEN** the sidecar crashes during start-up and consent was on
- **THEN** it is reported, on the consent that travelled with the spawn

#### Scenario: Turning the switch off mid-session

- **WHEN** the person turns crash reports off
- **THEN** the sidecar is told at once and stops reporting without a relaunch

#### Scenario: The sidecar cannot be told

- **WHEN** the sidecar is down, or answers that it is not reporting
- **THEN** nothing is shown, and the setting stays saved

#### Scenario: Before the settings have been read

- **WHEN** the stored settings have not hydrated yet
- **THEN** nothing is said to either reporter

### Requirement: The two re-execed hosts are covered by the same consent

The sidecar's preview host and its tool host SHALL take the same consent on the same path as the sidecar itself.

#### Scenario: The preview host crashes

- **WHEN** the preview host crashes with consent given on a production build
- **THEN** it is reported the same way the sidecar's own crash is

#### Scenario: Consent is off

- **WHEN** consent is off
- **THEN** neither host starts a reporter

### Requirement: Withdrawing consent makes no outbound request at all

Once consent is withdrawn, the event SHALL be dropped before it can be queued, the transport SHALL be shut down without waiting to flush what it had, and no report about discarded events SHALL be sent. "Off" SHALL mean no request leaves the machine.

#### Scenario: A crash just after the switch goes off

- **WHEN** an error occurs after consent was withdrawn
- **THEN** it is dropped before it is queued and nothing is sent

#### Scenario: Events were waiting when consent was withdrawn

- **WHEN** consent is withdrawn while events are held
- **THEN** the transport is closed without a flush pause
- **AND** no summary of what was discarded is sent

### Requirement: Paths are rewritten rather than opted out of

Every string in an outgoing report, keys included, SHALL have paths rewritten before it leaves: the process's real home directory where the process knows it, and any `/Users/<name>` or `/home/<name>` wherever it appears, each replaced by a placeholder. A bare username outside a path SHALL be left alone.

#### Scenario: A home the process knows

- **WHEN** a message carries the process's own home directory, wherever on disk it is
- **THEN** that prefix is replaced by the placeholder and the rest of the path survives

#### Scenario: A home the process was not told about

- **WHEN** a message carries another process's or the project's tooling's home path
- **THEN** it is replaced by the placeholder as well, at every occurrence in the string

#### Scenario: A path inside a sentence

- **WHEN** a path appears inside quotes, or is followed by a line and column
- **THEN** the path is replaced and the punctuation and the line and column survive

#### Scenario: A path with no user in it

- **WHEN** a message names a system path with no user segment
- **THEN** it is left exactly as it is

#### Scenario: A payload that is deeply nested or self-referential

- **WHEN** the payload nests beyond the walk's depth, or refers back to itself
- **THEN** the walk stops rather than failing, and the rest of the report still leaves

### Requirement: A report carries the error and nothing that watches the person

Reports SHALL carry the error, its stack and the release the build is, and SHALL NOT carry breadcrumbs, console output, the source lines around a frame, the machine's hostname, its operating-system or module inventory, performance traces, or any default personally identifying data. Prompts, conversations with the agent and the contents of project files SHALL never be included.

#### Scenario: A crash while the sidecar has been logging a turn

- **WHEN** the sidecar crashes after logging what it was doing with a turn
- **THEN** none of those log lines are attached as breadcrumbs

#### Scenario: A crash in the person's project code

- **WHEN** a frame points into a file in the person's project
- **THEN** the frame is reported with its path rewritten and without the source lines around it

#### Scenario: A personal machine

- **WHEN** a report is sent from a personal computer
- **THEN** the machine's hostname is replaced by a constant and its module inventory is not attached

### Requirement: Only crashes are reported

Only an uncaught exception, an unhandled rejection, a panic in the core, or a render that throws SHALL be reported. A failure the studio expects and renders as a sentence — the sidecar being down, a folder that would not open, a renderer refusing an option — SHALL NOT be reported.

#### Scenario: An expected failure

- **WHEN** an operation fails in a way the studio words for the person
- **THEN** the sentence is shown and nothing is sent

#### Scenario: An exception another handler took

- **WHEN** an uncaught exception is one the sidecar deliberately handles itself
- **THEN** the process is not exited out from under that handler by the reporter

### Requirement: The sidecar dying is reported by the core, once it had been serving

When a sidecar that had reached a serving state stops unexpectedly, the core SHALL report it as its own message carrying the reason line it already writes to the sidecar log, with no path in it. A launch that never became ready SHALL NOT be reported; it is reported to the person by the studio itself instead.

#### Scenario: A sidecar that had been serving crashes

- **WHEN** the sidecar exits unexpectedly after having served
- **THEN** the core reports it with its exit reason

#### Scenario: A sidecar that never started

- **WHEN** the sidecar cannot be launched at all
- **THEN** nothing is reported and the person is told by the studio itself

### Requirement: A render that throws leaves something on screen

A render error anywhere in the studio's window SHALL be replaced by a screen saying the studio stopped drawing, stating that projects and conversations are on disk and untouched, and offering to reload the window. It SHALL behave the same whether or not a reporter was started.

#### Scenario: A render throws with consent withheld

- **WHEN** a render throws and no reporter was started
- **THEN** the same screen is shown and reloading rebuilds the window
- **AND** nothing is sent

#### Scenario: A render throws while the workspace is being built

- **WHEN** the error is thrown before the studio's own state exists
- **THEN** it is still caught and the same screen is shown, rather than a blank window

### Requirement: The release a report is filed under is the build's own tag

Every report SHALL carry a release name derived from the running version in one way for all three processes, so the three layers group under one release and a frame resolves against the right build.

#### Scenario: A version with no prefix

- **WHEN** the running version is given without the tag's leading letter
- **THEN** the release is that version with the prefix added

#### Scenario: A version that already carries the prefix

- **WHEN** the running version already reads as a tag
- **THEN** the prefix is not doubled

### Requirement: The core reads consent where the studio keeps its data

The core SHALL read the crash-report consent, before the app is built, from the same data directory the studio writes it to: `~/Library/Application Support/com.remocn.remocn-studio` on macOS, and on Linux `$XDG_DATA_HOME/com.remocn.remocn-studio`, or `~/.local/share/com.remocn.remocn-studio` when `$XDG_DATA_HOME` is unset or not absolute. When neither location can be worked out, the core SHALL read no consent and SHALL start no reporter.

#### Scenario: Consent given on a default desktop

- **WHEN** on Linux `$XDG_DATA_HOME` is unset and the person has turned crash reports on
- **THEN** the core finds the consent under `~/.local/share/com.remocn.remocn-studio` and the three conditions decide as usual

#### Scenario: A relative XDG_DATA_HOME

- **WHEN** `$XDG_DATA_HOME` is set to a relative path
- **THEN** it is ignored as the XDG specification requires, and the default location is read

#### Scenario: No home to read from

- **WHEN** neither `$XDG_DATA_HOME` nor `$HOME` is usable
- **THEN** no consent is read and no reporter is started, which fails in the direction that sends nothing
