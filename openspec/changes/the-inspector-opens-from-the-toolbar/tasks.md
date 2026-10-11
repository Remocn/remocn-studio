## 1. Webview

- [x] 1.1 `components/studio/canvas-preview.tsx`: add `InspectorToggle({ layers })`, an icon button with `SlidersHorizontalIcon`, `aria-label="Inspector"`, `aria-pressed={layers.shown}`, the `secondary` variant while open, and the hint *Show/Hide layers and properties*. Render it at the end of `CanvasToolbar` whether the inspector is shown or not. Verify in `components/studio/canvas-preview.test.tsx`: it is pressed when shown and not pressed when hidden, says the matching hint, and calls `layers.toggle` on click.
- [x] 1.2 Remove the collapse button from `InspectorBar`, and drop the now-unused `PanelRightOpenIcon` and `PanelRightCloseIcon` imports. Verify in the same test file: the open inspector's "Inspector views" navigation has no button besides its views.
- [x] 1.3 Align a docked inspector with the toolbar. The panel starts at `top-(--canvas-ruler)`, and its bar is `h-10` (the `PaneHeader` height) with `pt-2`, the same as `CanvasHeader` below the ruler. `CanvasRulers` fills the band above it (`w-(--canvas-inspector-width)`, `bg-muted`, the ruler's `pane-border` bottom edge, no marks). The first try padded the bar by the ruler height instead, which left an empty block above the tabs beside the ruler. A floating inspector is unchanged. Verify in the test that the docked panel starts below the ruler with a `pt-2` bar, and the floating one keeps its offset with no padding.

## 2. Verification

- [x] 2.1 Add a changeset. Run `bun run fix`, `bun run check`, `bun run typecheck`, the touched test file, then `bun run test` once.
- [ ] 2.2 In the running app (the user runs it):
  - With rulers on, and again off, the Layers and Inspect buttons and the toolbar's buttons share one centre line.
  - The sliders toggle stays at the end of the toolbar while the inspector opens and closes, and reads as pressed while it is open.
  - On a narrow window, the toggle opens the floating inspector below the toolbar.
