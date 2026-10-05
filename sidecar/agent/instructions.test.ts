import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
  ELEMENT_ROLES,
  MOTION_DICTIONARY,
  MOTION_ROLES,
} from "@/shared/motion";
import {
  PIPELINE_STAGE_IDS,
  type PipelineStage,
  stageTemplate,
} from "@/shared/pipeline";
import { AGENT_PROVIDERS, PROVIDER_INFO } from "@/shared/providers";
import {
  conventionsFor,
  instructionsFor,
  STUDIO_CONVENTIONS,
  stageBrief,
} from "@/sidecar/agent/instructions";
import {
  BUNDLE_NAME,
  INTERACTIVITY_SKILL,
  LESSONS_SKILL,
  MOTION_SKILL,
  SHIPPED,
} from "@/sidecar/agent/knowledge";

const pipelineBrief = (
  stages: readonly PipelineStage[],
  video: string | null = null
) => stageBrief(stages, { planningTool: "TaskCreate", video });

const NAMED = `\`${LESSONS_SKILL}\``;
const MARKUP = `\`${INTERACTIVITY_SKILL}\``;
const MOTION = `\`${MOTION_SKILL}\``;

describe("conventionsFor structure", () => {
  it("keeps the structure: the lane, Root.tsx, the audiomap, editability", () => {
    const text = conventionsFor(false);
    const compact = text.replaceAll("\n", " ");

    expect(compact).toContain("working on exactly one of them");
    expect(text).toContain("never edit `Root.tsx`");
    expect(text).toContain("beat_cut");
    expect(text).toContain("Keep the result editable");
    expect(text).toContain("[Element #N]");
  });

  it("embeds footage with @remotion/media on every turn, whether or not skills loaded", () => {
    for (const hasSkills of [true, false]) {
      const compact = conventionsFor(hasSkills).replaceAll("\n", " ");

      expect(compact).toContain(
        "Embed footage with `<Video>` from `@remotion/media`, not `OffthreadVideo`."
      );
      expect(compact).toContain(
        "add it with the project's own package manager, pinned to the version of its `remotion`"
      );
      expect(compact).toContain(
        "Leave an existing `OffthreadVideo` alone unless the person asks or the design check reports `footage_late_frames`"
      );
      expect(compact).toContain("never rewrite the person's file");
      expect(compact).toContain(
        "keep `OffthreadVideo` rather than upgrading unasked"
      );
    }
  });

  it("asks for every scene to be named and described by a scene object", () => {
    const compact = conventionsFor(false).replaceAll("\n", " ");

    expect(compact).toContain("carries a short human `name`");
    expect(compact).toContain('definition id "scene"');
    expect(compact).toContain("label exactly the sequence's name");
    expect(compact).toContain(
      "Set every other object's parentId to its scene's object"
    );
  });
});

