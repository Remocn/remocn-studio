// @vitest-environment node
import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import { decodeHostCommand, decodeHostReply } from "./protocol";

describe("preview design protocol", () => {
  it("decodes a batch design command", () => {
    const decoded = decodeHostCommand(
      JSON.stringify({
        composition: "Main",
        frames: [30, 90],
        id: "request-1",
        type: "design",
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("decodes an agent-readable design result", () => {
    const decoded = decodeHostReply(
      JSON.stringify({
        id: "request-1",
        result: {
          composition: "Main",
          findings: [],
          frames: [30, 90],
          height: 1080,
          snapshots: [
            { frame: 30, path: "/tmp/frame-30.png" },
            { frame: 90, path: "/tmp/frame-90.png" },
          ],
          summary: { errors: 0, info: 0, warnings: 0 },
          width: 1920,
        },
        type: "design-done",
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(true);
  });
});
