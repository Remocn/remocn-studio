import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("lets the last conflicting tailwind utility win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("keeps utilities that only look conflicting", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });
});
