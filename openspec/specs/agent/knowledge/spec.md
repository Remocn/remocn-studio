# agent/knowledge Specification

## Purpose
What makes the studio more than a generic agent front end: one bundle of video-making skills delivered to whichever provider runs the turn, and a set of studio conventions appended to every turn's system prompt so the agent writes videos into the right folder in a shape the studio can preview, tune and export.

## Requirements

### Requirement: One skills bundle, shipped with the app

The studio SHALL ship exactly five skills — `remocn`, `remotion-best-practices`, `remotion-interactivity`, `video-lessons` and `motion-design` — as one bundle resolved from the path the core passes in `REMOCN_STUDIO_PLUGIN_DIR`, and every skill in it SHALL be named after the folder that holds it.

#### Scenario: The bundle is on disk

- **WHEN** a turn starts and the shipped bundle directory exists with a plugin manifest and a `SKILL.md` for each of the five skills
- **THEN** the attach reports the bundle as loaded, with the directory it was found in
- **AND** the agent's own skill catalog lists the five skills under the bundle name `remocn-studio`

#### Scenario: The app shipped no bundle

- **WHEN** the plugin directory is unset, empty or not on disk
- **THEN** the attach reports it not loaded with the reason that the app shipped no skills bundle
- **AND** the turn runs on the studio conventions alone

#### Scenario: A skill page inside the bundle is read

- **WHEN** a loaded skill routes the agent to another page inside the bundle
- **THEN** reading that page raises no permission card (see `agent/permissions`)
- **AND** a write inside the bundle, or a link leading out of it, still asks

### Requirement: The attach is a value, never a guess from the provider's name

The studio SHALL answer every attach with whether the bundle loaded, how it reached the runtime, the directory, the skills the project shadows, and a reason when it did not load; an adapter SHALL send skill-aware conventions when and only when that value says loaded, never on the strength of which provider it is.

#### Scenario: Skill-aware conventions

- **WHEN** the attach says loaded
- **THEN** the conventions gain the paragraph naming the bundle and its five skills, and the sentences mandating `motion-design`, `video-lessons` and `remotion-interactivity`
- **AND** those sentences name the bare skill names rather than any one runtime's namespaced spelling

#### Scenario: Nothing loaded

- **WHEN** the attach says not loaded
- **THEN** the conventions carry no sentence ordering the agent to invoke a skill
- **AND** no mandate is issued that the turn could not follow

### Requirement: An incomplete bundle is refused by name

The studio SHALL refuse a bundle directory that carries no plugin manifest, or that is missing any of the five skills, and the reason SHALL name what is missing rather than reporting a generic failure.

#### Scenario: A directory with no manifest

- **WHEN** the shipped directory exists but has no `.claude-plugin/plugin.json`
- **THEN** the attach fails with a reason naming the directory and the missing manifest

#### Scenario: A skill is missing from the bundle

- **WHEN** one of the five skills has no `SKILL.md`
- **THEN** the attach fails with a reason naming exactly the skills that are missing
- **AND** no partial bundle is delivered to the runtime

### Requirement: Each runtime is given the same bundle its own way

The studio SHALL deliver the one bundle through each provider's own mechanism: as a local plugin for Claude, as a plugin directory argument for Copilot and Grok, and through a mirrored agent home for Codex. It SHALL never reach into the person's own agent homes or into the project to install anything.

#### Scenario: Claude

- **WHEN** a Claude turn starts with the bundle loaded
- **THEN** the bundle is passed as a local plugin and the run reads project settings only
- **AND** nothing in the person's own Claude home is read or written

#### Scenario: Copilot and Grok

- **WHEN** a Copilot or Grok turn starts with the bundle loaded
- **THEN** the shipped bundle directory is passed to the CLI as its plugin directory, never the project folder

#### Scenario: Nothing is installed anywhere else

- **WHEN** any turn runs
- **THEN** the studio writes nothing into the person's agent homes and nothing into the opened project to deliver knowledge
- **AND** whatever those CLIs discover for themselves is left untouched

