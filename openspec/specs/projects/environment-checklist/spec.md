# projects/environment-checklist Specification

## Purpose
The environment checklist is the studio's one answer to "can this project actually work here": the agent's sign-in, the package manager, the Remotion version, the dependencies, the entry point and the videos the preview really found. It is reported in one card above the composer, and it gets out of the way the moment there is nothing left to say.

## Requirements

### Requirement: The report is read at known moments and never per turn
The studio SHALL run the environment report when a project's chat is opened, when Recheck is pressed, after a dependency install or a Remotion upgrade it ran itself, and when the window regains focus while a provider row is failed — at most once every five seconds in that last case. It SHALL NOT run the report per turn, per message or on a timer.

#### Scenario: A chat is opened
- **WHEN** its project becomes the open one
- **THEN** the report is read for that project, and a report already running for another project is abandoned rather than left to overwrite it

#### Scenario: The person signs in elsewhere and comes back
- **WHEN** the window regains focus while a provider row is failed
- **THEN** the report is read again, and a provider that has since been signed in passes without a button being pressed

#### Scenario: Focus flickers
- **WHEN** the window regains focus twice within five seconds
- **THEN** only the first of them re-reads the report

#### Scenario: The project's folder is gone
- **WHEN** the open chat's project no longer exists on disk
- **THEN** no report is read and the checklist shows nothing — the missing folder is reported by projects/project-lifecycle instead

### Requirement: A row is a state, a title, a detail and at most one fix
The studio SHALL answer with a list of rows, each carrying an identifier, a title, an explanatory detail and one of four states: ok, warn, failed or pending. A row MAY carry exactly one fix, which is one of: install the dependencies, install Node.js, a command to copy, a provider setup step, or upgrade the named packages to a named version.

#### Scenario: A row has something to do about it
- **WHEN** it carries a fix
- **THEN** the card renders the control for that fix beneath the row's detail, and nothing else

#### Scenario: A row carries a command to copy
- **WHEN** it is shown
- **THEN** the command is on screen as text with a Copy button, and the studio does not run it

### Requirement: The card is shown only while something is unresolved
The studio SHALL render the checklist only when at least one row is failed or warn, or when the report itself could not be read. Rows that are ok or pending SHALL produce no card at all.

#### Scenario: Everything passes
- **WHEN** every row is ok, or ok and pending
- **THEN** nothing is rendered above the composer

#### Scenario: Only warnings are left
- **WHEN** every unresolved row is a warning
- **THEN** the heading reads that the project has one thing worth fixing

#### Scenario: Something has failed
- **WHEN** at least one unresolved row is failed
- **THEN** the heading reads that the project is not ready to run

#### Scenario: The report itself could not be read
- **WHEN** the request fails
- **THEN** the card stays with the rows it last had and the failure is shown as its own message, rather than the rows being cleared

### Requirement: Only a failed sign-in locks the composer
The studio SHALL lock the composer only when the row for the provider this chat uses is failed. No other row — a folder that is not a Remotion project, missing dependencies, no entry point, no videos, an old Remotion — SHALL lock it.

#### Scenario: The chat's provider is not signed in
- **WHEN** that row is failed
- **THEN** the composer is disabled

#### Scenario: The folder is not a Remotion project
- **WHEN** that row is failed and the provider is signed in
- **THEN** the composer stays open

#### Scenario: Another provider is signed out
- **WHEN** the failed row belongs to a provider this chat does not use
- **THEN** the composer is not locked

### Requirement: The provider row is three steps and the studio types nothing
The studio SHALL present a failed provider row as three steps — install the command-line tool, sign in, come back — with the step that is not yet passed marked as the current one. Open in Terminal SHALL copy the step's command and open an empty terminal window: Terminal on macOS, and on Linux a new window of the person's terminal — the one `$TERMINAL` names, otherwise the desktop's default terminal, otherwise the first common terminal found installed. The studio SHALL NOT execute the command, SHALL NOT send keystrokes and SHALL NOT ask for any system automation permission. The core owns which terminal is opened.

#### Scenario: The tool is not installed
- **WHEN** the row is failed at the install step
- **THEN** the install step is current, its command is shown, and the sign-in step is still to come

#### Scenario: The tool is installed but signed out
- **WHEN** the row is failed at the sign-in step
- **THEN** the install step is marked done and the sign-in command is the one offered

#### Scenario: Open in Terminal is pressed
- **WHEN** the person presses it
- **THEN** the command is on the clipboard, a new terminal window is in front, and the button now says to paste — ⌘V on macOS, Ctrl+Shift+V on Linux — and press Enter
- **AND** nothing has run

