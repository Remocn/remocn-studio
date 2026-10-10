import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  hardcodedEasings,
  type TunabilityRule,
  tunabilityDesignFindings,
  tunabilityFindings,
} from "@/sidecar/tools/tunability";
import { documentFixture } from "@/test/fixtures/studio-document";

const WORKED = join(
  process.cwd(),
  "agent",
  "skills",
  "motion-design",
  "rules",
  "tunable-text.md"
);

function rules(source: string, path = "Scene.tsx"): TunabilityRule[] {
  return tunabilityFindings([{ path, source }]).map((finding) => finding.rule);
}

describe("hardcodedEasings", () => {
  // Exactly what the agent wrote when it followed the vendored skill: a curve
  // nailed shut, which the panel can render and can never edit.
  it("finds a constant easing and says where it is", () => {
    const source = [
      "const value = interpolate(frame, [0, 20], [0, 1], {",
      "  easing: Easing.out(Easing.cubic),",
      "});",
    ].join("\n");

    expect(hardcodedEasings("Lane.tsx", source)).toEqual([
      {
        file: "Lane.tsx",
        line: 2,
        snippet: "easing: Easing.out(Easing.cubic)",
      },
    ]);
  });

  it("finds every shape a constant curve is written in", () => {
    const source = [
      "easing: Easing.linear,",
      "easing: Easing.bezier(0.42, 0, 0.58, 1),",
      "easing: Easing.inOut(Easing.sin),",
    ].join("\n");

    expect(hardcodedEasings("Scene.tsx", source)).toHaveLength(3);
  });

  // The spread is the answer, not the problem — that curve comes from a prop
  // and is what the panel drags.
  it("leaves an easing that comes from a prop alone", () => {
    const source = [
      "easing: Easing.bezier(...easing),",
      "easing: Easing.bezier(...titleEasing),",
    ].join("\n");

    expect(hardcodedEasings("Title.tsx", source)).toEqual([]);
  });

  it("leaves an enum easing resolved through a lookup alone", () => {
    expect(
      hardcodedEasings("Title.tsx", "easing: getEasing(easing),\n")
    ).toEqual([]);
  });

  it("says nothing about code that has no easing at all", () => {
    expect(hardcodedEasings("Plain.tsx", "const a = 1;\n")).toEqual([]);
  });

  it("is not fooled by the word easing on its own", () => {
    expect(
      hardcodedEasings("Notes.tsx", "// pick an easing that settles\n")
    ).toEqual([]);
  });

  it("reads a spread that wrapped to the next line", () => {
    const source = [
      "const y = interpolate(frame, [0, 20], [0, 1], {",
      "  easing: Easing.bezier(",
      "    ...entryEasing",
      "  ),",
      "});",
    ].join("\n");

    expect(hardcodedEasings("Wrapped.tsx", source)).toEqual([]);
  });

  it("treats a bezier of four identifiers as prop-fed", () => {
    expect(
      hardcodedEasings("Split.tsx", "easing: Easing.bezier(e0, e1, e2, e3),\n")
    ).toEqual([]);
  });

  it("keeps naming the file and the line it found the curve on", () => {
    const findings = tunabilityFindings([
      { path: "a.tsx", source: "easing: Easing.linear,\n" },
      { path: "b.tsx", source: "\n\neasing: Easing.out(Easing.quad),\n" },
    ]);

    expect(
      findings.map((finding) => `${finding.file}:${finding.line}`)
    ).toEqual(["a.tsx:1", "b.tsx:3"]);
  });

  it("tells the agent the shape that replaces the constant", () => {
    const [finding] = tunabilityDesignFindings(
      tunabilityFindings([{ path: "a.tsx", source: "easing: Easing.linear" }])
    );

    expect(finding?.code).toBe("tunability_constant_easing");
    expect(finding?.severity).toBe("error");
    expect(finding?.observed).toContain("a.tsx:1");
    expect(finding?.fix).toContain("Easing.bezier(...easing)");
  });
});

