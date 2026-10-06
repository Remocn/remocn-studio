## MODIFIED Requirements

### Requirement: The active stage's instructions ride on a Pro turn

While a stage is active the turn SHALL carry that stage's brief: its title, the stages already done, its goal, its done-condition, the files to write, its checklist where it has one, the discovery order, and that a pointed edit is made without moving the stage. On Free no brief is attached.

#### Scenario: A stage is active

- **WHEN** a Pro turn starts in a chat with an active stage
- **THEN** the brief rides in the turn's message, beside the assets and brand briefs, with the video's own folder substituted into every path it names

#### Scenario: No stage, or Free

- **WHEN** no stage is active, or the turn runs on Free
- **THEN** no brief is attached and the turn is an ordinary one

#### Scenario: A pointed edit while a stage is active

- **WHEN** the person asks for one specific change, such as an edit to an element they pointed at, in a chat whose pipeline is mid-stage
- **THEN** the brief tells the agent to make that change, check the range it affects and end the turn, leaving the stage where it is rather than working on toward the end of the pipeline
