## MODIFIED Requirements

### Requirement: The gate decides by resolved path, not by the text of the path

The studio SHALL resolve every path a tool names — following symlinks and `..` component by component the way the system does, so a `..` after a link climbs from where the link lands, following a dangling link to the file it would create, and walking up to the nearest existing ancestor so a file that is about to be created still resolves — and SHALL allow a file tool without a card only when every path it names lands inside the opened folder.

#### Scenario: A file inside the folder

- **WHEN** the agent reads, writes or edits a path that resolves inside the opened folder, given absolutely or relative to it
- **THEN** the call runs with no card

#### Scenario: A file that does not exist yet

- **WHEN** the agent writes to a path whose file has not been created
- **THEN** the path is resolved through its nearest existing ancestor, and a target inside the folder still runs with no card

#### Scenario: A symlink leading out

- **WHEN** a path inside the folder is a symlink whose target is outside it
- **THEN** a card is raised, and the card names the resolved destination rather than the link

#### Scenario: A dangling symlink leading out

- **WHEN** a path inside the folder is a symlink to a file outside it that does not exist yet
- **THEN** a card is raised naming that outside file, and nothing is written unless the person approves it

#### Scenario: Climbing out through a symlink

- **WHEN** the agent names a path inside the folder that goes through a symlink to a directory outside it and then `..`
- **THEN** the `..` is taken from where the link lands, and a card is raised naming the resolved destination outside the folder

#### Scenario: A `..` that stays inside

- **WHEN** the agent names a path that climbs with `..` but still lands inside the opened folder
- **THEN** the call runs with no card

#### Scenario: A path climbing out of the folder

- **WHEN** the agent names a path that resolves outside the opened folder
- **THEN** a card is raised with the reason that the path is outside the project

### Requirement: Plan mode ends in a card

The studio SHALL treat the agent's request to leave plan mode as a permission card carrying the plan itself — for Claude Code its plan tool, for a provider on the Agent Client Protocol a request to switch mode — SHALL offer to approve into a named mode or to send the plan back, and SHALL apply an approved mode to the running turn so the same turn starts building, whichever provider runs the chat.

#### Scenario: The agent presents a plan

- **WHEN** the agent asks to leave plan mode
- **THEN** a card is raised whose body is the plan markdown, offering to approve into accept edits, to approve into auto, to keep planning, or to cancel the turn

#### Scenario: A protocol provider asks to switch out of plan mode

- **WHEN** a Copilot or Grok turn asks permission to switch mode
- **THEN** the card raised is the plan card, not a generic tool card, and its body is the plan the agent sent with the request, or the request's own title when it sent none

#### Scenario: The plan is approved

- **WHEN** the person approves into a mode
- **THEN** the running turn is switched into that mode, the chat's stored mode is updated and re-streamed, and the same turn carries on building

#### Scenario: The plan is approved on a protocol provider

- **WHEN** the person approves a Copilot or Grok plan card into accept edits or auto
- **THEN** the agent's own allow-once option is chosen, the running turn is asked to switch into the matching mode, the chat's stored mode is updated and re-streamed, and the next turn of that chat starts in it

#### Scenario: The running turn cannot be switched

- **WHEN** the provider refuses or fails the switch into the approved mode, or does not answer it within five seconds
- **THEN** the agent still receives the approval, the chat's stored mode is still updated and re-streamed, the failure is written to the sidecar log, and the next turn of that chat starts in the approved mode

#### Scenario: The plan is sent back

- **WHEN** the person chooses to keep planning
- **THEN** the agent is told to stay in plan mode, ask what should change and present a revised plan, and the chat's mode is unchanged

### Requirement: Providers on the Agent Client Protocol answer with the options they were offered

The studio SHALL answer a protocol permission request by applying the same rules as for every other provider — command execution always asks, file work whose every location resolves inside the opened folder runs silently, anything else asks — SHALL resolve each location the same way, following symlinks and `..` and walking up to the nearest existing ancestor, and SHALL choose only among the options the agent itself offered, cancelling the request when none of them fits.

#### Scenario: File work inside the folder

- **WHEN** the agent asks permission for a file operation whose every location resolves inside the opened folder
- **THEN** an allow option is chosen without raising a card

#### Scenario: A symlink leading out over the protocol

- **WHEN** a Copilot or Grok turn asks permission for a file operation on a path inside the folder that is a symlink whose target is outside it
- **THEN** a card is raised with the reason that the path is outside the project, and the file operation does not run unless the person approves it

#### Scenario: A command, or a location outside the folder

- **WHEN** the agent asks permission to execute a command, names a location outside the folder, or offers a kind with no locations at all
- **THEN** a card is raised, and the answer picks the agent's own allow-once, allow-always or reject option

#### Scenario: An approval remembered on a protocol provider

- **WHEN** a Copilot or Grok call whose exact signature was approved with "always allow" is asked about again in the same studio run
- **THEN** an allow option is chosen without raising a card, exactly as for any other provider

#### Scenario: A plan the agent offers no way to approve once

- **WHEN** a Copilot or Grok request to switch out of plan mode offers no allow-once option
- **THEN** the request is cancelled without raising a card, and neither the running turn's mode nor the chat's is changed

#### Scenario: The agent offered nothing that fits

- **WHEN** the answer needs an option the agent did not offer
- **THEN** the request is cancelled rather than an option being invented
