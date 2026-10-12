# sidecar/supervision Specification

## Purpose
The sidecar is the one bun process that does everything the webview cannot: the agent, history, the preview, the library and the project's own tooling. The Rust core owns it — it decides where the runtime and the script come from, what the process is told about the machine, when it is restarted and what the person is shown while it is away.

## Requirements

### Requirement: The core owns the sidecar and the webview only ever asks the core
The studio SHALL run exactly one sidecar process, started and supervised by the Rust core. The webview SHALL reach it only through the core's commands — make a request, cancel a request, read the status, ask for a restart — and SHALL receive stream chunks on the request's own channel and status changes on the `sidecar://status` event.

#### Scenario: The window opens
- **WHEN** the app starts
- **THEN** the core spawns the sidecar before the first request can be made
- **AND** it publishes a status the webview can read at any time, carrying the phase, the attempt number, the process id and the path of the log file

#### Scenario: The webview is not in a Tauri window
- **WHEN** the page is opened in a plain browser, so there is no core to ask
- **THEN** the status reads as unknown and the sidecar row says it is waiting for the Tauri core
- **AND** no transport error is shown

### Requirement: The runtime is resolved in a fixed order
The studio SHALL resolve the bun runtime in this order: the path named by `REMOCN_STUDIO_BUN`, then the copy shipped beside the app binary, then `~/.bun/bin`, the directories on `PATH`, and the usual Homebrew and system locations. A machine with none of these SHALL be told so by name, with the way to get one.

#### Scenario: A release build on a machine with no bun installed
- **WHEN** the sidecar is started
- **THEN** the copy shipped inside the app is used
- **AND** nothing on the machine has to be installed first

#### Scenario: The override points at something that is not a file
- **WHEN** `REMOCN_STUDIO_BUN` is set to a path that is not a file
- **THEN** the session fails with a reason naming that path
- **AND** the shipped copy is **not** substituted

### Requirement: The sidecar is told where everything is at spawn
The studio SHALL pass the sidecar the app data directory, the core's own process id, the project template, the agent plugin directory, the bundled component registry, the asset library directory, the preview entry, the element-picker script, the crash-report consent read from settings at that moment, the build environment and the app version. Each of these SHALL travel as an environment variable.

#### Scenario: A bundled resource cannot be resolved
- **WHEN** the preview entry, the picker script, the project template, the plugin directory, the component registry or the library directory cannot be resolved
- **THEN** the reason is written to the log and the sidecar starts without that variable
- **AND** only the feature that needs it is unavailable — the sidecar still serves everything else

#### Scenario: The runtime, the script or the data directory cannot be resolved
- **WHEN** any of those three is missing
- **THEN** the session does not start at all and its reason becomes the status detail the person reads

#### Scenario: The crash-report switch was changed while the app was running
- **WHEN** the sidecar is restarted
- **THEN** the consent passed to it is what the settings file says at that moment, not what it said at launch

### Requirement: The script comes from the repository in development and from the bundle in a release
The studio SHALL run the sidecar from the repository's own source in a development build, and from the bundled script inside the app in a release build.

#### Scenario: A development build
- **WHEN** the sidecar is started
- **THEN** the source in the repository is run
- **AND** no build step stands between an edit and the next restart

#### Scenario: A release build with no sidecar in the bundle
- **WHEN** the script cannot be resolved from the app's resources
- **THEN** the session fails with a reason saying the app bundle has no sidecar

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

### Requirement: A request made before the sidecar is ready waits for it
The studio SHALL hold a request made while the sidecar is starting or restarting until it is ready, for at most twenty seconds, rather than failing it at once.

#### Scenario: The first request is made during startup
- **WHEN** the sidecar becomes ready inside the window
- **THEN** the request is sent and answered normally

#### Scenario: The sidecar does not come up
- **WHEN** twenty seconds pass without a ready phase
- **THEN** the request fails with a sentence saying the sidecar did not come up in time

#### Scenario: The sidecar is down
- **WHEN** a request is made while the phase is down
- **THEN** it fails immediately with the reason the last session ended, not with a timeout

