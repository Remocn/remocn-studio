import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { file as bunFile } from "bun";
import { Effect, Fiber } from "effect";
import { REMOCN_DIR_ENV, TEMPLATE_DIR_ENV } from "@/shared/ipc";
import type { ShaderInsertRequest, ShaderProgress } from "@/shared/shaders";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import { documentFixture } from "@/test/fixtures/studio-document";
import { hashBytes } from "./config";
import { makeShaderInsertions } from "./shader-insertion";
import { makeShaderJournal, type ShaderJournalRecord } from "./shader-journal";
import {
  checkedShaderTargets,
  planShaderConnection,
  readShaderManifest,
  validateShaderSources,
} from "./shader-targets";

const shaderTargetsModule = await import("./shader-targets");

let root = "";
const template = resolve("templates/remotion");
const prior = process.env[TEMPLATE_DIR_ENV];
const priorRemocn = process.env[REMOCN_DIR_ENV];
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "shader-insertion-"));
  process.env[TEMPLATE_DIR_ENV] = template;
  process.env[REMOCN_DIR_ENV] = resolve("remocn");
  await writeFile(join(root, "package.json"), "{}");
  await mkdir(join(root, "src/videos/intro"), { recursive: true });
  await writeOrigin("1.0.0");
  await writeFile(
    join(root, "src/videos/intro/studio.json"),
    JSON.stringify(documentFixture)
  );
  await cp(
    join(template, "src/lib/studio-objects-v7/legacy-video.tsx.txt"),
    join(root, "src/videos/intro/index.tsx")
  );
  await cp(
    join(template, "src/lib/studio-objects-v5"),
    join(root, "src/lib/studio-objects-v5"),
    { recursive: true }
  );
  await cp(
    join(template, "src/lib/studio-objects-v6"),
    join(root, "src/lib/studio-objects-v6"),
    { recursive: true }
  );
});

function writeOrigin(version: string) {
  return writeFile(
    join(root, "src/videos/intro/studio-origin.json"),
    JSON.stringify({ createdWithStudioVersion: version, version: 1 })
  );
}

describe("persistent shader preparation", () => {
  const content = "export const shader = true;\n";
  const resource = {
    content,
    hash: hashBytes(content),
    path: "src/lib/prepared-shader.ts",
  };
  async function planned(): Promise<ShaderJournalRecord> {
    const connection = await Effect.runPromise(
      planShaderConnection(root, "intro")
    );
    return {
      edits: connection.edits,
      phase: "planned",
      request: {
        objectId: "shader-1",
        operationId: "operation-1",
        slug: "shader-mesh-gradient",
        target: shaderTargetFixture,
      },
      resources: [{ hash: resource.hash, path: resource.path }],
      root,
      version: 1,
    };
  }
  it("resumes prepared resources and partial source activation from a fresh journal service", async () => {
    const data = join(root, "app-data");
    const record = await planned();
    const first = makeShaderJournal(data);
    await Effect.runPromise(first.prepare(record, [resource]));
    const restarted = makeShaderJournal(data);
    const recovered = await Effect.runPromise(
      restarted.read(root, "intro", "operation-1")
    );
    expect(recovered?.phase).toBe("resources");
    expect(await readFile(join(root, resource.path), "utf8")).toBe(content);
    await writeFile(
      join(root, record.edits[0].path),
      record.edits[0].after ?? ""
    );
    await Effect.runPromise(restarted.activate(record));
    expect(
      (await Effect.runPromise(restarted.read(root, "intro", "operation-1")))
        ?.phase
    ).toBe("connected");
    expect(await readFile(join(root, record.edits[1].path), "utf8")).toBe(
      record.edits[1].after
    );
    await Effect.runPromise(restarted.activate(record));
    await Effect.runPromise(restarted.rollback(record));
    expect(await readFile(join(root, record.edits[0].path), "utf8")).toBe(
      record.edits[0].before
    );
    await expect(readFile(join(root, record.edits[1].path))).rejects.toThrow();
    expect(await readFile(join(root, resource.path), "utf8")).toBe(content);
    expect(
      (await Effect.runPromise(restarted.read(root, "intro", "operation-1")))
        ?.phase
    ).toBe("cancelled");
  });
  it("refuses activation before every resource is ready and preserves authored collisions", async () => {
    const journal = makeShaderJournal(join(root, "app-data"));
    const record = await planned();
    await expect(Effect.runPromise(journal.activate(record))).rejects.toThrow(
      "missing or changed"
    );
    expect(await readFile(join(root, record.edits[0].path), "utf8")).toBe(
      record.edits[0].before
    );
    await mkdir(dirname(join(root, resource.path)), { recursive: true });
    await writeFile(join(root, resource.path), "authored resource");
    await expect(
      Effect.runPromise(journal.prepare(record, [resource]))
    ).rejects.toThrow("authored file was preserved");
    expect(await readFile(join(root, resource.path), "utf8")).toBe(
      "authored resource"
    );
  });
  it("rolls back only matching writes and records independently changed files for recovery", async () => {
    const data = join(root, "app-data");
    const journal = makeShaderJournal(data);
    const record = await planned();
    await Effect.runPromise(journal.prepare(record, [resource]));
    await Effect.runPromise(journal.activate(record));
    await writeFile(join(root, record.edits[1].path), "external edit");
    await expect(Effect.runPromise(journal.rollback(record))).rejects.toThrow(
      "changed independently"
    );
    expect(await readFile(join(root, record.edits[0].path), "utf8")).toBe(
      record.edits[0].before
    );
    expect(await readFile(join(root, record.edits[1].path), "utf8")).toBe(
      "external edit"
    );
    const recovered = await Effect.runPromise(
      makeShaderJournal(data).read(root, "intro", "operation-1")
    );
    expect(recovered?.phase).toBe("failed");
    expect(recovered?.error).toContain(record.edits[1].path);
    expect(
      await Effect.runPromise(journal.read(root, "intro", "other-operation"))
    ).toBeNull();
  });
});
afterEach(async () => {
  if (priorRemocn === undefined) {
    delete process.env[REMOCN_DIR_ENV];
  } else {
    process.env[REMOCN_DIR_ENV] = priorRemocn;
  }
  if (prior === undefined) {
    delete process.env[TEMPLATE_DIR_ENV];
  } else {
    process.env[TEMPLATE_DIR_ENV] = prior;
  }
  await rm(root, { force: true, recursive: true });
});

