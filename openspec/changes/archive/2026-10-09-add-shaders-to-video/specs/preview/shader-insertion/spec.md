## Purpose

Defines direct insertion of independent shader elements into supported video scenes, including target identity, preparation, rendering, compatibility and recovery.

## ADDED Requirements

### Requirement: Direct insertion names a stable target

The webview SHALL show the target scene before insertion. It SHALL default to the single supported scene at the current frame and require an explicit choice when scenes overlap. A video without scene divisions SHALL expose one supported whole-video target. The sidecar SHALL validate the video, permanent target identity and insertion capability before committing. Choosing a card SHALL NOT start an agent turn or attach a message instead of inserting.

#### Scenario: One scene is active
- **WHEN** the person chooses a shader while one supported scene is active
- **THEN** the shader is requested for the displayed scene in the open video

#### Scenario: A transition overlaps scenes
- **WHEN** more than one scene is active and no explicit target is selected
- **THEN** insertion waits for the person to choose a named target rather than guessing

#### Scenario: The target disappears
- **WHEN** the scene or its insertion capability changes before the request commits
- **THEN** the request is refused with an explanation and no instance is attached to another scene

#### Scenario: There is no eligible video or scene
- **WHEN** no video is open or the current frame has no supported target
- **THEN** the catalogue stays browsable and adding is unavailable with a reason

#### Scenario: A legacy video has no managed preview messages
- **WHEN** a video without the managed runtime is opened
- **THEN** Studio checks source compatibility without waiting for `studio.ready` or `shader.targets`
- **AND** an unsupported video shows the compatibility reason instead of remaining in a waiting state

### Requirement: A shader is local to its scene

The project runtime SHALL render an added shader in the scene's declared background slot above its base background and below its content. By default it SHALL fill the frame and cover the scene's whole duration, independently of the frame used to choose the scene. Its time SHALL be scene-relative and frame-driven. Scene transforms, transitions and visibility SHALL apply to the shader with its scene. Multiple shaders SHALL have a persistent deterministic order inside that slot.

#### Scenario: Adding halfway through a scene
- **WHEN** a shader is added while the playhead is halfway through a scene
- **THEN** it covers the scene from its beginning to its end and displays the state corresponding to the current frame

#### Scenario: A scene has an opaque background and a transition
- **WHEN** the scene is rendered and transitions away
- **THEN** the shader is visible above its base background without covering foreground content and follows the transition with the scene

#### Scenario: Adding a second shader
- **WHEN** another shader is added to the same slot
- **THEN** it has independent values and is placed above earlier shaders within that slot
- **AND** foreground scene content remains above the shader slot

#### Scenario: Preview reports finish out of order after insertion
- **WHEN** the first insertion rebuilds the preview and an older target report finishes after the new scene has been confirmed
- **THEN** the older report or its validation failure cannot replace or clear the newer target
- **AND** another shader can be added using the current scene's generation and source revision
- **AND** adding stays unavailable while the webview is checking replacement targets

### Requirement: Preparation completes before insertion is reported as successful

The sidecar SHALL prepare compatible project-local components, runtime support and required dependencies using the project's package manager. The webview SHALL show preparation progress. Success SHALL require a saved instance and a preview acknowledgement for the same video, generation and operation. Export SHALL remain unavailable while insertion or its preview confirmation is unresolved.

#### Scenario: The first Paper shader needs a package
- **WHEN** a compatible Paper dependency is not installed
- **THEN** Studio prepares it with visible progress before reporting the shader as added
- **AND** no agent turn is required

#### Scenario: Preparation fails
- **WHEN** installation or resource preparation fails
- **THEN** the person sees a worded failure and a retry action
- **AND** no active instance referencing unavailable resources is committed

#### Scenario: The preview cannot confirm a saved instance
- **WHEN** saving succeeds but preview rendering fails or acknowledgement times out
- **THEN** Studio distinguishes saved from displayed state and offers retry or Undo rather than reporting success or blindly inserting again

#### Scenario: The person switches videos
- **WHEN** a request for one video completes after another video is opened
- **THEN** it cannot select an object, open Inspect or change the target in the newly opened video

