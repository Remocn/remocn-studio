import { describe, expect, it } from "vitest";
import type { EnvironmentCheck } from "@/shared/ipc";
import { compositionRow, isBlocked, merged, unresolved } from "./environment";
import { PREVIEW_MESSAGE_SOURCE, type PreviewComposition } from "./preview";

const pick = (over: Partial<PreviewComposition> = {}): PreviewComposition => ({
  compositionId: "Main",
  reason: "main",
  source: PREVIEW_MESSAGE_SOURCE,
  total: 3,
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

  it("warns when there is no Main, naming what plays instead", () => {
    const check = compositionRow(
      pick({ compositionId: "Intro", reason: "first" })
    );

    expect(check.state).toBe("warn");
    expect(check.detail).toContain("Intro");
  });

  it("passes when Main is one of them", () => {
    expect(compositionRow(pick()).state).toBe("ok");
  });

  it("does not call a folder match a missing Main", () => {
    expect(compositionRow(pick({ reason: "folder" })).state).toBe("warn");
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

describe("unresolved", () => {
  it("keeps only what the user has to act on", () => {
    const checks = [
      row({ id: "claude", state: "ok" }),
      row({ id: "runtime", state: "warn" }),
      row({ id: "remotion", state: "failed" }),
      row({ id: "compositions", state: "pending" }),
    ];

    expect(unresolved(checks).map((check) => check.id)).toEqual([
      "runtime",
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
  it("blocks on a failed Claude check", () => {
    expect(isBlocked([row({ id: "claude", state: "failed" })])).toBe(true);
  });

  it("does not block on a folder that is not a Remotion project", () => {
    expect(isBlocked([row({ id: "remotion", state: "failed" })])).toBe(false);
  });

  it("does not block before the first report arrives", () => {
    expect(isBlocked([])).toBe(false);
  });
});
