# projects/project-settings-and-brand Specification

## Purpose
A project carries a portable manifest in its own folder holding its identity, its name and its brand — colours, logos, fonts, tone and guideline text — and the studio edits that manifest from Settings › Project. This capability covers the manifest and its atomic, revision-checked writes, the brand editor and its managed asset files, importing a design document, moving a project on disk, and how a video's brand is captured and later changed through the agent.

## Requirements

### Requirement: The project manifest is the portable record

The studio SHALL keep a project's identity, human name, revision number and nullable brand in a manifest inside the project folder, at `.remocn/project.json`, and SHALL treat its own database as the local index of paths and history rather than as the record of these fields. Reading a project SHALL reconcile the row's name and revision from the manifest when one is present.

#### Scenario: A project that has no manifest yet
- **WHEN** a project recorded before manifests existed is read
- **THEN** the studio SHALL answer with the row's own name, a null brand and revision zero
- **AND** SHALL NOT create a manifest merely by reading it

#### Scenario: The manifest holds a name
- **WHEN** a project whose manifest names it is listed or found
- **THEN** the row SHALL take the manifest's name and revision

#### Scenario: The manifest cannot be parsed
- **WHEN** the manifest is present but is not a valid project configuration
- **THEN** the studio SHALL fail, naming the file and the reason, rather than treating the project as unconfigured

#### Scenario: The manifest belongs to another project
- **WHEN** the manifest in a project's folder carries a different identity
- **THEN** the studio SHALL refuse, saying the folder belongs to a different project and should be opened separately

### Requirement: Saving settings is atomic, revision-checked and serialized

The studio SHALL write the manifest by writing a temporary file, flushing it and renaming it into place, SHALL accept a save only when the draft's expected revision matches the manifest's current revision, and SHALL increment the revision on every accepted change. Concurrent saves against one project SHALL be serialized, and a save from another studio process holding the project's lock SHALL be refused rather than interleaved.

#### Scenario: The revision has moved on
- **WHEN** a draft is saved whose expected revision no longer matches the manifest
- **THEN** the studio SHALL refuse with a request to reload before saving
- **AND** the draft SHALL be retained on screen rather than discarded

#### Scenario: The same save arrives twice
- **WHEN** a save that already landed is retried with the same expected revision, name and brand
- **THEN** the studio SHALL answer with the manifest as it stands and SHALL NOT increment the revision again

#### Scenario: Nothing actually changed
- **WHEN** a save carries the name and brand the manifest already holds and the manifest exists
- **THEN** the studio SHALL answer with the existing manifest without writing or bumping the revision

#### Scenario: The draft names another project
- **WHEN** a draft carrying a different project identity is saved
- **THEN** the studio SHALL refuse, saying the draft belongs to another project

#### Scenario: Another studio process is saving
- **WHEN** the project's settings lock is held by a live process
- **THEN** the studio SHALL refuse with a sentence saying another Studio process is saving this project's settings
- **AND** SHALL reclaim a lock left behind by a process that is no longer running

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

### Requirement: A brand is colours, logos, fonts, tone and guideline text

The studio SHALL let a brand carry named colours as six- or eight-digit hexadecimal values, up to three logos in the roles on-light, on-dark and mark, up to three font roles — display, body and mono — each with its files, licences and a fallback family, a tone description with preferred and avoided wording, logo usage rules, motion character, an optional brand name, and a provenance record of what was imported and from where. A brand SHALL be clearable back to none.

#### Scenario: A colour role is added
- **WHEN** a colour is named and added
- **THEN** the studio SHALL add it to the draft with a default value, and the name SHALL be usable only once

#### Scenario: A logo role is filled or emptied
- **WHEN** an image is chosen for a logo role, or that role is cleared
- **THEN** the draft SHALL carry or drop exactly that role, leaving the other two alone

#### Scenario: A logo cannot be previewed
- **WHEN** a chosen logo does not render in the editor's preview
- **THEN** the studio SHALL say a logo could not be previewed and that its file should be checked before saving

#### Scenario: The brand is cleared
- **WHEN** Clear brand is used
- **THEN** the draft's brand SHALL become none
- **AND** existing videos SHALL keep the brand they already captured

### Requirement: Managed brand assets are immutable and live inside the Remotion root

