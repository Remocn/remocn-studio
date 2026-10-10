## ADDED Requirements

### Requirement: A closed pipe is a parent leaving, not a crash
Every entry point of the sidecar bundle SHALL treat a write into its standard
output or standard error whose reader is gone as that reader having left, never as
an error: the write is dropped and nothing is raised or reported. The sidecar, the
preview host and the tool host SHALL each stop in an orderly way when their
standard output is gone, the same way they stop when their input closes, and SHALL
log why.

#### Scenario: The core stops reading the sidecar
- **WHEN** the sidecar writes a frame and its standard output has no reader
- **THEN** no crash report is sent
- **AND** the sidecar closes down in an orderly way, logging that the host closed its output

#### Scenario: The sidecar goes before its preview host
- **WHEN** a preview host writes a frame or a log line after the sidecar has exited
- **THEN** nothing is raised or reported
- **AND** the preview host stops at once, without waiting for its two-second check on its parent

#### Scenario: The agent's CLI goes before a tool host
- **WHEN** a tool host's standard output has no reader
- **THEN** it stops and releases its connection to the sidecar
- **AND** nothing is reported

#### Scenario: The output broke before the process was listening for it
- **WHEN** a preview host's standard output breaks while the host is still booting
- **THEN** it still stops once it starts serving, giving the same reason

#### Scenario: Standard error is the pipe that broke
- **WHEN** a log line cannot be written
- **THEN** it is dropped, nothing is reported, and the process carries on serving over its standard output
