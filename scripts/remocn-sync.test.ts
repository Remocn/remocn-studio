import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BundleLock, syncCaptions } from "./remocn-captions";
import { CAPTION_NAMES, CAPTIONS_PIN } from "./remocn-sources";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  );
});
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "caption-sync-"));
  dirs.push(dir);
  const source = "export const Existing = 42;\n";
  const manifest = JSON.stringify({
    files: [{ file: "existing.ts", target: "src/components/existing.ts" }],
  });
  await mkdir(join(dir, "registry/existing"), { recursive: true });
  await writeFile(join(dir, "registry/existing/existing.ts"), source);
  await writeFile(join(dir, "registry/existing/manifest.json"), manifest);
  await writeFile(
    join(dir, "index.json"),
    JSON.stringify({ categories: ["Effects"], components: ["existing"] })
  );
  await writeFile(
    join(dir, "lock.json"),
    JSON.stringify({
      files: {
        "registry/existing/existing.ts": hash(source),
        "registry/existing/manifest.json": hash(manifest),
      },
      pin: "old",
    })
  );
  return dir;
}
function reader(conflict = false) {
  return (path: string): Promise<string> => {
    if (path === "registry/__manifest__.ts") {
      return Promise.resolve("export default {};");
    }
    const name = path.replace("registry-artifacts/", "").replace(".json", "");
    return Promise.resolve(
      JSON.stringify({
        files: [
          {
            content: `export const value = ${JSON.stringify(name)};`,
            target: conflict
              ? "components/existing.ts"
              : `components/${name}.tsx`,
          },
        ],
        name,
        registryDependencies:
          name === "caption-core" ? [] : ["@remocn/caption-core"],
      })
    );
  };
}
describe("caption batch vendoring", () => {
  it("adds the exact set and hidden dependency without changing old hashes, and is reproducible", async () => {
    const dir = await fixture();
    const before = await readFile(
      join(dir, "registry/existing/existing.ts"),
      "utf8"
    );
    await syncCaptions(dir, reader());
    const first = await readFile(join(dir, "lock.json"), "utf8");
    await syncCaptions(dir, reader());
    expect(await readFile(join(dir, "lock.json"), "utf8")).toBe(first);
    const lock: BundleLock = JSON.parse(first);
    expect(lock.pin).toBe("old");
    expect(lock.captionsPin).toBe(CAPTIONS_PIN);
    expect(lock.files["registry/existing/existing.ts"]).toBe(hash(before));
    expect(
      await readFile(join(dir, "registry/existing/existing.ts"), "utf8")
    ).toBe(before);
    const index = JSON.parse(await readFile(join(dir, "index.json"), "utf8"));
    expect(index.components).toEqual(["existing", ...CAPTION_NAMES].sort());
    expect(index.components).not.toContain("caption-core");
  });
  it("rejects a target collision before changing any output", async () => {
    const dir = await fixture();
    const before = await readFile(join(dir, "lock.json"), "utf8");
    await expect(syncCaptions(dir, reader(true))).rejects.toThrow(
      "Conflicting registry target"
    );
    expect(await readFile(join(dir, "lock.json"), "utf8")).toBe(before);
  });
});
