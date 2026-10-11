## Why

remocn now ships 36 shader presets: nine each for Mesh Gradient, Grain Gradient,
Swirl and Warp (`feat/shader-presets`, commit `94641f2`). A preset is a finished
look, and the person gets it without tuning a palette and six sliders. The
Studio cannot show any of them. Its catalogue is the bundled Shaders category,
and `scripts/remocn-sync.ts` finds that category by reading the docs tree one
page per component. remocn moved those four shaders into folders
(`shader-warp/index.mdx` plus one page per preset), and the sync does not read
folders. Moving the pin as things stand would add no presets, and the four
bases would lose their category and leave the Shaders view.

## What Changes

- **Each preset is its own card in Shaders**: "Warp Silk", "Mesh Gradient
  Aurora". It has its own poster, clip and search name, and adds in one click
  like any other shader.
- **A preset inserts as its base shader with the preset's values.** The saved
  instance is an ordinary Warp, Swirl, Mesh Gradient or Grain Gradient, with the
  preset's name as its label and its values in place of the descriptor
  defaults. Reset shader returns to the preset's look, not to the base's. No new
  adapter, descriptor file or revision is written into the project, and adding
  a preset beside its base reuses the base's prepared resources.
- **Preset values are part of the Studio catalogue**, checked against each
  preset's declared controls and against the vendored remocn source. A preset
  whose values the base cannot hold (today `shader-warp-cream`, `softness: 1.5`
  on a 0–1 control) is left out, with its reason recorded beside the
  catalogue. Every vendored preset is either offered or excluded, and that is
  checked before release.
- **The remocn sync reads foldered docs pages**: `index.mdx` is the component
  named after its folder, and every other page is the component named by its
  `component:` frontmatter. Then the pin moves to the presets commit, and
  posters and clips are rendered.

## Capabilities

### Modified Capabilities

- `library/shaders`: the catalogue lists presets as their own directly addable
  shaders, and a preset has a checked description of its values against its
  base.
- `preview/shader-insertion`: inserting a preset saves its base shader carrying
  the preset's name and values. Retries and recovery treat it as the same
  insertion.

## Impact

- **Shared contract**: `shared/shader-presets.json` (new, generated from the
  vendored presets) and its Schema in `shared/shaders.ts`. `shaderCreation` takes the values to start from.
  `ShaderInsertRequest` keeps its shape: `slug` names the card, which may be a
  preset. No frame changes and no protocol bump.
- **Sidecar**: `sidecar/library/shaders.ts` resolves a card slug to its base
  descriptor and starting values. `sidecar/projects/shader-insertion.ts` creates
  the instance from that and compares a saved receipt by the resolved base.
  `sidecar/library/roles.ts` gives a preset its base's motion role.
- **Webview**: `components/studio/shaders-pane.tsx` admits preset assets.
  `hooks/use-shader-insertion.ts` is unchanged.
- **Tooling**: `scripts/remocn-sync.ts` (foldered pages, `presetOf`, one pin
  shared with `remocn-sources.ts`, then the bump), the new
  `scripts/shader-presets.ts` (run by `remocn:sync`, checked by
  `remocn:check`), and `remocn:previews` for the 36 new cards. The `remocn/` vendor set grows by 36
  entries.
- **Rust core**: none.

## Non-goals

- **A preset as a separate shader implementation.** The project registry picks
  an adapter by slug, so a preset slug in the document would need its own file
  under the immutable `studio-shaders-v1`. That would be 36 copies of four
  adapters that differ only in numbers.
- **Recording the preset in the saved document.** The label carries the name.
  A preset is a starting point: once its values are tuned, nothing about the
  instance is that preset any more. `ShaderIdentity` stays as it is.
- **Following a preset that changes upstream.** Saved instances keep the values
  they were created with, as the authored-version requirement already says.
- **Grouping presets under their base in the pane.** One flat grid. Slug order
  already puts each preset beside its base.
- **`shader.list`.** No webview code calls it. It keeps listing base
  descriptors.
- **Fixing `shader-warp-cream` here.** The value is wrong in remocn
  (`softness` is documented 0–1 by Paper 0.0.78). It is fixed there, and until
  then the card states why it cannot be added.
