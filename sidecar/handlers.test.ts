import { afterEach, beforeEach, expect, it, mock } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Effect } from "effect";
import {
  DATA_DIR_ENV,
  type PromptParams,
  REMOCN_DIR_ENV,
  TEMPLATE_DIR_ENV,
} from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import type { AgentAdapter } from "./agent/adapter";
import { migrate, prepare } from "./history/migrations";
import { make as makeProjects, ProjectStore } from "./history/projects";
import { driverFor } from "./history/sqlite";
import { HistoryStore, make as makeHistory } from "./history/store";
import { make as makeVideos, VideoStore } from "./history/videos";

const turn = mock<AgentAdapter["turn"]>(() =>
  Effect.succeed({
    context: null,
    failure: { kind: "auth" as const, message: "Sign in to your agent." },
    sessionId: null,
  })
);
const adapter: AgentAdapter = {
  account: () => Effect.die("unused"),
  forget: () => Effect.void,
  info: PROVIDER_INFO.claude,
  toolKey: ({ turn: id }) => id,
  turn,
};
mock.module("./agent/registry", () => ({
  adapterFor: () => adapter,
  forgetChat: () => Effect.void,
}));
const { handlers } = await import("./handlers");
const old = {
  data: process.env[DATA_DIR_ENV],
  remocn: process.env[REMOCN_DIR_ENV],
  template: process.env[TEMPLATE_DIR_ENV],
};
let root: string;
let directory: string;
const driver = driverFor(":memory:");
prepare(driver);
migrate(driver);
const projects = makeProjects(driver);
const videos = makeVideos(driver);
const history = makeHistory(driver);
let projectId: string;
let videoId: string;
const run = <A, E>(
  effect: Effect.Effect<A, E, ProjectStore | VideoStore | HistoryStore>
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(ProjectStore, projects),
      Effect.provideService(VideoStore, videos),
      Effect.provideService(HistoryStore, history)
    )
  );
const ports = {
  ask: () => Effect.die("No core requests expected"),
  emit: () => Effect.void,
  log: () => Effect.void,
};
const targets = () =>
  run(
    handlers["shader.targets"]({
      ...ports,
      params: { generation: null, projectId, video: "intro" },
    })
  );
const source =
  "export default function Video() { return <div>Authored video</div>; }";
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "shader-handler-project-"));
  directory = await mkdtemp(join(tmpdir(), "shader-handler-data-"));
  process.env[DATA_DIR_ENV] = directory;
  process.env[TEMPLATE_DIR_ENV] = resolve("templates/remotion");
  process.env[REMOCN_DIR_ENV] = resolve("remocn");
  await mkdir(join(root, "src/videos/intro"), { recursive: true });
  await writeFile(join(root, "package.json"), "{}");
  await writeFile(join(root, "src/videos/intro/index.tsx"), source);
  await writeFile(
    join(root, "src/videos/intro/studio.json"),
    JSON.stringify({
      definitions: [],
      objects: [],
      operations: [],
      version: 1,
      video: "intro",
    })
  );
  await Promise.all(
    ["studio-objects-v5", "studio-objects-v6"].map((name) =>
      cp(
        resolve("templates/remotion/src/lib", name),
        join(root, "src/lib", name),
        { recursive: true }
      )
    )
  );
  const project = await run(projects.open(root));
  projectId = project.id;
  videoId = (
    await run(
      videos.create({ compositionId: "intro", name: "Intro", projectId })
    )
  ).id;
  turn.mockClear();
});
afterEach(async () => {
  for (const [key, value] of [
    [DATA_DIR_ENV, old.data],
    [TEMPLATE_DIR_ENV, old.template],
    [REMOCN_DIR_ENV, old.remocn],
  ]) {
    if (value === undefined) {
      delete process.env[key as string];
    } else {
      process.env[key as string] = value;
    }
  }
  await Promise.all(
    [root, directory].map((path) => rm(path, { force: true, recursive: true }))
  );
});
it("offers explicit preparation for unversioned authored source without starting an agent", async () => {
  const result = await targets();
  expect(result.preparationRevision).toHaveLength(64);
  expect(result.targets).toEqual([]);
  expect(result.reason).toContain("explicit");
  expect(turn).not.toHaveBeenCalled();
  expect(await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")).toBe(
    source
  );
});
it("never offers agent preparation as a bypass for recorded old or invalid provenance", async () => {
  await writeFile(
    join(root, "src/videos/intro/studio-origin.json"),
    JSON.stringify({ createdWithStudioVersion: "0.9.0", version: 1 })
  );
  const result = await targets();
  expect(result.preparationRevision).toBeUndefined();
  expect(result.reason).toContain("0.9.0");
  await writeFile(join(root, "src/videos/intro/studio-origin.json"), "{}");
  expect((await targets()).preparationRevision).toBeUndefined();
  expect(turn).not.toHaveBeenCalled();
});
it("reports configured agent failure through preparation status without changing the original", async () => {
  const offered = await targets();
  const params: PromptParams = {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    historyId: crypto.randomUUID(),
    media: [],
    mode: "auto",
    model: null,
    playing: null,
    projectId,
    prompt: "Prepare shaders",
    provider: "claude",
    sessionId: null,
    shaderPreparation: { revision: offered.preparationRevision as string },
    videoId,
  };
  await expect(
    run(handlers["agent.prompt"]({ ...ports, params }))
  ).rejects.toThrow("Sign in");
  expect(turn).toHaveBeenCalledTimes(1);
  const status = await targets();
  expect(status.preparation?.phase).toBe("failed");
  expect(status.preparation?.message).toContain("Settings");
  expect(await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")).toBe(
    source
  );
  await expect(
    run(handlers["agent.prompt"]({ ...ports, params }))
  ).rejects.toThrow("new chat");
  expect(turn).toHaveBeenCalledTimes(1);
});
it("sends validation feedback through the configured agent and records repairs in the same chat", async () => {
  const offered = await targets();
  const params: PromptParams = {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    historyId: crypto.randomUUID(),
    media: [],
    mode: "auto",
    model: null,
    playing: null,
    projectId,
    prompt: "Prepare shaders",
    provider: "claude",
    sessionId: null,
    shaderPreparation: { revision: offered.preparationRevision as string },
    videoId,
  };
  for (let i = 0; i < 3; i += 1) {
    turn.mockImplementationOnce(() =>
      Effect.succeed({
        context: null,
        failure: null,
        sessionId: "temporary-sdk-session",
      })
    );
  }
  await expect(
    run(handlers["agent.prompt"]({ ...ports, params }))
  ).rejects.toThrow("3 attempts");
  expect(turn).toHaveBeenCalledTimes(3);
  const { calls } = turn.mock;
  expect(calls[1][0].prompt).toContain("attempt 2 of 3");
  expect(calls[1][0].prompt).toContain("explicit");
  expect(calls[2][0].prompt).toContain("attempt 3 of 3");
  for (const [request, services] of calls) {
    expect(request.historyId).toBe(params.historyId);
    expect(request.provider).toBe(params.provider);
    expect(request.sessionId).toBeNull();
    expect(services.cwd).toBe(calls[0][1].cwd);
    expect(services.cwd).not.toBe(root);
  }
  const blocks = await run(history.blocks(params.historyId));
  expect(blocks.filter((block) => block.kind === "user")).toHaveLength(3);
  expect(JSON.stringify(blocks)).toContain("attempt 2 of 3");
  expect(await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")).toBe(
    source
  );
});
