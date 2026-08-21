---
"remocn-studio": minor
---

Movement now has a role: entry, emphasis, exit, scene or transition.

Keyframes are being replaced here by a vocabulary of named behaviours, and a vocabulary
needs a skeleton. This is it — one axis that says *when in the life of the thing it is
attached to* a movement runs, where the Components pane's categories only ever said what
a component was about. All 99 bundled remocn components are classified: 21 entry, 15
emphasis, 4 exit, 36 scene, 23 transition. Exit being that thin is information, and it
is visible now.

The pane groups by those five words instead of by category, with a count on each
heading; category survives in the data and orders the tiles inside a group, so Scene
still reads shaders before filters. A component you saved sits in its own role next to
the shipped ones — that is the point, the dictionary is meant to grow — and anything
saved before roles existed keeps a leading *Saved* group.

The agent is told the same vocabulary in every turn: the five roles, the rule that every
animated element gets an entry and an exit and that emphasis is spent on the one thing
that matters, the twenty dictionary names, and the props each role is expected to expose
— so a behaviour it invents arrives with the knobs a props panel can pick up later. The
names are in the conventions and the recipes are in the `motion-design` skill, which now
carries a Remotion recipe and a starting number per name. `save_asset` takes the role,
so a behaviour worth keeping joins the library already classified, and an inserted asset
reaches the turn as `[Asset #N] Name (entry)`.

The dictionary obeys `video-lessons` rather than competing with it: there is no `pulse`
in it, because §1 bans pulsing, and `rise-in` is documented as panels-and-images only,
because a text entrance travels on X or the glyph baselines snap.

Nothing without a role behaves differently. The field is nullable wherever it is stored,
a manifest written before this reads back as having none, and media is never given one.
