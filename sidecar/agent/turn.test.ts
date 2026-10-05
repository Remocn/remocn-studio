import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import type { ProjectBrandApplication } from "@/shared/brand";
import type {
  AgentEvent,
  Project,
  PromptParams,
  PromptResult,
  SourceAssetResolution,
} from "@/shared/ipc";
import { PROVIDER_INFO, type ProviderInfo } from "@/shared/providers";
import type { AgentAdapter, TurnServices } from "@/sidecar/agent/adapter";
import {
  makeGate,
  type PermissionGate,
  type TurnBinding,
} from "@/sidecar/agent/gate";
import { conventionsFor, stageBrief } from "@/sidecar/agent/instructions";
import { requestSourceAsset } from "@/sidecar/agent/source";
import {
  openTurn,
  runTurn,
  type TurnContext,
  type TurnPorts,
} from "@/sidecar/agent/turn";
import {
  type BrandLifecycle,
  type BrandStart,
  TurnError,
} from "@/sidecar/agent/turn-error";
import { migrate, prepare } from "@/sidecar/history/migrations";
import { make as makeProjects, ProjectStore } from "@/sidecar/history/projects";
import { driverFor } from "@/sidecar/history/sqlite";
import {
  HistoryError,
  HistoryStore,
  make as makeHistory,
} from "@/sidecar/history/store";
import { make as makeVideos, VideoStore } from "@/sidecar/history/videos";
import type { TurnTools } from "@/sidecar/tools/execute";
import type { ToolGateway } from "@/sidecar/tools/gateway";
import { TOOL_SERVERS } from "@/sidecar/tools/specs";

const DONE: PromptResult = { context: null, failure: null, sessionId: "sdk-1" };

const FAILED: PromptResult = {
  context: null,
  failure: { kind: "unknown", message: "The turn failed." },
  sessionId: null,
};

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { force: true, recursive: true }))
  );
});

async function studio() {
  const driver = driverFor(":memory:");
  prepare(driver);
  migrate(driver);

  const projects = makeProjects(driver);
  const videos = makeVideos(driver);
  const history = makeHistory(driver);

  const folder = await mkdtemp(join(tmpdir(), "remocn-turn-"));
  const elsewhere = await mkdtemp(join(tmpdir(), "remocn-turn-"));
  folders.push(folder, elsewhere);

  const project = await Effect.runPromise(projects.open(folder));
  const other = await Effect.runPromise(projects.open(elsewhere));
  const video = await Effect.runPromise(
    videos.create({
      compositionId: "promo",
      name: "Promo",
      projectId: project.id,
    })
  );
  const foreign = await Effect.runPromise(
    videos.create({
      compositionId: "intro",
      name: "Intro",
      projectId: other.id,
    })
  );

  return { foreign, history, project, projects, video, videos };
}

type Studio = Awaited<ReturnType<typeof studio>>;

function paramsFor(
  { project, video }: Studio,
  overrides: Partial<PromptParams> = {}
): PromptParams {
  return {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    historyId: crypto.randomUUID(),
    media: [],
    mode: "auto",
    model: null,
    playing: null,
    projectId: project.id,
    prompt: "Make the title bigger",
    provider: "claude",
    sessionId: null,
    videoId: video.id,
    ...overrides,
  };
}

interface Captured {
  readonly params: PromptParams;
  readonly services: TurnServices;
}

function fakeAdapter(
  answer: Effect.Effect<PromptResult>,
  {
    byChat = false,
    info = PROVIDER_INFO.claude,
  }: { byChat?: boolean; info?: ProviderInfo } = {}
) {
  const turns: Captured[] = [];
  const adapter: AgentAdapter = {
    account: () => Effect.die("unused"),
    forget: () => Effect.void,
    info,
    toolKey: ({ chat, turn }) => (byChat ? `chat-${chat}` : turn),
    turn: (params, services) =>
      Effect.suspend(() => {
        turns.push({ params, services });
        return answer;
      }),
  };
  return { adapter, turns };
}

function fakeGateway() {
  const keys = {
    asked: [] as string[],
    served: [] as string[],
    spawned: [] as string[],
  };
  const served: TurnTools[] = [];
  const gateway: ToolGateway = {
    ask: (_server, key) => {
      keys.asked.push(key);
      return () => Promise.resolve({ isError: false, text: "" });
    },
    serving: (key, tools) =>
      Effect.sync(() => {
        keys.served.push(key);
        served.push(tools);
      }),
    transport: (_server, key) => {
      keys.spawned.push(key);
      return { args: [], command: "tools", env: {} };
    },
  };
  return { gateway, keys, served };
}

