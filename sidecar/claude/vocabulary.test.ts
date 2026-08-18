import { describe, expect, it } from "vitest";
import { verbOf } from "./vocabulary";

describe("verbOf", () => {
  it("translates every tool the icons used to key on by name", () => {
    expect(verbOf("Bash")).toBe("run");
    expect(verbOf("Edit")).toBe("edit");
    expect(verbOf("MultiEdit")).toBe("edit");
    expect(verbOf("Write")).toBe("create");
    expect(verbOf("Read")).toBe("read");
    expect(verbOf("Glob")).toBe("find");
    expect(verbOf("Grep")).toBe("search");
    expect(verbOf("WebFetch")).toBe("web");
    expect(verbOf("WebSearch")).toBe("web");
    expect(verbOf("ExitPlanMode")).toBe("plan");
    expect(verbOf("Task")).toBe("subagent");
    expect(verbOf("TaskCreate")).toBe("task");
    expect(verbOf("TodoWrite")).toBe("task");
  });

  it("leaves a name outside the neutral vocabulary untranslated", () => {
    expect(verbOf("NotebookEdit")).toBeNull();
    expect(verbOf("mcp__remocn-library__save_asset")).toBeNull();
    expect(verbOf("SomethingNew")).toBeNull();
  });
});
