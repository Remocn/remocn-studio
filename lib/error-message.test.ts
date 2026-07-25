import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/error-message";

describe("errorMessage", () => {
  it("unwraps an Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("passes a string through", () => {
    expect(errorMessage("dialog unavailable")).toBe("dialog unavailable");
  });

  it("serialises a rejected object instead of [object Object]", () => {
    expect(errorMessage({ code: 13, reason: "denied" })).toBe(
      '{"code":13,"reason":"denied"}'
    );
  });

  it("survives values JSON cannot represent", () => {
    expect(errorMessage(undefined)).toBe("undefined");
  });
});