function fakeBrand(
  application: ProjectBrandApplication | null,
  {
    begin = Effect.succeed({ application, brief: "BRAND BRIEF" }),
    unfinished = null,
  }: {
    begin?: Effect.Effect<BrandStart, TurnError>;
    unfinished?: string | null;
  } = {}
) {
  const finished: boolean[] = [];
  const brand: BrandLifecycle = {
    begin: () => begin,
    finish: (_project, _video, _application, success) =>
      Effect.sync(() => {
        finished.push(success);
      }).pipe(
        Effect.andThen(
          unfinished === null
            ? Effect.void
            : Effect.fail(new TurnError({ message: unfinished }))
        )
      ),
  };
  return { brand, finished };
}

function bindingGate() {
  const real = makeGate();
  const bindings: TurnBinding[] = [];
  const gate: PermissionGate = {
    ...real,
    forTurn: (binding) => {
      bindings.push(binding);
      return real.forTurn(binding);
    },
  };
  return { bindings, gate };
}

function applicationFor(project: Project): ProjectBrandApplication {
  return {
    previous: null,
    status: "running",
    target: {
      brand: null,
      exceptions: "",
      hash: "a".repeat(64),
      projectId: project.id,
      revision: 1,
      schemaVersion: 1,
    },
  };
}

function openSession(setup: Studio, params: PromptParams) {
  return Effect.runPromise(
    setup.history.open({
      id: params.historyId,
      mode: params.mode,
      projectId: setup.project.id,
      provider: params.provider,
      title: "Promo",
      videoId: setup.video.id,
    })
  );
}

function cleanupAdapter(ending: Effect.Effect<PromptResult>) {
  const reached = Deferred.makeUnsafe<void>();
  const requests: Fiber.Fiber<SourceAssetResolution>[] = [];
  const adapter: AgentAdapter = {
    account: () => Effect.die("unused"),
    forget: () => Effect.void,
    info: PROVIDER_INFO.claude,
    toolKey: ({ turn }) => turn,
    turn: (_params, services) =>
      Effect.gen(function* () {
        yield* services.record({ text: "Working on it", type: "text" });
        const registered = yield* Deferred.make<void>();
        const request = yield* Effect.forkDetach(
          requestSourceAsset(
            {
              attempt: "first",
              name: "logo",
              projectId: "project",
              projectPath: services.cwd,
              source: "https://example.com/logo.png",
              turnId: services.turnId,
            },
            () => Effect.asVoid(Deferred.succeed(registered, undefined))
          )
        );
        requests.push(request);
        yield* Deferred.await(registered);
        yield* Deferred.succeed(reached, undefined);
        return yield* ending;
      }),
  };
  return { adapter, reached, requests };
}

async function expectCleanedUp(
  setup: Studio,
  params: PromptParams,
  requests: readonly Fiber.Fiber<SourceAssetResolution>[]
) {
  const blocks = await Effect.runPromise(
    setup.history.blocks(params.historyId)
  );
  expect(JSON.stringify(blocks)).toContain("Working on it");
  expect(requests).toHaveLength(1);
  const resolution = await Effect.runPromise(
    Fiber.join(requests[0]).pipe(Effect.timeoutOption("1 second"))
  );
  expect(Option.getOrNull(resolution)?.kind).toBe("cancelled");
}

const STUB_TOOLS = {} as TurnTools;

function harness(
  setup: Studio,
  {
    adapter,
    brand = fakeBrand(null).brand,
    gate = makeGate(),
    history = setup.history,
  }: {
    adapter: AgentAdapter;
    brand?: BrandLifecycle;
    gate?: PermissionGate;
    history?: HistoryStore;
  }
) {
  const events: AgentEvent[] = [];
  const contexts: TurnContext[] = [];
  const { gateway, keys } = fakeGateway();
  const ports: TurnPorts = {
    adapterFor: () => adapter,
    brand,
    emit: (event) =>
      Effect.sync(() => {
        events.push(event);
      }),
    gate,
    gateway,
    log: () => Effect.void,
    tools: (turn) => {
      contexts.push(turn);
      return STUB_TOOLS;
    },
  };

  const run = (params: PromptParams) =>
    runTurn(params, ports).pipe(
      Effect.provideService(HistoryStore, history),
      Effect.provideService(ProjectStore, setup.projects),
      Effect.provideService(VideoStore, setup.videos)
    );

  return { contexts, events, keys, run };
}