describe("conventionsFor", () => {
  it("orders the lessons skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(NAMED);
  });

  it("names the bundle and every skill in it, so any runtime's catalog matches", () => {
    const text = conventionsFor(true);

    expect(text).toContain(`\`${BUNDLE_NAME}\``);
    for (const skill of SHIPPED) {
      expect(text).toContain(skill);
    }
  });

  it("orders a skill in words no single runtime owns", () => {
    const text = conventionsFor(true);

    expect(text).not.toContain(`${BUNDLE_NAME}:${LESSONS_SKILL}`);
    expect(text).not.toContain(`${BUNDLE_NAME}:${MOTION_SKILL}`);
    expect(text).not.toContain(`${BUNDLE_NAME}:${INTERACTIVITY_SKILL}`);
  });

  it("orders the interactivity skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(MARKUP);
  });

  it("orders the motion-design skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(MOTION);
  });

  it("never orders a skill that is not loaded", () => {
    const alone = conventionsFor(false);

    expect(alone).toBe(STUDIO_CONVENTIONS);
    expect(alone).not.toContain(NAMED);
    expect(alone).not.toContain(LESSONS_SKILL);
    expect(alone).not.toContain(MARKUP);
    expect(alone).not.toContain(MOTION);
    expect(alone).not.toContain(MOTION_SKILL);
    expect(alone).not.toContain(BUNDLE_NAME);
  });

  it("keeps the app's own conventions either way", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text.replaceAll("\n", " ")).toContain(
        "working on exactly one of them"
      );
      expect(text).toContain("never edit `Root.tsx`");
      expect(text).toContain("[Element #N]");
      expect(text).toContain("mcp__remocn-design__design_check");
      expect(text).toContain("fix every mechanical finding");
    }
  });

  it("names the video the turn is about, and only when it knows it", () => {
    const named = conventionsFor(false, "opening-title");

    expect(named).toContain("`src/videos/opening-title/`");
    expect(conventionsFor(false)).not.toContain("Your video for this");
  });

  it("requires a parameter schema with or without the plugin", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text).toContain("Zod schema");
      expect(text).toContain("zColor()");
      expect(text).toContain("InteractivitySchema");
      expect(text).toContain("unless the person asks");
    }
  });

  // The interpolation editor only ever renders what a schema declares, so the
  // mandate is what makes the easing pane exist at all in agent-written code.
  it("makes the interactivity schema unconditional, not a thing to ask for", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("Every nested scene, element and transition");
      expect(compact).toContain("a file exports only the wrapped component");
    }
  });

  it("makes a tunable easing part of every animated component", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("exposes its easing");
      expect(compact).toContain("always, not only when asked");
      expect(compact).toContain("ending in `Easing`");
      expect(compact).toContain("always a four-number cubic-bezier array");
      expect(compact).toContain("Never an enum of easing names");
      expect(compact).toContain("Easing.bezier(...easing)");
      expect(compact).toContain("newItemDefault: 0");
      expect(compact).toContain("only where it is sampled");
      expect(compact).toContain("is not an easing");
    }
  });

  // The pane finds a spring by the shape of its paths, so the names in the
  // conventions and the names `springsIn` groups on are one decision.
  it("names the three numbers a spring is made of", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("`spring.damping`, `spring.stiffness` and");
      expect(compact).toContain("`spring.mass`");
      expect(compact).toContain("one group per spring");
      expect(compact).toContain("`entry.spring.damping`");
    }
  });

  it("sends a requested change to the component the block says owns it", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain(
        "grouped by the component that owns each one, with its file and line"
      );
      expect(compact).toContain("not the element the token names");
    }
  });

  it("asks for one named text element per run of text", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("whose direct child is the string");
      expect(compact).toContain("unique in the frame");
      expect(compact).toContain("text-content");
    }
  });
});

describe("the movement taxonomy", () => {
  it("reaches a turn whether or not the bundled skills loaded", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      for (const role of MOTION_ROLES) {
        expect(text).toContain(`\`${role}\``);
      }
    }
  });

  it("spells out the dictionary, so the words are the same on both sides", () => {
    const text = STUDIO_CONVENTIONS;

    for (const role of ELEMENT_ROLES) {
      for (const name of MOTION_DICTIONARY[role]) {
        expect(text).toContain(name);
      }
    }
  });

  it("says which props a movement role expects", () => {
    expect(STUDIO_CONVENTIONS).toContain("durationInFrames, delay, stagger");
    expect(STUDIO_CONVENTIONS).toContain("beat_cut");
    expect(STUDIO_CONVENTIONS).toContain("phrase_flow");
    expect(STUDIO_CONVENTIONS).toContain("intensity, repeat, delay");
  });

  it("sends an invented behaviour to the library with its role", () => {
    expect(STUDIO_CONVENTIONS).toContain("mcp__remocn-library__save_asset");
  });

  it("leaves the recipes to the skill that carries them", () => {
    expect(conventionsFor(true)).toContain("the movement dictionary");
    expect(conventionsFor(false)).not.toContain("the movement dictionary");
  });
});

// The literal `video/` these templates used to carry meant a project's second
// video overwrote the first one's script. The brief is the only place the
// agent learns where to write, so the slug has to reach it.
describe("the pipeline brief's document paths", () => {
  it("names the video's own docs folder, per video", () => {
    const brief = pipelineBrief(
      [{ stage: "script", status: "active" }],
      "opening-title"
    );

    expect(brief).toContain("src/videos/opening-title/docs/script.md");
    expect(brief).not.toContain("video/script.md");
  });

  it("substitutes every stage, not only the one that names an output", () => {
    for (const stage of PIPELINE_STAGE_IDS) {
      const brief =
        pipelineBrief([{ stage, status: "active" }], "opening-title") ?? "";

      expect(brief).not.toContain("{docs}");
      expect(brief).not.toContain("{video}");
    }
  });

  it("sends the brand stage's identity assets into the video's folder", () => {
    const brief = pipelineBrief(
      [{ stage: "brand", status: "active" }],
      "opening-title"
    );

    expect(brief).toContain("src/videos/opening-title/assets/");
  });

  // A row we could not read costs the slug and nothing else: the brief still
  // says what the stage is for.
  it("still reads as a folder when the turn could not name its video", () => {
    const brief = pipelineBrief([{ stage: "script", status: "active" }]);

    expect(brief).toContain("src/videos/");
    expect(brief).toContain("/docs/script.md");
    expect(brief).not.toContain("{docs}");
  });
});