### Requirement: Codex is served through a mirrored home of the studio's own

For Codex the studio SHALL build one home per sidecar process under its own data directory, in which every top-level entry of the person's Codex home is a symlink back to it, only the configuration file and the plugin store are the studio's own, and the bundle is a real copy keyed by the manifest version.

#### Scenario: The login and the past chats are shared, not copied

- **WHEN** the mirrored home is built
- **THEN** the credentials file is a symlink to the person's own, so a refreshed token is written through to it
- **AND** the stored threads and their indexes are symlinks, so a chat started before the mirror existed still resumes

#### Scenario: The person's own configuration is never written to

- **WHEN** the mirrored home's configuration is generated
- **THEN** it is the person's own file verbatim plus the studio's marketplace and plugin entries
- **AND** a home whose configuration already registers the bundle is passed through unchanged, rather than gaining a second entry

#### Scenario: The login cannot be shared

- **WHEN** the person's Codex home holds no credentials file
- **THEN** no mirror is built, the turn runs in the person's own home, and the attach carries the reason that the login could not be shared
- **AND** the bundle is not delivered for that turn

#### Scenario: The mirror cannot be prepared

- **WHEN** building the mirror fails for any reason
- **THEN** the home is left alone and the attach carries that failure as its reason
- **AND** the turn still runs

### Requirement: A project's own copy of a skill wins the name and costs nothing else

When the opened project installs a skill of the same name as one of the vendored three, the studio SHALL record the collision and attach the bundle anyway, so the project's copy takes the bare name by the runtime's own precedence and the rest of the bundle is still delivered.

#### Scenario: One name collides

- **WHEN** the project has its own copy of one vendored skill
- **THEN** the bundle still loads, the collision is logged, and the other four skills are still available
- **AND** the collision is not reported to the person as a failure

#### Scenario: An unrelated project skill

- **WHEN** the project installs a skill whose name is not one of the vendored three
- **THEN** nothing is recorded as a collision

### Requirement: A knowledge failure is one notice, never a failed turn

A bundle that should have loaded and did not SHALL produce exactly one notice in the turn saying so and that the turn runs on the conventions alone; the attach SHALL always be logged, and a knowledge failure SHALL never be presented as a sign-in or model failure.

#### Scenario: The bundle failed to attach

- **WHEN** the attach carries a reason other than the plan
- **THEN** the turn emits one notice naming that reason
- **AND** the turn proceeds and produces its answer

#### Scenario: The bundle loaded

- **WHEN** the attach succeeded
- **THEN** the attach is logged and the person sees nothing

### Requirement: Every turn carries the studio's own conventions

Every turn SHALL append the studio's conventions to the provider's own system prompt: the chat works on exactly one video, its lane is that video's folder under `src/videos/`, `Root.tsx` is never edited, a new scene is a component sequenced with `<Series>` or `<TransitionSeries>` in the video's `index.tsx`, given a short human `name`, and described in `studio.json` by a scene object (definition `scene`, label equal to that name) bound to the scene's root that its objects name as `parentId`, what is reused lives in `src/shared/`, an attached track's audiomap is timing evidence to be confirmed against the rendered mix, and the result stays editable as named components with plain props.

#### Scenario: The video is named

- **WHEN** the chat's video is known
- **THEN** the conventions name that slug, its folder and the composition it registers

#### Scenario: The video could not be read

- **WHEN** the chat's video row cannot be resolved
- **THEN** the conventions omit that one sentence and everything else is unchanged

#### Scenario: References in the message

- **WHEN** the message carries element references or backticked paths
- **THEN** the conventions explain that each element is described in a block at the end of the message, that requested changes are grouped by the component that owns them and are edited in that file, and that a backticked path was picked from the app's own file list

#### Scenario: A scene is sequenced

