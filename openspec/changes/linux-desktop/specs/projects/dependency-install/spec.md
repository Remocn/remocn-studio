## ADDED Requirements

### Requirement: On Linux, installing Node.js opens its download page
On Linux, where there is no system installer to hand a package to, the studio SHALL, when asked to install Node.js, open the Node.js download page (`https://nodejs.org/en/download`) in the person's default browser and SHALL say beside the button that the distribution's package manager or a version manager installs it too. The studio SHALL NOT download, unpack or install Node.js itself, and SHALL NOT ask for administrator rights. The webview owns this; the sidecar takes no part in it, and refuses `node.install` off macOS. On macOS the studio keeps fetching the official installer and handing it to the system installer.

#### Scenario: The install is asked for
- **WHEN** *Install Node.js* is pressed on Linux
- **THEN** the download page opens in the default browser, and the row stays as it is until Recheck finds Node.js

#### Scenario: The machine is offline
- **WHEN** the row is shown
- **THEN** it says the download page cannot be reached and to press Recheck once connected, instead of offering a button that cannot work

#### Scenario: The browser cannot be opened
- **WHEN** opening the page fails
- **THEN** the reason is shown as the checklist's own message, and the page's address is shown so it can be copied