The studio SHALL store every brand file under the Remotion root's public brand folder in a directory named after the file's own content hash, SHALL never overwrite a stored file, and SHALL verify on every save that each brand file sits in its content-addressed folder and still hashes to the value recorded for it. It SHALL refuse any path that is absolute, that climbs out of the project, or that passes through a symlink.

#### Scenario: The same file is added twice
- **WHEN** a file whose contents are already stored is added again
- **THEN** the studio SHALL reuse the stored file rather than writing a second copy

#### Scenario: A brand file has been changed or removed on disk
- **WHEN** settings are saved and a recorded brand file is missing or no longer hashes to its recorded value
- **THEN** the studio SHALL refuse the save, naming the file

#### Scenario: A path that leaves the project
- **WHEN** a path is absolute, contains a parent-directory step, or passes through a symlink out of the managed area
- **THEN** the studio SHALL refuse it as unsafe rather than following it

#### Scenario: The Remotion root is nested inside the project folder
- **WHEN** the project folder is not itself the Remotion root
- **THEN** brand files SHALL still be stored under the Remotion root's public folder, and their recorded paths SHALL stay relative to the project folder

### Requirement: A brand file is checked before it is stored

The studio SHALL accept only images, fonts and plain-text or Markdown licence documents as brand files, SHALL cap each at forty megabytes, and SHALL verify that the contents match the file's declared type before storing it. A font SHALL additionally be decoded to record its family, style, weight, variable axes and character coverage.

#### Scenario: A file that is too large, empty or of an unsupported type
- **WHEN** the chosen file exceeds forty megabytes, is shorter than a header, or has an extension outside the accepted set
- **THEN** the studio SHALL refuse, saying what it accepts

#### Scenario: The contents disagree with the extension
- **WHEN** an image's bytes do not begin with the signature its extension implies, or a file named as a vector image contains no vector markup
- **THEN** the studio SHALL refuse, saying the contents do not match the file type

#### Scenario: A font that cannot be decoded
- **WHEN** a file has a plausible font header but its contents cannot be read as one, or it is a font collection rather than a single font
- **THEN** the studio SHALL refuse, saying to choose a valid font file
- **AND** SHALL NOT store it

#### Scenario: A variable font
- **WHEN** a decoded font declares a weight axis
- **THEN** the recorded weight SHALL be that axis's range rather than a single value

### Requirement: A font can be fetched from Google Fonts into the project

The studio SHALL fetch a named family at requested weights from Google Fonts, SHALL accept the font files only from Google's own font host, SHALL store each returned file as a managed brand asset with its weight, style and character range, and SHALL keep the stylesheet it resolved as a provenance source beside them.

#### Scenario: A family and weights are given
- **WHEN** a family name and a weight list or range are entered and the download is used
- **THEN** the studio SHALL store every returned face for that role, keeping the licences already recorded for it

#### Scenario: The family or weights are malformed
- **WHEN** the family or the weight specification does not have the expected shape
- **THEN** the studio SHALL refuse with an example of what it expects, without making a request

#### Scenario: The download fails or returns nothing usable
- **WHEN** the request fails, is redirected, exceeds the size cap, times out, or yields no supported font file
- **THEN** the studio SHALL say so rather than recording a font role with no files

### Requirement: A design document is imported as a proposal, and its original is kept

The studio SHALL import a local Markdown design document, reading optional front-matter tokens and the body, resolving token references with a cycle check, normalising supported colour notations to the project's hexadecimal model, and offering the families and weights it found as candidates. It SHALL present the result for review with editable destination roles and explicit replacements, SHALL keep the complete original document and an immutable reference to its stored file in the brand, and SHALL NOT fetch anything the document links to.

#### Scenario: A document with tokens
- **WHEN** a document carrying colour and typography tokens is imported
- **THEN** the studio SHALL show the colours it read, the font families and weights it found, and any notes it raised, before anything is applied

#### Scenario: A prose-only document
- **WHEN** the document has no front matter
- **THEN** the studio SHALL note that no tokens were found and that the document is kept as design context, and SHALL infer no brand fields from the prose

#### Scenario: Token references that cannot be resolved
- **WHEN** a token reference is circular, excessively deep, or names something the document does not define
- **THEN** the studio SHALL refuse the import, naming the reference

