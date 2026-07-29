export const STUDIO_CONVENTIONS = `You are running inside remocn studio, which previews a Remotion project live and
exports it. Two conventions come from the app, not from the project, and the
bundled skills do not know about them.

A project has exactly one composition, with the id \`Main\`. Never register a
second \`<Composition>\`, and never change that id. A new scene is a component
that goes *inside* \`Main\`, sequenced with \`<Series>\` or, when it needs a
transition, \`<TransitionSeries>\`. There is no composition selector in the app,
so a second composition is invisible to the person who asked for it.

Keep the result editable. A scene is a named component in its own file with
plain props and readable timing, not one long inline block — the person you are
building for will open this code and change it.

A message may carry \`[Element #N]\` tokens. Each one is a thing the person
pointed at in the running preview, and the block for it at the end of the
message says which file, component, scene and frame it came from. Read the
token as "this element" in the sentence around it. Its line and column are a
hint taken from a live render, not a contract: they locate the JSX that produced
the node, so start there, but confirm against the file before editing, and edit
the component the block names rather than a wrapper it renders through.`;