describe("direct shader insertion service", () => {
  const query = {
    generation: "old-preview",
    projectId: "project-1",
    video: "intro",
  };
  async function requestFor(
    service: ReturnType<typeof makeShaderInsertions>
  ): Promise<ShaderInsertRequest> {
    const available = await Effect.runPromise(service.targets(root, query));
    expect(available.adaptation).toBe(true);
    return {
      objectId: "shader-1",
      operationId: "insert-1",
      slug: "shader-mesh-gradient",
      target: available.targets[0],
    };
  }
  const confirm =
    (service: ReturnType<typeof makeShaderInsertions>) =>
    (progress: ShaderProgress) =>
      Effect.gen(function* () {
        if (progress.phase !== "capability") {
          return;
        }
        const manifest = yield* readShaderManifest(root, "intro");
        if (!manifest) {
          throw new Error("Missing activated manifest");
        }
        yield* service
          .targets(root, {
            ...query,
            generation: "prepared-preview",
            report: [
              {
                contract: 1,
                durationInFrames: 150,
                fps: 30,
                from: 0,
                label: "Whole video",
                occurrences: 1,
                sceneId: null,
                slotId: "root-shaders",
                sourceRevision: manifest.sourceRevision,
              },
            ],
          })
          .pipe(Effect.orDie);
      }).pipe(Effect.orDie);

  it("refuses changed creation metadata before preparing dependencies", async () => {
    const prepare = mock(() => Effect.void);
    const service = makeShaderInsertions(join(root, "app-data"), prepare);
    const request = await requestFor(service);
    await writeOrigin("1.1.0");
    await expect(
      Effect.runPromise(service.insert(root, request, confirm(service)))
    ).rejects.toThrow("creation metadata changed");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("resumes insertion with a template descriptor and preserves its exact bytes through the journal", async () => {
    const path = "src/lib/studio-shaders-v1/descriptors/shader-dot-orbit.json";
    const content = await readFile(join(template, path), "utf8");
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
    const data = join(root, "app-data");
    const first = makeShaderInsertions(data, () =>
      Effect.fail({ message: "Offline" })
    );
    const request = { ...(await requestFor(first)), slug: "shader-dot-orbit" };
    await expect(
      Effect.runPromise(first.insert(root, request, confirm(first)))
    ).rejects.toThrow("Offline");
    const journal = makeShaderJournal(data);
    const prepared = await Effect.runPromise(
      journal.read(root, "intro", request.operationId)
    );
    expect(prepared?.resources.find((file) => file.path === path)?.hash).toBe(
      hashBytes(content)
    );
    const restarted = makeShaderInsertions(data, () => Effect.void);
    const result = await Effect.runPromise(
      restarted.insert(root, request, confirm(restarted))
    );
    expect(result.snapshot.document.objects.at(-1)?.shader?.slug).toBe(
      "shader-dot-orbit"
    );
    const second = await Effect.runPromise(
      restarted.insert(
        root,
        {
          ...request,
          objectId: "shader-2",
          operationId: "insert-2",
          target: result.receipt.target,
        },
        confirm(restarted)
      )
    );
    expect(
      second.snapshot.document.objects.filter((object) => object.shader)
    ).toHaveLength(2);
    expect(await readFile(join(root, path), "utf8")).toBe(content);
  });

  it("refuses descriptor changes after preflight even when only formatting changed", async () => {
    const path = "src/lib/studio-shaders-v1/descriptors/shader-dot-orbit.json";
    const content = await readFile(join(template, path), "utf8");
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
    const changed = JSON.stringify(JSON.parse(content));
    const service = makeShaderInsertions(join(root, "app-data"), () =>
      Effect.promise(() => writeFile(join(root, path), changed))
    );
    const request = {
      ...(await requestFor(service)),
      slug: "shader-dot-orbit",
    };
    await expect(
      Effect.runPromise(service.insert(root, request, confirm(service)))
    ).rejects.toThrow("authored file was preserved");
    expect(await readFile(join(root, path), "utf8")).toBe(changed);
    const saved = JSON.parse(
      await readFile(join(root, "src/videos/intro/studio.json"), "utf8")
    );
    expect(saved.operations).toHaveLength(0);
  });

  it.each(["added", "removed"])(
    "refuses %s origin metadata during preparation without replacing it",
    async (change) => {
      const path = join(root, "src/videos/intro/studio-origin.json");
      if (change === "added") {
        await rm(path);
      }
      const before = await readFile(
        join(root, "src/videos/intro/index.tsx"),
        "utf8"
      );
      const service = makeShaderInsertions(join(root, "app-data"), () =>
        Effect.promise(() =>
          change === "added" ? writeOrigin("1.1.0") : rm(path)
        )
      );
      const request = await requestFor(service);
      await expect(
        Effect.runPromise(service.insert(root, request, confirm(service)))
      ).rejects.toThrow("creation metadata changed");
      expect(
        await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")
      ).toBe(before);
      expect(await bunFile(path).exists()).toBe(change === "added");
    }
  );

  it("preserves an external provenance change during preparation and does not activate imports", async () => {
    const before = await readFile(
      join(root, "src/videos/intro/index.tsx"),
      "utf8"
    );
    const service = makeShaderInsertions(join(root, "app-data"), () =>
      Effect.promise(() => writeOrigin("1.1.0"))
    );
    const request = await requestFor(service);
    await expect(
      Effect.runPromise(service.insert(root, request, confirm(service)))
    ).rejects.toThrow("creation metadata changed");
    expect(
      await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")
    ).toBe(before);
    expect(
      JSON.parse(
        await readFile(
          join(root, "src/videos/intro/studio-origin.json"),
          "utf8"
        )
      ).createdWithStudioVersion
    ).toBe("1.1.0");
    expect(
      JSON.parse(
        await readFile(join(root, "src/videos/intro/studio.json"), "utf8")
      ).operations
    ).toHaveLength(0);
  });

  it("rechecks the creation floor when resuming an uncommitted journal", async () => {
    const data = join(root, "app-data");
    const first = makeShaderInsertions(data, () =>
      Effect.fail({ message: "Offline" })
    );
    const request = await requestFor(first);
    await expect(
      Effect.runPromise(first.insert(root, request, confirm(first)))
    ).rejects.toThrow("Offline");
    const journal = makeShaderJournal(data);
    const record = await Effect.runPromise(
      journal.read(root, "intro", request.operationId)
    );
    if (!record) {
      throw new Error("Missing journal");
    }
    await Effect.runPromise(journal.save({ ...record, phase: "planned" }));
    await writeOrigin("0.9.9");
    const prepare = mock(() => Effect.void);
    const restarted = makeShaderInsertions(data, prepare);
    await expect(
      Effect.runPromise(restarted.insert(root, request, confirm(restarted)))
    ).rejects.toThrow("created with Studio 0.9.9");
    expect(prepare).not.toHaveBeenCalled();
    expect(
      (
        await Effect.runPromise(
          restarted.status(root, "intro", request.operationId)
        )
      ).state
    ).toBe("failed");
  });

  it("prepares, adapts, confirms and commits once, then reconciles the saved result after a service restart", async () => {
    const data = join(root, "app-data");
    const service = makeShaderInsertions(data, () => Effect.void);
    const request = await requestFor(service);
    const result = await Effect.runPromise(
      service.insert(root, request, confirm(service))
    );
    expect(result.receipt).toMatchObject({
      objectId: "shader-1",
      operationId: "insert-1",
      target: { generation: "prepared-preview" },
    });
    expect(result.snapshot.document.objects.at(-1)?.shader?.slug).toBe(
      "shader-mesh-gradient"
    );
    const restarted = makeShaderInsertions(data, () =>
      Effect.die("Must not install on retry")
    );
    expect(
      await Effect.runPromise(restarted.status(root, "intro", "insert-1"))
    ).toEqual({ result, state: "saved" });
    expect(
      await Effect.runPromise(
        restarted.insert(root, request, () => Effect.void)
      )
    ).toEqual(result);
    await expect(
      Effect.runPromise(
        restarted.insert(
          root,
          { ...request, objectId: "different-id" },
          () => Effect.void
        )
      )
    ).rejects.toThrow("different request");
    const saved = JSON.parse(
      await readFile(join(root, "src/videos/intro/studio.json"), "utf8")
    );
    expect(saved.operations).toHaveLength(1);
    expect(
      await readFile(join(root, "src/videos/intro/shader-registry.ts"), "utf8")
    ).toContain("MeshGradientAdapter");
  });

  it("inserts different Paper and custom shaders into the same video without replacing earlier instances", async () => {
    const service = makeShaderInsertions(
      join(root, "app-data"),
      () => Effect.void
    );
    const request = await requestFor(service);
    let result = await Effect.runPromise(
      service.insert(root, request, confirm(service))
    );
    const first = result.snapshot.document.objects.at(-1);
    const mesh = await readFile(
      join(root, "src/lib/studio-shaders-v1/mesh-gradient.tsx"),
      "utf8"
    );
    for (const slug of [
      "shader-perlin-noise",
      "shader-water",
      "shader-caustics",
      "shader-light-tunnel",
    ]) {
      // biome-ignore lint/performance/noAwaitInLoops: Each insertion uses the preceding verified source revision.
      result = await Effect.runPromise(
        service.insert(
          root,
          {
            objectId: slug,
            operationId: `insert-${slug}`,
            slug,
            target: result.receipt.target,
          },
          confirm(service)
        )
      );
      expect(result.snapshot.document.objects.at(-1)?.shader?.slug).toBe(slug);
      expect(
        result.snapshot.document.objects.find(
          (object) => object.id === first?.id
        )
      ).toEqual(first);
    }
    expect(
      result.snapshot.document.objects.filter((object) => object.shader)
    ).toHaveLength(5);
    expect(
      await readFile(
        join(root, "src/lib/studio-shaders-v1/mesh-gradient.tsx"),
        "utf8"
      )
    ).toBe(mesh);
    const registry = await readFile(
      join(root, "src/videos/intro/shader-registry.ts"),
      "utf8"
    );
    for (const name of [
      "MeshGradient",
      "PerlinNoise",
      "Water",
      "Caustics",
      "LightTunnel",
    ]) {
      expect(registry).toContain(`${name}Adapter`);
    }
  });

  it("adds a provenance check when resuming a journal written before version gating", async () => {
    const data = join(root, "app-data");
    const first = makeShaderInsertions(data, () =>
      Effect.fail({ message: "Offline" })
    );
    const request = await requestFor(first);
    await expect(
      Effect.runPromise(first.insert(root, request, confirm(first)))
    ).rejects.toThrow("Offline");
    const journal = makeShaderJournal(data);
    const record = await Effect.runPromise(
      journal.read(root, "intro", request.operationId)
    );
    if (!record) {
      throw new Error("Missing journal");
    }
    await Effect.runPromise(
      journal.save({
        ...record,
        edits: record.edits.filter(
          (edit) => !edit.path.endsWith("/studio-origin.json")
        ),
        phase: "planned",
      })
    );
    const restarted = makeShaderInsertions(data, () => Effect.void);
    const result = await Effect.runPromise(
      restarted.insert(root, request, confirm(restarted))
    );
    expect(result.receipt.objectId).toBe(request.objectId);
    const committed = await Effect.runPromise(
      journal.read(root, "intro", request.operationId)
    );
    expect(
      committed?.edits.some(
        (edit) =>
          edit.path.endsWith("/studio-origin.json") &&
          edit.before === edit.after
      )
    ).toBe(true);
  });

  it("does not commit if provenance changes after the prepared preview is confirmed", async () => {
    const data = join(root, "app-data");
    const service = makeShaderInsertions(data, () => Effect.void);
    const request = await requestFor(service);
    const progress = (event: ShaderProgress) =>
      Effect.gen(function* () {
        yield* confirm(service)(event);
        if (event.phase === "commit") {
          yield* Effect.promise(() => writeOrigin("0.9.9"));
        }
      });
    await expect(
      Effect.runPromise(service.insert(root, request, progress))
    ).rejects.toThrow("created with Studio 0.9.9");
    expect(
      JSON.parse(
        await readFile(join(root, "src/videos/intro/studio.json"), "utf8")
      ).operations
    ).toHaveLength(0);
    expect(
      (
        await Effect.runPromise(
          service.status(root, "intro", request.operationId)
        )
      ).state
    ).toBe("failed");
  });
  it.each(["empty", "stale", "valid"])(
    "adds a second shader after a delayed %s report from the previous preview",
    async (kind) => {
      const service = makeShaderInsertions(
        join(root, "app-data"),
        () => Effect.void
      );
      const first = await requestFor(service);
      const inserted = await Effect.runPromise(
        service.insert(root, first, confirm(service))
      );
      const report = { ...inserted.receipt.target, occurrences: 1 };
      let release: () => void = () => undefined;
      let started: () => void = () => undefined;
      const held = new Promise<void>((done) => {
        release = done;
      });
      const entered = new Promise<void>((done) => {
        started = done;
      });
      const original = shaderTargetsModule.planShaderConnection;
      let delay = true;
      const plan = spyOn(
        shaderTargetsModule,
        "planShaderConnection"
      ).mockImplementation((...args) =>
        original(...args).pipe(
          Effect.flatMap((value) => {
            if (!delay) {
              return Effect.succeed(value);
            }
            delay = false;
            started();
            return Effect.promise(() => held).pipe(Effect.as(value));
          })
        )
      );
      try {
        const obsolete = Effect.runPromiseExit(
          service.targets(root, {
            ...query,
            generation: "prepared-preview",
            report:
              kind === "empty"
                ? []
                : [
                    {
                      ...report,
                      sourceRevision:
                        kind === "stale" ? "obsolete" : report.sourceRevision,
                    },
                  ],
          })
        );
        await entered;
        const latest = await Effect.runPromise(
          service.targets(root, {
            ...query,
            generation: "after-first-insertion",
            report: [report],
          })
        );
        release();
        await obsolete;
        const second = await Effect.runPromise(
          service.insert(
            root,
            {
              objectId: "shader-2",
              operationId: "insert-2",
              slug: "shader-perlin-noise",
              target: latest.targets[0],
            },
            confirm(service)
          )
        );
        expect(
          second.snapshot.document.objects.filter((object) => object.shader)
        ).toHaveLength(2);
      } finally {
        release();
        plan.mockRestore();
      }
    }
  );
  it("refuses a stale target and a source conflict before dependency preparation", async () => {
    let installs = 0;
    const service = makeShaderInsertions(join(root, "app-data"), () =>
      Effect.sync(() => {
        installs += 1;
      })
    );
    const request = await requestFor(service);
    await expect(
      Effect.runPromise(
        service.insert(
          root,
          { ...request, target: { ...request.target, generation: "stale" } },
          () => Effect.void
        )
      )
    ).rejects.toThrow("target scene changed");
    await writeFile(
      join(root, "src/videos/intro/index.tsx"),
      "authored source"
    );
    await expect(
      Effect.runPromise(service.insert(root, request, () => Effect.void))
    ).rejects.toThrow("no verified shader slot");
    expect(installs).toBe(0);
  });
  it("cancels before commit, leaves no active instance and can retry the same identity", async () => {
    const data = join(root, "app-data");
    const before = await readFile(
      join(root, "src/videos/intro/index.tsx"),
      "utf8"
    );
    const service = makeShaderInsertions(data, () => Effect.void);
    const request = await requestFor(service);
    let reached: () => void = () => undefined;
    const waiting = new Promise<void>((resolveWaiting) => {
      reached = resolveWaiting;
    });
    const fiber = Effect.runFork(
      service.insert(root, request, (progress) => {
        if (progress.phase === "capability") {
          reached();
          return Effect.never;
        }
        return Effect.void;
      })
    );
    await waiting;
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(
      await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")
    ).toBe(before);
    expect(
      JSON.parse(
        await readFile(join(root, "src/videos/intro/studio.json"), "utf8")
      ).operations
    ).toEqual([]);
    expect(
      (await Effect.runPromise(service.status(root, "intro", "insert-1"))).state
    ).toBe("failed");
    const retried = await Effect.runPromise(
      service.insert(root, request, confirm(service))
    );
    expect(retried.receipt.objectId).toBe("shader-1");
  });
});
describe("shader connection preflight", () => {
  it.each(["0.9.9", "1.0.0-alpha.1", "1.0.0-rc.1"])(
    "refuses creation with %s without changing the video",
    async (version) => {
      await writeOrigin(version);
      const before = await readFile(
        join(root, "src/videos/intro/index.tsx"),
        "utf8"
      );
      await expect(
        Effect.runPromise(planShaderConnection(root, "intro"))
      ).rejects.toThrow("requires creation with Studio 1.0.0");
      expect(
        await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")
      ).toBe(before);
    }
  );
  it.each(["1.0.0", "1.0.0+build.8", "1.0.1", "1.10.0", "2.0.0-beta.1"])(
    "allows a verified template created with %s",
    async (version) => {
      await writeOrigin(version);
      expect(
        (await Effect.runPromise(planShaderConnection(root, "intro")))
          .adaptation
      ).toBe(true);
    }
  );
  it("accepts missing provenance through structural compatibility and refuses invalid metadata", async () => {
    await rm(join(root, "src/videos/intro/studio-origin.json"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ version: "99.0.0" })
    );
    const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
    expect(plan.adaptation).toBe(true);
    expect(
      await bunFile(join(root, "src/videos/intro/studio-origin.json")).exists()
    ).toBe(false);
    await writeOrigin("1.0");
    await expect(
      Effect.runPromise(planShaderConnection(root, "intro"))
    ).rejects.toThrow("creation metadata is invalid");
  });
  it("plans a slot between Backdrop and headings and upgrades all local managed imports without writing", async () => {
    const before = await readFile(
      join(root, "src/videos/intro/index.tsx"),
      "utf8"
    );
    const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
    expect(plan.adaptation).toBe(true);
    expect(plan.durationInFrames).toBe(150);
    const after = plan.edits[0].after ?? "";
    expect(after.indexOf("<Backdrop />")).toBeLessThan(
      after.indexOf("<StudioShaderSlot")
    );
    expect(after.indexOf("<StudioShaderSlot")).toBeLessThan(
      after.indexOf('<Heading id="heading"')
    );
    expect(after).toContain("studio-objects-v7");
    expect(after).not.toContain("studio-objects-v6");
    expect(after).toContain("const { durationInFrames } = useVideoConfig();");
    expect(
      await readFile(join(root, "src/videos/intro/index.tsx"), "utf8")
    ).toBe(before);
  });
  it("accepts the template's stamped dimensions and duration without fixing the slot to the playhead", async () => {
    const path = join(root, "src/videos/intro/index.tsx");
    const source = await readFile(path, "utf8");
    await writeFile(
      path,
      source
        .replace("width: 1920", "width: 1080")
        .replace("height: 1080", "height: 1920")
        .replace("durationInFrames: 150", "durationInFrames: 240")
        .replace("fps: 30", "fps: 24")
    );
    const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
    expect(plan.durationInFrames).toBe(240);
    expect(plan.fps).toBe(24);
  });
  it("refuses arbitrary JSX, external hook consumers and modified old runtimes without source writes", async () => {
    const path = join(root, "src/videos/intro/index.tsx");
    const source = await readFile(path, "utf8");
    const changed = source.replace(
      "<Backdrop />",
      "<Backdrop /><SharedTitle />"
    );
    await writeFile(path, changed);
    await expect(
      Effect.runPromise(planShaderConnection(root, "intro"))
    ).rejects.toThrow("no verified shader slot");
    expect(await readFile(path, "utf8")).toBe(changed);
    await writeFile(
      path,
      source.replace(
        'import document from "./studio.json";',
        'import document from "./studio.json";\nimport { SharedTitle } from "../../components/shared-title";'
      )
    );
    await expect(
      Effect.runPromise(planShaderConnection(root, "intro"))
    ).rejects.toThrow("no verified shader slot");
    await writeFile(path, source);
    await writeFile(
      join(root, "src/lib/studio-objects-v5/index.tsx"),
      "authored runtime"
    );
    await expect(
      Effect.runPromise(planShaderConnection(root, "intro"))
    ).rejects.toThrow("missing or modified");
    expect(await readFile(path, "utf8")).toBe(source);
  });
  it("reuses declared slots only while their bound source hashes still match", async () => {
    const plan = await Effect.runPromise(planShaderConnection(root, "intro"));
    await Promise.all(
      plan.edits.map(async (edit) => {
        await mkdir(dirname(join(root, edit.path)), { recursive: true });
        if (edit.after !== null) {
          await writeFile(join(root, edit.path), edit.after);
        }
      })
    );
    await writeFile(
      join(root, "src/videos/intro/studio-shaders.json"),
      JSON.stringify(plan.manifest)
    );
    const manifest = await Effect.runPromise(readShaderManifest(root, "intro"));
    expect(manifest).toEqual(plan.manifest);
    await rm(join(root, "src/videos/intro/studio-origin.json"));
    expect(
      (await Effect.runPromise(planShaderConnection(root, "intro"))).edits
    ).toEqual([]);
    await writeFile(join(root, plan.edits[0].path), "edited after connecting");
    await expect(
      Effect.runPromise(validateShaderSources(root, plan.manifest))
    ).rejects.toThrow("changed since");
    await expect(
      Effect.runPromise(planShaderConnection(root, "../elsewhere"))
    ).rejects.toThrow("valid Studio video");
  });
  it("checks slot identity, duplicate occurrences, removed scenes and source revisions", async () => {
    const { manifest } = await Effect.runPromise(
      planShaderConnection(root, "intro")
    );
    const report = {
      contract: 1 as const,
      durationInFrames: 150,
      fps: 30,
      from: 0,
      label: "Whole video",
      occurrences: 1,
      sceneId: null,
      slotId: "root-shaders",
      sourceRevision: manifest.sourceRevision,
    };
    expect(
      checkedShaderTargets(
        "project",
        documentFixture,
        manifest,
        "generation-1",
        [report]
      )[0]
    ).toMatchObject({
      generation: "generation-1",
      projectId: "project",
      slotId: "root-shaders",
      video: "intro",
    });
    expect(() =>
      checkedShaderTargets("project", documentFixture, manifest, "g", [
        { ...report, occurrences: 2 },
      ])
    ).toThrow("more than once");
    expect(() =>
      checkedShaderTargets("project", documentFixture, manifest, "g", [
        report,
        report,
      ])
    ).toThrow("more than once");
    expect(() =>
      checkedShaderTargets("project", documentFixture, manifest, "g", [
        { ...report, sourceRevision: "stale" },
      ])
    ).toThrow("stale");
    const sceneManifest = {
      ...manifest,
      slots: [{ ...manifest.slots[0], sceneId: "scene-1" }],
    };
    const sceneReport = { ...report, sceneId: "scene-1" };
    expect(() =>
      checkedShaderTargets("project", documentFixture, sceneManifest, "g", [
        sceneReport,
      ])
    ).toThrow("missing or removed");
    const document = {
      ...documentFixture,
      objects: [
        ...documentFixture.objects,
        {
          definition: "scene",
          id: "scene-1",
          label: "Opening",
          parentId: null,
          removed: true as const,
          values: {},
        },
      ],
    };
    expect(() =>
      checkedShaderTargets("project", document, sceneManifest, "g", [
        sceneReport,
      ])
    ).toThrow("missing or removed");
  });
});
