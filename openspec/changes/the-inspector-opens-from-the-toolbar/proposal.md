## Why

The control that shows and hides the canvas inspector moves. With the
inspector open, it sits at the right end of the inspector's own bar. With the
inspector closed, it sits at the end of the canvas toolbar. A person has to
remember two places for one control, and its icon is a generic panel arrow that
says nothing about what the panel holds.

The inspector's bar and the canvas toolbar also sit at different heights. The
toolbar starts below the horizontal ruler and 8 px under it. The inspector bar
starts at the top edge of the pane. With rulers on, the two rows are 26 px apart
(measured from `--canvas-ruler` = 20 px, `pt-2` and the 40 px header against the
44 px bar). With rulers off, they are still 6 px apart.

## What Changes

- The inspector toggle lives only in the canvas toolbar, open or closed. The
  inspector bar keeps its views (Layers or Video details, and Inspect) and loses
  its collapse button.
- The toggle uses the Inspect view's sliders icon. It is pressed while the
  inspector is open, like Rulers, and its hint says what it shows: *Show layers
  and properties* or *Hide layers and properties*.
- When the inspector is docked, its bar lines up with the toolbar. Its row is
  as tall as the toolbar's and sits the same ruler-plus-8 px below the pane's
  top, so the two rows share one centre line with rulers on or off. A floating
  inspector, which opens below the toolbar on a narrow canvas, is unchanged.
- The requirement that states this is restated to match the inspector as it is
  built. The current text describes a vertical icon bar, Snapshot inside it,
  and a collapsed state that leaves the bar showing. None of that matches the
  code.

## Capabilities

### Modified Capabilities

- `shell/layout-and-panes`: *The properties pane exists only while it has
  something in it*. The inspector's bar holds its views; the one show/hide
  control is in the canvas toolbar; the bar is aligned with the toolbar.

## Impact

- Webview: `components/studio/canvas-preview.tsx`, where `InspectorToggle` is
  new and `InspectorBar` changes, plus its test.
- Shared contract, sidecar, Rust core: none.

## Non-goals

- A keyboard shortcut for the toggle. None exists today, and choosing one is a
  separate decision.
- Changing when the inspector floats instead of docking (`inspectorHasRoom`).
- Moving the rulers or changing their size.
