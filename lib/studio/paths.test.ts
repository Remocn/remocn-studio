import { describe, expect, it } from "vitest";
import { baseName } from "@/lib/studio/paths";

describe("baseName", () => {
  it("returns the last segment of a POSIX path", () => {
    expect(baseName("/Users/me/projects/my-video")).toBe("my-video");
  });

  it("returns the last segment of a Windows path", () => {
    expect(baseName("C:\\Users\\me\\projects\\my-video")).toBe("my-video");
  });

  it("ignores a trailing separator", () => {
    expect(baseName("/Users/me/my-video/")).toBe("my-video");
  });

  it("falls back to the whole path when there is no segment", () => {
    expect(baseName("/")).toBe("/");
  });
});
