// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { noBundle } from "@/sidecar/agent/knowledge";
import { pluginsFor } from "@/sidecar/claude/knowledge";

const PLUGIN = join(process.cwd(), "agent");

describe("pluginsFor", () => {
  it("hands the SDK the bundle the locator attached", () => {
    expect(
      pluginsFor({
        collisions: [],
        loaded: true,
        path: PLUGIN,
        reason: null,
        source: "plugin-dir",
      })
    ).toEqual([{ path: PLUGIN, type: "local" }]);
  });

  it("keeps handing it over when the project shipped one of the same skills", () => {
    expect(
      pluginsFor({
        collisions: ["remocn"],
        loaded: true,
        path: PLUGIN,
        reason: null,
        source: "plugin-dir",
      })
    ).toEqual([{ path: PLUGIN, type: "local" }]);
  });

  it("hands over nothing when there is no bundle to hand over", () => {
    expect(pluginsFor(noBundle("nothing shipped"))).toEqual([]);
  });
});
