import { describe, expect, it } from "bun:test";
import type { Asset } from "@/shared/library";
import { docsFolderOf, type PipelineStage } from "@/shared/pipeline";
import { stageBrief } from "../agent/instructions";
import {
  type DesignCalls,
  executeTool,
  type PipelineCalls,
  type TurnTools,
} from "./execute";

const CWD = "/videos/promo";

function asset(shape: Partial<Asset> = {}): Asset {
  return {
    audiomap: null,
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
    role: null,
    slug: "neon-title",
    source: null,
    type: "component",
    ...shape,
  };
}

function tools(shape: Partial<TurnTools> = {}): TurnTools {
  return {
    connections: { usable: () => Promise.resolve([]) },
    cwd: CWD,
    design: {
      check: () => Promise.reject(new Error("no design check in this test")),
      sources: () => Promise.resolve([]),
    },
    library: {
      list: () => Promise.resolve([]),
      save: () => Promise.reject(new Error("no save in this test")),
    },
    moodboard: {
      find: () => Promise.resolve(null),
      save: () => Promise.reject(new Error("no moodboard in this test")),
    },
    pipeline: {
      brief: () => null,
      requestSource: () =>
        Promise.reject(new Error("no source ask in this test")),
      setStage: () => Promise.reject(new Error("no pipeline in this test")),
      start: () => Promise.reject(new Error("no pipeline in this test")),
    },
    stock: {
      search: () => Promise.reject(new Error("no stock in this test")),
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

  it("carries the role through to the draft it saves", async () => {
    const drafts: unknown[] = [];
    await executeTool(
      "remocn-library",
      "save_asset",
      { files: ["src/Reveal.tsx"], name: "Reveal", role: "entry" },
      tools({
        library: {
          list: () => Promise.resolve([]),
          save: (draft) => {
            drafts.push(draft);
            return Promise.resolve(asset({ role: "entry" }));
          },
        },
      })
    );

    expect(drafts).toMatchObject([{ role: "entry" }]);
  });

  it("saves media with no role rather than inventing one", async () => {
    const drafts: unknown[] = [];
    await executeTool(
      "remocn-library",
      "save_asset",
      { files: ["/abs/intro.mp4"], name: "Intro" },
      tools({
        library: {
          list: () => Promise.resolve([]),
          save: (draft) => {
            drafts.push(draft);
            return Promise.resolve(asset({ type: "video" }));
          },
        },
      })
    );

    expect(drafts).toMatchObject([{ role: null }]);
  });

  it("inventories the role of a behaviour, since that is what it is for", async () => {
    const answer = await executeTool(
      "remocn-library",
      "list_assets",
      {},
      tools({
        library: {
          list: () => Promise.resolve([asset({ role: "entry" })]),
          save: () => Promise.reject(new Error("unused")),
        },
      })
    );

    expect(answer.text).toContain("Neon Title — component, entry");
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
          brief: (moved) =>
            stageBrief(moved, { planningTool: "TaskCreate", video: "promo" }),
          requestSource: () => Promise.reject(new Error("unused")),
          setStage: () => Promise.reject(new Error("unused")),
          start: () => Promise.resolve(stages),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(answer.text).toContain(JSON.stringify(stages));
    expect(answer.text).toContain("**Analysis**");
    expect(answer.text).toContain("src/videos/promo/docs/");
  });

  it("answers a stage move with the brief the turn's port builds for the stages now", async () => {
    const moved: PipelineStage[] = [
      { stage: "analysis", status: "done" },
      { stage: "brand", status: "active" },
    ];
    const asked: (readonly PipelineStage[])[] = [];
    const pipeline: PipelineCalls = {
      brief: (stages) => {
        asked.push(stages);
        return stageBrief(stages, {
          planningTool: "update_plan",
          video: "opening-title",
        });
      },
      requestSource: () => Promise.reject(new Error("unused")),
      setStage: () => Promise.resolve(moved),
      start: () => Promise.reject(new Error("unused")),
    };

    const answer = await executeTool(
      "remocn-pipeline",
      "set_pipeline_stage",
      { stage: "brand", status: "active" },
      tools({ pipeline })
    );

    expect(answer.isError).toBe(false);
    expect(asked).toEqual([moved]);
    expect(answer.text).toStartWith(`${JSON.stringify(moved)}\n\n`);
    expect(answer.text).toContain("**Brand**");
    expect(answer.text).toContain("src/videos/opening-title/docs/");
    expect(answer.text).not.toContain(docsFolderOf(null));
    expect(answer.text).toContain("update_plan");
    expect(answer.text).not.toContain("TaskCreate");
  });

  it("answers with the stages alone when the port has no brief for them", async () => {
    const finished: PipelineStage[] = [{ stage: "review", status: "done" }];

    const answer = await executeTool(
      "remocn-pipeline",
      "set_pipeline_stage",
      { stage: "analysis", status: "done" },
      tools({
        pipeline: {
          brief: () => null,
          requestSource: () => Promise.reject(new Error("unused")),
          setStage: () => Promise.resolve(finished),
          start: () => Promise.reject(new Error("unused")),
        },
      })
    );

    expect(answer.text).toBe(JSON.stringify(finished));
  });

  it("returns the person's source asset decision as structured JSON", async () => {
    const answer = await executeTool(
      "remocn-pipeline",
      "request_source_asset",
      {
        attempt: "No linked image was usable.",
        name: "Acme Logo",
        source: "https://example.com/brand",
      },
      tools({
        pipeline: {
          brief: () => null,
          requestSource: () =>
            Promise.resolve({
              kind: "uploaded",
              path: "video/assets/acme.svg",
              provenance: "Original supplied by the person",
            }),
          setStage: () => Promise.reject(new Error("unused")),
          start: () => Promise.reject(new Error("unused")),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(JSON.parse(answer.text)).toMatchObject({
      kind: "uploaded",
      path: "video/assets/acme.svg",
    });
  });

  it("returns the design report as agent-readable JSON", async () => {
    const asked: unknown[] = [];
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      { frames: [30, 90] },
      tools({
        design: {
          check: ({ frames, motion }) => {
            asked.push(motion);
            return Promise.resolve({
              composition: "Main",
              findings: [],
              frames: [...frames],
              height: 1080,
              snapshots: [],
              summary: { errors: 0, info: 0, warnings: 0 },
              width: 1920,
            });
          },
          sources: () => Promise.resolve([]),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(JSON.parse(answer.text)).toMatchObject({
      composition: "Main",
      frames: [30, 90],
    });
    expect(asked).toEqual([[]]);
    // Every later request in the turn re-reads this text; indentation was a
    // quarter to a half of it.
    expect(answer.text).not.toContain("\n ");
  });

  it("passes typed motion assertions through to the design check", async () => {
    const asked: unknown[] = [];
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      {
        frames: [30, 90],
        motion: [
          {
            from: 30,
            kind: "changes_between",
            selector: "[data-design-id='orb']",
            to: 90,
          },
          {
            frame: 60,
            kind: "visible_at",
            selector: "[data-design-id='headline']",
          },
          { kind: "stays_in_frame", selector: ".ticker" },
        ],
      },
      tools({
        design: {
          check: ({ motion }) => {
            asked.push(motion);
            return Promise.resolve({
              composition: "Main",
              findings: [],
              frames: [30, 60, 90],
              height: 1080,
              snapshots: [],
              summary: { errors: 0, info: 0, warnings: 0 },
              width: 1920,
            });
          },
          sources: () => Promise.resolve([]),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(asked[0]).toEqual([
      {
        from: 30,
        kind: "changes_between",
        selector: "[data-design-id='orb']",
        to: 90,
      },
      {
        frame: 60,
        kind: "visible_at",
        selector: "[data-design-id='headline']",
      },
      { kind: "stays_in_frame", selector: ".ticker" },
    ]);
  });

  it("passes the whole-video scene map through, and normalises an omitted camera", async () => {
    const asked: unknown[] = [];
    const report = {
      composition: "Main",
      findings: [],
      frames: [30, 90],
      height: 1080,
      snapshots: [],
      summary: { errors: 0, info: 0, warnings: 0 },
      width: 1920,
    };
    const design = {
      check: ({ video }: { video: unknown }) => {
        asked.push(video);
        return Promise.resolve(report);
      },
      sources: () => Promise.resolve([]),
    };

    await executeTool(
      "remocn-design",
      "design_check",
      {
        frames: [30, 90],
        video: {
          scenes: [
            { from: 0, name: "open", to: 60 },
            { from: 60, name: "claim", to: 150 },
          ],
        },
      },
      tools({ design })
    );
    await executeTool(
      "remocn-design",
      "design_check",
      { frames: [30, 90] },
      tools({ design })
    );

    expect(asked[0]).toEqual({
      camera: null,
      scenes: [
        { from: 0, name: "open", to: 60 },
        { from: 60, name: "claim", to: 150 },
      ],
    });
    expect(asked[1]).toBeNull();
  });

  it("refuses a scene map of one scene, which has no boundary to check", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      {
        frames: [30, 90],
        video: { scenes: [{ from: 0, name: "open", to: 60 }] },
      },
      tools()
    );

    expect(answer.isError).toBe(true);
  });

  it("refuses a motion assertion of an unknown kind", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      {
        frames: [30, 90],
        motion: [{ kind: "keeps_moving", selector: ".orb" }],
      },
      tools()
    );

    expect(answer.isError).toBe(true);
  });

  it("refuses a changes_between assertion comparing a frame to itself", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      {
        frames: [30, 90],
        motion: [
          { from: 30, kind: "changes_between", selector: ".orb", to: 30 },
        ],
      },
      tools()
    );

    expect(answer.isError).toBe(true);
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

  it("answers a stock search with items the agent can pass to save_moodboard", async () => {
    const answer = await executeTool(
      "remocn-library",
      "search_stock",
      { query: "warm window light" },
      tools({
        stock: {
          search: (query) => {
            expect(query).toEqual({
              kind: "photo",
              page: 1,
              query: "warm window light",
            });
            return Promise.resolve({
              items: [
                {
                  author: "Anna",
                  authorUrl: "https://pexels.com/@anna",
                  download: "https://images.pexels.com/photos/42/warm.jpeg",
                  duration: null,
                  height: 2000,
                  id: "42",
                  kind: "photo",
                  name: "Warm window",
                  thumbnail: "https://images.pexels.com/photos/42/thumb.jpeg",
                  url: "https://pexels.com/photo/42",
                  width: 3000,
                },
              ],
              nextPage: 2,
              total: 44,
            });
          },
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(answer.text).toContain(
      '"download":"https://images.pexels.com/photos/42/warm.jpeg"'
    );
    expect(answer.text).toContain('"pageUrl":"https://pexels.com/photo/42"');
    expect(answer.text).not.toContain("thumb.jpeg");
    expect(answer.text).toContain("pass page: 2");
  });

  it("says there is no moodboard rather than answering with nothing", async () => {
    const answer = await executeTool(
      "remocn-library",
      "get_moodboard",
      {},
      tools()
    );

    expect(answer).toEqual({
      isError: false,
      text: "There is no moodboard for this project yet.",
    });
  });

  it("maps a save_moodboard call onto a draft with attribution and resolved files", async () => {
    let seen: unknown = null;

    const answer = await executeTool(
      "remocn-library",
      "save_moodboard",
      {
        images: [
          {
            author: "Anna",
            id: "42",
            note: "anchor",
            pageUrl: "https://pexels.com/photo/42",
            url: "https://images.pexels.com/photos/42/warm.jpeg",
          },
          { file: "video/assets/frame.png", role: "texture" },
        ],
        keywords: ["warm"],
        palette: [{ hex: "#1a2b3c" }],
        title: "Warm launch",
      },
      tools({
        moodboard: {
          find: () => Promise.resolve(null),
          save: (draft) => {
            seen = draft;
            return Promise.resolve({
              asset: asset({
                name: "Warm launch",
                preview: "/library/assets/warm-launch/preview.png",
                slug: "warm-launch",
                type: "img",
              }),
              spec: {
                images: [],
                keywords: ["warm"],
                palette: [],
                project: "project-1",
                title: "Warm launch",
                typography: [],
              },
            });
          },
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(answer.text).toContain("Saved the moodboard Warm launch");
    expect(answer.text).toContain("/library/assets/warm-launch/preview.png");
    expect(seen).toEqual({
      images: [
        {
          columns: null,
          file: null,
          note: "anchor",
          role: "photo",
          rows: null,
          source: {
            author: "Anna",
            authorUrl: "",
            id: "42",
            provider: "pexels",
            url: "https://pexels.com/photo/42",
          },
          url: "https://images.pexels.com/photos/42/warm.jpeg",
        },
        {
          columns: null,
          file: `${CWD}/video/assets/frame.png`,
          note: "",
          role: "texture",
          rows: null,
          source: null,
          url: null,
        },
      ],
      keywords: ["warm"],
      palette: [{ hex: "#1a2b3c", name: "" }],
      title: "Warm launch",
      typography: [],
    });
  });

  it("refuses a moodboard image naming both a file and a url", async () => {
    const answer = await executeTool(
      "remocn-library",
      "save_moodboard",
      {
        images: [{ file: "a.png", url: "https://images.pexels.com/a.jpeg" }],
        title: "Board",
      },
      tools()
    );

    expect(answer.isError).toBe(true);
  });

  it("turns an implementation failure into an error answer, not a crash", async () => {
    const answer = await executeTool(
      "remocn-pipeline",
      "set_pipeline_stage",
      { stage: "analysis", status: "done" },
      tools({
        pipeline: {
          brief: () => null,
          requestSource: () => Promise.reject(new Error("unused")),
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

// A rendered frame cannot answer whether the person will be able to edit the
// motion, and instructions alone did not: the vendored interactivity skill
// tells the agent to hardcode the easing, and it did. So the gate the
// conventions already require reports it mechanically.
describe("design_check reports untunable easings", () => {
  const report = {
    composition: "Main",
    findings: [],
    frames: [30, 90],
    height: 1080,
    snapshots: [],
    summary: { errors: 0, info: 0, warnings: 0 },
    width: 1920,
  };

  function design(
    sources: readonly { path: string; source: string }[]
  ): DesignCalls {
    return {
      check: () => Promise.resolve(report) as never,
      sources: () => Promise.resolve(sources),
    };
  }

  it("merges each untunable curve into the findings the stage gates on", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      { frames: [30, 90] },
      tools({
        design: design([
          {
            path: "CurveLanes.tsx",
            source: "  easing: Easing.out(Easing.cubic),\n",
          },
        ]),
      })
    );

    const merged = JSON.parse(answer.text) as {
      findings: { code: string; fix: string; observed: string }[];
      summary: { errors: number; info: number; warnings: number };
    };

    expect(merged.findings).toHaveLength(1);
    expect(merged.findings[0]?.code).toBe("tunability_constant_easing");
    expect(merged.findings[0]?.observed).toContain("CurveLanes.tsx:1");
    expect(merged.findings[0]?.fix).toContain("Easing.bezier(...easing)");
  });

  it("counts what it merged, by severity", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      { frames: [30, 90] },
      tools({
        design: design([
          { path: "Lane.tsx", source: "easing: Easing.linear,\n" },
          {
            path: "Headline.tsx",
            source:
              "export function H({ text }) {\n  return <h1>{text}</h1>;\n}\n",
          },
        ]),
      })
    );

    expect(JSON.parse(answer.text)).toMatchObject({
      summary: { errors: 1, info: 0, warnings: 1 },
    });
  });

  it("adds no finding when every curve comes from a prop", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      { frames: [30, 90] },
      tools({
        design: design([
          { path: "Title.tsx", source: "easing: Easing.bezier(...easing),\n" },
        ]),
      })
    );

    expect(JSON.parse(answer.text)).toMatchObject({
      composition: "Main",
      findings: [],
      summary: { errors: 0, info: 0, warnings: 0 },
    });
  });

  // The check is a courtesy on top of the real one; a project it cannot read
  // must not fail the design check the agent is waiting on.
  it("still answers when the source cannot be read", async () => {
    const answer = await executeTool(
      "remocn-design",
      "design_check",
      { frames: [30, 90] },
      tools({
        design: {
          check: () => Promise.resolve(report) as never,
          sources: () => Promise.reject(new Error("gone")),
        },
      })
    );

    expect(answer.isError).toBe(false);
    expect(JSON.parse(answer.text)).toMatchObject({ composition: "Main" });
  });
});

it("routes music through paid generation with instrumental defaults and its own status tool", async () => {
  const requests: unknown[] = [];
  const ids: (string | undefined)[] = [];
  const calls = tools({
    sounds: {
      generate: (batch) => {
        requests.push(...batch);
        return Promise.resolve("prepared");
      },
      status: (id) => {
        ids.push(id);
        return Promise.resolve("completed");
      },
    },
  });
  const answer = await executeTool(
    "remocn-library",
    "generate_music",
    {
      connectionId: "cn_1",
      durationSeconds: 120,
      name: "Theme",
      text: "Calm piano",
    },
    calls
  );
  expect(answer.isError).toBe(false);
  expect(requests).toEqual([
    {
      connectionId: "cn_1",
      durationSeconds: 120,
      forceInstrumental: true,
      format: "mp3_44100_128",
      kind: "music",
      name: "Theme",
      text: "Calm piano",
    },
  ]);
  expect(
    (
      await executeTool(
        "remocn-library",
        "music_status",
        { id: "sound_1" },
        calls
      )
    ).isError
  ).toBe(false);
  expect(ids).toEqual(["sound_1"]);
  expect(
    (
      await executeTool(
        "remocn-library",
        "generate_music",
        {
          connectionId: "cn_1",
          durationSeconds: 601,
          name: "Theme",
          text: "Piano",
        },
        calls
      )
    ).isError
  ).toBe(true);
  expect(requests).toHaveLength(1);
});

it("hands every sound of one call to paid generation on the chosen connection", async () => {
  const batches: unknown[][] = [];
  const calls = tools({
    sounds: {
      generate: (batch) => {
        batches.push([...batch]);
        return Promise.resolve("prepared");
      },
      status: () => Promise.resolve("unused"),
    },
  });
  const answer = await executeTool(
    "remocn-library",
    "generate_sound_effect",
    {
      connectionId: "cn_1",
      sounds: [
        { name: "Door", text: "Door closes" },
        { durationSeconds: 2, name: "Rain", text: "Light rain" },
      ],
    },
    calls
  );
  expect(answer.isError).toBe(false);
  expect(batches).toEqual([
    [
      {
        connectionId: "cn_1",
        durationSeconds: null,
        format: "mp3_44100_128",
        name: "Door",
        text: "Door closes",
      },
      {
        connectionId: "cn_1",
        durationSeconds: 2,
        format: "mp3_44100_128",
        name: "Rain",
        text: "Light rain",
      },
    ],
  ]);
  const refused = await executeTool(
    "remocn-library",
    "generate_sound_effect",
    {
      connectionId: "cn_1",
      sounds: [
        { name: "Door", text: "Door closes" },
        { durationSeconds: 31, name: "Rain", text: "Light rain" },
      ],
    },
    calls
  );
  expect(refused.isError).toBe(true);
  expect(batches).toHaveLength(1);
});
