# Motion taxonomy design

REM-290. The keyframe timeline is replaced by a vocabulary of named
behaviours, and a vocabulary needs a skeleton. Hyperframes' is proven in
production: every movement belongs to one moment in the life of the thing it is
attached to — it arrives, it is emphasised, it leaves. This adds that axis to
the studio as **data**, not as a document.

## Design

**One field, one value.** `role: entry | emphasis | exit | scene | transition`
on a component. It answers *when* a behaviour runs, where the pane's categories
(Typography, Shaders, Filters…) answer *what it is about*. `scene` and
`transition` are the two answers that are about a whole scene rather than one
element — the architecture already gave them their meaning — so the axis is one
axis, not two: ambiguity resolves outward, transition over scene over the three
element roles. Anything without a role behaves exactly as it does today.

**The framework that decides a hard case.** Entry runs at the start of an
element's life, exit at the end, emphasis in between — so a behaviour that
replaces an element's *content* in place (a value swap, a per-word crossfade, a
strikethrough that reveals the new line) is emphasis: the element was there
before and is there after. A behaviour that brings content out of nothing
(typewriter, decode, handwrite) is entry, and so is a number that counts to the
value it lands on — the count is how that value arrives.

**Where the taxonomy lives.** `shared/motion.ts` — the roles, their labels, the
one-line hint per role, the parameters each role is expected to expose, and the
dictionary of named element behaviours. The convention paragraph and the pane's
headings are both generated from it, so the words the prompt uses and the words
the person reads cannot drift.

**Where the roles of the shipped set live.** `sidecar/library/roles.ts`, ours,
beside the vendored tree rather than inside it. `remocn/` is byte-locked against
upstream (`remocn:check` hashes every file), and the role assignment is our
editorial judgement, not upstream's data — writing it into the vendored
manifests would make every future `remocn:sync` a merge. A test asserts that
every component `remocn/index.json` ships has a role, so a sync that adds
components fails until they are classified.

**Where the dictionary is said to the agent.** Names in the convention, recipes
in the skill — the split the issue proposed. `STUDIO_CONVENTIONS` gains one
paragraph: the five roles, the rule that every animated element has an entry and
an exit and optionally an emphasis, the twenty dictionary names, the parameter
convention per role, and what to do with a behaviour the dictionary does not
have. `agent/skills/motion-design/SKILL.md` gains the section with a Remotion
recipe and starting numbers per name. A test pins that every dictionary name is
documented in the skill.

**Where it shows.** The Components pane groups by role — Entry, Emphasis, Exit,
Scene, Transition — instead of by category, because that is the question a
person composing a video actually asks, and it is the same vocabulary the prompt
and the future props panel (REM-6) use. Category survives in the data and orders
the tiles inside a role group, so Scene reads shaders before filters. Saved
components carry roles too (`save_asset` takes one) and sit in the role group
they belong to; the ones saved before roles existed keep a leading *Saved* group.

## Verification

`shared/motion.test.ts` for the taxonomy and its drift guards, a roles test
against `remocn/index.json`, `lib/studio/pane-view.test.ts` for the grouping
(pure, renders nothing), `sidecar/claude/conventions.test.ts` for the paragraph
with and without skills, and the library store/insert suites for the manifest
round trip of a role and for a manifest written before roles existed. Then
`bun run check`, `bun run typecheck`, `bun run test`.

The starting numbers in the skill section are stated as starting values and are
kept consistent with the durations §6 already carries; they are not re-measured
by a fresh render in this change.
