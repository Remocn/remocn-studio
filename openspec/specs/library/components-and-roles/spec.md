# library/components-and-roles Specification

## Purpose
Movement is described by a vocabulary rather than by keyframes, and every behaviour belongs to one moment in the life of the thing it is attached to. This capability covers that taxonomy, the dictionary of named behaviours built on it, the components the studio ships already classified, and the pane that shows them grouped by role.

## Requirements

### Requirement: Every behaviour has exactly one role
A movement SHALL carry one of five roles — entry, emphasis, exit, scene or transition — and SHALL never carry more than one. The roles SHALL read in the order a life runs, with the two whole-scene answers last, and each SHALL carry a label and a one-line hint saying what it answers: how a thing arrives, how it draws the eye while it is there, how it leaves, what holds the frame for a whole scene, and how one scene becomes the next. Entry, emphasis and exit SHALL be the roles an element itself has; scene and transition SHALL be about a whole scene.

#### Scenario: A behaviour replaces content in place
- **WHEN** a behaviour swaps a value, crossfades words or strikes a line through and reveals the next
- **THEN** it is emphasis, the element having been there before and being there after

#### Scenario: A number counts up to its value
- **WHEN** a behaviour brings content out of nothing, a count included
- **THEN** it is entry, the count being how that value arrives

#### Scenario: A behaviour could be read two ways
- **WHEN** a behaviour is ambiguous between a scene and a transition, or between one of those and an element role
- **THEN** it resolves outward: transition over scene, and scene over the three element roles

#### Scenario: A role is named in another spelling
- **WHEN** something claims a role by a word that is not one of the five
- **THEN** it is not recognised as a role at all

### Requirement: A role says which parameters a behaviour is expected to expose
Each role SHALL declare the parameters a behaviour in it is expected to take, and an exit SHALL declare exactly the parameters its entry does, so the pair is one decision rather than two.

#### Scenario: An entry is written
- **WHEN** a behaviour is an entry or an exit
- **THEN** it is expected to expose direction, duration in frames, delay, stagger and easing

#### Scenario: A whole-scene behaviour is written
- **WHEN** a behaviour holds the frame for a scene
- **THEN** it is expected to expose speed and intensity, where a transition exposes direction, duration in frames and easing

#### Scenario: An emphasis is written
- **WHEN** a behaviour draws the eye while its element is on screen
- **THEN** it is expected to expose intensity, repeat and delay

### Requirement: The dictionary names the behaviours an element can have
There SHALL be one dictionary of named behaviours for the three element roles, every name unique and written in kebab-case, and every exit SHALL mirror an entry of the same name. The names SHALL be the studio's vocabulary and the recipes behind them SHALL live in the bundled motion skill, where every name SHALL be documented. The dictionary SHALL exclude behaviours the studio's own lessons ban, pulsing among them.

#### Scenario: An exit is looked up
- **WHEN** a named exit is used
- **THEN** an entry of the same name exists, with `-out` reading against `-in`

#### Scenario: A name is used in a prompt
- **WHEN** the agent is given the vocabulary
- **THEN** every name in it is documented in the bundled motion skill, so the name and its recipe cannot drift apart

#### Scenario: A banned behaviour is looked for
- **WHEN** pulsing is looked for in the dictionary
- **THEN** it is not there

### Requirement: Every shipped component is classified, and nothing else is

Every motion component the studio ships SHALL have a role, and the classification SHALL name only components the studio actually ships. Caption styles SHALL be classified by their Captions category and SHALL carry no motion role, because they render a timed transcript rather than one motion behaviour. A name the studio does not ship SHALL answer with no role rather than a guess.

#### Scenario: The shipped set is listed
- **WHEN** the bundled motion components are listed
- **THEN** every motion component retains its assigned role
- **AND** none of those motion components is shown as unclassified

#### Scenario: A caption style is listed
- **WHEN** a bundled caption style is listed
- **THEN** it belongs to Captions with no entry, emphasis, exit, scene or transition role

#### Scenario: An unknown name is classified
- **WHEN** a role is asked for a name nothing ships
- **THEN** the answer is no role

### Requirement: The shipped components are listed as ordinary assets
The components that ship with the app SHALL be listed as assets, each carrying its title, its description, its category, the packages it needs, the files it is made of, its poster, its moving clip where one exists, and its role. Their slugs SHALL be marked so a shipped component is never mistaken for one the person saved. Without the resource that holds them, the listing SHALL be empty rather than an error.