#### Scenario: Custom shaders export on the desktop GPU
- **WHEN** a video containing Caustics, Strata or Weave is exported using Studio's desktop or software GL backend
- **THEN** the render compiler applies the same shared-uniform precision compatibility as native preview
- **AND** the encoded frames contain the shader output without changing project-local shader source or saved settings

### Requirement: Repeated requests and interrupted preparation are recoverable

The sidecar SHALL associate preparation and commit with the same insertion identity. Retrying after a lost answer or restart SHALL resolve to the original instance. Cancellation before commit SHALL prevent active insertion; after commit the result SHALL be reconciled and Undo offered. Recovery SHALL preserve unrelated project edits and SHALL NOT treat package-manager changes as atomically reversible scene edits.

#### Scenario: The commit reply is lost
- **WHEN** the person retries the same insertion
- **THEN** the existing receipt and instance are returned without duplication

#### Scenario: Retrying a rejected target before preparation starts
- **WHEN** insertion is rejected before any journal or saved instance exists and the person chooses Retry
- **THEN** Studio refreshes the target and retries the same operation and object IDs only for the same scene, slot and timing
- **AND** an already journaled operation keeps its original request for recovery

#### Scenario: Studio stops during preparation
- **WHEN** Studio resumes an interrupted insertion
- **THEN** it reconciles prepared files and committed receipts before retrying
- **AND** it does not leave active source references to missing resources

#### Scenario: Another writer changes a touched source file
- **WHEN** preparation detects that a file it intended to change has changed independently
- **THEN** it stops with a conflict explanation and preserves the newer file

### Requirement: Compatibility is explicit and project-local

New Studio video templates SHALL support shader insertion. Videos already authored in released Studio 1.0.0 SHALL have a preparation path without manually editing project files or inventing creation metadata. For a video without recorded origin, the sidecar SHALL determine eligibility from its document, runtime and scene structure; missing origin alone SHALL NOT block preparation. A recorded creating Studio version below stable 1.0.0 SHALL still block structural preparation; invalid recorded metadata SHALL receive a distinct error. The installed Studio version, project package version, timestamp and runtime version SHALL NOT be recorded as evidence of the original creating version. Studio SHALL preserve valid origin and stamp it only for newly created videos. Opening a video alone SHALL NOT convert it. Adaptations SHALL preserve rendering, timing, managed values and object identities before insertion, and render without the Studio interface running. Existing compatible shader slots and saved instances SHALL remain usable without a structural upgrade regardless of absent origin.

#### Scenario: An existing 1.0.0 template has no creation metadata
- **WHEN** the person first adds a shader to a compatible unversioned template from released Studio 1.0.0
- **THEN** Studio prepares the slot and inserts the shader with progress
- **AND** missing creation metadata does not block the action or get replaced with an invented creation version

#### Scenario: A finished video has several scenes
- **WHEN** a compatible existing video has separate scene components scheduled with Sequence, Series or TransitionSeries
- **THEN** Studio prepares a slot in each supported scene, preserving backgrounds, content, scene timing, transitions, object IDs and Inspect values
- **AND** insertion targets the named active scene, with explicit selection during overlaps
- **AND** changing the template's text or composing several scenes does not alone make the video unsupported

#### Scenario: A video has a known pre-1.0.0 origin
- **WHEN** a video requiring structural preparation records a creating Studio version below stable 1.0.0
- **THEN** preparation is unavailable with the minimum creation version explained
- **AND** no dependency installation or source conversion starts, even in a newer running Studio

#### Scenario: Origin is absent but structure is incompatible
- **WHEN** an unversioned video's source does not establish a compatible insertion slot
- **THEN** Studio explains the structural limitation and offers the separate preparation path
- **AND** the refusal does not claim that the video is older than Studio 1.0.0

#### Scenario: Recorded creation metadata is invalid
- **WHEN** an existing origin file cannot be decoded
- **THEN** Studio reports invalid metadata without overwriting it or silently treating it as absent

#### Scenario: A new video records its origin
- **WHEN** Studio creates a new video
- **THEN** its actual Studio version is recorded in portable video-local metadata
- **AND** later updates preserve that original version separately from the current runtime or document format version

#### Scenario: Shader support is already connected
- **WHEN** a video already has compatible, verified shader slots and requires no structural adaptation
- **THEN** absent creation provenance alone does not block insertion, editing or rendering of supported shaders

