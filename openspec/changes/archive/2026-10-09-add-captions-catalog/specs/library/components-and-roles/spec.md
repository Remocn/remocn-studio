## MODIFIED Requirements

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
