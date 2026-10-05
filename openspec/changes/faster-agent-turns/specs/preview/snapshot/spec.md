## MODIFIED Requirements

### Requirement: One capture at a time, and each sweeps the stills folder

A second capture SHALL be refused while one is in flight, and the Snapshot button SHALL show that a capture is running. Every capture SHALL clear the folder the studio keeps its rendered stills in before writing a uniquely named file into it, so the folder never grows. That folder SHALL hold captures only: the design check's reports and frames live beside it and are never swept by a capture. The attachment the composer keeps is a separate, permanent file, so past turns keep their pictures.

#### Scenario: A second click while a capture is running

- **WHEN** the frame is clicked again before the previous capture has answered
- **THEN** the second click is ignored
- **AND** the button shows a spinner for the capture in flight

#### Scenario: A capture is taken

- **WHEN** a still is rendered
- **THEN** the previous contents of the stills folder are removed first
- **AND** the new file is given a name nothing else in the folder can collide with

#### Scenario: A capture after a design check

- **WHEN** a Snapshot, or the still a library save takes, is rendered after a design check has written its report
- **THEN** the report and its frames are still on disk, and the agent can close the review stage against that report without running the check again