describe("constant-spring", () => {
  it("reports a spring whose physics are nailed shut", () => {
    const source = [
      "const schema = {",
      "  riseFrames: { default: 30, type: 'number' },",
      "} as const satisfies InteractivitySchema;",
      "const rise = spring({ config: { damping: 200 }, fps, frame });",
    ].join("\n");

    expect(rules(source)).toEqual(["constant-spring"]);
  });

  it("says nothing when the schema already exposes the physics", () => {
    const source = [
      "const schema = {",
      "  springDamping: { default: 60, type: 'number' },",
      "} as const satisfies InteractivitySchema;",
      "const rise = spring({ config: { damping: springDamping }, fps, frame });",
    ].join("\n");

    expect(rules(source)).toEqual([]);
  });
});

describe("plain-text-element", () => {
  it("reports a headline written as a bare h1", () => {
    const source = [
      "export function Headline({ text }) {",
      "  return <h1 style={{ fontSize: 96 }}>{text}</h1>;",
      "}",
    ].join("\n");

    expect(rules(source)).toEqual(["plain-text-element"]);
  });

  it("leaves spans inside an Interactive ancestor alone", () => {
    const source = [
      '<Interactive.Div name="Pushed line" style={{ fontSize: 112 }}>',
      "  {words.map((word, j) => (",
      "    <span key={j} style={{ display: 'inline-block' }}>",
      "      {word}",
      "    </span>",
      "  ))}",
      "</Interactive.Div>",
    ].join("\n");

    expect(rules(source, "WordPush.tsx")).toEqual([]);
  });

  it("leaves children forwarded to a component alone", () => {
    const source = [
      "<RevealTextBody fadeFrames={fadeFrames} style={style}>",
      "  {children}",
      "</RevealTextBody>",
    ].join("\n");

    expect(rules(source, "RevealText.tsx")).toEqual([]);
  });

  it("is not derailed by a comparison inside a style object", () => {
    const source = [
      "<Interactive.Div",
      '  name="Scene group"',
      "  style={{",
      "    filter:",
      "      enterBlur > 0",
      "        ? `blur(${interpolate(frame, [0, enterBlurFrames], [enterBlur, 0], {",
      '            extrapolateLeft: "clamp",',
      "          })}px)`",
      "        : undefined,",
      "  }}",
      ">",
      "  <span>{label}</span>",
      "</Interactive.Div>",
    ].join("\n");

    expect(rules(source, "SceneStage.tsx")).toEqual([]);
  });

  it("does not read a mapped list in a plain wrapper as text", () => {
    const source = [
      '<div style={{ display: "flex" }}>',
      "  {words.map((word) => (",
      '    <Interactive.Span key={word} name={word} style={{ fontSize: "96" }}>',
      "      {word}",
      "    </Interactive.Span>",
      "  ))}",
      "</div>",
    ].join("\n");

    expect(rules(source, "Stack.tsx")).toEqual([]);
  });

  it("still sees a string written beside a mapped list", () => {
    const source = [
      '<div style={{ display: "flex" }}>',
      "  Totals",
      "  {rows.map((row) => (",
      "    <Row key={row} />",
      "  ))}",
      "</div>",
    ].join("\n");

    expect(rules(source, "Stack.tsx")).toEqual(["plain-text-element"]);
  });
});

describe("mapped-primitive-name", () => {
  it("reports one literal name shared by every mapped instance", () => {
    const source = [
      "{roles.map((role, i) => (",
      "  <Interactive.Div",
      "    key={role}",
      '    name="Role slot"',
      "    style={{ top: top + i * 72 }}",
      "  >",
      "    <FadeLine>{role}</FadeLine>",
      "  </Interactive.Div>",
      "))}",
    ].join("\n");

    expect(rules(source, "ClaimScene.tsx")).toContain("mapped-primitive-name");
  });

  it("does not read a hyphenated attribute as the name", () => {
    const source = [
      "{rows.map((row) => (",
      '  <Interactive.Div key={row} name={row} data-name="Row" />',
      "))}",
    ].join("\n");

    expect(rules(source, "Rows.tsx")).toEqual([]);
  });

  it("says nothing when the mapped name carries the index", () => {
    const source = [
      "{roles.map((role, i) => (",
      '  <Interactive.Div key={role} name={"Role " + String(i + 1)} />',
      "))}",
    ].join("\n");

    expect(rules(source, "ClaimScene.tsx")).toEqual([]);
  });

  it("does not treat a finished map as an enclosing region", () => {
    const source = [
      'const glow = stops.map((a, i) => String(a) + " " + String(i) + "%").join(", ");',
      "",
      "return (",
      '  <Interactive.Div name="Ambient field" style={{ inset: -80 }}>',
      '    <Interactive.Div name="Localized glow" style={{ inset: 0 }} />',
      "  </Interactive.Div>",
      ");",
    ].join("\n");

    expect(rules(source, "LabBackdrop.tsx")).toEqual([]);
  });
});

