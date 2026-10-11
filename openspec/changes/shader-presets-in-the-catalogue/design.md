## Context

See proposal.md for why. The current state, read from the code on 2026-10-11:

- **The Shaders pane is built from library assets, not from `shader.list`.**
  `components/studio/shaders-pane.tsx` keeps a bundled asset of category
  Shaders when its slug matches an entry of `SHADER_DESCRIPTORS`, which it
  imports from `shared/shaders.ts`. A card's `onPick` sends `shader.insert`
  with `slug` set to the asset slug minus `remocn/`. No webview code calls
  `shader.list`. Only `sidecar/library/shaders.test.ts` reads it.
- **The sidecar turns `request.slug` into everything else.**
  `shaderResourcePlan(slug)` finds the descriptor, the runtime files and the
  vendored upstream source. `shaderCreation(descriptor, …)` builds the create
  operation with `values` from each field's `default` and
  `label: descriptor.title`. `object.shader.slug` is the descriptor's slug.
- **The project picks an adapter by `object.shader.slug`.**
  `sidecar/projects/shader-insertion.ts:571` writes an import of
  `studio-shaders-v1/<slug minus shader->` into the video's registry, and
  `studio-objects-v7/shaders.tsx:68` reads `registry[object.shader.slug]`.
- **Reset already returns to the create operation's values**, not the
  descriptor defaults (`hooks/use-managed-objects.ts:850`).
- **Two places compare a request by slug.** `requestMatches` compares a
  journaled request with a new one. `recoverReceipt` compares a saved receipt's
  `object.shader.slug` with `request.slug`. The webview rebuilds a request from
  a saved operation (`hooks/use-shader-insertion.ts:778`) with
  `slug: operation.object.shader.slug`, which is the base.
- **remocn at `feat/shader-presets` (`94641f2`).** Each preset is a registry
  item `shader-<base>-<name>` with `meta.presetOf: "shader-<base>"` and one
  file. That file exports `shader<Base><Name>Preset = { … } satisfies
  Shader<Base>Props` and a component that spreads the preset over the base
  component, with `speed` multiplied. The docs pages live in
  `content/docs/shaders/components/shader-<base>/`, with `index.mdx` for the
  base and `<name>.mdx` for each preset, whose frontmatter names the component
  (`component: shader-warp-silk`). The four base sources are byte-identical to
  the ones vendored at `8ae853e` (lock hashes `ae41f31e…`, `66432814…`,
  `5f964127…`, `76f75941…`). Between `8ae853e` and `94641f2`, `registry/remocn/`
  changes only by the presets and the caption batch, which is pinned on its
  own.
- **Measured against today's descriptors**, 35 of the 36 preset objects name
  only declared fields within bounds, palette limits and enum options. The
  exception is `shader-warp-cream`, whose `softness: 1.5` sits on a 0–1 control.
  Paper 0.0.78 documents `u_softness` as 0 to 1, and remocn's own
  `shader-warp/config.ts` says `max: 1`.

## Goals / Non-Goals

**Goals:**
- A preset card that inserts its base with the preset's values. The project
  sees exactly what it would see after the person picked the base and set the
  values by hand.
- One source for a preset's values: the vendored remocn file. Anything the
  Studio holds is derived from it and checked against it.

**Non-Goals:**
- A per-card "unavailable" state in the pane. A preset the Studio cannot
  describe is left out, and the check before release says why (see the
  decision on generated presets).
- Changing `shader.list`, `ShaderIdentity` or the document format.

## Decisions

### 1. A preset is a catalogue entry that points at a descriptor

`shared/shaders.ts` gains a `ShaderPreset` Schema: `{ base, slug, title,
values }`. `base` and `slug` are `ShaderIdentifier`s, and `values` is a
`Record<Identifier, StudioValue>`. The check behind it is `presetProblem`.
`shared/shader-presets.ts` decodes `shared/shader-presets.json` into
`SHADER_PRESETS` and `EXCLUDED_SHADER_PRESETS`, and holds the resolver. The
split is so that the generator, which imports `presetProblem`, never imports
the JSON it is about to write. A filter on the Schema rejects:
- a preset whose `base` has no descriptor;
- a key the descriptor does not declare, or one of `SHADER_INSTANCE_FIELDS`
  (opacity, order and timing belong to the slot, not to the look);