#### Scenario: No terminal is installed that the studio knows
- **WHEN** on Linux `$TERMINAL` is unset and no default or common terminal is found
- **THEN** the reason says no terminal was found and how to name one with `$TERMINAL`, and the command is still copyable

#### Scenario: Terminal could not be opened
- **WHEN** opening it fails
- **THEN** the reason is shown under the steps, and the command is still copyable

### Requirement: The Remotion version row reads what is installed
The studio SHALL read the Remotion version actually installed under the project's `node_modules`, walking up to a workspace root if it is hoisted there, and SHALL fall back to the range the manifest declares only when nothing is installed. Below the version at which Remotion began declaring typography and text on its own elements, the row SHALL warn and offer an upgrade; it SHALL never fail.

#### Scenario: A caret range below the floor with a newer copy installed
- **WHEN** the installed copy is at or above the floor
- **THEN** the row is ok, whatever range the manifest declares

#### Scenario: The installed copy is below the floor
- **WHEN** the row is built
- **THEN** it warns, names the version in use, says the properties pane cannot edit text, weight, size or colour here, and offers to upgrade every Remotion package the manifest declares to one named version

#### Scenario: The range cannot be read
- **WHEN** the declared range is a wildcard, a major-only range or a workspace protocol and nothing is installed
- **THEN** the row stays ok rather than guessing

#### Scenario: The folder is not a Remotion project
- **WHEN** there is no manifest at all, or the manifest does not depend on Remotion
- **THEN** the row fails saying so, and names what would make it one

### Requirement: The dependencies row reads the disk, and drift is a bun-only claim
The studio SHALL decide what is missing by looking for each declared package under `node_modules` on disk, walking up so a copy hoisted to a workspace root still counts, and SHALL NOT accept a package that only a package manager's global cache could resolve. It SHALL report a drift between the manifest and the lockfile only for a bun project, and SHALL say nothing at all rather than guess for any other manager.

#### Scenario: Packages are missing
- **WHEN** some declared packages are not under `node_modules`
- **THEN** the row fails, says how many of how many are missing, names up to four of them and says how many more there are, and offers to install

#### Scenario: Everything resolves but the lockfile disagrees
- **WHEN** the project is a bun project and the lockfile does not match the manifest
- **THEN** the row warns with what bun said and offers to install

#### Scenario: The drift check could not run
- **WHEN** bun is not there, the machine is offline, or bun failed for a reason that does not mention the lockfile
- **THEN** no drift is reported

#### Scenario: The project's package manager is not on the machine
- **WHEN** the manager row has failed
- **THEN** the dependencies row does not offer an install button

### Requirement: One root cause is one row
The studio SHALL omit a row it cannot answer rather than failing it, so a single fact produces a single failure.

#### Scenario: A folder with no manifest
- **WHEN** the report is built
- **THEN** it says once that this is not a Remotion project, and does not also report unknown dependencies and a missing entry point

#### Scenario: A JavaScript project that is not a Remotion project
- **WHEN** the manifest exists but does not depend on Remotion
- **THEN** the dependencies row is still answered
- **AND** the entry-point row is omitted

### Requirement: The videos row is the preview's answer
The studio SHALL take the videos row from what the preview's compiled project reported, and SHALL fold it in only while the preview is showing the project the open chat belongs to. Until the preview has compiled, the row SHALL be pending, which shows nothing.

#### Scenario: The preview has not compiled yet
- **WHEN** the report is shown
- **THEN** the videos row is pending, and a project whose preview is still building wears no checklist on its account

#### Scenario: The project registers no videos
- **WHEN** the preview reports none
- **THEN** the row fails saying the project's root registers no composition, and suggests asking the agent for a video

#### Scenario: The video that was asked for is not in the code
- **WHEN** the preview reports that the composition the pane asked for is missing
- **THEN** the row fails naming that video, rather than reporting the substitute that played

#### Scenario: The preview is showing another project
- **WHEN** the preview's project is not the open chat's project
- **THEN** the videos row stays pending rather than reporting another project's compositions

### Requirement: The sign-in probe is measured once per run of the sidecar
The studio SHALL cache the answer to a provider's sign-in probe for the life of the sidecar process, SHALL reuse it across projects, and SHALL clear it only when Recheck is pressed.

#### Scenario: Projects are switched
- **WHEN** a second project's report is read
- **THEN** the provider row is answered from the cache and no command-line tool is launched again

#### Scenario: Recheck is pressed
- **WHEN** the report is re-read with force
- **THEN** the cache is cleared first, and a sign-in that has just happened is seen

#### Scenario: The probe does not answer
- **WHEN** the provider's tool cannot be started, or does not answer in time
- **THEN** the row fails with what it said and how to see more, rather than hanging the report
