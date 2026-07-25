import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/studio/time";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const HAS_DIGIT = /\d/;
const ago = (ms: number) => relativeTime(NOW - ms, NOW);

describe("relativeTime", () => {
  it("reads as just now for anything under a minute", () => {
    expect(ago(0)).toBe("just now");
    expect(ago(59_000)).toBe("just now");
  });

  it("counts whole minutes, hours and days", () => {
    expect(ago(60_000)).toBe("1m ago");
    expect(ago(59 * 60_000)).toBe("59m ago");
    expect(ago(3_600_000)).toBe("1h ago");
    expect(ago(23 * 3_600_000)).toBe("23h ago");
    expect(ago(24 * 3_600_000)).toBe("1d ago");
    expect(ago(6 * 24 * 3_600_000)).toBe("6d ago");
  });

  it("falls back to a date once a week has passed", () => {
    expect(ago(7 * 24 * 3_600_000)).toMatch(HAS_DIGIT);
    expect(ago(7 * 24 * 3_600_000)).not.toContain("ago");
  });

  it("never counts backwards when a clock has drifted", () => {
    expect(relativeTime(NOW + 60_000, NOW)).toBe("just now");
  });
});