describe("runTurn", () => {
  it("hands the adapter its instructions, its turn id and its video", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const { contexts, run } = harness(setup, { adapter });
    const params = paramsFor(setup);
    await Effect.runPromise(
      setup.history.open({
        id: params.historyId,
        mode: params.mode,
        projectId: setup.project.id,
        provider: params.provider,
        title: "Promo",
        videoId: setup.video.id,
      })
    );
    const stages = await Effect.runPromise(
      setup.history.startPipeline(params.historyId)
    );

    const result = await Effect.runPromise(run(params));

    expect(result).toEqual(DONE);
    expect(turns).toHaveLength(1);
    const [{ services }] = turns;
    const brief = stageBrief(stages, {
      planningTool: "TaskCreate",
      video: "promo",
    });
    expect(brief).not.toBeNull();
    expect(services.instructions(true)).toEqual({
      media: null,
      system: `${conventionsFor(true, "promo")}\n\n${brief}`,
      trailer: "BRAND BRIEF",
    });
    expect(services.instructions(false).system).toBe(
      `${conventionsFor(false, "promo")}\n\n${brief}`
    );
    expect(services.cwd).toBe(setup.project.path);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].turnId).toBe(services.turnId);
    expect(contexts[0].video).toBe("promo");
  });

  it("keys the tools by the turn for a one-shot adapter", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const { keys, run } = harness(setup, { adapter });

    await Effect.runPromise(run(paramsFor(setup)));

    const { turnId } = turns[0].services;
    expect(keys.served).toEqual([turnId]);
    expect(keys.asked).toEqual(TOOL_SERVERS.map(() => turnId));
    expect(keys.spawned).toEqual(TOOL_SERVERS.map(() => turnId));
  });

  it("keys the tools by whatever the adapter answers for the chat", async () => {
    const setup = await studio();
    const { adapter } = fakeAdapter(Effect.succeed(DONE), { byChat: true });
    const { keys, run } = harness(setup, { adapter });
    const params = paramsFor(setup);

    await Effect.runPromise(run(params));

    const key = `chat-${params.historyId}`;
    expect(keys.served).toEqual([key]);
    expect(keys.asked).toEqual(TOOL_SERVERS.map(() => key));
    expect(keys.spawned).toEqual(TOOL_SERVERS.map(() => key));
  });

  it("words the planning step and the folders for the picked adapter's runtime", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE), {
      info: { ...PROVIDER_INFO.grok, planningTool: "fake_planner" },
    });
    const { contexts, run } = harness(setup, { adapter });
    const params = paramsFor(setup, { provider: "grok" });
    await openSession(setup, params);
    const stages = await Effect.runPromise(
      setup.history.startPipeline(params.historyId)
    );

    await Effect.runPromise(run(params));

    const { system } = turns[0].services.instructions(true);
    expect(system.replaceAll("\n", " ")).toContain(
      "create your task list with fake_planner from what you find:"
    );
    expect(system).toContain("src/videos/promo/docs/");
    expect(system).not.toContain("TaskCreate");

    const moved = contexts[0].brief(stages) ?? "";
    expect(moved).toBe(
      stageBrief(stages, { planningTool: "fake_planner", video: "promo" }) ??
        "missing"
    );
    expect(moved).toContain("src/videos/promo/docs/");
  });

  it("names no plan tool when the picked runtime declares none", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE), {
      info: PROVIDER_INFO.copilot,
    });
    const { contexts, run } = harness(setup, { adapter });
    const params = paramsFor(setup, { provider: "copilot" });
    await openSession(setup, params);
    const stages = await Effect.runPromise(
      setup.history.startPipeline(params.historyId)
    );

    await Effect.runPromise(run(params));

    const { system } = turns[0].services.instructions(false);
    const moved = contexts[0].brief(stages) ?? "";
    for (const text of [system, moved]) {
      expect(text).not.toContain("create your task list with");
      expect(text.replaceAll("\n", " ")).toContain(
        "lay out your steps from what you find, in your own planning tool if you have one:"
      );
    }
  });

  it("folds the studio history into the prompt when the provider session is gone", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const { events, run } = harness(setup, { adapter });
    const params = paramsFor(setup, { sessionId: "lost-session" });

    await Effect.runPromise(run(params));

    const [{ params: sent }] = turns;
    expect(sent.sessionId).toBeNull();
    expect(sent.prompt).toStartWith(
      `${params.prompt}\n\nPrevious Studio conversation`
    );
    expect(sent.prompt).toContain("Make the title bigger");
    const notice = events.findIndex(
      (event) =>
        event.type === "notice" &&
        event.message.startsWith("Starting a new provider session")
    );
    expect(notice).toBeGreaterThanOrEqual(0);
  });

  it("refuses a video from another project", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const { run } = harness(setup, { adapter });

    const exit = await Effect.runPromiseExit(
      run(paramsFor(setup, { videoId: setup.foreign.id }))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain(
      "This video does not belong to the selected project."
    );
    expect(turns).toHaveLength(0);
  });

  it("finishes a brand application by the result", async () => {
    const setup = await studio();
    const { brand, finished } = fakeBrand(applicationFor(setup.project));

    await Effect.runPromise(
      harness(setup, {
        adapter: fakeAdapter(Effect.succeed(DONE)).adapter,
        brand,
      }).run(paramsFor(setup, { brandRevision: 1 }))
    );
    await Effect.runPromise(
      harness(setup, {
        adapter: fakeAdapter(Effect.succeed(FAILED)).adapter,
        brand,
      }).run(paramsFor(setup, { brandRevision: 1 }))
    );

    expect(finished).toEqual([true, false]);
  });

  it("fails the brand application when the turn is interrupted", async () => {
    const setup = await studio();
    const { brand, finished } = fakeBrand(applicationFor(setup.project));
    const started = Deferred.makeUnsafe<void>();
    const { adapter } = fakeAdapter(
      Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never))
    );
    const { run } = harness(setup, { adapter, brand });

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          run(paramsFor(setup, { brandRevision: 1 }))
        );
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
      })
    );

    expect(finished).toEqual([false]);
  });

  it("fails the brand application when the history fallback cannot be read", async () => {
    const setup = await studio();
    const { brand, finished } = fakeBrand(applicationFor(setup.project));
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const history: HistoryStore = {
      ...setup.history,
      blocks: () => Effect.fail(new HistoryError({ message: "disk is full" })),
    };
    const { run } = harness(setup, { adapter, brand, history });

    const exit = await Effect.runPromiseExit(
      run(paramsFor(setup, { brandRevision: 1, sessionId: "lost-session" }))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(turns).toHaveLength(0);
    expect(finished).toEqual([false]);
  });

  it("emits the resume notice before the history event and the adapter's turn", async () => {
    const setup = await studio();
    let seen: readonly AgentEvent[] = [];
    let atTurn = -1;
    const { adapter } = fakeAdapter(
      Effect.sync(() => {
        atTurn = seen.length;
      }).pipe(Effect.as(DONE))
    );
    const { events, run } = harness(setup, { adapter });
    seen = events;

    await Effect.runPromise(
      run(paramsFor(setup, { sessionId: "lost-session" }))
    );

    const notice = events.findIndex(
      (event) =>
        event.type === "notice" &&
        event.message.startsWith("Starting a new provider session")
    );
    const history = events.findIndex((event) => event.type === "history");
    expect(notice).toBeGreaterThanOrEqual(0);
    expect(history).toBeGreaterThan(notice);
    expect(atTurn).toBeGreaterThan(notice);
  });

  it("resumes the stored provider session when the request names none", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const { events, run } = harness(setup, { adapter });
    const params = paramsFor(setup);
    await openSession(setup, params);
    await Effect.runPromise(setup.history.bind(params.historyId, "sdk-stored"));

    await Effect.runPromise(run(params));

    const [{ params: sent }] = turns;
    expect(sent.sessionId).toBe("sdk-stored");
    expect(sent.prompt).toBe(params.prompt);
    expect(events.some((event) => event.type === "notice")).toBe(false);
  });

  it("flushes the transcript and abandons source requests when the turn succeeds", async () => {
    const setup = await studio();
    const { adapter, requests } = cleanupAdapter(Effect.succeed(DONE));
    const { run } = harness(setup, { adapter });
    const params = paramsFor(setup);

    await Effect.runPromise(run(params));

    await expectCleanedUp(setup, params, requests);
  });

  it("flushes the transcript and abandons source requests when the turn fails", async () => {
    const setup = await studio();
    const { adapter, requests } = cleanupAdapter(
      Effect.die(new Error("adapter crashed"))
    );
    const { run } = harness(setup, { adapter });
    const params = paramsFor(setup);

    const exit = await Effect.runPromiseExit(run(params));

    expect(Exit.isFailure(exit)).toBe(true);
    await expectCleanedUp(setup, params, requests);
  });

  it("flushes the transcript and abandons source requests when the turn is interrupted", async () => {
    const setup = await studio();
    const { adapter, reached, requests } = cleanupAdapter(Effect.never);
    const { run } = harness(setup, { adapter });
    const params = paramsFor(setup);

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(run(params));
        yield* Deferred.await(reached);
        yield* Fiber.interrupt(fiber);
      })
    );

    await expectCleanedUp(setup, params, requests);
  });

  it("stores the chat's mode and announces it when the gate switches it", async () => {
    const setup = await studio();
    const { bindings, gate } = bindingGate();
    const { adapter } = fakeAdapter(
      Effect.suspend(() => bindings[0].applyMode("acceptEdits")).pipe(
        Effect.as(DONE)
      )
    );
    const { events, run } = harness(setup, { adapter, gate });
    const params = paramsFor(setup);

    await Effect.runPromise(run(params));

    const sessions = await Effect.runPromise(setup.history.sessions);
    expect(
      sessions.find((session) => session.id === params.historyId)?.mode
    ).toBe("acceptEdits");
    expect(
      events.some(
        (event) =>
          event.type === "history" && event.session.mode === "acceptEdits"
      )
    ).toBe(true);
  });

  it("tells the person when attached media cannot be copied into the project", async () => {
    const setup = await studio();
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const { events, run } = harness(setup, { adapter });
    const params = paramsFor(setup, {
      media: [
        {
          mediaType: "video/mp4",
          name: "clip.mp4",
          path: join(setup.project.path, "gone", "clip.mp4"),
        },
      ],
    });

    await Effect.runPromise(run(params));

    expect(
      events.some(
        (event) =>
          event.type === "notice" &&
          event.message.startsWith(
            "The attached media could not be copied into the project:"
          )
      )
    ).toBe(true);
    expect(turns[0].services.instructions(false).media).toBeNull();
  });

  it("fails the turn with the sentence of a brand application that cannot be finished", async () => {
    const setup = await studio();
    const { brand, finished } = fakeBrand(applicationFor(setup.project), {
      unfinished: "The brand update could not be saved.",
    });
    const { run } = harness(setup, {
      adapter: fakeAdapter(Effect.succeed(DONE)).adapter,
      brand,
    });

    const exit = await Effect.runPromiseExit(
      run(paramsFor(setup, { brandRevision: 1 }))
    );

    expect(finished).toEqual([true]);
    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain(
      "The brand update could not be saved."
    );
  });

  it("keeps the turn's own failure when the brand application cannot be failed", async () => {
    const setup = await studio();
    const { brand, finished } = fakeBrand(applicationFor(setup.project), {
      unfinished: "The brand update could not be saved.",
    });
    const { run } = harness(setup, {
      adapter: fakeAdapter(Effect.die(new Error("adapter crashed"))).adapter,
      brand,
    });

    const exit = await Effect.runPromiseExit(
      run(paramsFor(setup, { brandRevision: 1 }))
    );

    expect(finished).toEqual([false]);
    if (Exit.isSuccess(exit)) {
      throw new Error("the turn should have failed");
    }
    expect(Cause.hasDies(exit.cause)).toBe(true);
    expect(Cause.hasFails(exit.cause)).toBe(false);
  });

  it("fails a brand application prepared while the turn was being interrupted", async () => {
    const setup = await studio();
    const application = applicationFor(setup.project);
    const beginning = Deferred.makeUnsafe<void>();
    const proceed = Deferred.makeUnsafe<void>();
    const { brand, finished } = fakeBrand(application, {
      begin: Deferred.succeed(beginning, undefined).pipe(
        Effect.andThen(Deferred.await(proceed)),
        Effect.as({ application, brief: null })
      ),
    });
    const { adapter, turns } = fakeAdapter(Effect.succeed(DONE));
    const { run } = harness(setup, { adapter, brand });

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          run(paramsFor(setup, { brandRevision: 1 }))
        );
        yield* Deferred.await(beginning);
        const interrupting = yield* Effect.forkChild(Fiber.interrupt(fiber), {
          startImmediately: true,
        });
        yield* Deferred.succeed(proceed, undefined);
        yield* Fiber.join(interrupting);
      })
    );

    expect(finished).toEqual([false]);
    expect(turns).toHaveLength(0);
  });
});

describe("openTurn", () => {
  it("writes one user entry and answers the session row", async () => {
    const setup = await studio();
    const params = paramsFor(setup);

    const recorder = await Effect.runPromise(
      openTurn(params, () => Effect.void).pipe(
        Effect.provideService(HistoryStore, setup.history)
      )
    );
    const blocks = await Effect.runPromise(
      setup.history.blocks(params.historyId)
    );

    expect(recorder.session?.id).toBe(params.historyId);
    expect(recorder.session?.videoId).toBe(setup.video.id);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "user", text: params.prompt });
  });
});