describe("inert-easing", () => {
  it("reports a curve whose window defaults to zero", () => {
    const source = [
      "const schema = {",
      "  exitAt: {",
      "    default: 0,",
      "    type: 'number',",
      "  },",
      "  exitEasing: {",
      "    default: [0.64, 0, 0.78, 0],",
      "    type: 'array',",
      "  },",
      "} as const satisfies InteractivitySchema;",
    ].join("\n");

    expect(rules(source, "SceneStage.tsx")).toEqual(["inert-easing"]);
  });

  it("says nothing when the window it belongs to actually runs", () => {
    const source = [
      "const schema = {",
      "  entryFrames: {",
      "    default: 18,",
      "    type: 'number',",
      "  },",
      "  entryEasing: {",
      "    default: [0.33, 1, 0.68, 1],",
      "    type: 'array',",
      "  },",
      "} as const satisfies InteractivitySchema;",
    ].join("\n");

    expect(rules(source, "Headline.tsx")).toEqual([]);
  });

  it("reports a curve whose only use hides behind a ternary on its own window", () => {
    const source = [
      "const schema = {",
      "  exitFrames: {",
      "    default: 6,",
      "    type: 'number',",
      "  },",
      "  exitEasing: {",
      "    default: [0.64, 0, 0.78, 0],",
      "    type: 'array',",
      "  },",
      "} as const satisfies InteractivitySchema;",
      "const leave = hasExit",
      "  ? interpolate(frame, [a, b], [0, 1], {",
      "      easing: Easing.bezier(...exitEasing),",
      "    })",
      "  : 0;",
    ].join("\n");

    expect(rules(source, "SceneStage.tsx")).toEqual(["inert-easing"]);
  });
});

describe("controls-not-forwarded", () => {
  it("reports a schema component that never passes its controls on", () => {
    const source = [
      "function TitleBase({ controls, name }) {",
      "  return <Sequence name={name}>{null}</Sequence>;",
      "}",
      "export const Title = Interactive.withSchema({",
      "  Component: TitleBase,",
      "  schema: titleSchema,",
      "});",
    ].join("\n");

    expect(rules(source, "Title.tsx")).toContain("controls-not-forwarded");
  });

  it("says nothing when the controls reach the sequence", () => {
    const source = [
      "function TitleBase({ controls, name }) {",
      "  return <Sequence controls={controls} name={name}>{null}</Sequence>;",
      "}",
      "export const Title = Interactive.withSchema({",
      "  Component: TitleBase,",
      "  schema: titleSchema,",
      "});",
    ].join("\n");

    expect(rules(source, "Title.tsx")).toEqual([]);
  });
});

describe("raw-export", () => {
  it("reports the unwrapped component exported beside the wrapped one", () => {
    const source = [
      "export function TitleBase({ controls }) {",
      "  return <Sequence controls={controls}>{null}</Sequence>;",
      "}",
      "export const Title = Interactive.withSchema({",
      "  Component: TitleBase,",
      "  schema: titleSchema,",
      "});",
    ].join("\n");

    expect(rules(source, "Title.tsx")).toEqual(["raw-export"]);
  });

  it("says nothing when only the wrapped component leaves the file", () => {
    const source = [
      "function TitleBase({ controls }) {",
      "  return <Sequence controls={controls}>{null}</Sequence>;",
      "}",
      "export const Title = Interactive.withSchema({",
      "  Component: TitleBase,",
      "  schema: titleSchema,",
      "});",
    ].join("\n");

    expect(rules(source, "Title.tsx")).toEqual([]);
  });
});