describe("a pointed edit mid-pipeline", () => {
  it("tells every stage that one specific change ends the turn without moving the stage", () => {
    for (const stage of PIPELINE_STAGE_IDS) {
      const brief = (
        pipelineBrief([{ stage, status: "active" }], "intro") ?? ""
      ).replaceAll("\n", " ");

      expect(brief).toContain("`[Element #N]`");
      expect(brief).toContain(
        "is not stage work: make that change, check the range it affects, and end the turn, leaving the stage where it is."
      );
    }
  });

  it("keeps the push to the end of the pipeline for stage work only", () => {
    const brief = (pipelineBrief(ANALYSIS, "intro") ?? "").replaceAll(
      "\n",
      " "
    );
    const pointed = brief.indexOf("is not stage work");
    const onward = brief.indexOf("When the turn is stage work, do not wait");

    expect(pointed).toBeGreaterThan(-1);
    expect(onward).toBeGreaterThan(pointed);
    expect(brief).toContain(
      "keep going in the same turn until the whole pipeline is done"
    );
  });
});

describe("the choreography stage", () => {
  const brief = pipelineBrief([{ stage: "choreography", status: "active" }]);

  it("stands between building and reviewing, because it is a property of the whole", () => {
    expect([...PIPELINE_STAGE_IDS]).toEqual([
      "analysis",
      "brand",
      "script",
      "motion",
      "build",
      "choreography",
      "review",
    ]);
  });

  it("says the pipeline has seven stages and names the new one", () => {
    expect(STUDIO_CONVENTIONS).toContain("seven-stage");
    expect(STUDIO_CONVENTIONS).toContain(
      "analysis, brand, script, motion, build, choreography, review"
    );
  });

  it("hands the agent the whole checklist, in order", () => {
    const checklist = stageTemplate("choreography").checklist ?? [];

    expect(checklist).toHaveLength(5);
    for (const item of checklist) {
      expect(brief).toContain(`- ${item}`);
    }
  });

  it("sends the agent to measure the whole video rather than read the code", () => {
    expect(brief).toContain("mcp__remocn-design__design_check");
    expect(brief).toContain("scene map");
  });

  it("puts the checklist only on the stage that has one", () => {
    for (const stage of PIPELINE_STAGE_IDS) {
      const text = pipelineBrief([{ stage, status: "active" }]) ?? "";
      const hasChecklist = text.includes("Work this stage's checklist");

      expect(hasChecklist).toBe(stageTemplate(stage).checklist !== undefined);
    }
  });
});

describe("draft-first production instructions", () => {
  it("delivers reuse, a complete draft and local correction in the active briefs", () => {
    const motion = pipelineBrief(
      [{ stage: "motion", status: "active" }],
      "intro"
    );
    const build =
      pipelineBrief([{ stage: "build", status: "active" }], "intro") ?? "";

    expect(motion).toContain("mcp__remocn-library__list_assets");
    expect(motion).toContain("shot-to-component map");
    expect(motion).toContain(
      "Stop searching when each shot has a suitable implementation"
    );
    const draft = build.indexOf("Complete draft.");
    const inspect = build.indexOf("Inspect the draft.");
    const correct = build.indexOf("Local corrections.");
    expect(draft).toBeGreaterThanOrEqual(0);
    expect(inspect).toBeGreaterThan(draft);
    expect(correct).toBeGreaterThan(inspect);
    expect(build).toContain("src/videos/intro/assets/keyframes/");
    expect(build).toContain("src/videos/intro/assets/proof/");
    expect(build).toContain("dependent neighbors");
  });

  it("keeps iteration sampled while preserving the full review gate", () => {
    for (const stage of ["build", "choreography"] as const) {
      expect(pipelineBrief([{ stage, status: "active" }])).toContain(
        "mode=sampled"
      );
    }
    const review = pipelineBrief([{ stage: "review", status: "active" }]);
    expect(review).toContain("mode=full");
    expect(review).toContain("reviewReportId");
    expect(review).toContain(
      "changed sources or settings require a new full check"
    );
  });

  it("preserves draft-first order with or without bundled skills", () => {
    for (const hasSkills of [true, false]) {
      const text = conventionsFor(hasSkills).replaceAll("\n", " ");
      expect(text).toContain("reuse components, assemble the complete draft");
      expect(text).toContain(
        "For a pointed edit, reuse the existing component map"
      );
      expect(text).not.toContain("Before expanding a new film");
    }
  });
});

