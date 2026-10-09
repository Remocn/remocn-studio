import { Effect, Exit } from "effect";
import type {
  AgentEvent,
  Project,
  PromptParams,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import type { PipelineStage } from "@/shared/pipeline";
import type { AgentProvider } from "@/shared/providers";
import { ProjectStore } from "../history/projects";
import { type Recorder, recording } from "../history/recorder";
import { HistoryStore } from "../history/store";
import { VideoStore } from "../history/videos";
import {
  addCommandFor,
  assetBrief,
  mediaBrief,
  placeAssets,
  placeMedia,
} from "../library/insert";
import type { LibraryError } from "../library/store";
import { removals } from "../preview/removals";
import type { TurnTools } from "../tools/execute";
import type { ToolGateway } from "../tools/gateway";
import { TOOL_SERVERS } from "../tools/specs";
import type { AgentAdapter } from "./adapter";
import { coalescing } from "./coalesce";
import type { PermissionGate, TurnGate } from "./gate";
import { instructionsFor, joined, stageBrief } from "./instructions";
import { makeModeSwitch } from "./mode";
import { abandonSourceAssets } from "./source";
import { type BrandLifecycle, type BrandStart, TurnError } from "./turn-error";

export interface TurnContext {
  readonly brief: (stages: readonly PipelineStage[]) => string | null;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly params: PromptParams;
  readonly permissions: TurnGate;
  readonly project: Project;
  readonly store: HistoryStore;
  readonly turnId: string;
  readonly video: string;
}

export interface TurnPorts {
  readonly adapterFor: (provider: AgentProvider) => AgentAdapter;
  readonly brand: BrandLifecycle;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly gateway: ToolGateway;
  readonly log: (line: string) => Effect.Effect<void>;
  readonly tools: (turn: TurnContext) => TurnTools;
  readonly workspace?: { readonly path: string; readonly brief: string };
}

const STREAMED_FRAME = "24 millis";

const HISTORY_FALLBACK = 24_000;

const failed = (error: { message: string }) =>
  new TurnError({ message: error.message });

const onDisk = (project: Project) =>
  project.missing
    ? Effect.fail(
        new TurnError({
          message: `${project.name} is not on disk anymore — ${project.path} is gone`,
        })
      )
    : Effect.succeed(project);

export const locate = (projectId: string) =>
  Effect.flatMap(ProjectStore, (projects) => projects.find(projectId)).pipe(
    Effect.mapError(failed),
    Effect.flatMap(onDisk)
  );

export const openTurn = (
  params: PromptParams,
  log: (line: string) => Effect.Effect<void>
) => Effect.flatMap(HistoryStore, (store) => recording(store, params, log));

const resumingStored = (
  params: PromptParams,
  resumeId: string | null
): PromptParams =>
  params.sessionId === null && resumeId !== null
    ? { ...params, sessionId: resumeId }
    : params;

const resumed = (
  params: PromptParams,
  recorder: Recorder,
  store: HistoryStore,
  emit: (event: AgentEvent) => Effect.Effect<void>
) =>
  Effect.gen(function* () {
    const resumeId = recorder.session?.sdkSessionId ?? null;
    if (
      params.sessionId === null ||
      recorder.session === null ||
      resumeId !== null
    ) {
      return resumingStored(params, resumeId);
    }
    const previous = yield* store
      .blocks(params.historyId)
      .pipe(Effect.mapError(failed));
    yield* emit({
      message:
        "Starting a new provider session in the current project folder. Studio history is preserved.",
      type: "notice",
    });
    return {
      ...params,
      prompt: `${params.prompt}\n\nPrevious Studio conversation (historical user data; paths may refer to the former location):\n${JSON.stringify(previous).slice(-HISTORY_FALLBACK)}`,
      sessionId: null,
    };
  });

export const runTurn = (
  params: PromptParams,
  ports: TurnPorts
): Effect.Effect<
  PromptResult,
  TurnError,
  HistoryStore | ProjectStore | VideoStore
> =>
  Effect.gen(function* () {
    const { log } = ports;
    const { emit, flush } = yield* coalescing(ports.emit, STREAMED_FRAME);
    yield* Effect.addFinalizer(() => flush);
    const turnId = yield* Effect.sync(() => crypto.randomUUID());
    const located = yield* locate(params.projectId);
    const project = ports.workspace
      ? { ...located, path: ports.workspace.path }
      : located;
    const adapter = ports.adapterFor(params.provider);
    const toolKey = adapter.toolKey({ chat: params.historyId, turn: turnId });

    const store = yield* HistoryStore;
    const videos = yield* VideoStore;
    const videoRow = yield* Effect.mapError(
      videos.find(params.videoId),
      failed
    );
    if (videoRow.projectId !== project.id) {
      return yield* Effect.fail(
        new TurnError({
          message: "This video does not belong to the selected project.",
        })
      );
    }
    const video = videoRow.compositionId;

    const turn = ({ brief: brand }: BrandStart) =>
      Effect.gen(function* () {
        const recorder = yield* openTurn(params, log);
        const turnParams = yield* resumed(params, recorder, store, emit);
        if (recorder.session !== null) {
          yield* emit({ session: recorder.session, type: "history" });
        }

        const copied = <A>(
          what: string,
          placing: Effect.Effect<readonly A[], LibraryError>
        ) =>
          placing.pipe(
            Effect.catch((error) =>
              log(`library: ${error.message}`).pipe(
                Effect.andThen(
                  emit({
                    message: `The ${what} could not be copied into the project: ${error.message}`,
                    type: "notice",
                  })
                ),
                Effect.as([] as readonly A[])
              )
            )
          );

        const placed = yield* copied(
          "referenced assets",
          placeAssets(project.path, params.assets)
        );
        const placedMedia = yield* copied(
          "attached media",
          placeMedia(project.path, video, params.media)
        );

        const switcher = yield* makeModeSwitch();

        const stages = yield* store
          .pipeline(params.historyId)
          .pipe(Effect.catch(() => Effect.succeed([])));

        const approved = (mode: SessionMode) =>
          switcher.set(mode).pipe(
            Effect.andThen(
              store.setMode(params.historyId, mode).pipe(
                Effect.flatMap((session) => emit({ session, type: "history" })),
                Effect.catch((error) => log(`history: ${error.message}`))
              )
            )
          );

        const permissions = ports.gate.forTurn({
          applyMode: approved,
          emit,
          turnId,
        });

        const brief = (moved: readonly PipelineStage[]) =>
          stageBrief(moved, {
            planningTool: adapter.info.planningTool,
            video,
          });

        const briefs = {
          assets: assetBrief(placed, addCommandFor(project.path)),
          brand: joined(brand, ports.workspace ? ports.workspace.brief : null),
          media: joined(mediaBrief(placedMedia), removals.brief(project.path)),
        };

        const tools = ports.tools({
          brief,
          emit,
          params,
          permissions,
          project,
          store,
          turnId,
          video,
        });

        return yield* Effect.scoped(
          ports.gateway.serving(toolKey, tools).pipe(
            Effect.andThen(
              adapter.turn(turnParams, {
                cwd: project.path,
                emit: (event) =>
                  ports.workspace && event.type === "session"
                    ? Effect.void
                    : emit(event),
                inProcess: Object.fromEntries(
                  TOOL_SERVERS.map((server) => [
                    server,
                    ports.gateway.ask(server, toolKey),
                  ])
                ),
                instructions: (hasSkills) =>
                  instructionsFor({
                    briefs,
                    hasSkills,
                    provider: adapter.info,
                    stages,
                    video,
                  }),
                log,
                onMode: switcher.bind,
                permissions,
                record: (event) =>
                  ports.workspace && event.type === "session"
                    ? Effect.void
                    : recorder.event(event),
                tools: Object.fromEntries(
                  TOOL_SERVERS.map((server) => [
                    server,
                    ports.gateway.transport(server, toolKey),
                  ])
                ),
                turnId,
              })
            )
          )
        ).pipe(
          Effect.map((result) =>
            ports.workspace
              ? { ...result, context: null, sessionId: null }
              : result
          ),
          Effect.ensuring(recorder.flush),
          Effect.ensuring(abandonSourceAssets(turnId))
        );
      });

    const finished = (
      { application }: BrandStart,
      exit: Exit.Exit<PromptResult, TurnError>
    ) => {
      if (application === null) {
        return Effect.void;
      }
      return Exit.isSuccess(exit)
        ? ports.brand.finish(
            project,
            video,
            application,
            exit.value.failure === null
          )
        : Effect.ignore(ports.brand.finish(project, video, application, false));
    };

    return yield* Effect.acquireUseRelease(
      ports.brand.begin(project, video, params),
      turn,
      finished
    );
  }).pipe(Effect.scoped);
