import { describe, expect, it } from "vitest";
import { elapsedTime, relativeTime, runningTime } from "@/lib/studio/time";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const HAS_DIGIT = /\d/;
const ago = (ms: number) => relativeTime(NOW - ms, NOW);
const since = (ms: number) => elapsedTime(NOW - ms, NOW);
const running = (ms: number) => runningTime(NOW - ms, NOW);

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

describe("elapsedTime", () => {
  it("stays under a minute rather than rounding to zero", () => {
    expect(since(0)).toBe("<1m");
    expect(since(59_000)).toBe("<1m");
  });

  it("counts minutes while a wait is worth watching", () => {
    expect(since(60_000)).toBe("1m");
    expect(since(4 * 60_000)).toBe("4m");
    expect(since(59 * 60_000)).toBe("59m");
  });

  it("keeps the minutes beside the hours", () => {
    expect(since(3_600_000)).toBe("1h");
    expect(since(3_600_000 + 5 * 60_000)).toBe("1h 5m");
    expect(since(23 * 3_600_000)).toBe("23h");
  });

  it("gives up on precision after a day", () => {
    expect(since(24 * 3_600_000)).toBe("1d");
    expect(since(9 * 24 * 3_600_000)).toBe("9d");
  });

  it("never counts backwards when a clock has drifted", () => {
    expect(elapsedTime(NOW + 60_000, NOW)).toBe("<1m");
  });
});

describe("runningTime", () => {
  it("counts seconds through the first minute", () => {
    expect(running(0)).toBe("0s");
    expect(running(12_000)).toBe("12s");
    expect(running(59_999)).toBe("59s");
  });

  it("keeps the seconds beside the minutes", () => {
    expect(running(60_000)).toBe("1m 0s");
    expect(running(125_000)).toBe("2m 5s");
    expect(running(59 * 60_000 + 59_000)).toBe("59m 59s");
  });

  it("stops counting seconds once an hour has passed", () => {
    expect(running(3_600_000)).toBe("1h");
    expect(running(3_600_000 + 5 * 60_000 + 30_000)).toBe("1h 5m");
    expect(running(24 * 3_600_000)).toBe("1d");
  });

  it("never counts backwards when a clock has drifted", () => {
    expect(runningTime(NOW + 60_000, NOW)).toBe("0s");
  });
});
