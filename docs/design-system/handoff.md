# Remocn Studio — UI handoff

Prepared 2026-10-04. [Open Paper handoff](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-1-0).

The intended UI is compact, flat and neutral, with one Linear-style sidebar. Clean fuchsia is reserved for **Create project** and **Export**. This is the design specification; current migration status and verification evidence are recorded in [implementation.md](implementation.md).

## Sources of truth

1. Current screen artboards define composition and placement.
2. Shared specimens define component anatomy and states.
3. [paper-tokens.css](paper-tokens.css) defines exact semantic values.
4. Existing source components and hooks define behavior, data and public APIs.

Read [components](handoff-components.md) for source files and component decisions; read [layout and behavior](handoff-layout.md) before implementing shell, dialogs or transitions.

## Paper index

| Page | Use |
| --- | --- |
| [01 · Foundations](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-2-0) | Color roles, type, spacing and radius |
| [02 · UI Primitives](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-3-0) | Buttons, fields, selectors, overlays and feedback |
| [03 · Studio Components](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-4-0) | Composer, Thinking, Preview, Inspector, media and S18–S19 project dialogs |
| [04 · Studio & Inspector](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-5-0) | W01–W07 workspace states; I01–I07 inspector controls |
| [05 · Settings](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-6-0) | T01–T11 settings screens |
| [06 · Turn Variations](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-7-0) | V01 long response; V02 design_check; V03 generated audio; V04 generating audio |
| [07 · Layout & Behavior](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-8-0) | Compact workspace, tab overflow, hint states and sidebar transition |
| [08 · Hugeicons](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-9-0) | UI icon library |
| [09 · Onboarding & Project](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-B-0) | O01–O13 welcome, project dialog, brand import and product tour |

Pages **90–91 are archives**. Do not implement their superseded colors, full-page project form or older welcome layouts. The 77 current desktop screen artboards use 1440 × 900; paired themes place Dark left and Light right. The seven detailed inspector states are dark; the shared Inspector library and W05 provide both themes.

## Non-negotiable visual rules

- Inter for UI; Geist Mono for code and technical values. Sentence case; no uppercase labels or wide tracking.
- Standard labels: 13/20; dense controls may use existing 13/18. Supporting copy: 12/18. Metadata: 11/16. Dialog title: 20/28; welcome: 24/32.
- Use semantic color tokens. `primary` is neutral; `key-action` is fuchsia. `--color-study-*` belongs only to archive exploration and is excluded from the handoff CSS.
- Radius: 6 px controls/composer, 8 px filled fields/cards, 12 px panes/dialogs. Full radius only for circles, pills and switch thumbs.
- Separate surfaces through fills and spacing. No decorative borders, inset highlights or shadows on fields, cards, rows or panes.
- Keep functional strokes: keyboard focus, selection bounds, canvas rulers, ratio silhouettes, icons and data visualization.
- Dark modal fields use `dark-field`; fields on white light popovers use `light-control` so they remain visible.
- Implement in flex/grid with intrinsic sizing. Paper's extracted absolute geometry is not a responsive layout algorithm.

## Handoff files

- [paper-handoff.json](paper-handoff.json): current pages, artboards, links, dimensions, component source mapping and superseded node references.
- [paper-tokens.css](paper-tokens.css): current active tokens, exported from Paper; not imported into the application.
- [assets](assets/README.md): exported welcome SVG and original social logo SVGs.
- [paper-ui-library.json](paper-ui-library.json): historical extraction inventory, retained for provenance; current overrides are in `paper-handoff.json`.

## Implementation order and acceptance

1. Map Paper tokens to existing app theme roles; remove decorative surface treatments in shared primitives.
2. Build shell and workspace/settings sidebar states. Horizontal chat tabs are deferred to REM-661 and excluded from this migration.
3. Apply the system to Studio blocks and settings; then implement welcome and the shared project dialog.
4. Check both themes, 1440 and 1024 widths, narrow dialogs, keyboard focus, IME, empty/disabled/loading/error states, long names and paths, and reduced motion.

Paper contains editable static groups, not linked component instances or a working prototype. Runtime behavior, screen-reader output and resize/scroll interactions must be verified in the application. Mobile 390 px boards are adaptation references, not a claim of complete native mobile coverage.