### Requirement: A crash restarts, with a visible gap
The studio SHALL restart a sidecar that exits, up to four attempts with a growing delay between them, and SHALL then stay down until a person asks for a restart. A session that had reached ready SHALL reset the attempt counter, so that a later crash is given the full set of attempts again.

#### Scenario: The process dies after serving
- **WHEN** the sidecar exits having been ready
- **THEN** the phase becomes restarting with the exit reason as its detail, the counter starts again, and the process is spawned once more

#### Scenario: Four attempts fail
- **WHEN** the fourth attempt ends the same way
- **THEN** the phase is down with the last reason
- **AND** nothing is retried until Restart is pressed

#### Scenario: The preview was running
- **WHEN** the sidecar comes back
- **THEN** the preview relaunches itself rather than waiting for a click — see preview/live-preview

### Requirement: No request is left hanging when the process goes
The studio SHALL fail every request that was in flight when a sidecar session ends, with the reason that session ended, and SHALL answer a request whose reply cannot be delivered rather than leaving the caller waiting.

#### Scenario: The sidecar is killed mid-request
- **WHEN** the process exits with requests outstanding
- **THEN** each of them fails with the exit reason
- **AND** the error is a sentence the pane can render, not a protocol token

#### Scenario: The sidecar closed its input
- **WHEN** a request cannot be written to the process at all
- **THEN** it fails with a sentence saying the sidecar is not running

### Requirement: Restart is the person's escape hatch
The studio SHALL offer a Restart that ends the current session and starts a new one, including from the down phase, and SHALL report a restart that could not be asked for.

#### Scenario: Restart is pressed while the sidecar is down
- **WHEN** the person presses it
- **THEN** the supervisor leaves the down state and spawns a fresh session

#### Scenario: A process that will not stop
- **WHEN** the running sidecar does not exit shortly after being asked to
- **THEN** it is killed, so a restart always produces a restart

### Requirement: Nothing is orphaned
The studio SHALL make the sidecar and everything it spawns die with the app. The sidecar SHALL be started in its own process group so signalling it reaches its children, SHALL exit when its input closes, and SHALL exit when the core's process is gone, checked every two seconds.

#### Scenario: The app quits normally
- **WHEN** the app exits
- **THEN** the sidecar and its whole process group are signalled and then forced, and the supervisor does not restart it

#### Scenario: The core is killed outright
- **WHEN** the core dies without being able to signal anything
- **THEN** the sidecar sees its input close, or finds the core's process gone within two seconds, and exits on its own

#### Scenario: The sidecar is signalled directly
- **WHEN** it receives a termination, interrupt or hang-up signal
- **THEN** it stops serving and closes down in an orderly way rather than being killed mid-write

### Requirement: Standard error is the log and standard output is the wire
The studio SHALL copy every line the sidecar writes to standard error into a log file in the app's log directory, line by line, timestamped and marked with whether the core or the sidecar said it. Standard output SHALL carry protocol frames only.

#### Scenario: The sidecar logs a line
- **WHEN** it writes to standard error
- **THEN** the line appears in the log file with a timestamp, and the log's path is on the status so the person can reveal it

#### Scenario: The log has grown large
- **WHEN** the app starts and the file is over four megabytes
- **THEN** it is rolled aside before the new session appends to it

#### Scenario: A line on standard output is not a frame
- **WHEN** the core reads a line it cannot parse
- **THEN** it logs the line with the parse failure and keeps reading, rather than ending the session

### Requirement: The sidecar can report on itself
The studio SHALL offer a method that answers with the sidecar's own runtime version, working directory, process id, protocol number and how long it has been running.

#### Scenario: A diagnostic is needed
- **WHEN** that method is called
- **THEN** it answers without touching a project, a provider or the network

### Requirement: One bundle serves four entry points
The studio SHALL re-execute the same sidecar bundle for its child processes rather than shipping separate programs: the preview host, the studio's own tool host and the one-shot read of a project's render configuration are each selected by a command-line flag on that same bundle.

#### Scenario: The preview is started for a project
- **WHEN** a preview host is needed
- **THEN** the sidecar re-executes itself with the preview-host flag, and no second program is shipped for it

#### Scenario: Crash reporting is switched on
- **WHEN** any of those entry points starts
- **THEN** the same consent check runs ahead of the entry-point choice, and all of them are covered by it

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
