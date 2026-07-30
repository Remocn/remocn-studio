---
"remocn-studio": patch
---

The shadcn registry moves from the `base-luma` style to `base-vega`. Base UI is
still the primitive underneath every component, so nothing about how they compose
changes — but the shapes do: buttons go from `rounded-4xl` pills to `rounded-md`,
and each size now derives its radius from `min(var(--radius-md), …)` rather than
sharing one pill. Focus rings went from `ring-ring/30` to `/50` and the outline
variant picked up a `shadow-xs`.

Worth knowing for next time: a re-add rewrites all ~70 files in `components/ui`
at once, in the registry's own formatting, so `bun run check` fails on every one
of them until `bun run fix` runs. It also reintroduced the two generator defects
this repo has hit before — a duplicated `components={{…}}` in `calendar.tsx` and a
duplicated `render={…}` in `pagination.tsx`, both TS17001, both silently
discarding the earlier attribute. `bun run typecheck` is what catches those, and
it is the only gate over that directory.

The projects pane picked up the fixes that came out of a guidelines pass at the
same time: rows no longer change font weight between states (colour and
background carry it), every elapsed time and count is `tabular-nums` so digits
stop shifting as they tick, the status marker aligns to the title line rather
than the centre of a two-line row, and the row's click target is an overlay with
`aria-labelledby` — so a screen reader announces the session name as the button
and reads "Waiting 4m · Bash" as its own line, instead of running the two
together into one very long button name.