- **WHEN** the agent adds a scene to a video
- **THEN** the conventions have asked it to name the sequence, add the scene object with the same label bound to the scene's root, and parent the scene's objects to it
- **AND** an object drawn inside another object is parented to that object instead

### Requirement: New components must be tunable without code

A Pro turn's conventions SHALL require every component the agent writes new to expose its knobs: typed props with inline defaults, top-level composition props in a Zod schema with colours as `zColor()`, an `InteractivitySchema` on every nested scene, element and transition wrapper exported through `Interactive.withSchema()` with its generated `controls` passed to its own `<Sequence>`, and a file that exports only the wrapped component.

#### Scenario: A run of text

- **WHEN** the agent writes a headline, caption or line of a stack
- **THEN** it is one `Interactive.H1`, `Interactive.P` or `Interactive.Span` whose direct child is the string, with typography as literals in its own `style` and a `name` unique in the frame and equal to its `data-design-id`
- **AND** a component that splits a run into words keeps the split inside and takes the whole string as one `text` prop

#### Scenario: A timing curve

- **WHEN** the agent animates anything
- **THEN** the easing is a prop named `easing` or ending in `Easing`, defaulting inline and spread into `interpolate()` as a four-number cubic-bezier array
- **AND** an enum of easing names is forbidden

#### Scenario: A spring

- **WHEN** the agent uses a spring
- **THEN** its physics are exposed as numbers under a dotted `spring` group, one group per spring, prefixed where a component has more than one

#### Scenario: An existing component

- **WHEN** the agent edits a component that already exists
- **THEN** it is not rewritten around a schema unless the person asks
- **AND** on a Remotion too old for part of the shape, the discipline is kept and what the version cannot express is skipped

### Requirement: Movement is named from one taxonomy

The conventions SHALL carry the studio's movement taxonomy: the five roles (`entry`, `emphasis`, `exit`, `scene`, `transition`) with a one-line hint each, the parameter vocabulary each role expects, and the dictionary of named behaviours for entry, emphasis and exit.

#### Scenario: Naming a movement

- **WHEN** the agent chooses a movement the dictionary already names
- **THEN** it uses that name rather than describing the behaviour fresh

#### Scenario: Nothing in the dictionary fits

- **WHEN** no dictionary name fits
- **THEN** the agent writes the behaviour as its own named, tunable component and gives its role when saving it to the library

### Requirement: The design check is required before finishing

A Pro turn's conventions SHALL require a stable `data-design-id` on every animated element and a call to the studio's design check over the affected range before a scene or video is called finished, passing only the movements the video's motion document actually promises as assertions (see `agent/design-check`).

#### Scenario: Finishing a scene

- **WHEN** the agent believes a scene or video is finished
- **THEN** it has run the design check over the affected range and either fixed every mechanical finding or recorded a bounded exception with a purpose and visible evidence
- **AND** labelling a finding "intentional" alone does not close it

#### Scenario: A vendored skill disagrees

- **WHEN** a bundled skill tells the agent to hardcode an easing, inline the words a component splits, or avoid spreads
- **THEN** the conventions overrule it on exactly those points

### Requirement: Free turns get the structure and the references only

On Free the studio SHALL withhold the skills bundle before it looks at the disk, and SHALL send only the structural and reference conventions — no skill name, no pipeline tool, no craft or taxonomy paragraphs, no design-check mandate, no moodboard. A Pro turn's conventions SHALL be byte-for-byte what they were.

#### Scenario: A Free turn

- **WHEN** a turn runs on the Free plan
- **THEN** the bundle is not located at all and no notice is raised
- **AND** the conventions name no skill, no pipeline tool and no schema requirement

#### Scenario: A Pro turn

- **WHEN** a turn runs on Pro
- **THEN** the conventions are the full set: structure, craft, references and production

### Requirement: A turn's briefs ride beside the conventions

A turn SHALL carry, beside the conventions, the briefs describing what the studio already did for it: the assets and media copied into the project, the project's brand snapshot (see `projects/project-settings-and-brand`), and on Pro the active pipeline stage's instructions (see `agent/pipeline`).

