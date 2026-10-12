# Remocn Studio UI in Paper

Start with [the current handoff](handoff.md) and [00 · Handoff in Paper](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-1-0). Prepared 2026-10-04 after the Linear layout, flat surfaces, selective clean-fuchsia accent and welcome/project-dialog iterations.

## Current deliverables

- Current pages 01–09 contain foundations, primitives, Studio components, 77 desktop screen states, interaction references and icons.
- Desktop screen pairs are arranged Dark left / Light right. Seven detailed inspector boards are dark; shared component recipes include both themes.
- Current welcome and project creation live on 09 · Onboarding & Project. S18–S19 on 03 · Studio Components define the shared project dialog's filled and empty/focused states.
- Pages 90–91 preserve obsolete explorations and replaced screens. They are not implementation sources.
- [paper-handoff.json](paper-handoff.json) is the current page/artboard/source index.
- [paper-tokens.css](paper-tokens.css) is the current active-token export. It is not imported into the application.
- [assets/README.md](assets/README.md) documents the exported welcome ribbon and social SVGs.

## Original extraction

The library was first extracted from the working tree on 2026-10-03 into a separate file, leaving Remocn UI untouched. [paper-ui-library.json](paper-ui-library.json) preserves that historical inventory: 179 source files, 180 component specimens in two themes and eight original screen compositions. Its original counts and fidelity labels describe that extraction, not the current edited design.

The current source index overrides replaced Startup, New project and Appearance screen nodes. Application source was not migrated as part of this design handoff.

## Implementation limits

Paper uses named editable groups, not linked component instances or live application behavior. UI text, shapes and SVGs remain editable; shader frames and tour screenshots are image references. Build responsive flex/grid layouts from the semantic structure instead of copying fixed absolute positions. Verify focus, keyboard, accessibility, loading/error states, motion and resizing in the running application.

See [component decisions](handoff-components.md) and [layout/state contracts](handoff-layout.md).
