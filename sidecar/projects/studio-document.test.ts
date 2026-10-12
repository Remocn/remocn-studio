import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { MESH_GRADIENT, shaderCreation } from "@/shared/shaders";
import { inverseStudioOperation } from "@/shared/studio-document";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import {
  documentFixture,
  easingDocumentFixture,
  operationFixture,
} from "@/test/fixtures/studio-document";
import { ShaderError } from "../library/shaders";
import {
  commitStudioCreation,
  readStudioDocument,
  removeStudioObject,
  writeStudioDocument,
} from "./studio-document";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-objects-"));
  file = join(root, "src/videos/intro/studio.json");
  await mkdir(join(root, "src/videos/intro"), { recursive: true });
  await writeFile(join(root, "package.json"), "{}");
  await writeFile(file, JSON.stringify(documentFixture));
});
afterEach(() => rm(root, { force: true, recursive: true }));

describe("prepared shader creation persistence", () => {
  const creation = shaderCreation(
    MESH_GRADIENT,
    shaderTargetFixture,
    "insert-1",
    "shader-1",
    0
  );
  it("writes the complete object and receipt once, reconciles a lost reply, and preserves unrelated edits on Undo", async () => {
    const saved = await Effect.runPromise(
      commitStudioCreation(
        root,
        "intro",
        creation,
        Effect.succeed(shaderTargetFixture)
      )
    );
    expect(saved.document.objects.at(-1)?.id).toBe("shader-1");
    const edited = await Effect.runPromise(
      writeStudioDocument(root, "intro", operationFixture())
    );
    const retry = await Effect.runPromise(
      commitStudioCreation(
        root,
        "intro",
        creation,
        Effect.fail(new ShaderError({ message: "stale report" }))
      )
    );
    expect(retry).toEqual(edited);
    expect(
      retry.document.operations.filter(
        (operation) => operation.id === creation.id
      )
    ).toHaveLength(1);
    const undone = await Effect.runPromise(
      writeStudioDocument(
        root,
        "intro",
        inverseStudioOperation(creation, "undo-insert")
      )
    );
    expect(undone.document.objects.at(-1)?.removed).toBe(true);
    expect(
      undone.document.objects.find((object) => object.id === "third")?.values
        .size
    ).toBe(72);
    expect(undone.document.definitions).toEqual(saved.document.definitions);
  });
  it("refuses generic creation, stale final targets and changed retry payloads without saving", async () => {
    const before = await readFile(file, "utf8");
    await expect(
      Effect.runPromise(writeStudioDocument(root, "intro", creation))
    ).rejects.toThrow("prepared insertion request");
    await expect(
      Effect.runPromise(
        commitStudioCreation(
          root,
          "intro",
          creation,
          Effect.succeed({ ...shaderTargetFixture, generation: "new" })
        )
      )
    ).rejects.toThrow("target changed");
    expect(await readFile(file, "utf8")).toBe(before);
    await Effect.runPromise(
      commitStudioCreation(
        root,
        "intro",
        creation,
        Effect.succeed(shaderTargetFixture)
      )
    );
    await expect(
      Effect.runPromise(
        commitStudioCreation(
          root,
          "intro",
          { ...creation, object: { ...creation.object, label: "Other" } },
          Effect.succeed(shaderTargetFixture)
        )
      )
    ).rejects.toThrow("different change");
  });
});

describe("managed document persistence", () => {
  it("persists receipts with values and accepts a retry after rereading the file", async () => {
    const first = await Effect.runPromise(
      writeStudioDocument(root, "intro", operationFixture())
    );
    const retry = await Effect.runPromise(
      writeStudioDocument(root, "intro", operationFixture())
    );
    expect(retry).toEqual(first);
    const read = await Effect.runPromise(readStudioDocument(root, "intro"));
    expect(read.document.objects[2].values.size).toBe(72);
    expect(read.document.operations).toHaveLength(1);
  });

  it("serializes independent edits and refuses the second conflicting write", async () => {
    await Promise.all([
      Effect.runPromise(writeStudioDocument(root, "intro", operationFixture())),
      Effect.runPromise(
        writeStudioDocument(
          root,
          "intro",
          operationFixture({ after: 90, id: "other", objectId: "first" })
        )
      ),
    ]);
    const contents = await readFile(file, "utf8");
    await expect(
      Effect.runPromise(
        writeStudioDocument(root, "intro", operationFixture({ id: "conflict" }))
      )
    ).rejects.toThrow("changed elsewhere");
    expect(await readFile(file, "utf8")).toBe(contents);
  });

  it("refuses malformed documents, traversal and symlink targets without changing them", async () => {
    await expect(
      Effect.runPromise(readStudioDocument(root, "../intro"))
    ).rejects.toThrow("Choose a Studio video");
    await writeFile(file, "{");
    await expect(
      Effect.runPromise(writeStudioDocument(root, "intro", operationFixture()))
    ).rejects.toThrow("not valid JSON");
    expect(await readFile(file, "utf8")).toBe("{");
    await rm(file);
    await symlink(join(root, "package.json"), file);
    await expect(
      Effect.runPromise(readStudioDocument(root, "intro"))
    ).rejects.toThrow();
  });
});

