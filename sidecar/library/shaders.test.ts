// biome-ignore-all lint/performance/noAwaitInLoops: Verify shared resources in installation order.
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Effect } from "effect";
import { REMOCN_DIR_ENV, TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { MESH_GRADIENT, SHADER_DESCRIPTORS } from "@/shared/shaders";
import { hashBytes } from "../projects/config";
import { listBundled } from "./bundled";
import {
  checkShaderResources,
  listShaders,
  shaderDescriptor,
  shaderResourcePlan,
} from "./shaders";

let folder = "";
const prior = {
  remocn: process.env[REMOCN_DIR_ENV],
  template: process.env[TEMPLATE_DIR_ENV],
};
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "studio-shaders-"));
  process.env[REMOCN_DIR_ENV] = resolve("remocn");
  process.env[TEMPLATE_DIR_ENV] = resolve("templates/remotion");
});
afterEach(async () => {
  if (prior.remocn === undefined) {
    delete process.env[REMOCN_DIR_ENV];
  } else {
    process.env[REMOCN_DIR_ENV] = prior.remocn;
  }
  if (prior.template === undefined) {
    delete process.env[TEMPLATE_DIR_ENV];
  } else {
    process.env[TEMPLATE_DIR_ENV] = prior.template;
  }
  await rm(folder, { force: true, recursive: true });
});
describe("shader resources", () => {
  it("reuses template descriptor JSON without rewriting its formatting or key order", async () => {
    for (const descriptor of SHADER_DESCRIPTORS) {
      if (descriptor.slug === MESH_GRADIENT.slug) {
        continue;
      }
      const plan = await Effect.runPromise(shaderResourcePlan(descriptor.slug));
      const path = `src/lib/studio-shaders-v1/descriptors/${descriptor.slug}.json`;
      const content = await readFile(
        resolve("templates/remotion", path),
        "utf8"
      );
      await mkdir(dirname(join(folder, path)), { recursive: true });
      await writeFile(join(folder, path), content);
      const checked = await Effect.runPromise(
        checkShaderResources(folder, plan)
      );
      expect(checked.find((file) => file.path === path)).toEqual({
        content,
        hash: hashBytes(content),
        path,
        reused: true,
      });
      expect(await readFile(join(folder, path), "utf8")).toBe(content);
    }
  });

  it.each(["default", "revision", "extra", "order", "malformed"])(
    "preserves and refuses a descriptor with a changed %s",
    async (change) => {
      const plan = await Effect.runPromise(
        shaderResourcePlan("shader-dot-orbit")
      );
      const path =
        "src/lib/studio-shaders-v1/descriptors/shader-dot-orbit.json";
      const descriptor = JSON.parse(JSON.stringify(plan.descriptor));
      if (change === "default") {
        descriptor.definition.fields[0].default = "authored";
      } else if (change === "revision") {
        descriptor.revision = "older-revision";
      } else if (change === "extra") {
        descriptor.authored = true;
      } else if (change === "order") {
        descriptor.definition.fields.reverse();
      }
      const content = change === "malformed" ? "{" : JSON.stringify(descriptor);
      await mkdir(dirname(join(folder, path)), { recursive: true });
      await writeFile(join(folder, path), content);
      await expect(
        Effect.runPromise(checkShaderResources(folder, plan))
      ).rejects.toThrow("authored shader resource");
      expect(await readFile(join(folder, path), "utf8")).toBe(content);
    }
  );

  it("covers every shipped shader with self-contained, compatible resource plans", async () => {
    const assets = (await Effect.runPromise(listBundled())).filter(
      (asset) => asset.category === "Shaders"
    );
    const descriptors = (await Effect.runPromise(listShaders())).map(
      (entry) => entry.descriptor
    );
    expect(descriptors).toHaveLength(23);
    expect(descriptors.map((d) => `remocn/${d.slug}`).sort()).toEqual(
      assets.map((a) => a.slug).sort()
    );
    const shared = new Map<string, string>();
    for (const descriptor of SHADER_DESCRIPTORS) {
      const plan = await Effect.runPromise(shaderResourcePlan(descriptor.slug));
      const adapter = plan.files.find((file) =>
        file.path.endsWith(`/${descriptor.slug.slice(7)}.tsx`)
      );
      expect(adapter?.content).toContain(`${descriptor.exportName}Adapter`);
      const snapshot = plan.files.find((file) =>
        file.path.endsWith(`/descriptors/${descriptor.slug}.json`)
      );
      if (!snapshot) {
        throw new Error(`Missing snapshot: ${descriptor.slug}`);
      }
      expect(JSON.parse(snapshot.content)).toEqual(descriptor);
      if (descriptor.slug !== MESH_GRADIENT.slug) {
        expect(
          JSON.parse(
            await readFile(resolve("templates/remotion", snapshot.path), "utf8")
          )
        ).toEqual(descriptor);
      }
      for (const file of plan.files) {
        const previous = shared.get(file.path);
        if (previous) {
          expect(file.hash).toBe(previous);
        }
        shared.set(file.path, file.hash);
        if (file.path.includes("/upstream/")) {
          continue;
        }
        for (const match of file.content.matchAll(
          /from\s+["'](\.[^"']+)["']/g
        )) {
          const imported = join(dirname(file.path), match[1]);
          expect(
            plan.files.some((candidate) =>
              [
                imported,
                `${imported}.ts`,
                `${imported}.tsx`,
                `${imported}/index.tsx`,
              ].includes(candidate.path)
            )
          ).toBe(true);
        }
      }
    }
  });
  it("uses existing bundled asset references and versioned descriptor snapshots", async () => {
    const entries = await Effect.runPromise(listShaders());
    expect(entries[0].asset.slug).toBe(`remocn/${MESH_GRADIENT.slug}`);
    expect(entries[0].descriptor).toEqual(MESH_GRADIENT);
    const plan = await Effect.runPromise(
      shaderResourcePlan(MESH_GRADIENT.slug)
    );
    expect(plan.packages).toEqual([
      "@paper-design/shaders",
      "@paper-design/shaders-react",
    ]);
    expect(
      plan.files.find((file) =>
        file.path.endsWith(`/descriptors/${MESH_GRADIENT.slug}.json`)
      )?.content
    ).toContain(MESH_GRADIENT.revision);
    expect(plan.files.every((file) => file.path.startsWith("src/lib/"))).toBe(
      true
    );
    expect(
      plan.files.some((file) =>
        file.path.endsWith("upstream/shader-mesh-gradient.tsx")
      )
    ).toBe(true);
  });
  it("refuses a missing descriptor or missing bundled entry", async () => {
    await expect(
      Effect.runPromise(shaderDescriptor("not-a-shader"))
    ).rejects.toThrow("supported Studio adapter");
    process.env[REMOCN_DIR_ENV] = folder;
    await expect(Effect.runPromise(listShaders())).rejects.toThrow("missing");
    await expect(
      Effect.runPromise(shaderResourcePlan(MESH_GRADIENT.slug))
    ).rejects.toThrow();
  });
  it("reuses matching files and refuses authored collisions before making writes", async () => {
    const plan = await Effect.runPromise(
      shaderResourcePlan(MESH_GRADIENT.slug)
    );
    const [file] = plan.files;
    expect(
      (await Effect.runPromise(checkShaderResources(folder, plan))).every(
        (entry) => !entry.reused
      )
    ).toBe(true);
    await mkdir(dirname(join(folder, file.path)), { recursive: true });
    await writeFile(join(folder, file.path), file.content);
    expect(
      (await Effect.runPromise(checkShaderResources(folder, plan)))[0].reused
    ).toBe(true);
    await writeFile(join(folder, file.path), "authored runtime");
    await expect(
      Effect.runPromise(checkShaderResources(folder, plan))
    ).rejects.toThrow("authored shader resource");
    expect(await readFile(join(folder, file.path), "utf8")).toBe(
      "authored runtime"
    );
  });
});
