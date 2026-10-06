## MODIFIED Requirements

### Requirement: The phase is published and is never guessed at
The studio SHALL publish one of four phases — starting, ready, restarting, down — with the attempt number, the reason for the last failure where there is one, the process id and the log path. The phase SHALL be published whether or not anything is currently listening. The log SHALL be written to the platform's log directory: `~/Library/Logs/com.remocn.remocn-studio/sidecar.log` on macOS, and on Linux `logs/sidecar.log` beneath `$XDG_DATA_HOME/com.remocn.remocn-studio` (by default `~/.local/share/com.remocn.remocn-studio`).

#### Scenario: The sidecar announces itself
- **WHEN** the sidecar reports that it is listening
- **THEN** the phase becomes ready and the attempt counter is cleared

#### Scenario: The webview mounts after the sidecar was already up
- **WHEN** the status is read
- **THEN** the answer is the phase in force now, not the phase at the moment the first request was made

#### Scenario: The status popover is opened
- **WHEN** the person looks at it
- **THEN** it shows the phase, the process id, the path of the log file, a Restart button and a way to show the log in the file manager (Finder on macOS)
- **AND** while the sidecar is coming back it says which attempt of four this is

## ADDED Requirements

### Requirement: `bun` names the studio's runtime for everything the sidecar starts
The studio SHALL put first on the sidecar's `PATH` a directory in which `bun` is the runtime the sidecar runs on, so a turn or a project script that runs `bun` gets the studio's runtime on a machine with no bun of its own. A `bun` link that cannot be made SHALL be noted in the sidecar log and SHALL NOT stop the sidecar from starting.

#### Scenario: A turn adds a package on a machine with no bun
- **WHEN** a turn runs `bun add` in a project and the person has never installed bun
- **THEN** the command runs on the studio's shipped runtime

#### Scenario: The shipped runtime has its own name
- **WHEN** the runtime's file is `remocn-studio-bun`, as it is on both platforms so a `.deb` never claims `/usr/bin/bun`
- **THEN** a directory in the studio's data folder holding a `bun` link to it is first on the sidecar's `PATH`, and the runtime's own directory is not on it

#### Scenario: The AppImage starts from a new mount
- **WHEN** the AppImage is started again and is mounted at a different path
- **THEN** the link names the runtime at the new path before the sidecar starts

### Requirement: Directories added for a desktop launcher never shadow what was found before
The studio SHALL search `~/.bun/bin`, then the `PATH` it was given, then Homebrew and the system directories, and only after them the home directories of version and package managers and `$NVM_BIN`, so a directory searched last finds a tool nothing earlier had and never displaces one found earlier. The package managers' own home directories SHALL keep their place ahead of `PATH`.

#### Scenario: Started from a desktop entry
- **WHEN** the studio is started from Finder, the Dock or a desktop entry with the session's minimal `PATH`, and Claude Code is installed only in `~/.local/bin`
- **THEN** Claude Code is found

#### Scenario: Homebrew's node beside a version manager's shim
- **WHEN** Homebrew's `node` and an asdf or mise shim for `node` (in `~/.asdf/shims` or `~/.local/share/mise/shims`) both exist
- **THEN** the sidecar and every agent run Homebrew's `node`
