## MODIFIED Requirements

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


## ADDED Requirements

### Requirement: The core reads consent where the studio keeps its data

The core SHALL read the crash-report consent, before the app is built, from the same data directory the studio writes it to: `$XDG_DATA_HOME/com.remocn.remocn-studio`, or `~/.local/share/com.remocn.remocn-studio` when `$XDG_DATA_HOME` is unset or not absolute. When neither location can be worked out, the core SHALL read no consent and SHALL start no reporter.

#### Scenario: Consent given on a default desktop

- **WHEN** `$XDG_DATA_HOME` is unset and the person has turned crash reports on
- **THEN** the core finds the consent under `~/.local/share/com.remocn.remocn-studio` and the three conditions decide as usual

#### Scenario: A relative XDG_DATA_HOME

- **WHEN** `$XDG_DATA_HOME` is set to a relative path
- **THEN** it is ignored as the XDG specification requires, and the default location is read

#### Scenario: No home to read from

- **WHEN** neither `$XDG_DATA_HOME` nor `$HOME` is usable
- **THEN** no consent is read and no reporter is started, which fails in the direction that sends nothing
