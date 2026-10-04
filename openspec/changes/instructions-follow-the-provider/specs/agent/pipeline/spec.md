## MODIFIED Requirements

### Requirement: The active stage's instructions ride on a Pro turn

While a stage is active the turn SHALL carry that stage's brief: its title, the stages already done, its goal, its done-condition, the files to write, its checklist where it has one, and the discovery order. On Free no brief is attached. The brief's planning step SHALL name the plan tool the chat's provider's own runtime exposes to the model, as the studio declares it for that provider, and SHALL never name a tool that runtime does not have; a provider whose plan tool the studio has not verified is asked to lay out its steps in its own planning tool, with no tool named. Every brief — the one that opens the turn and the one the pipeline tools hand back after a stage moves — SHALL name the chat's own video folder.

#### Scenario: A stage is active

- **WHEN** a Pro turn starts in a chat with an active stage
- **THEN** the brief is appended to the turn's instructions with the video's own folder substituted into every path it names

#### Scenario: No stage, or Free

- **WHEN** no stage is active, or the turn runs on Free
- **THEN** no brief is attached and the turn is an ordinary one

#### Scenario: Claude

- **WHEN** a stage is active on a Claude turn
- **THEN** the brief asks the agent to create its task list with TaskCreate from what discovery finds, exactly as before

#### Scenario: Codex

- **WHEN** a stage is active on a Codex turn
- **THEN** the brief asks the agent to create its task list with `update_plan` and does not mention TaskCreate

#### Scenario: Grok

- **WHEN** a stage is active on a Grok turn
- **THEN** the brief asks the agent to create its task list with `todo_write` and does not mention TaskCreate

#### Scenario: A provider whose plan tool is not known

- **WHEN** a stage is active on a turn whose provider has no declared plan tool name, which is Copilot today
- **THEN** the brief asks the agent to lay out its steps from what discovery finds in its own planning tool, and names no tool at all

#### Scenario: A plan the studio does not draw

- **WHEN** an agent other than Claude makes its plan with its own runtime's tool
- **THEN** no plan drawer or checklist appears for that chat, as before

#### Scenario: A stage moves mid-turn

- **WHEN** the agent starts the pipeline or moves a stage, and the tool answers with the brief of the stage that is now active
- **THEN** that brief names the chat's own video folder, exactly as the brief that opened the turn does, and words its planning step for the same provider

#### Scenario: The video could not be read when a stage moves

- **WHEN** a stage moves in a turn whose video row could not be resolved
- **THEN** the returned brief falls back to the placeholder folder rather than pointing at another video's folder, and the stage still moves
