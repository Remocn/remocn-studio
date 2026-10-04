import { beforeEach, describe, expect, it } from "bun:test";
import { withSurface } from "@/test/surface";
import {
  assetBase,
  assetName,
  assetValue,
  isImageName,
  staticBase,
} from "./assets";

const BASE = "http://127.0.0.1:4000/static-abc";

describe("an asset value, both ways", () => {
  beforeEach(() => {
    withSurface({ assets: BASE });
  });

  // `staticFile("library/logo one.png")` is the base plus the name encoded
  // segment by segment; the pane is given the name back.
  it("reads the name out of what staticFile() produced", () => {
    expect(assetName("/static-abc/library/logo%20one.png", "/static-abc")).toBe(
      "library/logo one.png"
    );
    expect(assetName("https://example.com/a.png", "/static-abc")).toBe(
      "https://example.com/a.png"
    );
    expect(assetName("/other/a.png", "")).toBe("/other/a.png");
  });

  it("writes a name against the surface's static base", () => {
    expect(staticBase()).toBe(BASE);
    expect(assetValue("library/logo one.png")).toBe(
      `${BASE}/library/logo%20one.png`
    );
    expect(assetValue("")).toBe("");
    expect(assetValue("https://example.com/a.png")).toBe(
      "https://example.com/a.png"
    );
    expect(assetValue("/already/absolute.png")).toBe("/already/absolute.png");
  });

  it("is a round trip through the base it came from", () => {
    expect(assetName(assetValue("deep/name.png"), staticBase())).toBe(
      "deep/name.png"
    );
  });

  it("gives the app an absolute base to load pictures from", () => {
    expect(
      assetBase("/static-abc", "http://127.0.0.1:5173/?composition=x")
    ).toBe("http://127.0.0.1:5173/static-abc/");
    expect(assetBase("", "http://127.0.0.1:5173/")).toBeNull();
  });

  it("offers pictures, since the control that reads it draws one", () => {
    expect(["a.png", "b.JPEG", "c.svg", "d.webp"].every(isImageName)).toBe(
      true
    );
    expect(["clip.mp4", "song.mp3", "notes.md"].some(isImageName)).toBe(false);
  });
});
