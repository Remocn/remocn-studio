## 1. Webview

- [x] 1.1 `components/studio/canvas-preview.tsx`: add `InspectorToggle({ layers })`, an icon button with `SlidersHorizontalIcon`, `aria-label="Inspector"`, `aria-pressed={layers.shown}`, the `secondary` variant while open, and the hint *Show/Hide layers and properties*. Render it at the end of `CanvasToolbar` whether the inspector is shown or not. Verify in `components/studio/canvas-preview.test.tsx`: it is pressed when shown and not pressed when hidden, says the matching hint, and calls `layers.toggle` on click.
- [x] 1.2 Remove the collapse button from `InspectorBar`, and drop the now-unused `PanelRightOpenIcon` and `PanelRightCloseIcon` imports. Verify in the same test file: the open inspector's "Inspector views" navigation has no button besides its views.
- [x] 1.3 Align a docked `InspectorBar` with the toolbar. Its row is `h-10` (the `PaneHeader` height) with a top padding of `calc(var(--canvas-ruler) + 0.5rem)`, the same offset as `CanvasHeader`. A floating bar keeps no extra padding. Verify in the test that the docked bar carries the ruler offset and the floating one does not.

## 2. Verification

- [x] 2.1 Add a changeset. Run `bun run fix`, `bun run check`, `bun run typecheck`, the touched test file, then `bun run test` once.
- [ ] 2.2 In the running app (the user runs it):
  - With rulers on, and again off, the Layers and Inspect buttons and the toolbar's buttons share one centre line.
  - The sliders toggle stays at the end of the toolbar while the inspector opens and closes, and reads as pressed while it is open.
  - On a narrow window, the toggle opens the floating inspector below the toolbar.
