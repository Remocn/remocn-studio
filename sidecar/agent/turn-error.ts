import { Data, type Effect } from "effect";
import type { ProjectBrandApplication } from "@/shared/brand";
import type { Project, PromptParams } from "@/shared/ipc";

export class TurnError extends Data.TaggedError("TurnError")<{
  message: string;
}> {}

export interface BrandStart {
  readonly application: ProjectBrandApplication | null;
  readonly brief: string | null;
}

export interface BrandLifecycle {
  readonly begin: (
    project: Project,
    video: string,
    params: PromptParams
  ) => Effect.Effect<BrandStart, TurnError>;
  readonly finish: (
    project: Project,
    video: string,
    application: ProjectBrandApplication,
    success: boolean
  ) => Effect.Effect<void, TurnError>;
}