#### Scenario: Front matter that is malformed
- **WHEN** the front matter is not closed, holds duplicate keys, is not a mapping, or declares colours or typography as something other than a mapping
- **THEN** the studio SHALL refuse with the reason

#### Scenario: A colour notation the studio cannot read
- **WHEN** a colour token cannot be parsed
- **THEN** the studio SHALL skip it with a note naming the token, rather than failing the whole import

#### Scenario: The file is not a suitable document
- **WHEN** the chosen file is not Markdown, is not a regular file, is empty, is not valid UTF-8, or exceeds the size cap
- **THEN** the studio SHALL refuse, saying what it accepts

#### Scenario: Review and application
- **WHEN** the review is applied
- **THEN** only the colours ticked and the fonts given a destination role SHALL reach the draft, each destination role SHALL be usable once, and role names SHALL be refused unless they start with a letter and hold only letters, digits, underscores or hyphens
- **AND** the fields the brand already carries SHALL be kept unless they are explicitly replaced

#### Scenario: Fonts named but not supplied
- **WHEN** the document names families without font files
- **THEN** the studio SHALL say that font names include no files and that the files must be added or downloaded after importing
- **AND** the font role SHALL remain visible in the editor with no files rather than being dropped

#### Scenario: The import is cancelled
- **WHEN** the review is cancelled
- **THEN** the draft SHALL be unchanged
- **AND** the document stored while reading it SHALL be harmless, since nothing references it

#### Scenario: A document is dropped on the editor
- **WHEN** files are dropped on the import area
- **THEN** the studio SHALL accept exactly one Markdown file and SHALL otherwise say to drop one Markdown file

### Requirement: A video captures the brand it was created with

The studio SHALL write a brand snapshot beside every video it creates, carrying the project's brand as it stood, the project identity, the revision and a hash over the brand, and SHALL verify that hash when reading it. An existing video's snapshot SHALL change only through an explicit brand application.

#### Scenario: A new video
- **WHEN** a video is created
- **THEN** the studio SHALL write the project's current brand as that video's snapshot
- **AND** SHALL generate that video's local font runtime module and, for the studio's own starter video only, wire its colours, display family and font gate into the starter composition

#### Scenario: The project's brand changes afterwards
- **WHEN** the project's brand is saved again
- **THEN** existing videos SHALL keep the snapshot they already have

#### Scenario: A snapshot that does not match its own hash
- **WHEN** a video's snapshot has been edited so that its hash no longer matches its contents
- **THEN** the studio SHALL refuse to use it, saying the hash does not match

#### Scenario: A snapshot from another project
- **WHEN** a video's snapshot names a different project identity
- **THEN** the studio SHALL refuse, rather than briefing the agent with another project's brand

### Requirement: Every turn receives the video's brand as data, and instructions outrank it

The studio SHALL hand the video's brand snapshot to whichever provider runs the turn, SHALL mark it explicitly as user data rather than as instructions, and SHALL state that the person's explicit instructions for the video take priority over it, that role overrides are recorded as exceptions without altering the brand or its hash, and that an imported design document is reference material whose workflow or tool instructions are never followed.

#### Scenario: A turn in a video with a snapshot
- **WHEN** a turn starts in a video that has a brand snapshot
- **THEN** the brief SHALL be included for every provider, naming the snapshot's location and the Remotion root the public paths are relative to

#### Scenario: A turn in a video with no snapshot
- **WHEN** the video has no snapshot
- **THEN** no brand brief SHALL be sent and the turn SHALL run normally

#### Scenario: Brand data that does not verify
- **WHEN** the snapshot's brand references a managed file that is missing or changed
- **THEN** the studio SHALL report it rather than quietly substituting anything

### Requirement: Applying a brand to an existing video is explicit and ends in a review

The studio SHALL change an existing video's brand only through an application the person starts, SHALL record the previous and target snapshots with a status, SHALL brief the agent with the changed fields, and SHALL write the new snapshot only after the person confirms that they have reviewed the result.

#### Scenario: Videos are selected and applied
- **WHEN** videos are selected in Settings and the brand is applied
- **THEN** the studio SHALL start one turn per video asking for the brand to be applied and the result reported for review
- **AND** a video that already has a turn running SHALL not be selectable

