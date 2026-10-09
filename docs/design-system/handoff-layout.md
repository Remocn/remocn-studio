# Layout, states and interaction

These are target implementation rules. Paper is a static reference, not executable behavior.

## Desktop shell

| Region | Reference |
| --- | --- |
| Artboard | 1440 × 900 |
| Window chrome | 46 px high |
| Single sidebar | 238 px |
| Main pane | x238, y46, 1194 × 846; 8 px right/bottom inset |
| Inspector | 340 px, inside the main pane |
| Sidebar row | 214 × 28, x12; icon slots fixed width |
| Chat tabs | Deferred to REM-661; excluded from this implementation |

Use flex/grid and `min-width: 0`, not screen-wide absolute coordinates. Scroll long conversation, sidebar lists and Inspector content within their regions; keep their persistent actions visible. At 1024 px use the compact workspace reference with collapsed sidebar. Mobile 390 px boards specify adaptation intent only.

Long titles truncate; paths use middle truncation. With no open chats preserve empty chrome and use the appropriate welcome/empty content. Existing document tabs retain keyboard navigation and scrolling. Chat-tab opening, closing and focus behavior belongs to REM-661.

## Project dialog

Reference: [S18 dark](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-4-0/1JP2-0), [S19 empty](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-4-0/1MXE-0).

| Element | Geometry |
| --- | --- |
| Dialog | 816 × 516, centered; radius 12; padding 28 |
| Header | 20/28 title, 13/20 description, gap 6 |
| Close | 32 × 32 at top/right 16 |
| Form | 760 wide; reference top 112 |
| First row | Name 280 + gap 24 + Location 456 |
| Field | Label 13/20, gap 8, control 36 high |
| Ratio group | 32 px below first field group; label + 12 px gap |
| Ratio cards | 4 × 181 × 176; 12 px gap; 16 px padding; radius 8 |
| Card content | Shape slot 48; ratio 18/24; resolution 12/18; logo 32 |
| Footer | 36 px high, 8 px action gap, aligned right; 28 px bottom inset |

Responsive width: `min(816px, calc(100vw - 32px))`. Max height is viewport minus 32 px; scroll the content. Below 720 px viewport, stack the fields and use two ratio columns. Keep the layout intrinsic; 516 px is the desktop reference, not a minimum on every device. At coarse pointers provide at least 44 px non-overlapping targets.

Dark scrim is #000000B3; light scrim #00000040. Modal itself has no decorative border or shadow. Light fields/cards on a white modal use `light-control`, selected card uses `light-accent`; dark fields/cards use `dark-field`, selected uses `dark-accent`.

## Creation state contract

Read `hooks/use-new-project.ts` rather than inventing validation.

- `open()` resets name to empty, parent to null, format to landscape.
- `launch-film` in S19 is a placeholder. It is not a default project name.
- `canCreate = name.trim().length > 0 && parent !== null`.
- Native folder-picker cancellation preserves the previous parent selection.
- Current `submit()` closes the dialog before awaiting creation. Keep current app-level progress/error handling. A persistent modal spinner would require an intentional logic change beyond this handoff.
- Focus Name on open; trap Tab inside the dialog; Escape/Cancel close; restore focus to the trigger.
- Ratio is a RadioGroup: arrow navigation, Space selection, visible selected check and neutral focus outline.
- Accessible card names include ratio, resolution and platforms, although platform captions are visually removed.

## Interaction states

Neutral hover surfaces use the opaque `accent` token (`#2a2a2a` in dark mode,
`#eaeaea` in light mode), matching the welcome template rows. Use it for buttons,
sidebar rows, inspector controls, menus and clickable cards; do not substitute
`muted`, `sidebar-accent` or translucent fills for hover. Keyboard-highlighted
menu items use the same surface. Selected neutral toolbar buttons also use
`accent` so they remain visible against `control`. Keep semantic action colors,
media overlays, scrollbar thumbs and resize handles in their own roles.

Use existing primitives for default, hover, focus-visible, active, disabled, loading and invalid states. Do not change weight, dimensions or border thickness on hover. Neutral focus: 2 px outline with 2 px offset. Invalid states need text as well as color. Disabled controls do not trigger actions. Loading retains width.

Composer's current key handler sends on Enter and uses Shift + Enter for a line break. Preserve mention selection priority and verify IME composition before shipping; static Paper cannot verify it. Escape closes transient UI. Dialogs and menus restore focus when dismissed.

## Sidebar transition

[B04](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-8-0/1GJJ-0): one clipped 238 px viewport below stationary 46 px chrome.

- Enter Settings: workspace body 0 → −238; settings body +238 → 0.
- 200 ms, cubic-bezier(.32,.72,0,1); Back reverses direction.
- Move focus to Back on entry; restore to Settings on return; keep workspace state.
- No entrance slide on initial load. Keyboard navigation and reduced-motion mode switch immediately.

## Welcome hints and product tour

[B03](https://app.paper.design/file/01M40EK8FFWZTW2G14NW9CXN69/p-8-0/1KV7-0): four manual hint states, 480 × 120. Previous/Next and indicators switch; 4 → 1 loops. Keep height fixed; crossfade 160 ms; reduced-motion switches immediately. No autoplay while typing or interacting.

The separate tour uses cover + six chapters from `lib/studio/onboarding.ts`. Skip/Close dismiss; indicators jump; reopening resumes the stored chapter. Preserve existing persistence in `hooks/use-onboarding.ts`.

## Runtime acceptance

Verify 1440, 1024 and a viewport below 720; Light/Dark; overflowing document-tab titles, projects and file paths; empty and populated states; focus order/return, radio keyboard navigation, IME; disabled/loading/error handling; reduced motion; canvas pan/zoom/selection/rulers; long responses and audio transport. Paper screenshots verify visual alignment, not these runtime interactions.
