## MODIFIED Requirements

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

### Requirement: The report is read at known moments and never per turn
The studio SHALL run the environment report when a project's chat is opened, when Recheck is pressed, after a dependency install or a Remotion upgrade it ran itself, when a new project's scaffold stops running, and when the window regains focus while a provider row is failed — at most once every five seconds in that last case. It SHALL NOT run the report while a new project's scaffold is still copying the template or installing, and SHALL NOT run it per turn, per message or on a timer.

#### Scenario: A chat is opened
- **WHEN** its project becomes the open one
- **THEN** the report is read for that project, and a report already running for another project is abandoned rather than left to overwrite it

#### Scenario: A new project is still being set up
- **WHEN** a project opens while its scaffold is still running
- **THEN** no report is read and the checklist shows nothing, so it neither reports the dependencies being installed as missing nor offers a second install beside the running one
- **AND** the report is read once the scaffold has landed, failed or been cancelled

#### Scenario: The person signs in elsewhere and comes back
- **WHEN** the window regains focus while a provider row is failed
- **THEN** the report is read again, and a provider that has since been signed in passes without a button being pressed

#### Scenario: Focus flickers
- **WHEN** the window regains focus twice within five seconds
- **THEN** only the first of them re-reads the report

#### Scenario: The project's folder is gone
- **WHEN** the open chat's project no longer exists on disk
- **THEN** no report is read and the checklist shows nothing — the missing folder is reported by projects/project-lifecycle instead
