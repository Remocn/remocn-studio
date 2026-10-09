## ADDED Requirements

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

## MODIFIED Requirements

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
