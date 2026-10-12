# projects/dependency-install Specification

## Purpose
A project the studio opens is somebody else's tree, so its dependencies are installed with its own package manager and never with the runtime the studio happens to ship. This capability covers choosing that manager, running it one at a time per project, reporting what it said, upgrading Remotion, and getting Node.js onto a machine that has none.

## Requirements

### Requirement: The lockfile names the package manager
The studio SHALL choose a project's package manager from the lockfile it finds: a bun lockfile means bun, a pnpm lockfile means pnpm, a yarn lockfile means yarn, and an npm lockfile or shrinkwrap means npm. With no lockfile anywhere the answer SHALL be bun. The nearest lockfile SHALL win over one further up.

#### Scenario: The project has its own lockfile
- **WHEN** the manager is chosen
- **THEN** it is the one that lockfile names, and the row says which file said so

#### Scenario: The project sits inside a workspace
- **WHEN** the project has no lockfile of its own and an enclosing directory both holds one and declares workspaces
- **THEN** that manager and that directory are used

#### Scenario: The project merely sits inside an unrelated repository
- **WHEN** an enclosing directory holds a lockfile but declares no workspaces
- **THEN** the manager is the default rather than that repository's, and no lockfile is claimed

#### Scenario: The walk would leave the repository
- **WHEN** climbing reaches a directory holding a repository marker without having found a lockfile
- **THEN** the climb stops there and the default manager is used
- **AND** a lockfile sitting beside that marker is still read

#### Scenario: Nothing names a manager
- **WHEN** there is no lockfile in the project or above it
- **THEN** the manager is bun and the row says so, since nothing in the project named one

### Requirement: A scaffolded project installs with bun and every other install asks the project
The studio SHALL install a project it has just scaffolded with bun, whatever lockfile may sit above it. Every other install — the checklist's button, a retry, an upgrade — SHALL use the manager the project itself names.

#### Scenario: The wizard finishes expanding the template
- **WHEN** it installs
- **THEN** bun is used, whatever lockfile may exist in an enclosing directory

#### Scenario: The checklist's Install dependencies is pressed
- **WHEN** the project's lockfile names npm
- **THEN** npm is run, and bun is not

### Requirement: The command runs where its own file is
The studio SHALL run a plain install in the directory holding the lockfile that chose the manager, and SHALL run an upgrade in the directory holding the manifest the checklist read.

#### Scenario: A workspace member is installed
- **WHEN** the install runs
- **THEN** it runs at the workspace root

#### Scenario: A workspace member's Remotion is upgraded
- **WHEN** the upgrade runs
- **THEN** it runs in the member's own directory, so that the pin lands in the manifest the checklist reads

### Requirement: One package-manager run at a time per project
The studio SHALL allow at most one package-manager run per project at any moment, identified by the project's real path so the same folder reached through a link still waits its turn. A second run SHALL be queued, not refused, and its output SHALL still stream when its turn comes. Runs in different projects SHALL stay parallel.

#### Scenario: Install is pressed twice
- **WHEN** the second press arrives while the first run is alive
- **THEN** the second run does not start until the first has exited

#### Scenario: An upgrade is asked for during an install
- **WHEN** both target the same project
- **THEN** the upgrade waits for the install to finish

#### Scenario: Two projects install at once
- **WHEN** each has its own folder
- **THEN** both run at the same time

### Requirement: A run that reports an error has failed, whatever it exited with
The studio SHALL treat a line of the manager's output that begins with an error marker as a failed run even when the process exits successfully, and SHALL report the command that failed together with what it said.

#### Scenario: The manager prints an error and exits zero
- **WHEN** the run ends
- **THEN** it is reported as failed with the error lines it printed
- **AND** the checklist does not turn green over a half-linked tree

#### Scenario: The manager exits with a non-zero code
- **WHEN** the run ends
- **THEN** the failure names the command, how it ended and the last lines it printed

#### Scenario: The request is cancelled or abandoned
- **WHEN** the run is interrupted
- **THEN** the child is signalled and then killed after a short grace, so nothing is left running

### Requirement: The manager is resolved, and never substituted
The studio SHALL use its own bun runtime as the binary for a bun project only. For npm, pnpm and yarn it SHALL look on the search path and in the install locations a window-launched app does not inherit. A manager that is not on the machine SHALL be reported by name, and the studio SHALL NOT install that project's dependencies with anything else.

#### Scenario: A bun project on a machine with no bun installed
- **WHEN** the install runs
- **THEN** the studio's own runtime is the binary, so the install works

