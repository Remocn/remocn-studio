import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect, Exit } from "effect";
import type { EnvironmentCheck } from "@/shared/ipc";
import {
  compositionRow,
  downloadPercent,
  isBlocked,
  merged,
  NODE_DOWNLOAD_URL,
  openNodeDownload,
  unresolved,
} from "./environment";
import { PREVIEW_MESSAGE_SOURCE, type PreviewComposition } from "./preview";

const pick = (over: Partial<PreviewComposition> = {}): PreviewComposition => ({
  compositionId: "Main",
  compositions: ["Main"],
  metadata: null,
  reason: "main",
  source: PREVIEW_MESSAGE_SOURCE,
  total: 3,
  trouble: null,
  type: "composition",
  unmeasured: false,
  ...over,
});

const row = (over: Partial<EnvironmentCheck>): EnvironmentCheck => ({
  detail: null,
  fix: null,
  id: "claude",
  state: "ok",
  title: "",
  ...over,
});

describe("compositionRow", () => {
  it("stays pending until the preview has compiled", () => {
    expect(compositionRow(null).state).toBe("pending");
  });

  it("fails when the Root registers nothing", () => {
    const check = compositionRow(
      pick({ compositionId: null, reason: "none", total: 0 })
    );

    expect(check.state).toBe("failed");
  });

  // A project holds many videos now, so "none of them is called Main" is the
  // ordinary case. The one thing worth failing on is a video the pane asked
  // for that the compiled project does not render.
  it("fails when the video that was asked for is not in the code", () => {
    const check = compositionRow(
      pick({ compositionId: "torrens-motherboard", reason: "missing" })
    );

    expect(check.state).toBe("failed");
    expect(check.title).toContain("torrens-motherboard");
    expect(check.detail).toContain("Root.tsx");
  });

  it("passes on the video the pane asked for", () => {
    const check = compositionRow(
      pick({ compositionId: "opening-title", reason: "asked" })
    );

    expect(check.state).toBe("ok");
    expect(check.detail).toContain("opening-title");
  });

  it("says nothing about Main when no video was asked for", () => {
    expect(compositionRow(pick({ reason: "first" })).state).toBe("ok");
    expect(compositionRow(pick({ reason: "folder" })).state).toBe("ok");
  });
});

describe("merged", () => {
  it("replaces the sidecar's pending row with the preview's answer", () => {
    const checks = merged(
      [row({ id: "compositions", state: "pending" })],
      pick()
    );

    expect(checks).toHaveLength(1);
    expect(checks[0].state).toBe("ok");
  });

  it("leaves every other row alone", () => {
    const claude = row({ id: "claude", state: "failed", title: "logged out" });

    expect(merged([claude], pick())[0]).toBe(claude);
  });
});

describe("downloadPercent", () => {
  it("is null before a length is known", () => {
    expect(downloadPercent(null)).toBeNull();
    expect(
      downloadPercent({ received: 10, total: null, type: "progress" })
    ).toBeNull();
  });

  it("rounds what has arrived against what was declared", () => {
    expect(
      downloadPercent({ received: 50, total: 200, type: "progress" })
    ).toBe(25);
  });

  it("never claims more than a whole file", () => {
    expect(
      downloadPercent({ received: 300, total: 200, type: "progress" })
    ).toBe(100);
  });
});

describe("openNodeDownload", () => {
  it("opens the Node.js download page and asks the sidecar nothing", async () => {
    const asked: [string, unknown][] = [];
    mockIPC((cmd, args) => {
      asked.push([cmd, args]);
      return null;
    });

    await Effect.runPromise(openNodeDownload);

    expect(asked).toHaveLength(1);
    const [command, payload] = asked[0] ?? [null, null];
    expect(command).toBe("plugin:opener|open_url");
    expect(payload).toMatchObject({ url: NODE_DOWNLOAD_URL });
  });

  it("fails with a sentence that carries the address", async () => {
    mockIPC(() => {
      throw new Error("no browser");
    });

    const exit = await Effect.runPromiseExit(openNodeDownload);

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("https://nodejs.org/en/download");
  });
});

describe("unresolved", () => {
  it("keeps only what the user has to act on", () => {
    const checks = [
      row({ id: "claude", state: "ok" }),
      row({ id: "manager", state: "warn" }),
      row({ id: "remotion", state: "failed" }),
      row({ id: "compositions", state: "pending" }),
    ];

    expect(unresolved(checks).map((check) => check.id)).toEqual([
      "manager",
      "remotion",
    ]);
  });

  it("is empty for a project that only has pending work left", () => {
    expect(unresolved([row({ id: "compositions", state: "pending" })])).toEqual(
      []
    );
  });
});

describe("isBlocked", () => {
  it("blocks on the session's provider failing its login check", () => {
    expect(isBlocked([row({ id: "claude", state: "failed" })], "claude")).toBe(
      true
    );
  });

  it("does not block on a folder that is not a Remotion project", () => {
    expect(
      isBlocked([row({ id: "remotion", state: "failed" })], "claude")
    ).toBe(false);
  });

  it("does not block before the first report arrives", () => {
    expect(isBlocked([], "claude")).toBe(false);
  });
});