it("persists custom curves atomically and accepts a serialized retry", async () => {
  await writeFile(file, JSON.stringify(easingDocumentFixture));
  const operation = {
    after: [0.2, -0.5, 0.8, 1.5] as const,
    before: [0, 0, 0.58, 1] as const,
    definition: easingDocumentFixture.definitions[0],
    field: "entryEasing",
    id: "curve-save",
    objectId: "title",
  };
  await Effect.runPromise(writeStudioDocument(root, "intro", operation));
  const retried = await Effect.runPromise(
    writeStudioDocument(root, "intro", structuredClone(operation))
  );
  expect(retried.document.objects[0].values.entryEasing).toEqual(
    operation.after
  );
  expect(retried.document.operations).toHaveLength(1);
});

describe("removing an object", () => {
  const TEMPLATE = fileURLToPath(
    new URL("../../templates/remotion", import.meta.url)
  );
  const remove = {
    id: "remove-first",
    kind: "remove",
    objectId: "first",
  } as const;
  const V5 =
    'import { StudioObjects, useStudioObject } from "../../lib/studio-objects-v5";\nimport { geometryBetween } from "../../lib/studio-objects-v5/between";\nimport document from "./studio.json";\n';
  const entry = () => join(root, "src/videos/intro/index.tsx");
  const scene = () => join(root, "src/videos/intro/Scene.tsx");

  beforeEach(async () => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
    await writeFile(entry(), V5);
    await writeFile(
      scene(),
      'import { useStudioObject } from "../../lib/studio-objects-v5";\n'
    );
  });

  it("upgrades a v5 video's provider import and marks the record", async () => {
    const removed = await Effect.runPromise(
      removeStudioObject(root, "intro", remove)
    );
    expect(removed.upgraded).toBe("src/videos/intro/index.tsx");
    expect(removed.document.objects[0].removed).toBe(true);
    expect(await readFile(entry(), "utf8")).toBe(
      V5.replace(
        '"../../lib/studio-objects-v5";\nimport { geometryBetween }',
        '"../../lib/studio-objects-v6";\nimport { geometryBetween }'
      )
    );
    expect(await readFile(scene(), "utf8")).toContain("studio-objects-v5");
    expect(
      await readFile(join(root, "src/lib/studio-objects-v6/index.tsx"), "utf8")
    ).toContain('data-studio-runtime="6"');
    const read = await Effect.runPromise(readStudioDocument(root, "intro"));
    expect(read.document.objects[0].removed).toBe(true);
    expect(read.revision).toBe(removed.revision);
  });

  it.each([6, 7])(
    "writes only the document for a video already on v%s, and once on retry",
    async (version) => {
      const v6 = V5.replace(
        'studio-objects-v5"',
        `studio-objects-v${version}"`
      );
      await writeFile(entry(), v6);
      const first = await Effect.runPromise(
        removeStudioObject(root, "intro", remove)
      );
      const retried = await Effect.runPromise(
        removeStudioObject(root, "intro", remove)
      );
      expect(first.upgraded).toBeNull();
      expect(retried.document.operations).toHaveLength(1);
      expect(await readFile(entry(), "utf8")).toBe(v6);
    }
  );

  it("refuses a video with no provider or two, and writes nothing", async () => {
    const before = await readFile(file, "utf8");
    await writeFile(entry(), 'import document from "./studio.json";\n');
    await expect(
      Effect.runPromise(removeStudioObject(root, "intro", remove))
    ).rejects.toThrow("does not load its objects through the studio's runtime");
    await writeFile(entry(), V5);
    await writeFile(
      scene(),
      'import { StudioObjects as Objects } from "../../lib/studio-objects-v5";\n'
    );
    await expect(
      Effect.runPromise(removeStudioObject(root, "intro", remove))
    ).rejects.toThrow("more than one place");
    expect(await readFile(file, "utf8")).toBe(before);
    expect(await readFile(entry(), "utf8")).toBe(V5);
  });

  it("refuses a runtime older than v5", async () => {
    await writeFile(
      entry(),
      V5.replace('studio-objects-v5"', 'studio-objects-v4"')
    );
    await expect(
      Effect.runPromise(removeStudioObject(root, "intro", remove))
    ).rejects.toThrow("too old to delete objects");
  });

  it("puts the provider back when the document cannot be written", async () => {
    const before = await readFile(file, "utf8");
    await chmod(join(root, "src/videos/intro"), 0o555);
    try {
      await expect(
        Effect.runPromise(removeStudioObject(root, "intro", remove))
      ).rejects.toThrow();
    } finally {
      await chmod(join(root, "src/videos/intro"), 0o755);
    }
    expect(await readFile(file, "utf8")).toBe(before);
    expect(await readFile(entry(), "utf8")).toBe(V5);
  });

  it("leaves everything as it was when the provider cannot be rewritten", async () => {
    const before = await readFile(file, "utf8");
    await chmod(entry(), 0o444);
    try {
      await expect(
        Effect.runPromise(removeStudioObject(root, "intro", remove))
      ).rejects.toThrow("could not be upgraded");
    } finally {
      await chmod(entry(), 0o644);
    }
    expect(await readFile(file, "utf8")).toBe(before);
    expect(await readFile(entry(), "utf8")).toBe(V5);
  });
});
