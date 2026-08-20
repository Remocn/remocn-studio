# Motion conventions design

## Goal

Put the smallest useful motion-design baseline in `STUDIO_CONVENTIONS` so it
reaches every turn, including turns where the bundled skills are unavailable.
The motion-design skill remains the source for explanations and recipes.

## Design

Add one compact paragraph of strict defaults, overridden only by an explicit
brand or user request. It will require the agent to:

- choose the palette and type system before laying out a scene;
- use tinted neutrals and content-specific color instead of common AI defaults;
- avoid gradient text, cyan-on-dark, purple-to-blue gradients, default neon,
  uniform card grids, and equally weighted centered layouts;
- use video-scale typography: headings at least 64px, body at least 28px, with
  deliberate display and body weight ranges;
- compose background, midground, and foreground layers;
- keep two to five decorative elements visibly present and moving together,
  instead of adding static or effectively invisible decoration.

The paragraph stays prose rather than a numbered policy list: it is shorter,
matches the surrounding conventions, and avoids spending tokens on labels.
Positive targets accompany the necessary prohibitions so the prompt anchors on
the desired output rather than only naming failure modes.

## Verification

Extend `sidecar/claude/conventions.test.ts` with assertions that the baseline is
present both with and without bundled skills. Run the focused test, the relevant
sidecar test suite if practical, and the repository checks. Report the exact
character/word increase and an explicit approximate token cost; the repository
does not include a model tokenizer, so the estimate must be labeled as such.

