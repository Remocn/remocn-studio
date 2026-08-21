// @vitest-environment node
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@/shared/ipc";
import { answerSourceAsset, requestSourceAsset } from "./source";

const COPIED_LOGO = /^video\/assets\/acme-logo-[a-f0-9]+\.svg$/;

async function asked(projectPath: string) {
  const announced =
    Promise.withResolvers<Extract<AgentEvent, { type: "asset_source" }>>();
  const waiting = Effect.runPromise(
    requestSourceAsset(
      {
        attempt: "No downloadable image or SVG was exposed.",
        name: "Acme Logo",
        projectId: "project-1",
        projectPath,
        source: "https://example.com/brand",
        turnId: crypto.randomUUID(),
      },
      (event) =>
        Effect.sync(() => {
          if (event.type === "asset_source") {
            announced.resolve(event);
          }
        })
    )
  );
  return { event: await announced.promise, waiting };
}

describe("source asset ask", () => {
  it("copies a supplied original into video/assets and resumes the caller", async () => {
    const root = join(tmpdir(), `remocn-source-${crypto.randomUUID()}`);
    const original = join(tmpdir(), `logo-${crypto.randomUUID()}.svg`);
    await writeFile(original, "<svg>original</svg>");
    const { event, waiting } = await asked(root);

    expect(
      await Effect.runPromise(
        answerSourceAsset({ action: "uploaded", file: original, id: event.id })
      )
    ).toBe(true);

    const result = await waiting;
    expect(result).toMatchObject({ kind: "uploaded" });
    expect(result.path).toMatch(COPIED_LOGO);
    expect(await readFile(join(root, result.path as string), "utf8")).toBe(
      "<svg>original</svg>"
    );
  });

  it("returns an explicit cancellation instead of licensing invention", async () => {
    const { event, waiting } = await asked(
      join(tmpdir(), `remocn-source-${crypto.randomUUID()}`)
    );

    await Effect.runPromise(
      answerSourceAsset({ action: "cancel", file: null, id: event.id })
    );

    await expect(waiting).resolves.toMatchObject({
      kind: "cancelled",
      path: null,
    });
  });
});
