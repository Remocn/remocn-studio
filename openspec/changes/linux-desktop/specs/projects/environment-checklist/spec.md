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