it("gives managed videos precedence over legacy Interactive authoring rules", () => {
  const text = conventionsFor(true, "intro");
  expect(text).toContain("studio-objects-v5/README.md");
  expect(text).toContain("useStudioObject(stableId)");
  expect(text).toContain("takes precedence over the legacy Interactive");
});

it("teaches the v6 provider and what a removed object means", () => {
  const text = conventionsFor(true, "intro");
  expect(text).toContain("src/lib/studio-objects-v6/README.md");
  expect(text).toContain(
    "Import the provider and hook from src/lib/studio-objects-v6"
  );
  expect(text).toContain('"removed": true');
  expect(text).toContain(
    "Never render it back, clear the flag or reuse its ID"
  );
});

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

const ANALYSIS: readonly PipelineStage[] = [
  { stage: "analysis", status: "active" },
];

const CHOREOGRAPHY: readonly PipelineStage[] = [
  { stage: "analysis", status: "done" },
  { stage: "brand", status: "done" },
  { stage: "script", status: "done" },
  { stage: "motion", status: "done" },
  { stage: "build", status: "done" },
  { stage: "choreography", status: "active" },
  { stage: "review", status: "pending" },
];

const NO_BRIEFS = { assets: null, brand: null, media: null };

describe("the words, as they were before the move", () => {
  it("keeps the conventions with the skills byte for byte", () => {
    const text = conventionsFor(true, "intro");

    expect(text).toHaveLength(20_583);
    expect(sha256(text)).toBe(
      "402c8c9eb3060e39121d7cc523fb8bc69b72e4eb2477abf33399905e5ce70cc4"
    );
  });

  it("keeps the conventions alone byte for byte", () => {
    const text = conventionsFor(false, null);

    expect(text).toHaveLength(18_600);
    expect(sha256(text)).toBe(
      "03b8db94e3df0b7c570b950ebce1dbc7255c9f520d7456ef2b8bc76845da6c35"
    );
  });

  it("keeps Claude's analysis brief byte for byte", () => {
    const text = stageBrief(ANALYSIS, {
      planningTool: PROVIDER_INFO.claude.planningTool,
      video: "intro",
    });

    expect(text).toHaveLength(2432);
    expect(sha256(text ?? "")).toBe(
      "49c4d740397bd417e4d944057e1295d67c7de7148d3541832932df3029ada3eb"
    );
  });

  it("keeps Claude's brief for a later stage byte for byte", () => {
    const text = stageBrief(CHOREOGRAPHY, {
      planningTool: PROVIDER_INFO.claude.planningTool,
      video: "intro",
    });

    expect(text).toHaveLength(4673);
    expect(sha256(text ?? "")).toBe(
      "caef524e048e00bf5c3ff1f97fc379b587714f28ec2a2d9cd5722a4789fd12b7"
    );
  });

  it("keeps the stage brief out of Claude's system text, so a stage moving leaves it alone", () => {
    const staged = instructionsFor({
      briefs: NO_BRIEFS,
      hasSkills: true,
      provider: PROVIDER_INFO.claude,
      stages: ANALYSIS,
      video: "intro",
    });
    const unstaged = instructionsFor({
      briefs: NO_BRIEFS,
      hasSkills: true,
      provider: PROVIDER_INFO.claude,
      stages: [],
      video: "intro",
    });

    expect(staged.system).toBe(conventionsFor(true, "intro"));
    expect(staged.system).toBe(unstaged.system);
    expect(staged.trailer).toBe(
      stageBrief(ANALYSIS, {
        planningTool: PROVIDER_INFO.claude.planningTool,
        video: "intro",
      })
    );
  });
});

