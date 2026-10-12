# preview/managed-objects Specification

## Purpose
Provides persistent, independently addressable editable objects for Studio-generated videos without replacing React rendering.

## Requirements

### Requirement: A managed video has a validated independent object catalogue

The studio SHALL read a versioned catalogue independently of the current frame and SHALL reject duplicate IDs, missing definitions, parent cycles and invalid values without altering the source.

#### Scenario: An object is outside the frame
- **WHEN** a managed object is not mounted
- **THEN** its declared properties remain available in the catalogue

#### Scenario: An invalid document is read
- **WHEN** the document is malformed or incompatible
- **THEN** a descriptive failure is shown and no data is rewritten

### Requirement: Managed edits are checked and idempotent

The studio SHALL save one completed property operation directly, checking the addressed value and definition, preserving unrelated fields, and recording its operation ID atomically with the change. Undo SHALL apply the inverse with the same preconditions.

#### Scenario: An independent concurrent edit
- **WHEN** another writer changes a different property
- **THEN** both changes survive

#### Scenario: A conflicting edit
- **WHEN** the addressed value or definition changed
- **THEN** the operation is refused and the newer data remains intact

### Requirement: An operation retry has one result

The studio SHALL remember completed operation IDs in the document and reject reusing an ID for different contents.

#### Scenario: An answer was lost
- **WHEN** the same completed operation is retried
- **THEN** it is not applied twice

#### Scenario: An ID is reused incorrectly
- **WHEN** an existing operation ID carries different contents
- **THEN** it is refused

### Requirement: A managed object is removed in its document and restored by the inverse

The studio SHALL remove a managed object with one operation that marks its record removed and leaves its ID, label, values, definition and place in the tree unchanged. The operation SHALL be refused when the object does not exist, is already removed or sits under a removed ancestor, or is a scene. Its inverse SHALL restore the record by clearing the mark, and SHALL be refused unless the record is still marked removed. Both SHALL be checked, recorded and retried exactly like a property operation. A property edit addressed to a removed object SHALL be refused.

#### Scenario: Removing a heading

- **WHEN** the person removes the "Subtitle" object
- **THEN** its record stays in the document with its values and parent, marked removed
- **AND** one operation is recorded

#### Scenario: Restoring it

- **WHEN** that removal is undone
- **THEN** the mark is cleared and the object has exactly the values and place it had

#### Scenario: Removing a scene

- **WHEN** a removal names an object whose definition is a scene
- **THEN** it is refused with a sentence saying a scene cannot be deleted, and the document is unchanged

#### Scenario: The object was already removed elsewhere

- **WHEN** a removal names an object that is already removed, or whose ancestor is
- **THEN** it is refused and the document is unchanged

#### Scenario: Editing a removed object

- **WHEN** a property operation addresses an object that is removed
- **THEN** it is refused with a sentence saying the object was deleted

#### Scenario: A lost answer is retried

- **WHEN** the same removal is sent again with the same operation ID
- **THEN** it is not applied twice

### Requirement: A removed object is not painted, and its values stay readable

In a video on the v6 runtime, an object SHALL count as removed when it or any of its ancestors is marked removed. The root it binds SHALL NOT be painted in the preview, in stills or in an Export, while every reader of its values SHALL receive them unchanged. Its ID SHALL remain reserved.

#### Scenario: Removing a group

- **WHEN** a group with three children is removed
- **THEN** neither the group nor any of its children is painted
- **AND** undoing the removal paints all four again

#### Scenario: A value read elsewhere

- **WHEN** a removed object's timing fields are read by the video's timeline
- **THEN** the timeline computes as before and the video still plays

#### Scenario: Exporting after a removal

- **WHEN** a video with a removed object is exported
- **THEN** the object is absent from the exported file

### Requirement: A video moves to the v6 runtime on its first removal

The studio SHALL ship a `studio-objects-v6` runtime that renders every v5 video identically, keeps every v5 reader in the video working unchanged, additionally honours removal, and marks its presence where the preview can see it. When the first removal is asked for in a video whose provider is imported from the v5 runtime, the studio SHALL, as part of that gesture, rewrite that one import to v6 and change nothing else, and SHALL say so in a notice. A video on v6 or a compatible later runtime SHALL use removal without a downgrade. A video whose provider is not a supported removal runtime and cannot take the verified v5 upgrade SHALL NOT be offered managed removal.

#### Scenario: The first Delete in a v5 video

- **WHEN** the person deletes an object in a video whose provider is imported from `studio-objects-v5`
- **THEN** that import now names `studio-objects-v6`, the object is removed, and a notice says the video was upgraded so objects can be deleted
- **AND** components that import `useStudioObject` from v5 keep reading their values

#### Scenario: The provider cannot be found or rewritten

- **WHEN** a v5 upgrade is required and no file in the video folder imports that provider exactly once, or its source cannot be written
- **THEN** no file and no document is changed, the object reappears, and a sentence says why

#### Scenario: A video on v1 to v4

- **WHEN** Delete is chosen for an object in a video whose provider is older than v5
- **THEN** nothing is written, the object reappears selected, and a sentence says the video's editing runtime is too old to delete objects

#### Scenario: Removing an object on the shader-capable runtime

- **WHEN** the person deletes an object in a video on the supported shader-capable runtime
- **THEN** removal preserves that runtime and its palette and shader support rather than downgrading the provider to v6

### Requirement: Shader creation is a checked object operation

The sidecar SHALL create a shader record with an independent permanent ID, a supported definition, complete valid values and a valid target. It SHALL record the creation and its operation ID with the document change. Retrying an identical operation SHALL return its existing result, while reusing its ID for different contents SHALL fail. Unrelated edits SHALL be preserved; duplicate IDs, stale target contracts and unsupported definitions SHALL be refused.

#### Scenario: Adding the same shader twice intentionally
- **WHEN** two different creation operations request the same shader
- **THEN** two independent instances are created and changing one does not change the other

#### Scenario: Retrying after a lost answer
- **WHEN** an identical completed creation is requested again
- **THEN** the original instance is returned and no second record is written

#### Scenario: Reusing an operation with another target
- **WHEN** a completed creation ID is reused with different contents
- **THEN** the request fails in words and neither the original instance nor the new target is changed

### Requirement: Undo of shader creation preserves shared resources

Undo SHALL deactivate the created instance through a checked inverse operation while reserving its identity and retaining shared components and packages. It SHALL refuse incompatible concurrent changes instead of deleting another writer's work. Subsequent property edits, removal and restoration SHALL use the existing managed editing rules.

#### Scenario: Undoing the newest insertion
- **WHEN** the person undoes an unconflicted creation
- **THEN** that instance disappears from rendering and active object selection
- **AND** other instances and shared files remain intact

#### Scenario: The instance changed independently
- **WHEN** Undo would discard a change made by another writer since creation
- **THEN** it reports the conflict and preserves that change

### Requirement: Palettes are validated ordered values

The managed document SHALL support ordered colour lists with per-field length bounds and validated colour values. A complete palette edit SHALL be saved, compared, retried and undone as one value. Order SHALL be significant. Old documents without palette values SHALL remain readable; unsupported new contracts SHALL be refused with an explanation rather than decoded partially.

#### Scenario: Reordering colours
- **WHEN** a palette changes only its colour order
- **THEN** the change is persisted and one Undo restores the previous order

#### Scenario: A palette exceeds its bounds
- **WHEN** a write contains invalid colours or a list outside the field's supported length
- **THEN** the entire operation is refused and the saved palette remains intact