#### Scenario: Arbitrary authored JSX is encountered
- **WHEN** Studio cannot establish a safe insertion slot
- **THEN** direct insertion stays unavailable with a structural explanation and a separate preparation action
- **AND** the shader card does not mutate source or launch an agent turn

### Requirement: Unrecognised scene structure has an explicit preparation path

The webview SHALL offer a separate Prepare video action when source analysis cannot establish safe scene slots. Invoking that action SHALL start preparation through the configured coding agent using the existing turn and permission flow. The task SHALL be scoped to shader support and preserve authored content, timing, transitions, object identities and managed values. The sidecar SHALL validate the resulting source bindings and the preview SHALL confirm actual target identity and timing before shader insertion becomes available. Agent completion text alone SHALL NOT establish compatibility. This action SHALL NOT bypass a known pre-1.0.0 origin or invalid metadata. No shader instance SHALL be created by preparation alone.

#### Scenario: Preparation is explicitly requested
- **WHEN** the person chooses Prepare video for an unsupported authored scene structure
- **THEN** Studio starts a visible preparation turn and shows its progress
- **AND** it does not silently run that turn from a shader card click

#### Scenario: Preparation progress is shown in the sidebar
- **WHEN** preparation is running
- **THEN** the sidebar shows one compact phase status and a short direction to follow the chat
- **AND** it omits the scene-selection prompt, duplicate availability messages, internal working-copy diagnostics and a disabled preparation action
- **WHEN** preparation fails
- **THEN** it shows a concise failure with collapsible diagnostic details and an available retry action where preparation is still supported

#### Scenario: Prepared slots pass validation
- **WHEN** preparation produces valid source bindings and the preview confirms the slots
- **THEN** shader cards become available for the corresponding scenes without manual file editing

#### Scenario: Validation finds a repairable source error
- **WHEN** an agent preparation attempt fails structural validation or compilation
- **THEN** Studio sends the diagnostic to the configured agent in the same visible preparation chat and working copy, with at most three total attempts
- **AND** instructions describe the supported scene root, managed binding and static timing requirements, including expansion of custom scene wrappers
- **AND** Studio removes only its generated connections from the failed validation before repair, preserving the agent's source edits and keeping the original project unchanged
- **AND** cancellation, provider failures and changes outside the allowed scope stop preparation without another agent attempt
- **AND** exhausting the attempts reports the last validation error and does not activate the copy

#### Scenario: Preparation fails or is interrupted
- **WHEN** preparation fails, is cancelled, or produces invalid source bindings or preview errors
- **THEN** Studio keeps insertion unavailable and shows a recoverable preparation failure
- **AND** rollback restores only files still matching preparation writes and preserves concurrent user edits with an explicit conflict explanation

#### Scenario: No agent is available
- **WHEN** the person needs assisted preparation but the configured agent cannot run
- **THEN** Studio explains how to connect or restore the agent and does not claim that preparation or insertion succeeded

### Requirement: Preview and export share deterministic shader rendering

The project runtime SHALL derive shader motion from the requested video frame and saved parameters, await required resources before capture, and release graphics resources when instances unmount. Preview, Snapshot and Export SHALL use the same project-local implementation. Graphics failures SHALL be explained, and capture SHALL fail rather than silently producing a missing shader.

#### Scenario: Shared shader uniforms on native WebKit
- **WHEN** native preview compiles a saved Caustics, Strata or Weave adapter using the pinned Paper renderer
- **THEN** shared vertex/fragment uniforms use compatible precision declarations and the frame renders successfully
- **AND** compatibility processing preserves project files, instance values, fragment arithmetic and frame timing

#### Scenario: A frame is reached directly
- **WHEN** the same frame is reached by seeking, playback or export with the same parameters
- **THEN** the shader represents the same animation time without requiring playback history

#### Scenario: A shader is removed or leaves its scene
- **WHEN** the instance unmounts
- **THEN** its graphics resources and pending readiness work are released

#### Scenario: Graphics initialization fails
- **WHEN** a required graphics context or shader cannot initialize
- **THEN** preview gives a worded failure and Snapshot or Export cannot silently succeed with that shader absent