async function shippedBlocks(page: string): Promise<string[]> {
  const text = await readFile(page, "utf8");
  return [...text.matchAll(/```tsx\n([\s\S]*?)```/g)].map(
    (block) => block[1] ?? ""
  );
}

describe("the worked component the motion-design skill ships", () => {
  it("scores nothing against the rule set", async () => {
    const blocks = await shippedBlocks(WORKED);

    expect(blocks.length).toBeGreaterThan(0);
    expect(
      tunabilityFindings(
        blocks.map((source, index) => ({
          path: `tunable-text-${index}.tsx`,
          source,
        }))
      )
    ).toEqual([]);
  });
});

describe("the springs guide the motion-design skill ships", () => {
  // The guide teaches the config; its example must not nail one shut.
  it("scores nothing against the rule set", async () => {
    const blocks = await shippedBlocks(join(WORKED, "..", "springs.md"));

    expect(blocks.length).toBeGreaterThan(0);
    expect(
      tunabilityFindings(
        blocks.map((source, index) => ({
          path: `springs-${index}.tsx`,
          source,
        }))
      )
    ).toEqual([]);
  });
});

describe("tunabilityDesignFindings", () => {
  it("gives every rule a code the review stage can gate on", () => {
    const source = [
      "export function Headline({ text }) {",
      "  return <h1>{text}</h1>;",
      "}",
    ].join("\n");

    const [finding] = tunabilityDesignFindings(rulesOf(source));

    expect(finding?.code).toBe("tunability_plain_text_element");
    expect(finding?.severity).toBe("warning");
    expect(finding?.bbox).toBeNull();
    expect(finding?.frames).toEqual([]);
    expect(finding?.selector).toBeNull();
    expect(finding?.text).toBeNull();
    expect(finding?.observed).toContain("Scene.tsx:2");
  });
});

function rulesOf(source: string) {
  return tunabilityFindings([{ path: "Scene.tsx", source }]);
}

describe("managed object sources", () => {
  const source =
    'const object = useStudioObject("title"); return <h1 {...object.bind}>{text}</h1>;';
  it("accepts a declared semantic text root and validates its document", () => {
    expect(
      tunabilityFindings([
        { path: "index.tsx", source },
        { path: "studio.json", source: JSON.stringify(documentFixture) },
      ])
    ).toEqual([]);
  });
  it("reports missing and malformed documents", () => {
    expect(rules(source)).toEqual(["managed-document"]);
    expect(
      tunabilityFindings([{ path: "studio.json", source: "{" }])[0]?.snippet
    ).toContain("not valid JSON");
    expect(
      tunabilityFindings([
        {
          path: "studio.json",
          source: JSON.stringify({ ...documentFixture, version: 99 }),
        },
      ])[0]?.rule
    ).toBe("managed-document");
  });
});