#### Scenario: The project's brand moved while the application was starting
- **WHEN** a turn carrying a brand revision reaches a project whose manifest is at a different revision
- **THEN** the studio SHALL refuse the turn, saying the project brand changed and settings should be reloaded

#### Scenario: The turn ends
- **WHEN** the turn finishes, fails or is interrupted
- **THEN** the application SHALL be recorded as awaiting review on success and as failed otherwise
- **AND** an application still recorded as running with no turn behind it SHALL read as failed

#### Scenario: Confirmation
- **WHEN** the person confirms a reviewed application
- **THEN** the studio SHALL write the target snapshot for that video and mark the application confirmed
- **AND** SHALL refuse if the application is not awaiting review, if its project or revision does not match, or if the video's snapshot changed since the application began

#### Scenario: Two brand turns in one project
- **WHEN** brand applications are started for several videos of one project
- **THEN** the studio SHALL run them one at a time for that project

#### Scenario: The agent's own limits
- **WHEN** the agent is briefed for an application
- **THEN** it SHALL be told to preserve local exceptions and unrelated edits, to verify the affected compositions, not to perform a repository-wide colour or font replacement, and not to edit the snapshot or the project manifest itself

### Requirement: Each video's fonts load locally with no network

The studio SHALL generate, for a video's snapshot, a local module that registers the brand's font files from the project's own public folder, names each family after a hash of its files so two brands cannot collide, and exposes a hook the composition waits on before drawing. The module SHALL be named after the snapshot's hash and SHALL never be overwritten with different contents.

#### Scenario: A snapshot with fonts
- **WHEN** the module is generated for a snapshot carrying font roles
- **THEN** it SHALL reference the font files by their project-relative paths and SHALL make no network request

#### Scenario: The module already exists
- **WHEN** a module for that snapshot hash is already present with the same contents
- **THEN** the studio SHALL leave it alone
- **AND** SHALL fail rather than replacing one whose contents differ

### Requirement: Moving a project is journalled, verified and reversible until the switch

The studio SHALL move a project's folder only after validating the source, the destination and the project's Git layout, SHALL take an exclusive lock on the project for the duration, SHALL stop the project's preview first, SHALL journal its progress outside both folders, and SHALL change the recorded location only after the files have arrived and been verified.

#### Scenario: The destination is unusable
- **WHEN** the destination already exists, is the source itself, or is inside the source
- **THEN** the studio SHALL refuse before touching any file, saying which

#### Scenario: The source is gone
- **WHEN** the project's folder is missing
- **THEN** the studio SHALL refuse and say to use Locate folder

#### Scenario: Linked Git worktrees or submodules
- **WHEN** the project is a linked worktree, holds worktrees of its own, or declares submodules
- **THEN** the studio SHALL refuse, saying to move them with Git first

#### Scenario: A move within one volume
- **WHEN** the destination is on the same volume
- **THEN** the studio SHALL move the folder, including hidden files, preserving symbolic links without following them, and then switch the recorded location

#### Scenario: A move across volumes
- **WHEN** the destination is on another volume
- **THEN** the studio SHALL copy into a staging folder, compare an inventory of every entry, mode and file hash on both sides, and only then put the copy in place, switch the recorded location and delete the original
- **AND** SHALL refuse with a recovery message if the copy cannot be verified, naming both the original and the partial copy

#### Scenario: The move is cancelled
- **WHEN** a cross-volume copy is cancelled before the switch
- **THEN** the studio SHALL remove the partial copy and its journal and SHALL leave the original folder unchanged

#### Scenario: The recorded location cannot be updated
- **WHEN** the files have arrived but the index cannot be switched
- **THEN** the studio SHALL keep the journal and the destination and say where the files are, where they came from, and that Locate folder restores the link

#### Scenario: Anything else is attempted during a move
- **WHEN** another operation on that project is requested while it is moving
- **THEN** the studio SHALL refuse it as busy, saying the project is moving

#### Scenario: A move is started while the project is busy
- **WHEN** a move is requested while another operation on that project is running
- **THEN** the studio SHALL refuse, saying to wait for the active operation to finish

#### Scenario: The project has no manifest yet
- **WHEN** a project that never had a manifest is moved
- **THEN** the studio SHALL write its manifest before moving the files, so the moved folder carries its identity