#### Scenario: An npm project on a machine with no Node.js
- **WHEN** the report is read
- **THEN** the package-manager row fails, names the lockfile that chose npm, and says the studio will not substitute its own bun because that would write a second lockfile and resolve to different versions
- **AND** the row offers to install Node.js

#### Scenario: A pnpm or yarn project on a machine that has npm
- **WHEN** the manager is missing
- **THEN** the row offers the global install command for that manager as text to copy, and offers no Node.js download

### Requirement: The Remotion upgrade pins every Remotion package to one version
The studio SHALL build the upgrade from the packages the checklist named — every scoped Remotion package the manifest declares, plus Remotion itself — each pinned to the one version the row named, using the project manager's own word for adding a package. An upgrade naming no packages SHALL be refused rather than run bare.

#### Scenario: The upgrade is run for a bun, pnpm or yarn project
- **WHEN** it starts
- **THEN** the manager is asked to add every named package at the named version

#### Scenario: The upgrade is run for an npm project
- **WHEN** it starts
- **THEN** npm's install is used with the same pinned list

#### Scenario: The list is empty
- **WHEN** an upgrade is asked for
- **THEN** it fails saying there is nothing to upgrade, and no manager is run

#### Scenario: The upgrade succeeds
- **WHEN** it finishes
- **THEN** the environment report is read again with the sign-in probe refreshed, and the row reports what is now installed

### Requirement: A running install says what it is doing
The studio SHALL stream the manager's output to the caller line by line while a checklist install or an upgrade runs, SHALL show the most recent line beside the button, and SHALL disable that button while its run is alive.

#### Scenario: An install is running
- **WHEN** the manager prints
- **THEN** the latest line is shown beside the button and the button cannot be pressed again

#### Scenario: The install finishes
- **WHEN** it succeeds
- **THEN** the output line is cleared and the environment report is read again

#### Scenario: The install fails
- **WHEN** it ends badly
- **THEN** the reason is shown as the checklist's own message and the button is available again

#### Scenario: A project is being scaffolded
- **WHEN** its install runs
- **THEN** its progress is reported as the scaffold's install step rather than line by line, and a failure leaves the project in place to be retried — the retry itself belongs to projects/project-lifecycle

### Requirement: Node.js is fetched from its own release index and handed to the system installer
The studio SHALL, when asked to install Node.js, read the release index, take the newest entry marked long-term support, download that version's macOS installer package while reporting how many bytes have arrived out of how many are expected, and hand the file to the system installer so macOS asks for its own administrator approval. The studio SHALL NOT install Node.js quietly into the person's home directory.

#### Scenario: The install is asked for
- **WHEN** it runs
- **THEN** the newest long-term-support version is chosen, the download reports its progress, and the system installer opens with the package
- **AND** the progress reads as a percentage when the size is known and as a plain "downloading" when it is not

#### Scenario: The machine is offline
- **WHEN** the row is shown
- **THEN** it says the installer cannot be fetched and to press Recheck once connected, instead of offering a button that cannot work

#### Scenario: The index cannot be read or lists no long-term-support release
- **WHEN** the request runs
- **THEN** it fails with a sentence naming what went wrong, and nothing is downloaded

#### Scenario: The download is cancelled
- **WHEN** the request is interrupted
- **THEN** the transfer is aborted and no installer is opened

### Requirement: On Linux, installing Node.js opens its download page
On Linux, where there is no system installer to hand a package to, the studio SHALL, when asked to install Node.js, open the Node.js download page (`https://nodejs.org/en/download`) in the person's default browser and SHALL say beside the button that the distribution's package manager or a version manager installs it too. The studio SHALL NOT download, unpack or install Node.js itself, and SHALL NOT ask for administrator rights.

#### Scenario: The sidecar is asked to install on Linux
- **WHEN** `node.install` reaches the sidecar off macOS
- **THEN** it refuses; the webview opens the page itself, and on macOS the studio keeps fetching the official installer and handing it to the system installer

#### Scenario: The install is asked for
- **WHEN** *Install Node.js* is pressed on Linux
- **THEN** the download page opens in the default browser, and the row stays as it is until Recheck finds Node.js

#### Scenario: The machine is offline
- **WHEN** the row is shown
- **THEN** it says the download page cannot be reached and to press Recheck once connected, instead of offering a button that cannot work

#### Scenario: The browser cannot be opened
- **WHEN** opening the page fails
- **THEN** the reason is shown as the checklist's own message, and the page's address is shown so it can be copied
