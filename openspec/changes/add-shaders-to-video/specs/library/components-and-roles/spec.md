## MODIFIED Requirements

### Requirement: The components view groups by role, with a leading group for the unclassified
The components view SHALL exclude bundled entries whose category is Shaders, which belong in the dedicated Shaders view, and SHALL show one group per role in the taxonomy's order, each headed by its name and the number of components in it, and SHALL drop a group holding nothing. Inside a group, components the person saved SHALL lead, followed by the shipped ones ordered by category. Saved components carrying no role SHALL form one leading group of their own.

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
