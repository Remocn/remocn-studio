// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Asset } from "@/shared/library";
import type { PipelineStage } from "@/shared/pipeline";
import { executeTool, type TurnTools } from "./execute";

const CWD = "/videos/promo";

function asset(shape: Partial<Asset> = {}): Asset {
  return {
    category: null,
    clip: null,
    createdAt: 0,
    dependencies: [],
    description: "",
    duration: null,
    files: ["Scene.tsx"],
    name: "Neon Title",
    path: "/library/assets/neon-title",
    preview: null,
    proxied: false,
    slug: "neon-title",
    type: "component",
    ...shape,
  };
}

function tools(shape: Partial<TurnTools> = {}): TurnTools {
  return {
    cwd: CWD,
    design: {
      check: () => Promise.reject(new Error("no design check in this test")),
    },
    library: {
      list: () => Promise.resolve([]),
      save: () => Promise.reject(new Error("no save in this test")),
    },
    pipeline: {
      setStage: () => Promise.reject(new Error("no pipeline in this test")),
      start: () => Promise.reject(new Error("no pipeline in this test")),
    },
    ...shape,
  };
}

describe("executeTool", () => {
  it("says the library is empty rather than answering with nothing", async () => {
    const answer = await executeTool(
      "remocn-library",
      "list_assets",
      {},
      tools()
    );

    expect(answer).toEqual({ isError: false, text: "The library is empty." });
  });

  it("inventories an asset with its files and dependencies", async () => {
    const answer = await executeTool(
      "remocn-library",
      "list_assets",
      {},
      tools({
        library: {
          list: () =>
            Promise.resolve([
              asset({ dependencies: ["three"], description: "A neon title" }),
            ]),
          save: () => Promise.reject(new Error("unused")),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(answer.text).toBe(
      "Neon Title — component\nA neon title\nfiles: Scene.tsx\nneeds: three"
    );
  });

  it("resolves relative files against the project before saving", async () => {
    const drafts: unknown[] = [];
    const answer = await executeTool(
      "remocn-library",
      "save_asset",
      { files: ["src/Scene.tsx", "/abs/ease.ts"], name: "Neon Title" },
      tools({
        library: {
          list: () => Promise.resolve([]),
          save: (draft) => {
            drafts.push(draft);
            return Promise.resolve(asset({ files: ["Scene.tsx", "ease.ts"] }));
          },
        },
      })
    );

    expect(drafts).toMatchObject([
      { files: [`${CWD}/src/Scene.tsx`, "/abs/ease.ts"] },
    ]);
    expect(answer.isError).toBe(false);
    expect(answer.text).toBe(
      "Saved Neon Title to the library as neon-title (component), holding 2 files. It is now available in every project."
    );
  });

  it("answers the pipeline tools with the stages and the active brief", async () => {
    const stages: PipelineStage[] = [
      { stage: "analysis", status: "active" },
      { stage: "brand", status: "pending" },
    ];
    const answer = await executeTool(
      "remocn-pipeline",
      "start_video_pipeline",
      {},
      tools({
        pipeline: {
          setStage: () => Promise.reject(new Error("unused")),
          start: () => Promise.resolve(stages),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(answer.text).toContain(JSON.stringify(stages));
    expect(answer.text).toContain("**Analysis**");
  });

  it("returns the design report as agent-readable JSON", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      { frames: [30, 90] },
      tools({
        design: {
          check: (frames) =>
            Promise.resolve({
              composition: "Main",
              findings: [],
              frames: [...frames],
              height: 1080,
              snapshots: [],
              summary: { errors: 0, info: 0, warnings: 0 },
              width: 1920,
            }),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(JSON.parse(answer.text)).toMatchObject({
      composition: "Main",
      frames: [30, 90],
    });
  });

  it("refuses arguments the tool's own schema rejects", async () => {
    const answer = await executeTool(
      "remocn-library",
      "save_asset",
      { files: [], name: "" },
      tools()
    );

    expect(answer.isError).toBe(true);
  });

  it("refuses a tool the server does not carry", async () => {
    const answer = await executeTool(
      "remocn-library",
      "delete_everything",
      {},
      tools()
    );

    expect(answer).toEqual({
      isError: true,
      text: "remocn-library has no tool called delete_everything",
    });
  });

  it("turns an implementation failure into an error answer, not a crash", async () => {
    const answer = await executeTool(
      "remocn-pipeline",
      "set_pipeline_stage",
      { stage: "analysis", status: "done" },
      tools({
        pipeline: {
          setStage: () =>
            Promise.reject(new Error("session s-1 has no pipeline")),
          start: () => Promise.reject(new Error("unused")),
        },
      })
    );

    expect(answer).toEqual({
      isError: true,
      text: "session s-1 has no pipeline",
    });
  });
});
