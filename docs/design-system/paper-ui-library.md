# Remocn Studio UI in Paper

[Open the separate Paper design file](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-1-0).

Created on 2026-10-03 from the current working tree. The existing **Remocn UI** Paper file was left untouched. Application source code was not changed for the transfer.

## Contents

- 154 design tokens for Light/Dark colors, font families, type sizes and weights, line heights, spacing, radii, opacity and dimensions.
- 180 component specimens in Light and Dark (360 editable groups), covering primitives and Studio blocks such as Composer, Thinking, Preview, Inspector, permission cards, navigation, media, audio, settings, brand, documents, onboarding and system states.
- Eight full-screen compositions at 1440 × 900 in both themes (16 artboards).
- Four frozen shader states in both themes.

Pages: **00 · Start here**, **01 · Foundations**, **02 · UI Primitives**, **03 · Studio Components**, **04 · Screens & Flows**. The Start page includes a coverage and editing guide. Component labels and layer names identify their source and rendering method.

## Fidelity and editing

The catalog contains 107 direct static React renders (106 component specimens and one settings screen), 74 source-guided reconstructions, and seven assembled screen states. Fixture data represents content and state; this is not an exhaustive capture of every runtime interaction. Source-guided specimens should be checked against the application before implementing a design change.

Components are named, editable groups, without linked instances or automatic synchronization with code. UI text, shapes and SVGs can be edited individually; shader frames are raster images. Color and typography tokens are bound where their source values match. Geometry was extracted at fixed sizes, so changing type or spacing requires checking wrapping and alignment.

Duplicate a group or screen to explore a variation. Compare both themes and related states, then use the source path in the specimen label to implement the chosen design.

## Source map

[paper-ui-library.json](paper-ui-library.json) maps all 179 source component files: 74 UI files and 105 Studio files. Of these, 163 are primary specimen sources, 12 are represented within other blocks/compositions, two are shader frame references, and two have no independent visual surface (ContextMenuGuard and StudioProvider). It also contains every specimen's Paper node IDs and fidelity classification.

[paper-tokens.css](paper-tokens.css) is an exported reference snapshot of the Paper tokens. It is not imported into the application.

## Verification

All 188 catalog entries have Light and Dark variants. Each component group and all 16 screen artboards were visually inspected. Transfer artifacts in SVG paints, textarea alignment, static resizable/chart examples, shimmer, permission heading spacing and the new-chat Composer were corrected in Paper. Artboards are arranged without overlaps, with screen themes paired by scenario.

