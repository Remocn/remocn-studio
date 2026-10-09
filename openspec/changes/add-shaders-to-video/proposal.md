## Why

[REM-724](https://linear.app/remocn/issue/REM-724/shaders): choosing a bundled shader currently attaches a component to an agent message; the person cannot place it directly and reliably tune its own parameters. Give shaders a dedicated catalogue and a direct path from selection to an editable, persistent element in the video.

## What Changes

- Add Shaders beside Library and Components, with search, posters and hover clips. Move the 23 bundled entries categorised as Shaders out of Components; shader-based typography and transitions keep their existing categories.
- Add a shader directly to an explicitly identified scene, without starting an agent turn. Default to the scene's full duration and frame-sized background slot; overlapping scenes require an explicit target.
- Introduce a narrowly scoped scene insertion contract and project-local shader renderer. Preserve scene transitions and stacking; do not guess insertion points in arbitrary JSX.
- Open Inspect on the new instance after the preview acknowledges it. Expose per-shader controls, editable colour palettes, opacity, frame-driven speed, pattern transforms, scene-relative timing and order within the shader slot.
- Persist independent instances and checked, retry-safe creation operations. Support Undo, existing removal, dependency preparation, conflict reporting and recovery.
- Keep the implementation and parameter definitions versioned in the project so preview, Snapshot and Export use the same authored result.
- Support videos already authored in released Studio 1.0.0, including multi-scene videos without creation metadata. Determine compatibility from verified document/runtime/scene structure when origin is absent; retain recorded origin for new videos and the refusal for known pre-1.0.0 origins. Never infer a creation version.
- Prepare recognised scenes during the first Add gesture. For unsupported authored structures, offer a separate, explicit agent preparation action with validation and recovery; a shader card never silently starts an agent turn.
- Deliver Mesh Gradient end to end first, including an existing-scene compatibility proof, then cover the complete shipped shader category.

## Capabilities

### New Capabilities

- `library/shaders`: the shipped shader catalogue, versioned control descriptions and category coverage.
- `preview/shader-insertion`: target selection, project preparation, scene-local rendering, compatibility and completion/failure behaviour for direct insertion.

### Modified Capabilities

- `shell/layout-and-panes`: Shaders navigation and remembered view.
- `library/components-and-roles`: exclude the Shaders category from the Components view while preserving role classification and ordinary asset references.
- `preview/managed-objects`: palette values and checked creation/Undo of independent shader records.
- `preview/properties-pane`: shader controls, dependent fields, palette editing and instance timing/order.

## Non-goals

- Shader text fills, text masks and letter effects: explicitly deferred.
- A GLSL editor or direct insertion of every remocn component: this renderer handles a finite shader catalogue.
- Arbitrary placement between existing JSX elements or unchecked automatic conversion of unknown React structures: automated adapters require verified slots; other structures use explicit agent-assisted preparation and validation.
- Automatic retrofitting of videos with a recorded pre-1.0.0 origin, or guessing creation versions for unversioned videos. Structural compatibility cannot prove an unrecorded historical app version.
- A general image-filter workflow: input-image controls are only for shaders that already accept them, using project-local assets.
- A new timeline, keyframe editor or scene renderer: React continues to own the video's structure and animation.

## Impact

- **Shared contract:** shader descriptors, palette validation, creation receipts and insertion IPC; expand managed preview messages and bump the paired sidecar/Rust protocol versions for the new contract.
- **Sidecar:** prepare versioned files and compatible dependencies, validate insertion targets, serialize checked writes and recover interrupted insertions using Effect services.
- **Project runtime:** versioned object/palette support, explicit scene shader slots, pinned adapters and template/generation guidance. Existing authored runtime files remain intact.
- **Rust core:** protocol parity and native navigation integration; no shader rendering or business logic in Rust.
- **Webview:** navigation, catalogue, insertion hook, managed controls and preview receipt handling. Reuse `paneView`; no new settings key or SQLite history migration is planned.
- **Verification:** insertion/Undo/conflict tests, all-shader descriptor coverage and WebKit/Chromium frame and export checks. Rendering performance and legacy compatibility remain to be demonstrated during implementation.
