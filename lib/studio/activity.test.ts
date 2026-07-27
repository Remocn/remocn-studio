import { describe, expect, it } from "vitest";
import {
  targetText,
  toolDetail,
  toolFailure,
  toolTarget,
  toolTargetParts,
} from "@/lib/studio/activity";

const CWD = "/Users/me/projects/my-video";

describe("toolTarget", () => {
  it("shows an edited file relative to the open folder", () => {
    expect(toolTarget({ file_path: `${CWD}/src/Scene.tsx` }, CWD)).toBe(
      "src/Scene.tsx"
    );
  });

  it("keeps a path outside the folder absolute", () => {
    expect(toolTarget({ file_path: "/etc/hosts" }, CWD)).toBe("/etc/hosts");
  });

  it("prefers the command over the description for Bash", () => {
    expect(
      toolTarget({ command: "bun add remotion", description: "Install" }, CWD)
    ).toBe("bun add remotion");
  });

  it("has nothing to show for an input without a subject", () => {
    expect(toolTarget({ todos: [] }, CWD)).toBeNull();
    expect(toolTarget(null, CWD)).toBeNull();
  });
});

describe("toolTargetParts", () => {
  it("splits a path into the folder in front and the filename", () => {
    expect(toolTargetParts({ file_path: `${CWD}/src/Scene.tsx` }, CWD)).toEqual(
      {
        kind: "path",
        lead: "src/",
        name: "Scene.tsx",
      }
    );
  });

  it("leaves a file at the root of the project with no folder in front", () => {
    expect(
      toolTargetParts({ file_path: `${CWD}/remotion.config.ts` }, CWD)
    ).toEqual({ kind: "path", lead: "", name: "remotion.config.ts" });
  });

  it("keeps the whole folder in front when there is none to strip", () => {
    expect(
      toolTargetParts({ file_path: `${CWD}/src/Scene.tsx` }, null)
    ).toEqual({
      kind: "path",
      lead: `${CWD}/src/`,
      name: "Scene.tsx",
    });
  });

  it("names the last segment of a folder, not the empty string after it", () => {
    expect(toolTargetParts({ path: `${CWD}/src/scenes/` }, CWD)).toEqual({
      kind: "path",
      lead: "src/",
      name: "scenes/",
    });
  });

  it("leaves a command whole, since it reads from the left", () => {
    expect(toolTargetParts({ command: "bun run build" }, CWD)).toEqual({
      kind: "text",
      lead: "",
      name: "bun run build",
    });
  });

  it("puts the cd into the open project in front, where it can be dimmed", () => {
    expect(
      toolTargetParts({ command: `cd ${CWD} && ls src/demos/` }, CWD)
    ).toEqual({
      kind: "text",
      lead: `cd ${CWD} && `,
      name: "ls src/demos/",
    });
  });

  it("still hands the permission card the command that actually runs", () => {
    const command = `cd ${CWD} && rm -rf dist`;

    expect(toolTarget({ command }, CWD)).toBe(command);
  });

  it("joins back to the string the permission card renders", () => {
    for (const input of [
      { file_path: `${CWD}/src/Scene.tsx` },
      { file_path: "/etc/hosts" },
      { file_path: `${CWD}/remotion.config.ts` },
      { command: "bun add remotion" },
    ]) {
      const parts = toolTargetParts(input, CWD);

      expect(parts).not.toBeNull();
      expect(parts === null ? null : targetText(parts)).toBe(
        toolTarget(input, CWD)
      );
    }
  });

  it("has nothing to split for an input without a subject", () => {
    expect(toolTargetParts({ todos: [] }, CWD)).toBeNull();
  });
});

describe("toolDetail", () => {
  it("reads a Write as a diff of added lines", () => {
    const detail = toolDetail({
      input: { content: "a\nb", file_path: "/a.tsx" },
      name: "Write",
      result: "File created",
    });

    expect(detail).toEqual({
      kind: "diff",
      lines: [
        { id: 0, kind: "added", text: "a" },
        { id: 1, kind: "added", text: "b" },
      ],
    });
  });

  it("diffs an Edit from its own strings, not from the result text", () => {
    const detail = toolDetail({
      input: { new_string: "b", old_string: "a" },
      name: "Edit",
      result: "The file /a.tsx has been updated.",
    });

    expect(detail).toEqual({
      kind: "diff",
      lines: [
        { id: 0, kind: "removed", text: "a" },
        { id: 1, kind: "added", text: "b" },
      ],
    });
  });

  it("keeps a Bash command next to its output", () => {
    expect(
      toolDetail({
        input: { command: "bun run build" },
        name: "Bash",
        result: "done\n",
      })
    ).toEqual({ command: "bun run build", kind: "command", output: "done\n" });
  });

  it("shows the command of a Bash call that has not answered yet", () => {
    expect(
      toolDetail({ input: { command: "bun test" }, name: "Bash", result: null })
    ).toEqual({ command: "bun test", kind: "command", output: "" });
  });

  it("previews the result of any other tool", () => {
    expect(
      toolDetail({
        input: { file_path: "/a.tsx" },
        name: "Read",
        result: "  x  ",
      })
    ).toEqual({ kind: "text", text: "x" });
  });

  it("has nothing to expand while a read is still running", () => {
    expect(
      toolDetail({ input: { file_path: "/a.tsx" }, name: "Read", result: null })
    ).toBeNull();
  });
});

describe("toolFailure", () => {
  it("keeps the error short and says there is more", () => {
    expect(toolFailure("one\ntwo\nthree\nfour")).toBe("one\ntwo\nthree…");
  });

  it("keeps a short error whole", () => {
    expect(toolFailure("no such file")).toBe("no such file");
  });

  it("has nothing to say when the tool said nothing", () => {
    expect(toolFailure("   ")).toBeNull();
    expect(toolFailure(null)).toBeNull();
  });
});
