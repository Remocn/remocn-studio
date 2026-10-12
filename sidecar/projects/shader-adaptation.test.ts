import { afterEach, beforeEach, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { file as bunFile } from "bun";
import { Effect } from "effect";
import { REMOCN_DIR_ENV, TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { makeShaderInsertions } from "./shader-insertion";
import { makeShaderJournal } from "./shader-journal";
import { planShaderConnection } from "./shader-targets";

let root = "";
const priorTemplate = process.env[TEMPLATE_DIR_ENV];
const priorRemocn = process.env[REMOCN_DIR_ENV];
async function file(path: string, text: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
}
const folder = "src/videos/intro";
const index = `import { AbsoluteFill, Series } from "remotion";
import { StudioObjects } from "../../lib/studio-objects-v6";
import { SceneA } from "./scenes/a";
import { SceneB } from "./scenes/b";
import { SceneC } from "./scenes/c";
import { LENGTH, FPS } from "./timing";
import document from "./studio.json";
export const meta = { durationInFrames: LENGTH.a + LENGTH.b + LENGTH.c, fps: FPS, height: 180, width: 320 };
export default function Video() {
 return <StudioObjects document={document}><AbsoluteFill style={{backgroundColor: "black"}}><Series>
  <Series.Sequence durationInFrames={LENGTH.a}><SceneA /></Series.Sequence>
  <Series.Sequence durationInFrames={LENGTH.b}><SceneB /></Series.Sequence>
  <Series.Sequence durationInFrames={LENGTH.c}><SceneC /></Series.Sequence>
 </Series></AbsoluteFill></StudioObjects>;
}`;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "shader-scenes-"));
  process.env[TEMPLATE_DIR_ENV] = resolve("templates/remotion");
  process.env[REMOCN_DIR_ENV] = resolve("remocn");
  await file("package.json", "{}");
  await Promise.all(
    ["studio-objects-v5", "studio-objects-v6"].map((runtime) =>
      cp(
        resolve("templates/remotion/src/lib", runtime),
        join(root, "src/lib", runtime),
        { recursive: true }
      )
    )
  );
  await file(`${folder}/index.tsx`, index);
  await file(
    `${folder}/timing.ts`,
    "export const FPS = 30; export const LENGTH = { a: 75, b: 153, c: 72 } as const;"
  );
  await file(
    `${folder}/studio.json`,
    JSON.stringify({
      definitions: [{ fields: [], id: "scene", version: 1 }],
      objects: ["a", "b", "c"].map((id) => ({
        definition: "scene",
        id,
        label: `Scene ${id}`,
        parentId: null,
        values: {},
      })),
      operations: [],
      version: 1,
      video: "intro",
    })
  );
  await Promise.all(
    ["a", "b", "c"].map((id) =>
      file(
        `${folder}/scenes/${id}.tsx`,
        `import { AbsoluteFill } from "remotion";
import { useStudioObject } from "../../../lib/studio-objects-v6";
export function Scene${id.toUpperCase()}() { const scene = useStudioObject("${id}"); return <AbsoluteFill {...scene.bind} style={{backgroundColor: "red"}}><div style={{position: "absolute", width: 30, height: 30, backgroundColor: "lime"}}>Text</div></AbsoluteFill>; }`
      )
    )
  );
});
afterEach(async () => {
  if (priorRemocn === undefined) {
    delete process.env[REMOCN_DIR_ENV];
  } else {
    process.env[REMOCN_DIR_ENV] = priorRemocn;
  }
  if (priorTemplate === undefined) {
    delete process.env[TEMPLATE_DIR_ENV];
  } else {
    process.env[TEMPLATE_DIR_ENV] = priorTemplate;
  }
  await rm(root, { force: true, recursive: true });
});
it("plans finished unversioned Series scenes, all local readers and dependency guards without modifying the video", async () => {
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  expect(
    plan.scenes.map(({ sceneId, from, durationInFrames }) => ({
      durationInFrames,
      from,
      sceneId,
    }))
  ).toEqual([
    { durationInFrames: 75, from: 0, sceneId: "a" },
    { durationInFrames: 153, from: 75, sceneId: "b" },
    { durationInFrames: 72, from: 228, sceneId: "c" },
  ]);
  expect(
    plan.edits.find((edit) => edit.path.endsWith("timing.ts"))
  ).toMatchObject({
    before:
      "export const FPS = 30; export const LENGTH = { a: 75, b: 153, c: 72 } as const;",
  });
  expect(
    plan.edits.find((edit) => edit.path.endsWith("/scenes/a.tsx"))?.after
  ).toContain("<StudioSceneShader />");
  expect(
    plan.edits.find((edit) => edit.path.endsWith("/scenes/a.tsx"))?.after
  ).not.toContain("studio-objects-v6");
  expect(plan.edits[0].after).toContain(
    "durationInFrames={LENGTH.a}><SceneA /></StudioShaderScene>"
  );
  expect(await readFile(join(root, `${folder}/index.tsx`), "utf8")).toBe(index);
  expect(
    await bunFile(join(root, `${folder}/studio-origin.json`)).exists()
  ).toBe(false);
  const service = makeShaderInsertions(join(root, "app-data"));
  const result = await Effect.runPromise(
    service.targets(root, {
      generation: "preview",
      projectId: "project",
      video: "intro",
    })
  );
  expect(result.targets.map((target) => target.slotId)).toEqual([
    "a-shaders",
    "b-shaders",
    "c-shaders",
  ]);
});
it("resolves Sequence ranges and preserves gaps", async () => {
  await file(
    `${folder}/index.tsx`,
    index
      .replace("AbsoluteFill, Series", "AbsoluteFill, Sequence")
      .replaceAll("<Series>", "")
      .replaceAll("</Series>", "")
      .replaceAll("</Series.Sequence>", "</Sequence>")
      .replace(
        "<Series.Sequence durationInFrames={LENGTH.a}>",
        "<Sequence from={0} durationInFrames={60}>"
      )
      .replace(
        "<Series.Sequence durationInFrames={LENGTH.b}>",
        "<Sequence from={75} durationInFrames={LENGTH.b}>"
      )
      .replace(
        "<Series.Sequence durationInFrames={LENGTH.c}>",
        "<Sequence from={228} durationInFrames={LENGTH.c}>"
      )
  );
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  expect(
    plan.scenes.map((scene) => [scene.from, scene.durationInFrames])
  ).toEqual([
    [0, 60],
    [75, 153],
    [228, 72],
  ]);
});
it("resolves explicit TransitionSeries overlap while keeping slots inside each scene", async () => {
  await file(
    `${folder}/index.tsx`,
    'import { TransitionSeries, linearTiming } from "@remotion/transitions";\n' +
      index
        .replaceAll("Series.Sequence", "TransitionSeries.Sequence")
        .replaceAll("<Series>", "<TransitionSeries>")
        .replaceAll("</Series>", "</TransitionSeries>")
        .replace(
          "<TransitionSeries.Sequence durationInFrames={LENGTH.b}>",
          "<TransitionSeries.Transition timing={linearTiming({durationInFrames: 15})} /><TransitionSeries.Sequence durationInFrames={LENGTH.b}>"
        )
  );
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  expect(plan.scenes.map((scene) => scene.from)).toEqual([0, 60, 213]);
  expect(plan.edits[0].after).toContain(
    "timing={linearTiming({durationInFrames: 15})}"
  );
});
it("rejects reused components, dynamic timing and shared old-context consumers", async () => {
  await file(`${folder}/index.tsx`, index.replace("<SceneB />", "<SceneA />"));
  await expect(
    Effect.runPromise(planShaderConnection(root, "intro"))
  ).rejects.toThrow("mounted more than once");
  await file(
    `${folder}/index.tsx`,
    index.replace(
      "durationInFrames={LENGTH.a}",
      "durationInFrames={getDuration()}"
    )
  );
  await expect(
    Effect.runPromise(planShaderConnection(root, "intro"))
  ).rejects.toThrow("computed dynamically");
  await file(
    `${folder}/index.tsx`,
    `import { helper } from "../../components/helper";\n${index}`
  );
  await file(
    "src/components/helper.ts",
    'export { useStudioObject as helper } from "../lib/studio-objects-v6";'
  );
  await expect(
    Effect.runPromise(planShaderConnection(root, "intro"))
  ).rejects.toThrow("shared component");
});
it("detects timing edits and newly added provenance before journal activation", async () => {
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  const available = await Effect.runPromise(
    makeShaderInsertions(join(root, "app-data")).targets(root, {
      generation: "old",
      projectId: "project",
      video: "intro",
    })
  );
  const record = {
    edits: plan.edits,
    phase: "planned" as const,
    request: {
      objectId: "shader",
      operationId: "insert",
      slug: "shader-mesh-gradient",
      target: available.targets[0],
    },
    resources: [],
    root,
    version: 1 as const,
  };
  const journal = makeShaderJournal(join(root, "app-data"));
  await file(
    `${folder}/studio-origin.json`,
    JSON.stringify({ createdWithStudioVersion: "0.9.0", version: 1 })
  );
  await expect(Effect.runPromise(journal.activate(record))).rejects.toThrow(
    "changed independently"
  );
  await rm(join(root, `${folder}/studio-origin.json`));
  await file(`${folder}/timing.ts`, "export const FPS = 24;");
  await expect(Effect.runPromise(journal.activate(record))).rejects.toThrow(
    "changed independently"
  );
  expect(await readFile(join(root, `${folder}/index.tsx`), "utf8")).toBe(index);
});
it("puts the slot after an opaque scene background and before content", async () => {
  const path = `${folder}/scenes/a.tsx`;
  const before = await readFile(join(root, path), "utf8");
  await file(
    path,
    before.replace(
      "<div style=",
      '<AbsoluteFill style={{backgroundColor: "blue"}} /><div style='
    )
  );
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  const after = plan.edits.find((edit) => edit.path === path)?.after ?? "";
  expect(after.indexOf('backgroundColor: "blue"')).toBeLessThan(
    after.indexOf("<StudioSceneShader")
  );
  expect(after.indexOf("<StudioSceneShader")).toBeLessThan(
    after.indexOf("<div style=")
  );
});
it("rolls back all source edits without fabricating missing origin and can prepare again", async () => {
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  const available = await Effect.runPromise(
    makeShaderInsertions(join(root, "app-data")).targets(root, {
      generation: "old",
      projectId: "project",
      video: "intro",
    })
  );
  const record = {
    edits: plan.edits,
    phase: "planned" as const,
    request: {
      objectId: "shader",
      operationId: "insert",
      slug: "shader-mesh-gradient",
      target: available.targets[0],
    },
    resources: [],
    root,
    version: 1 as const,
  };
  const journal = makeShaderJournal(join(root, "app-data"));
  await Effect.runPromise(journal.activate(record));
  await Effect.runPromise(journal.rollback(record));
  expect(await readFile(join(root, `${folder}/index.tsx`), "utf8")).toBe(index);
  expect(
    await bunFile(join(root, `${folder}/shader-scenes.tsx`)).exists()
  ).toBe(false);
  expect(
    await bunFile(join(root, `${folder}/studio-origin.json`)).exists()
  ).toBe(false);
  expect(
    (await Effect.runPromise(planShaderConnection(root, "intro"))).scenes
  ).toEqual(plan.scenes);
});
it("prepares an unversioned finished video and commits one shader to the selected scene across retry", async () => {
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  const service = makeShaderInsertions(
    join(root, "app-data"),
    () => Effect.void
  );
  const query = { generation: "before", projectId: "project", video: "intro" };
  const available = await Effect.runPromise(service.targets(root, query));
  const request = {
    objectId: "shader-b",
    operationId: "insert-b",
    slug: "shader-mesh-gradient",
    target: available.targets[1],
  };
  const report = (progress: { phase: string }) =>
    Effect.gen(function* () {
      if (progress.phase !== "capability") {
        return;
      }
      const manifest = yield* Effect.promise(() =>
        bunFile(join(root, `${folder}/studio-shaders.json`)).json()
      );
      yield* service.targets(root, {
        ...query,
        generation: "prepared",
        report: plan.scenes.map(({ source: _source, ...scene }) => ({
          ...scene,
          occurrences: 1,
          sourceRevision: manifest.sourceRevision,
        })),
      });
    }).pipe(Effect.orDie);
  const result = await Effect.runPromise(service.insert(root, request, report));
  expect(result.receipt.target.sceneId).toBe("b");
  expect(result.receipt.target.from).toBe(75);
  expect(result.receipt.target.durationInFrames).toBe(153);
  const saved = await bunFile(join(root, `${folder}/studio.json`)).json();
  expect(
    saved.objects.filter((object: { shader?: unknown }) => object.shader)
  ).toHaveLength(1);
  expect(saved.operations).toHaveLength(1);
  expect(
    await bunFile(join(root, `${folder}/studio-origin.json`)).exists()
  ).toBe(false);
  const retry = await Effect.runPromise(service.insert(root, request, report));
  expect(retry.receipt).toEqual(result.receipt);
  expect(
    (await bunFile(join(root, `${folder}/studio.json`)).json()).operations
  ).toHaveLength(1);
});
it("upgrades local runtime re-exports with the provider", async () => {
  await file(
    `${folder}/reader.ts`,
    'export { useStudioObject } from "../../lib/studio-objects-v6";'
  );
  await file(
    `${folder}/index.tsx`,
    `import { useStudioObject } from "./reader";\n${index}`
  );
  const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
  expect(
    plan.edits.find((edit) => edit.path.endsWith("/reader.ts"))?.after
  ).toContain("studio-objects-v7");
});
