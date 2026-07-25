import { describe, expect, it } from "vitest";
import { folderName } from "@/lib/studio/paths";

describe("folderName", () => {
  it("returns the last segment of a POSIX path", () => {
    expect(folderName("/Users/me/projects/my-video")).toBe("my-video");
  });

  it("returns the last segment of a Windows path", () => {
    expect(folderName("C:\\Users\\me\\projects\\my-video")).toBe("my-video");
  });

  it("ignores a trailing separator", () => {
    expect(folderName("/Users/me/my-video/")).toBe("my-video");
  });

  it("falls back to the whole path when there is no segment", () => {
    expect(folderName("/")).toBe("/");
  });
});
