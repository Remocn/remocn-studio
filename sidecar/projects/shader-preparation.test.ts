import { afterEach, beforeEach, expect, it, mock } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Deferred, Effect, Fiber } from "effect";
import {
  type PromptResult,
  REMOCN_DIR_ENV,
  TEMPLATE_DIR_ENV,
} from "@/shared/ipc";
import { ShaderError } from "../library/shaders";
import { makeShaderInsertions } from "./shader-insertion";
import { makeShaderPreparations, preparationOffer } from "./shader-preparation";
import { planShaderConnection } from "./shader-targets";

let root: string;
let directory: string;
const previousTemplate = process.env[TEMPLATE_DIR_ENV];
const previousRemocn = process.env[REMOCN_DIR_ENV];
const ok: PromptResult = { context: null, failure: null, sessionId: null };
const videoPath = "src/videos/intro";
async function file(path: string, content: string, base = root) {
  await mkdir(dirname(join(base, path)), { recursive: true });
  await writeFile(join(base, path), content);
}
const read = (path: string) => readFile(join(root, videoPath, path), "utf8");
async function input() {
  return {
    historyId: crypto.randomUUID(),
    revision: await Effect.runPromise(preparationOffer(root, "intro")),
    root,
    video: "intro",
  };
}
const verify = mock(() => Effect.void);
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "shader-preparation-project-"));
  directory = await mkdtemp(join(tmpdir(), "shader-preparation-data-"));
  process.env[TEMPLATE_DIR_ENV] = resolve("templates/remotion");
  process.env[REMOCN_DIR_ENV] = resolve("remocn");
  await file("package.json", "{}");
  await Promise.all(
    ["studio-objects-v5", "studio-objects-v6"].map((name) =>
      cp(
        resolve("templates/remotion/src/lib", name),
        join(root, "src/lib", name),
        { recursive: true }
      )
    )
  );
  await file(
    `${videoPath}/index.tsx`,
    `import {AbsoluteFill, Sequence} from 'remotion';
import {StudioObjects, useStudioObject} from '../../lib/studio-objects-v6';
import document from './studio.json';
export const meta = {durationInFrames: 90, fps: 30, height: 180, width: 320};
function Scene() {const scene = useStudioObject('scene'); return <AbsoluteFill {...scene.bind}><div>Original content</div></AbsoluteFill>;}
export default function Video() { return <StudioObjects document={document}><Sequence durationInFrames={90}><Scene/></Sequence></StudioObjects>; }`
  );
  await file(
    `${videoPath}/studio.json`,
    JSON.stringify({
      definitions: [{ fields: [], id: "scene", version: 1 }],
      objects: [
        {
          definition: "scene",
          id: "scene",
          label: "Scene",
          parentId: null,
          values: {},
        },
      ],
      operations: [],
      version: 1,
      video: "intro",
    })
  );
  verify.mockClear();
});
afterEach(async () => {
  if (previousTemplate === undefined) {
    delete process.env[TEMPLATE_DIR_ENV];
  } else {
    process.env[TEMPLATE_DIR_ENV] = previousTemplate;
  }
  if (previousRemocn === undefined) {
    delete process.env[REMOCN_DIR_ENV];
  } else {
    process.env[REMOCN_DIR_ENV] = previousRemocn;
  }
  await Promise.all(
    [root, directory].map((path) => rm(path, { force: true, recursive: true }))
  );
});
it("runs the agent on a copy, compiles before activation and waits for real preview without creating a shader", async () => {
  const original = await read("index.tsx");
  const document = await read("studio.json");
  const validate = mock((stage: string) =>
    Effect.gen(function* () {
      expect(stage).not.toEqual(root);
      expect(yield* Effect.promise(() => read("index.tsx"))).toEqual(original);
      expect((yield* planShaderConnection(stage, "intro")).adaptation).toBe(
        false
      );
    })
  );
  const service = makeShaderPreparations(directory, validate);
  const request = await input();
  await Effect.runPromise(
    service.run(
      request,
      (workspace) =>
        Effect.gen(function* () {
          expect(workspace.path).not.toEqual(root);
          expect(workspace.brief).toContain("Do not add a shader instance");
          yield* Effect.promise(() =>
            file(`${videoPath}/notes.md`, "prepared", workspace.path)
          );
          return ok;
        }),
      Effect.gen(function* () {
        expect((yield* service.status(root, "intro"))?.phase).toBe(
          "activating"
        );
        expect((yield* planShaderConnection(root, "intro")).adaptation).toBe(
          false
        );
      })
    )
  );
  expect(validate).toHaveBeenCalledTimes(1);
  expect(await read("studio.json")).toEqual(document);
  expect(await read("notes.md")).toEqual("prepared");
  expect((await Effect.runPromise(service.status(root, "intro")))?.phase).toBe(
    "ready"
  );
  expect(await readdir(join(directory, "shader-workspaces"))).toEqual([]);
  await expect(read("studio-origin.json")).rejects.toThrow();
});
it("preserves the original when the agent or compiler fails and allows retry", async () => {
  const original = await read("index.tsx");
  const service = makeShaderPreparations(directory, () =>
    Effect.fail(new ShaderError({ message: "Bundle failed" }))
  );
  await expect(
    Effect.runPromise(
      service.run(await input(), () => Effect.succeed(ok), verify())
    )
  ).rejects.toThrow("Bundle failed");
  expect(await read("index.tsx")).toEqual(original);
  expect((await Effect.runPromise(service.status(root, "intro")))?.phase).toBe(
    "failed"
  );
  const retried = makeShaderPreparations(directory, () => Effect.void);
  await Effect.runPromise(
    retried.run(await input(), () => Effect.succeed(ok), Effect.void)
  );
  expect((await Effect.runPromise(retried.status(root, "intro")))?.phase).toBe(
    "ready"
  );
});
it("returns a rejected SceneRoot to the agent and activates only the repaired copy", async () => {
  const source = await read("index.tsx");
  await file(
    `${videoPath}/SceneRoot.tsx`,
    `import {AbsoluteFill} from 'remotion';
import {useStudioObject} from '../../lib/studio-objects-v6';
export function SceneRoot({id, children}) {const scene = useStudioObject(id); return <AbsoluteFill {...scene.bind} style={{overflow: 'hidden'}}>{children}</AbsoluteFill>;}`
  );
  const wrapped =
    'import {SceneRoot} from "./SceneRoot";\n' +
    source.replace(
      "<AbsoluteFill {...scene.bind}><div>Original content</div></AbsoluteFill>",
      '<SceneRoot id="scene"><div>Original content</div></SceneRoot>'
    );
  await file(`${videoPath}/index.tsx`, wrapped);
  const service = makeShaderPreparations(directory, () => Effect.void);
  const paths: string[] = [];
  const agent = mock(
    (workspace: { path: string; brief: string; feedback?: string }) =>
      Effect.promise(async () => {
        paths.push(workspace.path);
        expect(await read("index.tsx")).toBe(wrapped);
        if (paths.length === 2) {
          expect(workspace.feedback).toContain("SceneRoot");
          expect(workspace.feedback).toContain("AbsoluteFill");
          expect(workspace.feedback).toContain("2 of 3");
          await file(`${videoPath}/index.tsx`, source, workspace.path);
        }
        return ok;
      })
  );
  await Effect.runPromise(service.run(await input(), agent, verify()));
  expect(agent).toHaveBeenCalledTimes(2);
  expect(new Set(paths).size).toBe(1);
  expect((await Effect.runPromise(service.status(root, "intro")))?.phase).toBe(
    "ready"
  );
  expect(
    (await Effect.runPromise(planShaderConnection(root, "intro"))).manifest
      .slots
  ).toHaveLength(1);
});
it("restores generated connections before retrying a compiler failure", async () => {
  const source = await read("index.tsx");
  let builds = 0;
  const service = makeShaderPreparations(directory, () =>
    Effect.suspend(() => {
      builds += 1;
      return builds === 1
        ? Effect.fail(new ShaderError({ message: "Scene.tsx: missing export" }))
        : Effect.void;
    })
  );
  let attempts = 0;
  await Effect.runPromise(
    service.run(
      await input(),
      (workspace) =>
        Effect.promise(async () => {
          attempts += 1;
          if (attempts === 2) {
            expect(workspace.brief).toContain("Scene.tsx: missing export");
            expect(
              await readFile(
                join(workspace.path, videoPath, "index.tsx"),
                "utf8"
              )
            ).toBe(source);
            await expect(
              readFile(join(workspace.path, videoPath, "studio-shaders.json"))
            ).rejects.toThrow();
            await file(
              `${videoPath}/notes.md`,
              "compiler repaired",
              workspace.path
            );
          }
          return ok;
        }),
      verify()
    )
  );
  expect(attempts).toBe(2);
  expect(builds).toBe(2);
  expect(await read("notes.md")).toBe("compiler repaired");
});
it("stops after three failed validations without activating or verifying preview", async () => {
  const source = await read("index.tsx");
  const service = makeShaderPreparations(directory, () =>
    Effect.fail(new ShaderError({ message: "Still invalid" }))
  );
  const agent = mock(() => Effect.succeed(ok));
  const preview = mock(() => undefined);
  await expect(
    Effect.runPromise(service.run(await input(), agent, Effect.sync(preview)))
  ).rejects.toThrow("Still invalid");
  expect(agent).toHaveBeenCalledTimes(3);
  expect(preview).not.toHaveBeenCalled();
  expect(await read("index.tsx")).toBe(source);
  expect(
    (await Effect.runPromise(service.status(root, "intro")))?.message
  ).toContain("3 attempts");
  expect(await readdir(join(directory, "shader-workspaces"))).toEqual([]);
});
it("refuses changes outside the video and changes to existing Inspect values", async () => {
  const original = await read("studio.json");
  for (const path of [
    "src/lib/changed.ts",
    `${videoPath}/studio.json`,
    `${videoPath}/studio-origin.json`,
  ]) {
    const service = makeShaderPreparations(directory, () => Effect.void);
    // biome-ignore lint/performance/noAwaitInLoops: Each attempt must finish recovery before the next begins.
    await expect(
      Effect.runPromise(
        service.run(
          await input(),
          (workspace) =>
            Effect.promise(async () => {
              await file(path, "{}", workspace.path);
              return ok;
            }),
          Effect.void
        )
      )
    ).rejects.toThrow();
    expect(await read("studio.json")).toEqual(original);
  }
});
it("rejects stale source before starting the agent and preserves concurrent original edits", async () => {
  const service = makeShaderPreparations(directory, () => Effect.void);
  const stale = await input();
  const source = await read("index.tsx");
  await file(`${videoPath}/index.tsx`, `${source}\n// changed`);
  const agent = mock(() => Effect.succeed(ok));
  await expect(
    Effect.runPromise(service.run(stale, agent, Effect.void))
  ).rejects.toThrow("changed since");
  expect(agent).not.toHaveBeenCalled();
  const request = await input();
  await expect(
    Effect.runPromise(
      service.run(
        request,
        () =>
          Effect.promise(async () => {
            await file(
              `${videoPath}/index.tsx`,
              `${source}\n// concurrent change`
            );
            return ok;
          }),
        Effect.void
      )
    )
  ).rejects.toThrow("original project changed");
  expect(await read("index.tsx")).toBe(`${source}\n// concurrent change`);
});
it("rolls back failed live preview while preserving independent changes", async () => {
  const source = await read("index.tsx");
  const service = makeShaderPreparations(directory, () => Effect.void);
  await expect(
    Effect.runPromise(
      service.run(
        await input(),
        () => Effect.succeed(ok),
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            file(`${videoPath}/index.tsx`, `${source}\n// newer edit`)
          );
          return yield* Effect.fail(
            new ShaderError({ message: "Preview failed" })
          );
        })
      )
    )
  ).rejects.toThrow("Preview failed");
  expect(await read("index.tsx")).toBe(`${source}\n// newer edit`);
  await expect(read("studio-shaders.json")).rejects.toThrow();
  expect(
    (await Effect.runPromise(service.status(root, "intro")))?.message
  ).toContain("Independent changes were preserved");
});
it("cancels during the agent turn without activating partial output", async () => {
  const source = await read("index.tsx");
  const service = makeShaderPreparations(directory, () => Effect.void);
  const started = Deferred.makeUnsafe<void>();
  const request = await input();
  const fiber = Effect.runFork(
    service.run(
      request,
      (workspace) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            file(
              `${videoPath}/index.tsx`,
              "broken partial output",
              workspace.path
            )
          );
          yield* Deferred.succeed(started, undefined);
          return yield* Effect.never;
        }),
      Effect.void
    )
  );
  await Effect.runPromise(Deferred.await(started));
  await Effect.runPromise(Fiber.interrupt(fiber));
  expect(await read("index.tsx")).toBe(source);
  expect((await Effect.runPromise(service.status(root, "intro")))?.phase).toBe(
    "failed"
  );
});
it("cancels a repair attempt without starting another attempt or activating source", async () => {
  const source = await read("index.tsx");
  const service = makeShaderPreparations(directory, () =>
    Effect.fail(new ShaderError({ message: "Repair needed" }))
  );
  const repairing = Deferred.makeUnsafe<void>();
  let attempts = 0;
  const request = await input();
  const fiber = Effect.runFork(
    service.run(
      request,
      () =>
        Effect.gen(function* () {
          attempts += 1;
          if (attempts === 2) {
            yield* Deferred.succeed(repairing, undefined);
            return yield* Effect.never;
          }
          return ok;
        }),
      Effect.void
    )
  );
  await Effect.runPromise(Deferred.await(repairing));
  await Effect.runPromise(Fiber.interrupt(fiber));
  expect(attempts).toBe(2);
  expect(await read("index.tsx")).toBe(source);
  expect((await Effect.runPromise(service.status(root, "intro")))?.phase).toBe(
    "failed"
  );
  expect(await readdir(join(directory, "shader-workspaces"))).toEqual([]);
});
it("recovers interrupted activation from disk without overwriting newer source", async () => {
  const service = makeShaderPreparations(directory, () => Effect.void);
  await Effect.runPromise(
    service.run(await input(), () => Effect.succeed(ok), Effect.void)
  );
  const [name] = await readdir(join(directory, "shader-preparations"));
  const path = join(directory, "shader-preparations", name);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.phase = "activating";
  await mkdir(join(directory, "shader-workspaces", record.workspace), {
    recursive: true,
  });
  await writeFile(
    join(directory, "shader-workspaces", record.workspace, "partial.tsx"),
    "unfinished copy"
  );
  await writeFile(path, JSON.stringify(record));
  await file(`${videoPath}/index.tsx`, "newer user content");
  const restarted = makeShaderPreparations(directory, () => Effect.void);
  expect(
    (await Effect.runPromise(restarted.status(root, "intro")))?.phase
  ).toBe("failed");
  expect(await read("index.tsx")).toBe("newer user content");
  expect(await readdir(join(directory, "shader-workspaces"))).toEqual([]);
  await expect(read("studio-shaders.json")).rejects.toThrow();
});

