## MODIFIED Requirements

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
