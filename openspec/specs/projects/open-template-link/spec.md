# projects/open-template-link Specification

## Purpose
The studio answers one URL scheme, `remocn-studio://`, with one route: a link that creates a project from a bundled template with the properties the link carries and opens it. This capability covers what such a link may say, how a link reaches the studio from a cold start and into a running app, what the studio writes for it, and what it refuses.

## Requirements

### Requirement: The link can name a template and its properties, and nothing else

The studio SHALL accept `remocn-studio://open-template` carrying a `template` naming one of the templates it ships and a `props` carrying base64url-encoded UTF-8 JSON, and SHALL accept the route written either as the link's host or as its path. It SHALL decode the properties through the template's own declared shape, dropping any key that shape does not declare.

#### Scenario: A well-formed link
- **WHEN** a link names a known template and carries properties matching its shape
- **THEN** the studio SHALL accept it and create a project from that template with those properties

#### Scenario: The route is written with a leading slash
- **WHEN** the route appears in the link's path rather than its host
- **THEN** the studio SHALL read it as the same route

#### Scenario: Keys the template does not declare
- **WHEN** the encoded properties carry keys beyond what the template declares
- **THEN** the studio SHALL drop them, and nothing a link carries beyond that shape SHALL reach a file

#### Scenario: Text beyond Latin-1
- **WHEN** a property carries characters outside Latin-1
- **THEN** the studio SHALL decode them intact, and the encoding SHALL carry no padding and no characters a URL would object to

### Requirement: Anything else is a notice and no project

The studio SHALL refuse, with a message naming the reason and without creating anything, every link that is not the one route it has. It SHALL NOT partially create a project for a link it then refuses.

#### Scenario: Another scheme, or text that is not a link
- **WHEN** the studio is handed a URL for another scheme, or text that is not a URL at all
- **THEN** it SHALL say the link is not a Remocn Studio link

#### Scenario: A route the studio does not have
- **WHEN** the link asks for a route other than opening a template
- **THEN** the studio SHALL say what the link asked for and that it cannot do it

#### Scenario: A template the studio does not ship
- **WHEN** the link names no template, or names one that is not among the templates the studio ships
- **THEN** the studio SHALL refuse, naming the template it was given

#### Scenario: Properties that cannot be read
- **WHEN** the properties are absent, are not base64url, are not valid UTF-8, are not JSON, or do not match the template's shape
- **THEN** the studio SHALL say either that the properties could not be read or that they are not the ones the template expects

#### Scenario: A refusal is shown
- **WHEN** a link is refused
- **THEN** the studio SHALL show a notice carrying the reason
- **AND** SHALL create no folder, no project and no video

### Requirement: A cold start and a running app take the same path

The Rust core SHALL hold every URL the platform hands it in a queue and SHALL emit an event as a nudge; the webview SHALL drain that queue once when it comes up and again on every nudge. A link that started the studio and a link delivered into a running studio SHALL therefore be handled identically, and the window SHALL be shown and focused when one arrives.

#### Scenario: The link started the studio
- **WHEN** a link is delivered before any page is listening
- **THEN** it SHALL wait in the core's queue and SHALL be read once the page comes up

#### Scenario: The link reaches a running studio
- **WHEN** a link is delivered while the studio is running
- **THEN** the core SHALL queue it, emit the nudge, and show, unminimize and focus the window
- **AND** the webview SHALL read the queue again

#### Scenario: A second launch of the studio
- **WHEN** the studio is launched again while an instance is running
- **THEN** the second launch's link SHALL be forwarded to the running instance rather than starting a second studio

#### Scenario: Outside a Tauri webview
- **WHEN** the page is running without a core to ask
- **THEN** reading the queue SHALL be quiet rather than an error on screen

#### Scenario: Two links in a row
- **WHEN** two links arrive close together
- **THEN** the studio SHALL create their projects one after the other, so the second does not start while the first is still choosing its folder

### Requirement: Opening a link mints a free folder and never lands in an existing project

The studio SHALL create the project under its own default location — a folder beneath the person's Movies directory — naming it after the template and the properties, and SHALL append a counter until the folder name is free.

#### Scenario: The name is free
- **WHEN** no folder of that name exists
- **THEN** the studio SHALL create it and use it

#### Scenario: The same link is opened twice
- **WHEN** a folder of that name already exists
- **THEN** the studio SHALL count past it, creating the next free name
- **AND** SHALL NOT reuse the existing folder

#### Scenario: The properties name nobody
- **WHEN** the properties carry no usable name for the project
- **THEN** the studio SHALL still produce a project name rather than an empty one

### Requirement: The link's project is written, then finished by the ordinary scaffold

The studio SHALL, for an accepted link, register the project, write its manifest, expand the project template, register the scan, expand the template's video with the link's properties stamped into its module, merge the pins that video needs into the project's package manifest, and create the video's row. The webview SHALL then run the ordinary scaffold and install, expand the video and open a chat on it.

#### Scenario: A link is accepted
- **WHEN** the project has been written
- **THEN** the studio SHALL remember it, start the ordinary scaffold, remember and expand its video, open a new chat, and show the videos view
- **AND** the install progress and its Retry SHALL be the ordinary ones

#### Scenario: The pins the template needs
- **WHEN** the template's video requires packages beyond what the project template installs
- **THEN** the studio SHALL add them at the project's own Remotion version where they belong to Remotion
- **AND** SHALL NOT move a pin the project already declares

#### Scenario: The project declares no Remotion version
- **WHEN** the package manifest names no Remotion version to pin against
- **THEN** the studio SHALL fail with a sentence naming the manifest rather than guessing a version

#### Scenario: The template module lost its slot
- **WHEN** the template's video module no longer carries the slot the properties are written into
- **THEN** the studio SHALL refuse with a sentence naming the template, rather than creating a video with no properties

#### Scenario: Creating the project fails
- **WHEN** any step of writing the project fails
- **THEN** the studio SHALL show a notice saying the project could not be created, carrying the message

### Requirement: A link works signed out and on Free

The studio SHALL open a template link without an account and without a paid plan, and SHALL NOT require either before creating the project.

#### Scenario: Nobody is signed in
- **WHEN** a link is opened while signed out
- **THEN** the studio SHALL create the project and open it

#### Scenario: The plan is Free
- **WHEN** a link is opened on the Free plan
- **THEN** the studio SHALL create the project and open it
- **AND** the paid gates described in account/plans-and-entitlement SHALL apply to the chat exactly as they do in any other project

### Requirement: The scheme is registered by the installed application

The URL scheme SHALL be declared by the application bundle rather than registered at runtime, so the studio answers a link only when it is running as an installed application.

#### Scenario: A development build
- **WHEN** a link is opened against a build that is not an installed application bundle
- **THEN** the operating system SHALL not route the link to the studio, and the studio SHALL therefore do nothing

### Requirement: The welcome link creates the current personalized thank-you video

The bundled `welcome-early-member` template SHALL contain the 570-frame, 30fps welcome video using a warm solid background, personalized kinetic typography and the early-member card. It SHALL NOT include the previous neural shader or confetti effect.

#### Scenario: A new welcome project
- **WHEN** an accepted link names `welcome-early-member`
- **THEN** the new project SHALL contain that video with the link's name, member number and dates
- **AND** its font dependency SHALL match the project's Remotion version

#### Scenario: A previous welcome project already exists
- **WHEN** the same link is opened using the updated application
- **THEN** a new project SHALL use the updated template
- **AND** existing project files SHALL remain unchanged
