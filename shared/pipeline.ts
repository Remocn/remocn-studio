import { Schema } from "effect";

export const PIPELINE_STAGE_IDS = [
  "analysis",
  "brand",
  "script",
  "motion",
  "build",
  "review",
] as const;

export const PipelineStageId = Schema.Literals(PIPELINE_STAGE_IDS);

export type PipelineStageId = (typeof PipelineStageId)["Type"];

export const PIPELINE_STATUSES = ["pending", "active", "done"] as const;

export const PipelineStatus = Schema.Literals(PIPELINE_STATUSES);

export type PipelineStatus = (typeof PipelineStatus)["Type"];

export const PipelineStage = Schema.Struct({
  stage: PipelineStageId,
  status: PipelineStatus,
});

export type PipelineStage = (typeof PipelineStage)["Type"];

export interface StageTemplate {
  readonly activeForm: string;
  readonly ask: string;
  readonly discover: string;
  readonly doneWhen: string;
  readonly goal: string;
  readonly id: PipelineStageId;
  readonly outputs: readonly string[];
  readonly title: string;
}

export const STAGE_TEMPLATES: readonly StageTemplate[] = [
  {
    activeForm: "Analysing the material",
    ask: "Ask for the topic, the audience, the target duration, and any material to build from. Ask concrete questions, one message.",
    discover:
      "Check video/analysis.md. If it is missing, look at what the folder already holds: source material, a README, existing scenes — anything that says what this video is about.",
    doneWhen:
      "video/analysis.md names the topic, the goal, the target duration and every source it draws on.",
    goal: "Work out what is given: the material, the topic, the audience and the target duration.",
    id: "analysis",
    outputs: ["video/analysis.md"],
    title: "Analysis",
  },
  {
    activeForm: "Collecting the brand",
    ask: "Ask for the brand: its name, a site or brand book to read, two or three key colors, and the tone the video should carry. Never invent a brand.",
    discover:
      "Check video/brand.md. If it is missing, look for the brand in the project itself: logos, css tokens, a README, a site it mentions.",
    doneWhen:
      "video/brand.md names concrete colors, fonts and tone, and every asset it needs sits in video/assets/.",
    goal: "Collect the visual language: palette, fonts, logos and tone.",
    id: "brand",
    outputs: ["video/brand.md", "video/assets/"],
    title: "Brand",
  },
  {
    activeForm: "Writing the script",
    ask: "Ask what the video should say if analysis left it open: the story, the order, what each scene shows.",
    discover:
      "Check video/script.md. If it is missing, read video/analysis.md and any draft the person left in the folder, then write from those.",
    doneWhen:
      "Every scene in video/script.md has its text, its visual and its duration in seconds, and the durations add up to the target.",
    goal: "Write the script scene by scene: what is said, what is on screen, and for how long.",
    id: "script",
    outputs: ["video/script.md"],
    title: "Script",
  },
  {
    activeForm: "Defining the motion language",
    ask: "Propose a motion language yourself and ask the person to confirm it — pace, entrances, transitions — rather than asking them to design it.",
    discover:
      "Check video/motion.md. If it is missing, look at animations already in the project whose style this video should continue.",
    doneWhen:
      "video/motion.md names a device for every kind of element the script uses, and a transition between every pair of scenes.",
    goal: "Define the motion language: entrance and exit devices, easing, pace, and the transitions between scenes.",
    id: "motion",
    outputs: ["video/motion.md"],
    title: "Motion",
  },
  {
    activeForm: "Building the video",
    ask: "Ask only when the script or the motion language leaves a scene ambiguous — name the scene and the ambiguity.",
    discover:
      "Read video/script.md and video/motion.md, then check what of the video already exists in src/.",
    doneWhen:
      "The preview compiles, every scene the script names is present, and the total duration matches the script.",
    goal: "Build the video: every scene inside Main via Series or TransitionSeries, exactly as the script and the motion language say.",
    id: "build",
    outputs: ["src/"],
    title: "Build",
  },
  {
    activeForm: "Reviewing the result",
    ask: "Ask the person to watch the preview and tell you what reads wrong; record each note in video/review.md.",
    discover:
      "Check video/review.md for notes already taken, and compare the built video against video/script.md scene by scene.",
    doneWhen:
      "Every note in video/review.md is closed or explicitly deferred by the person.",
    goal: "Review the result against the script, collect notes, and close them.",
    id: "review",
    outputs: ["video/review.md"],
    title: "Review",
  },
];

export function stageTemplate(id: PipelineStageId): StageTemplate {
  const found = STAGE_TEMPLATES.find((template) => template.id === id);
  if (found === undefined) {
    throw new Error(`there is no pipeline stage called ${id}`);
  }
  return found;
}

export function startedStages(): readonly PipelineStage[] {
  return PIPELINE_STAGE_IDS.map((stage, index) => ({
    stage,
    status: index === 0 ? "active" : "pending",
  }));
}

export function orderedStages(
  rows: readonly PipelineStage[]
): readonly PipelineStage[] {
  const byId = new Map(rows.map((row) => [row.stage, row]));
  return PIPELINE_STAGE_IDS.flatMap((stage) => byId.get(stage) ?? []);
}

export function activeStage(
  stages: readonly PipelineStage[]
): PipelineStage | null {
  return stages.find((row) => row.status === "active") ?? null;
}

export function pipelineDone(stages: readonly PipelineStage[]): boolean {
  return stages.length > 0 && stages.every((row) => row.status === "done");
}
