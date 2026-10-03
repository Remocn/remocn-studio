## MODIFIED Requirements

### Requirement: Settings › Project binds a draft to one project

The studio SHALL show, for the project chosen in Settings, a General group carrying the project's name and its location and a Brand section, SHALL save the name and the brand together in one action, and SHALL treat the location as a separate action that is unavailable while the draft has unsaved changes.

#### Scenario: No project is open
- **WHEN** Settings › Project is opened with no project
- **THEN** the studio SHALL offer to open a folder or create a project rather than showing an empty form

#### Scenario: Unsaved changes
- **WHEN** the draft differs from what is saved
- **THEN** the studio SHALL say there are unsaved changes, enable Save changes and Cancel changes, and SHALL refuse to move to another settings section or to another project until the draft is saved or cancelled
- **AND** Move project and Locate folder SHALL be unavailable while it is dirty

#### Scenario: Cancel changes
- **WHEN** Cancel changes is pressed
- **THEN** the draft SHALL return to the last saved configuration and nothing SHALL be written

#### Scenario: The project's folder is missing
- **WHEN** the chosen project's folder is gone
- **THEN** the form SHALL say so and offer Locate folder
- **AND** the name field, the brand editor, Show in Finder (Show in Files on Linux) and Move project SHALL be unavailable

#### Scenario: The project is switched under the form
- **WHEN** settings are read for one project and another project is chosen before the answer arrives
- **THEN** the studio SHALL discard the late answer rather than binding another project's configuration to the form
