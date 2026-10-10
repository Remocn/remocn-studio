import { describe, expect, it } from "bun:test";
import type { Updates } from "@/hooks/use-updates";
import { updateSummary } from "./update-status";

const CHECKED: Updates = {
  check: async () => undefined,
  download: null,
  environment: "production",
  error: null,
  hasChecked: true,
  install: async () => undefined,
  isChecking: false,
  isInstalling: false,
  os: "Arch Linux",
  release: null,
  unavailable: null,
  version: "1.0.1",
};

describe("updateSummary", () => {
  it("calls this build the newest once a check found nothing newer", () => {
    expect(updateSummary(CHECKED)).toBe("This is the newest release");
  });

  // The error line under the summary says what went wrong; above it, the
  // summary must not claim the check found this build current.
  it("claims nothing about the newest release when the check failed", () => {
    expect(
      updateSummary({
        ...CHECKED,
        error: "The newest release has no build for this system yet.",
      })
    ).toBe("Could not tell whether a newer build is out");
  });

  it("still names a release that is out when installing it failed", () => {
    expect(
      updateSummary({
        ...CHECKED,
        error: "Failed to install package",
        release: { body: null, date: null, version: "1.1.0" },
      })
    ).toBe("1.1.0 is out, and this build is older");
  });
});
