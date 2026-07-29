// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  absolutise,
  formatFrame,
  isProjectFile,
  joinPath,
  projectFrames,
  truncateMarkup,
} from "./source";

const ROOT = "/Users/me/projects/my-video";

describe("joinPath", () => {
  it("joins a relative path onto the root", () => {
    expect(joinPath(ROOT, "src/Title.tsx")).toBe(`${ROOT}/src/Title.tsx`);
  });

  it("resolves the segments that walk back up", () => {
    expect(joinPath(ROOT, "src/../lib/Title.tsx")).toBe(
      `${ROOT}/lib/Title.tsx`
    );
  });

  it("walks out of the root when the path says so", () => {
    expect(joinPath(ROOT, "../shared/Title.tsx")).toBe(
      "/Users/me/projects/shared/Title.tsx"
    );
  });
});

describe("absolutise", () => {
  it("resolves a path the sourcemap gives relative to the root", () => {
    expect(absolutise(ROOT, "src/Title.tsx")).toBe(`${ROOT}/src/Title.tsx`);
  });

  it("drops the dot webpack likes to put in front", () => {
    expect(absolutise(ROOT, "./src/Title.tsx")).toBe(`${ROOT}/src/Title.tsx`);
  });

  it("drops the webpack scheme and its project name", () => {
    expect(absolutise(ROOT, "webpack://my-video/./src/Title.tsx")).toBe(
      `${ROOT}/src/Title.tsx`
    );
  });

  it("leaves an already absolute path where it is", () => {
    expect(absolutise(ROOT, "/opt/other/Title.tsx")).toBe(
      "/opt/other/Title.tsx"
    );
  });

  it("has no path for a frame that names no file", () => {
    expect(absolutise(ROOT, undefined)).toBeNull();
    expect(absolutise(ROOT, "")).toBeNull();
  });

  it("has no path for something served over the network", () => {
    expect(absolutise(ROOT, "http://127.0.0.1:5173/bundle.js")).toBeNull();
  });
});

describe("isProjectFile", () => {
  it("accepts a file under the project", () => {
    expect(isProjectFile(ROOT, `${ROOT}/src/Title.tsx`)).toBe(true);
  });

  it("refuses a dependency the project happens to contain", () => {
    expect(
      isProjectFile(ROOT, `${ROOT}/node_modules/remotion/dist/Sequence.js`)
    ).toBe(false);
  });

  it("refuses a file outside the project", () => {
    expect(isProjectFile(ROOT, "/opt/other/Title.tsx")).toBe(false);
  });

  it("refuses the root itself, which is a folder", () => {
    expect(isProjectFile(ROOT, ROOT)).toBe(false);
  });
});

describe("projectFrames", () => {
  it("keeps the project's own frames, innermost first", () => {
    expect(
      projectFrames(ROOT, [
        {
          columnNumber: 7,
          fileName: "src/Title.tsx",
          functionName: "Title",
          lineNumber: 12,
        },
        {
          columnNumber: 3,
          fileName: "src/Main.tsx",
          functionName: "Main",
          lineNumber: 40,
        },
      ])
    ).toEqual([
      { column: 7, file: `${ROOT}/src/Title.tsx`, line: 12, name: "Title" },
      { column: 3, file: `${ROOT}/src/Main.tsx`, line: 40, name: "Main" },
    ]);
  });

  it("drops the frames that land in a dependency", () => {
    expect(
      projectFrames(ROOT, [
        {
          fileName: "node_modules/remotion/dist/Sequence.js",
          functionName: "Sequence",
        },
        { fileName: "src/Title.tsx", functionName: "Title" },
      ]).map((spot) => spot.name)
    ).toEqual(["Title"]);
  });

  it("drops the apply frame Remotion's dev-mode JSX proxy leaves behind", () => {
    expect(
      projectFrames(ROOT, [
        { fileName: "src/Title.tsx", functionName: "apply" },
        { fileName: "src/Title.tsx", functionName: "Title" },
      ]).map((spot) => spot.name)
    ).toEqual(["Title"]);
  });

  it("drops a frame with no file to point at", () => {
    expect(projectFrames(ROOT, [{ functionName: "Title" }])).toEqual([]);
  });

  it("has nothing to report when the stack could not be read", () => {
    expect(projectFrames(ROOT, null)).toEqual([]);
  });
});

describe("formatFrame", () => {
  it("writes the component and where it came from", () => {
    expect(
      formatFrame({
        column: 7,
        file: `${ROOT}/src/Title.tsx`,
        line: 12,
        name: "Title",
      })
    ).toBe(`Title (${ROOT}/src/Title.tsx:12:7)`);
  });

  it("writes the file alone when the frame is anonymous", () => {
    expect(
      formatFrame({
        column: null,
        file: `${ROOT}/src/Title.tsx`,
        line: 12,
        name: null,
      })
    ).toBe(`${ROOT}/src/Title.tsx:12`);
  });
});

describe("truncateMarkup", () => {
  it("leaves markup that fits alone", () => {
    expect(truncateMarkup("<h1>Hi</h1>", 40)).toBe("<h1>Hi</h1>");
  });

  it("cuts markup that does not, and says so", () => {
    expect(truncateMarkup("<h1>Hello</h1>", 5)).toBe("<h1>H…");
  });
});
