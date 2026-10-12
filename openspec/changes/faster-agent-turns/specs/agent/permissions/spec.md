## MODIFIED Requirements

### Requirement: Commands and unrecognised tools always ask

The studio SHALL raise a card for every command execution regardless of what it touches, and for every tool it has no path rule for, and SHALL allow without a card only the agent's own plan and task bookkeeping, the agent loading a skill or looking up a deferred tool's definition, and the studio's own tools.

#### Scenario: A shell command

- **WHEN** the agent runs a command
- **THEN** a card is raised carrying the command, whatever the command touches

#### Scenario: A tool with no path rule

- **WHEN** the agent calls a tool the gate has no path rule for, including a tool from any server other than the studio's own
- **THEN** a card is raised

#### Scenario: The studio's own tools and the agent's bookkeeping

- **WHEN** the agent calls one of the studio's own tools, or creates, updates, lists or reads its own task list
- **THEN** the call runs with no card

#### Scenario: A skill is loaded

- **WHEN** the agent invokes a skill by name, in any mode
- **THEN** the call runs with no card, and anything the skill then asks the agent to run or read outside the folder still goes through the gate on its own

#### Scenario: A deferred tool is looked up

- **WHEN** the agent asks its runtime for the definition of a tool it has not loaded yet
- **THEN** the lookup runs with no card, and calling the tool it found is judged on its own

#### Scenario: A search with no path

- **WHEN** the agent searches without naming a path
- **THEN** nothing resolves outside the opened folder and the call runs with no card

### Requirement: Providers on the Agent Client Protocol answer with the options they were offered

The studio SHALL answer a protocol permission request by applying the same rules — command execution always asks, file work whose every location resolves inside the opened folder runs silently, a read or search whose every location resolves inside the opened folder or the shipped skills bundle runs silently, anything else asks — and SHALL choose only among the options the agent itself offered, cancelling the request when none of them fits.

#### Scenario: File work inside the folder

- **WHEN** the agent asks permission for a file operation whose every location is inside the opened folder
- **THEN** an allow option is chosen without raising a card

#### Scenario: A read of the shipped bundle

- **WHEN** the agent asks permission to read or search a location inside the skills bundle the studio ships
- **THEN** an allow option is chosen without raising a card

#### Scenario: A write into the shipped bundle

- **WHEN** the agent asks permission to edit, move or delete a location inside the shipped bundle
- **THEN** a card is raised

#### Scenario: A command, or a location outside the folder

- **WHEN** the agent asks permission to execute a command, names a location outside the folder, or offers a kind with no locations at all
- **THEN** a card is raised, and the answer picks the agent's own allow-once, allow-always or reject option

#### Scenario: The agent offered nothing that fits

- **WHEN** the answer needs an option the agent did not offer
- **THEN** the request is cancelled rather than an option being invented
