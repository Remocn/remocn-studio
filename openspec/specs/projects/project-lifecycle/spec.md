# projects/project-lifecycle Specification

## Purpose
A project is a folder on disk that the studio remembers. This capability covers opening any folder, creating one through the wizard, scaffolding and installing it, keeping its row when the folder moves or disappears, renaming and removing it, and what happens on screen when the person switches from one project to another.

## Requirements

### Requirement: A folder is a project row

The studio SHALL record a project as a row holding an identity, a canonical path, a name and its timestamps, and SHALL resolve the path through symlinks before recording it so that the same folder opened twice is one project rather than two histories. A row SHALL be answered with the name the folder's own manifest carries when there is one, and with the folder's basename otherwise.

#### Scenario: The same folder is opened twice
- **WHEN** a folder that is already a project is opened again, by its own path or through a symlink to it
- **THEN** the studio SHALL answer with the project that already exists
- **AND** SHALL NOT create a second project or a second history for it

#### Scenario: A folder that is not a Remotion project
- **WHEN** any folder is opened
- **THEN** the studio SHALL open it as a project regardless of what it contains
- **AND** SHALL leave what is wrong with it to be reported by projects/environment-checklist

#### Scenario: The folder carries a manifest naming a different project
- **WHEN** a folder holds a project manifest whose identity is registered at another location
- **THEN** the studio SHALL refuse to open it, saying that the identity is already registered elsewhere, that a moved original is reconnected with Locate folder, and that a copy must be given a distinct identity
- **AND** SHALL NOT adopt the folder under the existing identity

### Requirement: Creating a project and its first video are one gesture

The studio SHALL offer a New project wizard with exactly three fields — a name, a location and an aspect ratio — SHALL create the folder under the chosen location, and SHALL then create the project's first video under the project's own name with the chosen ratio, expand it and open an empty chat on it, without any further step from the person.

#### Scenario: The wizard is completed
- **WHEN** a name, a location and a ratio are given and Create is pressed
- **THEN** the studio SHALL create the folder, register the project, start the scaffold, create the first video with that ratio, and open a new chat on it

#### Scenario: The wizard is incomplete
- **WHEN** the name is empty or no location has been chosen
- **THEN** Create SHALL be disabled and nothing SHALL be written to disk

### Requirement: Scaffolding streams its two steps and never overwrites

The studio SHALL scaffold a project in two reported steps — copying the template, then installing dependencies — SHALL report each step as it starts and finishes, and SHALL skip any file the folder already holds. The package manifest it copies SHALL be renamed after the folder, using a name the package registry accepts.

#### Scenario: A file already exists
- **WHEN** the template is expanded into a folder that already holds one of its files
- **THEN** the studio SHALL leave that file exactly as it is
- **AND** SHALL write only the files that were absent

#### Scenario: The scaffold fails
- **WHEN** the template copy or the install fails
- **THEN** the studio SHALL say which of the two steps failed, show the underlying message, and offer Retry
- **AND** SHALL leave the project in the list rather than removing it

#### Scenario: The chat is used while the install runs
- **WHEN** dependencies are still installing
- **THEN** the composer SHALL remain usable and a turn SHALL be allowed to start
- **AND** the preview SHALL NOT be started for that project until the scaffold has finished

#### Scenario: The folder cannot be created
- **WHEN** creating the folder or registering the project fails
- **THEN** the wizard SHALL close and the reason SHALL be shown beside the project list
- **AND** no project SHALL be added to the list

#### Scenario: Retry after the agent has edited the project
- **WHEN** Retry is pressed on a project whose files the agent has since changed
- **THEN** the studio SHALL re-run the same two steps and SHALL NOT overwrite any edited file

### Requirement: A folder that is gone keeps its history

The studio SHALL compute whether a project's folder is present each time the row is read, SHALL keep the row, its videos, its chats and its transcripts when the folder is gone, and SHALL present such projects apart from the ones still on disk. It SHALL refuse to start a turn in a folder that is not there.

#### Scenario: The folder has been moved or deleted
- **WHEN** a project's folder no longer exists
- **THEN** the project SHALL be marked missing and listed under a heading saying it was moved or deleted
- **AND** its chats and transcripts SHALL still be readable
- **AND** New video SHALL be unavailable, and in the project's settings the name field, the brand editor, Show in Finder (Show in Files on Linux) and Move project SHALL be unavailable

#### Scenario: A turn is attempted in a missing folder
- **WHEN** a turn, or any other operation needing the folder, is requested for a project whose folder is gone
- **THEN** the studio SHALL refuse with a sentence naming the project and the path that is gone, rather than handing the provider a working directory that does not exist

### Requirement: Locate folder reconnects a project and never moves files

The studio SHALL offer Locate folder for a project, SHALL verify that the chosen folder is the same project before accepting it, and SHALL only change the recorded path. It SHALL NOT copy, move or delete anything on disk.

#### Scenario: The chosen folder carries the project's own manifest
- **WHEN** a folder holding this project's identity is chosen
- **THEN** the studio SHALL record the new path and answer with the project at that location

#### Scenario: The chosen folder belongs to another project
- **WHEN** the chosen folder holds a manifest for a different identity
- **THEN** the studio SHALL refuse, saying the folder belongs to a different project

