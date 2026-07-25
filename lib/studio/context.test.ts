import { describe, expect, it } from "vitest";
import { compactTokens, contextReading } from "@/lib/studio/context";

describe("contextReading", () => {
  it("reports how much of the window is used and what is left", () => {
    expect(contextReading({ maxTokens: 200_000, totalTokens: 84_231 })).toEqual(
      {
        percent: 42,
        remaining: "116k",
        used: "84k",
      }
    );
  });

  it("never reports more than a full window", () => {
    expect(
      contextReading({ maxTokens: 200_000, totalTokens: 260_000 })
    ).toEqual({ percent: 100, remaining: "0", used: "200k" });
  });

  it("survives a window the CLI did not report", () => {
    expect(contextReading({ maxTokens: 0, totalTokens: 0 }).percent).toBe(0);
  });
});

describe("compactTokens", () => {
  it("keeps small counts exact", () => {
    expect(compactTokens(842)).toBe("842");
  });

  it("shortens thousands and millions", () => {
    expect(compactTokens(1200)).toBe("1.2k");
    expect(compactTokens(84_231)).toBe("84k");
    expect(compactTokens(1_000_000)).toBe("1.0M");
  });
});