it.skipIf(process.env.REMOCN_SHADER_RENDER !== "1")(
  "compiles the prepared copy with the project's real Remotion bundler before activation",
  async () => {
    await symlink(
      resolve("test/fixtures/render-smoke/node_modules"),
      join(root, "node_modules"),
      "dir"
    );
    await file(
      "src/index.tsx",
      `import React from 'react'; import {Composition, registerRoot} from 'remotion'; import Video, {meta} from './videos/intro'; registerRoot(() => <Composition id="Intro" component={Video} {...meta}/>);`
    );
    const source = await read("index.tsx");
    const service = makeShaderPreparations(directory);
    await Effect.runPromise(
      service.run(
        await input(),
        () => Effect.succeed(ok),
        Effect.sync(() => {
          verify();
        })
      )
    );
    expect(await read("index.tsx")).not.toBe(source);
    expect(
      (await Effect.runPromise(service.status(root, "intro")))?.phase
    ).toBe("ready");
  },
  60_000
);

it("keeps preparation pending until a matching live scene report arrives", async () => {
  const service = makeShaderPreparations(directory, () => Effect.void);
  const insertions = makeShaderInsertions(directory);
  const waiting = Deferred.makeUnsafe<void>();
  let completed = false;
  const fiber = Effect.runFork(
    service
      .run(
        await input(),
        () => Effect.succeed(ok),
        Deferred.succeed(waiting, undefined).pipe(
          Effect.andThen(insertions.waitForPrepared(root, "project", "intro"))
        )
      )
      .pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            completed = true;
          })
        )
      )
  );
  await Effect.runPromise(Deferred.await(waiting));
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  const [slot] = plan.manifest.slots;
  const report = {
    contract: 1 as const,
    durationInFrames: 90,
    fps: 30,
    from: 0,
    label: slot.label,
    occurrences: 1,
    sceneId: slot.sceneId,
    slotId: slot.id,
    sourceRevision: plan.manifest.sourceRevision,
  };
  await expect(
    Effect.runPromise(
      insertions.targets(root, {
        generation: "fresh",
        projectId: "project",
        report: [{ ...report, sourceRevision: "stale" }],
        video: "intro",
      })
    )
  ).rejects.toThrow("stale");
  expect(completed).toBe(false);
  expect((await Effect.runPromise(service.status(root, "intro")))?.phase).toBe(
    "activating"
  );
  await Effect.runPromise(
    insertions.targets(root, {
      generation: "fresh",
      projectId: "project",
      report: [report],
      video: "intro",
    })
  );
  await Effect.runPromise(Fiber.join(fiber));
  expect(completed).toBe(true);
  expect((await Effect.runPromise(service.status(root, "intro")))?.phase).toBe(
    "ready"
  );
  expect(JSON.parse(await read("studio.json")).objects).toHaveLength(1);
});