#### Scenario: The chosen folder is already open as another project
- **WHEN** the chosen path is already registered under a different project
- **THEN** the studio SHALL refuse and name the project that already occupies it

#### Scenario: A project recorded before manifests existed
- **WHEN** the chosen folder carries no manifest
- **THEN** the studio SHALL accept it only if it declares a Remotion dependency and holds a folder for every one of the project's own videos, and SHALL then write the project's manifest into it
- **AND** SHALL otherwise refuse, saying the folder does not match this project

#### Scenario: Provider conversations after a relocation
- **WHEN** a project has been relocated
- **THEN** the studio SHALL drop the provider resume tokens of that project's chats, so the next turn starts a fresh provider conversation in the new folder while the studio's own transcript is preserved

### Requirement: Removing a project never touches the folder

The studio SHALL remove a project as a single row deletion that takes its videos, chats and transcripts with it, SHALL stop any turn running in it first, and SHALL leave every file on disk exactly as it is.

#### Scenario: Remove is confirmed
- **WHEN** Remove is confirmed for a project
- **THEN** the studio SHALL stop that project's running turns, delete the project and its history, and drop it from the list
- **AND** SHALL NOT delete, move or write anything inside the folder

#### Scenario: The confirmation is read before the decision
- **WHEN** the remove confirmation is shown
- **THEN** it SHALL say that the chats and their transcripts go with the project and that the folder on disk is left as it is

### Requirement: Renaming a project changes a name and nothing else

The studio SHALL rename a project by writing the trimmed name into the project's manifest and its row, and SHALL leave the folder name and the path untouched. An empty name SHALL be refused.

#### Scenario: A new name is submitted
- **WHEN** a non-empty name is submitted
- **THEN** the studio SHALL store the trimmed name and the project SHALL keep its path

#### Scenario: The name is blank
- **WHEN** the name is empty or only whitespace
- **THEN** Rename SHALL be disabled, and a blank name reaching the store SHALL be refused with a request to enter one

#### Scenario: The folder is missing
- **WHEN** a project whose folder is gone is renamed
- **THEN** the studio SHALL record the new name without attempting to write a manifest

### Requirement: Projects are ordered by their most recent chat

The studio SHALL order projects by the most recent activity in their chats, falling back to the project's own timestamp when it has none, newest first.

#### Scenario: A chat receives a turn
- **WHEN** a turn runs in one project's chat
- **THEN** that project SHALL lead the list on the next read

#### Scenario: A project with no chats
- **WHEN** a project has never been used
- **THEN** it SHALL be ordered by its own timestamp among the rest

### Requirement: Switching projects opens that project's most recent chat

The studio SHALL list the known projects in the sidebar, in the command palette's Projects group and, on macOS, in the application's File menu, marking the open one, and SHALL, whenever a project is chosen in any of them, open that project's most recent chat, so that the video list, the preview, the conventions and Export are all bound to one project at a time.

#### Scenario: The project has chats
- **WHEN** a project holding chats is chosen
- **THEN** the studio SHALL select that project, select and expand the video its newest chat belongs to, and open that chat

#### Scenario: The project has no chats yet
- **WHEN** a project with no chats is chosen
- **THEN** the studio SHALL select the project and open an empty composer rather than leaving another project's conversation on screen

#### Scenario: Chosen from the palette
- **WHEN** a project is chosen from the palette's Projects group
- **THEN** the studio does exactly what choosing it in the sidebar does

### Requirement: A list that failed is not a list that is empty

The studio SHALL distinguish the project list itself failing from a single folder that would not open. A failed list SHALL be reported as a failure with a Try again, and SHALL NOT be presented as a first run.

#### Scenario: The project list cannot be read
- **WHEN** reading the projects fails
- **THEN** the conversation SHALL say the project list could not be read, show the message, and offer Try again
- **AND** SHALL NOT show first-run onboarding

#### Scenario: One folder would not open
- **WHEN** opening a chosen folder fails while the list itself is intact
- **THEN** the studio SHALL show the message beside the list and SHALL keep the list on screen

#### Scenario: There are genuinely no projects
- **WHEN** the list is read successfully and is empty
- **THEN** the studio SHALL show first-run onboarding, offering to create a project or open a folder

### Requirement: A folder remembered by an earlier version is adopted once

The studio SHALL, when `projectFolder` in `settings.json` still names a single folder from before projects were a list, open that folder as a project on the next launch, forget the setting, and then read the list normally.

#### Scenario: The remembered folder is present
- **WHEN** the studio starts with a remembered folder recorded
- **THEN** it SHALL open that folder as a project, select it, clear `projectFolder`, and reload the list

#### Scenario: The remembered folder cannot be opened
- **WHEN** opening it fails
- **THEN** the studio SHALL leave `projectFolder` in place and read the list anyway, rather than failing the launch

### Requirement: New folder imports require Studio provenance

The studio SHALL refuse a new external folder lacking Studio identity while preserving access to existing registered projects and creation through Studio.

#### Scenario: A Studio project is opened
- **WHEN** the folder carries its Studio manifest
- **THEN** it can be registered subject to identity checks

#### Scenario: An arbitrary external folder is opened
- **WHEN** the folder is neither registered nor a Studio project
- **THEN** it is refused without writing into it