describe("scenes", () => {
  function sceneDocument(
    labels: readonly string[],
    parents: Readonly<Record<string, string>> = {}
  ): string {
    return JSON.stringify({
      ...documentFixture,
      definitions: [
        ...documentFixture.definitions,
        { fields: [], id: "scene", version: 1 },
      ],
      objects: [
        ...labels.map((label, index) => ({
          definition: "scene",
          id: `scene-${index}`,
          label,
          parentId: null,
          values: {},
        })),
        ...documentFixture.objects.map((object) => ({
          ...object,
          parentId: parents[object.id] ?? null,
        })),
      ],
    });
  }

  const film = (...sequences: string[]) =>
    [
      "export default function Film() {",
      "  return (",
      "    <Series>",
      ...sequences.map(
        (attributes) =>
          `      <Series.Sequence ${attributes}><Scene /></Series.Sequence>`
      ),
      "    </Series>",
      "  );",
      "}",
    ].join("\n");

  const everyObjectIn = {
    first: "scene-0",
    second: "scene-0",
    third: "scene-1",
  };

  function check(index: string, document: string) {
    return tunabilityFindings([
      { path: "index.tsx", source: index },
      { path: "studio.json", source: document },
    ]);
  }

  it("accepts scenes that are named and described", () => {
    expect(
      check(
        film(
          'name="Intro" durationInFrames={30}',
          'name="Outro" durationInFrames={30}'
        ),
        sceneDocument(["Intro", "Outro"], everyObjectIn)
      )
    ).toEqual([]);
  });

  it("reports a scene sequenced without a name, on its line", () => {
    const [finding] = check(
      film("durationInFrames={30}", 'name="Outro" durationInFrames={30}'),
      sceneDocument(["Intro", "Outro"], everyObjectIn)
    );

    expect(finding?.rule).toBe("unnamed-scene");
    expect(finding?.line).toBe(4);
    expect(finding?.file).toBe("index.tsx");
  });

  it("reports a named scene with no scene object of that label", () => {
    const findings = check(
      film(
        'name="Intro" durationInFrames={30}',
        'name="Pricing" durationInFrames={30}'
      ),
      sceneDocument(["Intro", "Outro"], everyObjectIn)
    );

    expect(findings.map((finding) => [finding.rule, finding.snippet])).toEqual([
      ["scene-without-object", 'name="Pricing"'],
    ]);
  });

  it("warns about an object outside every scene, but not one index.tsx renders", () => {
    const outside = check(
      film(
        'name="Intro" durationInFrames={30}',
        'name="Outro" durationInFrames={30}'
      ),
      sceneDocument(["Intro", "Outro"], { first: "scene-0", second: "scene-0" })
    );

    expect(outside.map((finding) => [finding.rule, finding.file])).toEqual([
      ["object-outside-scene", "studio.json"],
    ]);
    expect(outside[0]?.snippet).toContain("third");

    const videoWide = check(
      `const stage = useStudioObject('third');\n${film('name="Intro" durationInFrames={30}', 'name="Outro" durationInFrames={30}')}`,
      sceneDocument(["Intro", "Outro"], { first: "scene-0", second: "scene-0" })
    );

    expect(videoWide).toEqual([]);
  });

  it("counts a nested object as in its scene", () => {
    expect(
      check(
        film(
          'name="Intro" durationInFrames={30}',
          'name="Outro" durationInFrames={30}'
        ),
        sceneDocument(["Intro", "Outro"], {
          first: "scene-0",
          second: "first",
          third: "second",
        })
      )
    ).toEqual([]);
  });

  it("reports only the missing names on a video written before scenes", () => {
    const findings = check(
      film("durationInFrames={30}", "durationInFrames={30}"),
      JSON.stringify(documentFixture)
    );

    expect(findings.map((finding) => finding.rule)).toEqual([
      "unnamed-scene",
      "unnamed-scene",
    ]);
  });

  it("reads TransitionSeries and a braced literal, and trusts an expression", () => {
    const index = [
      "<TransitionSeries>",
      '  <TransitionSeries.Sequence name={"Intro"} durationInFrames={30}><A /></TransitionSeries.Sequence>',
      "  <TransitionSeries.Sequence name={scene.title} durationInFrames={30}><B /></TransitionSeries.Sequence>",
      "</TransitionSeries>",
    ].join("\n");

    expect(
      check(
        index,
        sceneDocument(["Intro"], {
          first: "scene-0",
          second: "scene-0",
          third: "scene-0",
        })
      )
    ).toEqual([]);
  });

  it("gives each scene rule a code and a severity", () => {
    const findings = tunabilityDesignFindings(
      check(
        film("durationInFrames={30}", 'name="Pricing" durationInFrames={30}'),
        sceneDocument(["Intro"], { first: "scene-0", second: "scene-0" })
      )
    );

    expect(findings.map((finding) => [finding.code, finding.severity])).toEqual(
      [
        ["tunability_unnamed_scene", "error"],
        ["tunability_scene_without_object", "error"],
        ["tunability_object_outside_scene", "warning"],
      ]
    );
  });
});
