import { describe, expect, it } from "bun:test";
import { installerUrl, newestLts } from "./node-installer";

describe("newestLts", () => {
  it("takes the first LTS entry, which is the newest", () => {
    expect(
      newestLts([
        { lts: false, version: "v25.1.0" },
        { lts: "Jod", version: "v22.14.0" },
        { lts: "Iron", version: "v20.18.1" },
      ])
    ).toBe("v22.14.0");
  });

  it("is null when nothing on the index is LTS", () => {
    expect(newestLts([{ lts: false, version: "v25.1.0" }])).toBeNull();
  });

  it("refuses an entry whose version is not a version", () => {
    expect(newestLts([{ lts: "Jod", version: "latest" }])).toBeNull();
  });

  it("survives an index entry of an unexpected shape", () => {
    expect(newestLts([null, 7, { lts: "Jod", version: "v22.14.0" }])).toBe(
      "v22.14.0"
    );
  });
});

describe("installerUrl", () => {
  it("names the universal macOS installer for a version", () => {
    expect(installerUrl("v22.14.0")).toBe(
      "https://nodejs.org/dist/v22.14.0/node-v22.14.0.pkg"
    );
  });
});