- a value `fieldProblem` would reject for that field. That is the same
  per-field check the document runs, so its sentence (*"Softness must be at
  most 1."*) is the recorded exclusion reason.

`shaderCatalogueEntry(slug)` is the one resolver. It returns `{ descriptor,
title, values }`. For a base, `values` is empty and `title` is
`descriptor.title`. For a preset, they are the preset's. The webview's pane and
the sidecar both use it.

*Alternative: one descriptor per preset, with slug `shader-warp-silk`.*
Rejected. The registry codegen derives the adapter file from the slug, so each
preset would need its own `studio-shaders-v1/warp-silk.tsx`. That is 36 files
in an immutable resource tree, all the same four adapters with different
numbers.

### 2. The request names the card, and the sidecar resolves it

`ShaderInsertRequest` keeps its shape, and `slug` may now be a preset's slug.
The webview does not change what it sends. In the sidecar, `insert` resolves
the slug once:
- `shaderResourcePlan` is asked for the **base** slug, so resource preparation,
  the dependency step and `checkShaderResources` are exactly the base's.
- `shaderCreation(descriptor, target, operationId, objectId, order, start)`
  takes the starting values and the label. Its `values` are the field defaults,
  then the preset's values, then `endFrame` and `order`.

The webview never supplies values. Doing so would make a frame able to write
arbitrary starting values into a project, and the shader-insertion spec already
lets the sidecar alone decide what is prepared.

An unknown slug fails before anything is journaled, with the sentence *"This
shader cannot be added."*, as an unknown descriptor slug does today.

There is no frame change and no protocol bump. The webview and the sidecar
ship together, and `slug` was already a free `ShaderIdentifier`.

### 3. Requests are compared by the shader they resolve to

`requestMatches` and `recoverReceipt` compare `resolve(slug).descriptor.slug`
instead of the raw slug. The identity of an insertion is already
`operationId` + `objectId`, which are both fresh UUIDs per gesture. The slug
check only guards against reusing an ID for a different shader, and the base is
what that guard is about. Without this, a request the webview rebuilt from a
saved preset instance (slug = base) would fail against its own journal entry,
which holds the preset slug, with *"This insertion ID already belongs to a
different request."*

### 4. Preset values are generated from the vendored source and checked

`scripts/shader-presets.ts` reads every vendored manifest with a `presetOf`
and produces `shared/shader-presets.json`:
- **values** come from the preset file's `…Preset = { … } satisfies` object
  literal. It is a pure literal, so the script reads it as text and evaluates
  that one expression. Importing the module would pull in the base component,
  remotion and Paper, and `remocn/` is outside `tsconfig.json`.
- **title** is the vendored manifest title with its leading `Shader ` removed,
  so "Shader Warp Silk" becomes "Warp Silk". This matches the Studio's own
  "Warp".
- A preset that fails Decision 1's checks goes to an `excluded` list in the
  same file, as `{ slug, reason }`, for example *"softness 1.5 is outside
  Warp's 0–1"*.

`remocn-sync.ts` calls it after vendoring, and its `--check` (`remocn:check`)
fails when the file differs from what the vendored set produces, comparing
parsed JSON so that Biome's formatting of the file is not drift. It is not
chained in `package.json`: `bun run remocn:sync --captions` would hand the flag
to the last command. A test also asserts that
every vendored preset is either in `presets` or in `excluded`, so a bump cannot
add a preset that silently never appears.

*Alternative: hand-written values with a comparison test.* It gives the same
guarantee with 36 entries typed by hand, and every bump means retyping what the
script already knows. *Alternative: remocn emits the values in `meta`.* This is
cleaner upstream, but it couples a Studio need to the remocn registry format,
and the literal is already in the shipped file.

`speed` is stored as an absolute value: Warp Silk's `speed` is 2. remocn
multiplies the preset's speed by a `speed` prop that defaults to 1, so the
starting look is identical. After that, the person moves the ordinary Speed
control.

### 5. The sync reads foldered docs pages

`componentsOf` in `scripts/remocn-sync.ts` treats a directory inside a category
(other than `components/`, which it already descends into) as one component
family:
- `index.mdx` is the component named after the folder;
- every other `.mdx` names its component through `component:` in its
  frontmatter, fetched raw at the pin. A page without it fails the sync by name.
- a folder with no `index.mdx` is prose and is skipped. `shaders/` and
  `filters/` both have a `getting-started/` folder whose pages name no
  component; reading those as a family would have failed the sync.

*Alternative: infer `<folder>-<page>`.* It holds for all 36 today, but the
frontmatter is what the docs declare, and inferring would silently mis-name a
page that differs.

`VendoredManifest` gains an optional `presetOf`, read from the artifact's
`meta.presetOf` and written only when present. That way the 182 existing
manifests and their lock hashes do not change. Both pins move together: `PIN` in `remocn-sync.ts` and
`BASE_PIN` in `remocn-sources.ts`. The sync imports `BASE_PIN`, so there is one
constant.

### 6. Roles follow the base

`sidecar/library/roles.ts` gains no 36 lines. `bundledRoleOf` takes the
manifest's `presetOf` and returns the base's role, `scene` for all four today.
The roles test counts a preset as classified through its base.

### 7. The pane admits preset assets

The pane's filter keeps an asset of category Shaders whose slug resolves
through `shaderCatalogueEntry`. Preset cards carry their own poster and clip,
because `remocn:previews` renders every vendored component with a preview
entry, and the presets have one in remocn's `__manifest__.ts`. Search already
matches the asset title.

## Risks / Trade-offs

- [The pin must name a commit that survives the remocn merge] → Bump to the
  commit on remocn `main` after the presets PR merges, never to `94641f2` on the
  feature branch. A squash merge would orphan it, and the raw URLs would stop
  resolving.
- [The bump also vendors whatever else changed upstream] → Today that is only
  the presets and the caption batch (pinned separately). The `remocn/` diff of
  the bump is reviewed for anything else before it lands.
- [A later bump could change a shader's vendored source] → Then
  `checkShaderResources` would refuse projects holding the older `upstream/`
  copy. That hazard already exists for all 23 shaders and is not new here.
  Today the four bases are byte-identical between pins, and the bump's
  `remocn/` diff is checked for any `registry/shader-*/shader-*.tsx` change
  before it lands.
- [Recovery after an update mid-preparation] → A journaled preset request
  resolves against the catalogue of the Studio doing the recovery. If that
  update changed the preset, the recovered instance starts from the new values.
  Accepted: the preset's look is not saved anywhere until commit, and the
  instance is ordinary and editable.
- [Warp Cream stays excluded until remocn fixes it] → The reason is in
  `shared/shader-presets.json`. Fixing `softness` upstream and re-running the
  sync moves it to `presets` with no Studio code change.
- [36 more cards in one flat grid] → Accepted for now. Slug order puts each
  preset beside its base, and search narrows by base name.

### 8. Vendoring the bump

`remocn-sync.ts` removes `remocn/registry/` before it vendors, which takes the
342 tracked posters and clips with it. The bump restored them with
`git checkout` and rendered only the 36 new names. Measured at `fd2d301`: the
sync reported 182 items (176 shipped). The only `remocn/` changes were the 36
new preset folders, `index.json` and the lock's pin, and no existing source or
manifest hash moved. One render (`shader-mesh-gradient-ink`) timed out loading
Google Fonts at 30 s and rendered on its own at the first retry.

## Migration Plan

No data migration. Saved videos are untouched, and the existing four bases keep
their slugs, descriptors and resources. Rollback is reverting the change: preset
instances already saved are plain base instances and keep working.