const PLANNED = {
  claude: "create your task list with TaskCreate from what you find:",
  codex: "create your task list with update_plan from what you find:",
  copilot:
    "lay out your steps from what you find, in your own planning tool if you have one:",
  grok: "create your task list with todo_write from what you find:",
} as const;

describe("instructionsFor, across the providers", () => {
  it("words the planning step for the plan tool each runtime has", () => {
    for (const provider of AGENT_PROVIDERS) {
      const { trailer } = instructionsFor({
        briefs: NO_BRIEFS,
        hasSkills: true,
        provider: PROVIDER_INFO[provider],
        stages: ANALYSIS,
        video: "intro",
      });

      expect((trailer ?? "").replaceAll("\n", " ")).toContain(
        PLANNED[provider]
      );
    }
  });

  it("never names TaskCreate to a runtime that does not have it", () => {
    for (const provider of AGENT_PROVIDERS.filter((id) => id !== "claude")) {
      for (const stage of PIPELINE_STAGE_IDS) {
        const { system, trailer } = instructionsFor({
          briefs: NO_BRIEFS,
          hasSkills: true,
          provider: PROVIDER_INFO[provider],
          stages: [{ stage, status: "active" }],
          video: "intro",
        });

        expect(system).not.toContain("TaskCreate");
        expect(trailer).not.toContain("TaskCreate");
      }
    }
  });

  it("names no tool at all for a runtime whose plan tool is not known", () => {
    const brief =
      stageBrief(ANALYSIS, { planningTool: null, video: "intro" }) ?? "";
    const step = brief
      .replaceAll("\n", " ")
      .split("in this order, and ")[1]
      ?.split(":")[0];

    expect(step).toBe(
      "lay out your steps from what you find, in your own planning tool if you have one"
    );
  });

  it("names the video's own docs folder in every stage, for every provider", () => {
    for (const provider of AGENT_PROVIDERS) {
      for (const stage of PIPELINE_STAGE_IDS) {
        const { trailer } = instructionsFor({
          briefs: NO_BRIEFS,
          hasSkills: false,
          provider: PROVIDER_INFO[provider],
          stages: [{ stage, status: "active" }],
          video: "opening-title",
        });

        expect(trailer).toContain("src/videos/opening-title/docs/");
      }
    }
  });

  it("carries the conventions alone when no stage is active", () => {
    const { system } = instructionsFor({
      briefs: NO_BRIEFS,
      hasSkills: false,
      provider: PROVIDER_INFO.codex,
      stages: [],
      video: "intro",
    });

    expect(system).toBe(conventionsFor(false, "intro"));
  });

  it("joins the assets and the brand into the trailer, and passes the media through", () => {
    const both = instructionsFor({
      briefs: { assets: "ASSETS", brand: "BRAND", media: "MEDIA" },
      hasSkills: false,
      provider: PROVIDER_INFO.grok,
      stages: [],
      video: null,
    });
    const brand = instructionsFor({
      briefs: { assets: null, brand: "BRAND", media: null },
      hasSkills: false,
      provider: PROVIDER_INFO.grok,
      stages: [],
      video: null,
    });

    expect(both.trailer).toBe("ASSETS\n\nBRAND");
    expect(both.media).toBe("MEDIA");
    expect(brand.trailer).toBe("BRAND");
    expect(brand.media).toBeNull();
  });

  it("puts the stage brief last in the trailer, after the assets and the brand", () => {
    const brief = stageBrief(ANALYSIS, {
      planningTool: PROVIDER_INFO.codex.planningTool,
      video: "intro",
    });
    const all = instructionsFor({
      briefs: { assets: "ASSETS", brand: "BRAND", media: null },
      hasSkills: false,
      provider: PROVIDER_INFO.codex,
      stages: ANALYSIS,
      video: "intro",
    });
    const alone = instructionsFor({
      briefs: NO_BRIEFS,
      hasSkills: false,
      provider: PROVIDER_INFO.codex,
      stages: ANALYSIS,
      video: "intro",
    });

    expect(all.trailer).toBe(`ASSETS\n\nBRAND\n\n${brief}`);
    expect(alone.trailer).toBe(brief);
  });

  it("has no trailer when there are neither assets nor a brand", () => {
    const { trailer } = instructionsFor({
      briefs: NO_BRIEFS,
      hasSkills: false,
      provider: PROVIDER_INFO.copilot,
      stages: [],
      video: null,
    });

    expect(trailer).toBeNull();
  });
});