#### Scenario: The pane asks for the shipped set
- **WHEN** the bundled components are listed
- **THEN** each is an asset of the component kind, with a poster to show and its category recorded

#### Scenario: The resource is not there
- **WHEN** the shipped components cannot be located
- **THEN** the listing is empty and nothing else in the pane fails

#### Scenario: A shipped component is on a card
- **WHEN** a shipped component's card is rendered
- **THEN** it carries no Delete action

### Requirement: The components view groups by role, with a leading group for the unclassified

The components view SHALL exclude bundled entries whose category is Shaders or Captions, which belong in their dedicated views, and SHALL show one group per role in the taxonomy's order, each headed by its name and the number of components in it, and SHALL drop a group holding nothing. Inside a group, components the person saved SHALL lead, followed by the shipped ones ordered by category. Saved components carrying no role SHALL form one leading group of their own.

#### Scenario: A saved component carries a role
- **WHEN** a component saved by the agent was given a role
- **THEN** it sits in that role's group, ahead of the shipped components in it

#### Scenario: A saved component carries no role
- **WHEN** a component has no role
- **THEN** it appears in a leading group of saved components
- **AND** that group is absent when every saved component has a role

#### Scenario: The list is searched
- **WHEN** a query is typed
- **THEN** the groups are rebuilt from what matched, with their counts following
- **AND** a query that matches nothing says so by name

#### Scenario: A component uses a shader internally
- **WHEN** a bundled entry belongs to Typography or Transitions rather than Shaders
- **THEN** it remains in Components with its existing role

#### Scenario: A shipped shader is browsed
- **WHEN** a bundled entry belongs to Shaders
- **THEN** it appears in Shaders and not as a duplicate card in Components

#### Scenario: A shipped caption is browsed
- **WHEN** a bundled entry belongs to Captions
- **THEN** it appears in Captions and not in a Components role or unclassified group

### Requirement: The view is a pinned control above a scroller, and the headings sit above the tiles
The search field SHALL be pinned above the scrolling list rather than made sticky inside it, so that it is drawn and takes its clicks in the same place however far the list has scrolled. The role headings SHALL stick to the scroller's own top edge and SHALL paint above the tiles' own click targets and actions. The view SHALL draw no fade over the top of its scroller, where a stuck heading sits.

#### Scenario: The list is scrolled
- **WHEN** tiles scroll under a role heading
- **THEN** the heading stays legible above them and the role being looked at is always readable

#### Scenario: The search field is clicked after scrolling
- **WHEN** the list has been scrolled and the field is clicked
- **THEN** the click reaches the field, which never moved

### Requirement: The role travels with the asset into a turn
An asset's role SHALL be stored on its manifest, SHALL be optional everywhere and SHALL decode as absent for anything written before roles existed. The agent SHALL be able to give a role when it saves a component, and SHALL be told to leave it out when nothing fits. When a referenced asset is copied into the project, its role SHALL be named beside it in the block the agent is given. Media SHALL never be given a role.

#### Scenario: A component with a role is referenced
- **WHEN** a saved component classified as an entry is referenced in a message
- **THEN** the block the agent gets names the asset and its role beside it

#### Scenario: An attached clip is copied in
- **WHEN** media is placed into the project
- **THEN** no role is named for it

#### Scenario: An asset saved before roles existed is read
- **WHEN** a manifest with no role is read back
- **THEN** it reads as having no role, rather than failing to decode

### Requirement: A shipped component is inserted with everything it pulls in
Inserting a shipped component SHALL copy that component and everything its registry entry depends on — the shared runtime, an icon set — into the layout the registry declares, relative to the project's Remotion root. Nothing already in the project SHALL be overwritten, so a second component reusing the same runtime skips it. The packages the project does not have SHALL be named. A name that is not among the shipped set SHALL be answered with a sentence, not a failure.

#### Scenario: The first shipped component is inserted
- **WHEN** a shipped component is referenced in a project that has none
- **THEN** it and its registry closure are copied into the project at the paths the registry names
- **AND** the agent is told where each file landed

#### Scenario: A second component shares the runtime
- **WHEN** another shipped component that needs the same runtime is inserted
- **THEN** the runtime files already there are left untouched and reported as such
- **AND** only the new component's own files are copied

#### Scenario: The name is not one the studio ships
- **WHEN** a reference names a shipped component that does not exist
- **THEN** the agent is told in a sentence that it is not among the bundled components and nothing was copied
- **AND** the turn runs
