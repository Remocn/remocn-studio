## 0. Upstream (remocn, before the pin moves)

- [x] 0.1 In remocn, set `softness` in `registry/remocn/shader-warp-cream/index.tsx` to `1` (or let it stay excluded; see design, Risks) and merge `feat/shader-presets` to `main`. Verify: the merge commit's `registry-artifacts/shader-warp-silk.json` resolves on `raw.githubusercontent.com`.

## 1. Tooling: vendoring the presets

- [x] 1.1 `scripts/remocn-sync.ts` imports `BASE_PIN` from `scripts/remocn-sources.ts` instead of its own `PIN`. Verify: `bun run remocn:check` still passes at `8ae853e` with no `remocn/` diff.
- [x] 1.2 `componentsOf` reads a family folder: `index.mdx` is the folder's name, and each other page is its frontmatter `component:`, fetched raw at the pin. A page without it fails the sync by name. Verify with a unit test over a fake listing in `scripts/remocn-sync.test.ts` (flat page, `components/`, family folder, missing frontmatter).
- [x] 1.3 `VendoredManifest` (script and `sidecar/library/bundled.ts`) gains an optional `presetOf` from `meta.presetOf`, written only when present so no other manifest changes. Verify: `sidecar/library/bundled.test.ts` decodes a manifest with and without it.
- [x] 1.4 Move `BASE_PIN` to remocn's merge commit from 0.1 (`fd2d301`; the sync wipes `registry/`, so restore the tracked posters and clips with `git checkout` and render only the 36 new names), then run `bun run remocn:sync` and `bun run remocn:previews`. Review the `remocn/` diff: 36 `shader-*-*` entries in Shaders, the four bases still in Shaders, and no `registry/shader-*/shader-*.tsx` hash changed in `remocn/lock.json`. Verify: `bun run remocn:check` passes, and every preset has `poster.png` and `preview.mp4`.

## 2. Shared contract

- [x] 2.1 `scripts/shader-presets.ts`: read every vendored manifest with `presetOf`, evaluate its `…Preset = { … } satisfies` literal, and title it from the manifest without the leading `Shader `. Check values against the base descriptor (Decision 1). Write `shared/shader-presets.json` as `{ presets, excluded }`. `--check` fails on drift. `remocn-sync.ts` regenerates it after a sync, and its `--check` (`remocn:check`) reports drift. Verify: the generated file holds 35 presets and excludes `shader-warp-cream` with a worded reason (or holds 36 if 0.1 fixed it).
- [x] 2.2 `shared/shaders.ts`: the `ShaderPreset` Schema with `presetProblem` (known base, declared non-instance fields, `fieldProblem`-clean values); `shared/shader-presets.ts`: `SHADER_PRESETS`, `EXCLUDED_SHADER_PRESETS` and `shaderCatalogueEntry(slug)` (split so the generator never imports the file it writes). `shaderCreation` takes an optional `{ title, values }`. Verify in `shared/shader-presets.test.ts`: Aurora's values plus Mesh Gradient defaults for the rest; rejection of an unknown base, an instance field, an out-of-bounds value, a bad enum and a too-long palette; and every vendored preset either in `presets` or in `excluded`.

## 3. Sidecar

- [x] 3.1 `sidecar/projects/shader-insertion.ts`: resolve `request.slug` once. Prepare resources for the base, create with the preset's title and values, and fail an unknown slug with *"This shader cannot be added."* before journaling. Verify in `sidecar/projects/shader-insertion.test.ts`: a preset insertion saves a base instance labelled with the preset with its values. Adding Warp Silk beside an existing Warp writes no resource and installs nothing.
- [x] 3.2 `requestMatches` and `recoverReceipt` compare the resolved base slug. Verify in the same file: retrying a saved Warp Silk insertion with the preset slug, and again with the base slug (the webview's rebuilt request), returns the existing receipt without duplicating it or reporting a different request.
- [x] 3.3 `bundledRoleOf` returns the base's role for a manifest with `presetOf`. Verify: `sidecar/library/roles.test.ts` passes with the 36 presets vendored and no new entries in `BUNDLED_ROLES`.

## 4. Webview

- [x] 4.1 `components/studio/shaders-pane.tsx` admits a Shaders asset whose slug resolves through `shaderCatalogueEntry`, and excludes an excluded preset. Verify in `components/studio/shaders-pane.test.tsx`: Warp Silk renders beside Warp, "silk" and "warp" search as in the spec, Warp Cream is absent while excluded, and picking Warp Silk sends `shader.insert` with `slug: "shader-warp-silk"` (through `hooks/use-shader-insertion.ts`, unchanged).
- [x] 4.2 Reset on a preset instance returns to the preset's values. Verify in `hooks/use-managed-objects.test.tsx` with a create operation that carries preset values.

## 5. Verification and records

- [x] 5.1 Add a changeset ("Shaders gains 35 ready-made presets of Mesh Gradient, Grain Gradient, Swirl and Warp"). Add to CLAUDE.md under *Caption catalogue tooling* (or a sibling *Shader presets* note): `shared/shader-presets.json` is generated, never hand-edited, and an excluded preset is fixed upstream.
- [x] 5.2 `bun run check`, `bun run typecheck`, the touched test files, then `bun run test` once.
- [x] 5.3 `REMOCN_SHADER_CATALOG_RENDER=1 bun test sidecar/preview/shader-catalog-render.test.ts` renders a preset instance (one case per base: Sunrise, Aurora, Candy, Silk). Verify: frames are non-empty, repeat deterministically and differ from the base's default frame.
- [ ] 5.4 In the running app (the user runs it): open Shaders and check that the preset cards show posters and hover clips. Add Mesh Gradient Aurora to a scene and compare it with its poster. Tune it, press Reset shader and see Aurora return. Add Warp Silk to a video that already has a Warp and see no install step. Export a few seconds and check that the preset appears in the mp4.
