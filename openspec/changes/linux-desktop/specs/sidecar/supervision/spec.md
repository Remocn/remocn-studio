## MODIFIED Requirements

### Requirement: The phase is published and is never guessed at
The studio SHALL publish one of four phases — starting, ready, restarting, down — with the attempt number, the reason for the last failure where there is one, the process id and the log path. The phase SHALL be published whether or not anything is currently listening. The log SHALL be written under the studio's data directory, in `logs/sidecar.log` beneath `$XDG_DATA_HOME/com.remocn.remocn-studio` (by default `~/.local/share/com.remocn.remocn-studio`).

#### Scenario: The sidecar announces itself
- **WHEN** the sidecar reports that it is listening
- **THEN** the phase becomes ready and the attempt counter is cleared

#### Scenario: The webview mounts after the sidecar was already up
- **WHEN** the status is read
- **THEN** the answer is the phase in force now, not the phase at the moment the first request was made

#### Scenario: The status popover is opened
- **WHEN** the person looks at it
- **THEN** it shows the phase, the process id, the path of the log file, a Restart button and a way to show the log in the file manager
- **AND** while the sidecar is coming back it says which attempt of four this is