#### Scenario: A brand snapshot exists

- **WHEN** the project carries a brand snapshot
- **THEN** the turn is told it is authoritative after explicit instructions from the person, is not to be asked about again, and is never overridden by a moodboard

#### Scenario: No pipeline is active

- **WHEN** no stage is active, or the turn is on Free
- **THEN** no pipeline brief is attached

### Requirement: New videos declare managed editable objects

The studio SHALL provide a versioned managed runtime and example document, and SHALL instruct generation to bind every intended editable object to independent stable data. Existing video conversion SHALL preserve existing visual behavior and IDs where present.

#### Scenario: A new video is generated
- **WHEN** the agent creates new video content
- **THEN** its editable objects have explicit definitions and values in the canonical document

#### Scenario: An old video is edited
- **WHEN** the existing video is not managed
- **THEN** conversion is treated as an explicit source change, never a silent source rewrite

### Requirement: Footage is embedded so every frame lands

The conventions SHALL tell the agent to embed video footage with `<Video>` from
`@remotion/media`, not `OffthreadVideo`. They SHALL also say that a project whose
manifest does not declare `@remotion/media` gets it through the project's own
package manager, pinned to the version of the project's `remotion`. The sidecar owns
this sentence. It rides on every turn, whether or not the skills bundle loaded.

#### Scenario: Footage is added to a scene

- **WHEN** the agent embeds a video file in a scene
- **THEN** it has been told to use `<Video>` from `@remotion/media`, because `OffthreadVideo` shows the previous frame whenever a file's frames start a fraction of a millisecond after their slot

#### Scenario: The project does not declare the package

- **WHEN** the project's manifest does not list `@remotion/media`
- **THEN** the conventions tell the agent to add it with the project's own package manager at the version of the project's `remotion`
- **AND** that install runs as a Bash command and raises a permission card like any other (see `agent/permissions`)

#### Scenario: Existing OffthreadVideo

- **WHEN** a component the agent did not write this turn already embeds footage with `OffthreadVideo`
- **THEN** the agent leaves it alone unless the person asks or the design check reports late frames for that file
- **AND** when the check reports late frames, the correction is to switch that component to `<Video>` from `@remotion/media`, not to rewrite the person's file

#### Scenario: A Remotion without the package

- **WHEN** the project's Remotion predates `@remotion/media`
- **THEN** the agent keeps `OffthreadVideo` rather than upgrading Remotion unasked, and the design check still reports late frames for that footage

### Requirement: Template examples guide motion decisions

The motion-design knowledge SHALL provide a task-oriented route across the complete current remocn template catalog, with source-grounded studies explaining useful passages, their choreography, adaptation conditions and visible failure symptoms. New video direction work SHALL be instructed to consult that route and select relevant examples while preserving the person's brief, references and brand.

#### Scenario: Different categories of video

- **WHEN** the agent chooses motion for an interface demonstration, an automation workflow, an editorial showcase, a brand identity film or a release announcement
- **THEN** it can reach the corresponding template study, actual source and preview through the skill
- **AND** catalog coverage does not require using every template in one video

#### Scenario: A template changes or a new one appears

- **WHEN** available template sources differ from a study or the live catalog contains additional templates
- **THEN** the guidance directs the agent to verify the current implementation and consider relevant new entries
- **AND** historical names, timings and APIs are not treated as current without verification

#### Scenario: Sources are unavailable or unsuitable

- **WHEN** a relevant source or preview cannot be accessed, or no example suits the brief
- **THEN** the guidance directs the agent to state the limitation, use inspected available material or author a suitable movement, and preserve the brief
- **AND** it does not invent a template API or claim an unobserved visual comparison

#### Scenario: A pointed edit

- **WHEN** the person requests a small technical correction unrelated to direction or choreography
- **THEN** the agent can read only the guide relevant to that correction without analyzing the template catalog again
