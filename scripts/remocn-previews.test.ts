import { expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchExamples, previewEntries } from "./remocn-previews";

it("follows the example's TypeScript fixture at its pinned revision", async () => {
  const dir = await mkdtemp(join(tmpdir(), "caption-preview-test-"));
  const calls: string[] = [];
  try {
    await fetchExamples(
      ["caption-karaoke-example"],
      dir,
      "caption-pin",
      (pin, path) => {
        calls.push(`${pin}/${path}`);
        if (path.endsWith("caption-karaoke-example.tsx")) {
          return Promise.resolve(
            'import { fixture } from "@/components/docs/examples/caption-fixture";'
          );
        }
        if (path.endsWith("caption-fixture.ts")) {
          return Promise.resolve("export const fixture = [];");
        }
        return Promise.resolve(null);
      }
    );
    expect(await readFile(join(dir, "caption-fixture.ts"), "utf8")).toContain(
      "fixture"
    );
    expect(
      await readFile(join(dir, "caption-karaoke-example.tsx"), "utf8")
    ).toContain('from "./caption-fixture"');
    expect(calls.every((path) => path.startsWith("caption-pin/"))).toBe(true);
    await expect(
      fetchExamples(["missing"], dir, "pin", () => Promise.resolve(null))
    ).rejects.toThrow("Missing example helper");
    await expect(
      fetchExamples(["unavailable"], dir, "pin", () =>
        Promise.reject(new Error("server unavailable"))
      )
    ).rejects.toThrow("server unavailable");
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

it("mounts the upstream example instead of passing example text to the registry renderer", () => {
  const entry = previewEntries(
    '"caption-karaoke": { load: () => import("@/components/docs/examples/caption-karaoke-example").then((m) => ({ default: m.CaptionKaraokeExample })) }'
  ).get("caption-karaoke");
  expect(entry).toEqual({
    exported: "CaptionKaraokeExample",
    importPath: "@/components/docs/examples/caption-karaoke-example",
  });
});
