import { describe, expect, it, mock } from "bun:test";
import { Cause, Effect, Exit } from "effect";

const webcodecs = await import("@remotion/webcodecs");

let failure: unknown = null;

mock.module("@remotion/webcodecs", () => ({
  ...webcodecs,
  convertMedia: () => Promise.reject(failure),
}));

const { proxyFor, reasonOf } = await import("@/lib/studio/proxy");

describe("reasonOf", () => {
  it("follows the cause the library hides behind its own message", () => {
    const encoder = new DOMException("Encoder failure", "EncodingError");
    const failed = new Error(
      "Video encoder of track 1 failed (see .cause of this error)",
      { cause: encoder }
    );

    expect(reasonOf(failed)).toBe(
      "Video encoder of track 1 failed (see .cause of this error): Encoder failure"
    );
  });

  it("names a cause that says nothing by what it is", () => {
    const failed = new Error("Video decoder of track 1 failed", {
      cause: new DOMException("", "OperationError"),
    });

    expect(reasonOf(failed)).toBe(
      "Video decoder of track 1 failed: OperationError"
    );
  });

  it("is the message alone when there is no cause", () => {
    expect(reasonOf(new Error("Only mp4 is supported"))).toBe(
      "Only mp4 is supported"
    );
    expect(reasonOf("a string")).toBe("a string");
  });

  it("stops on a cause that leads back to itself", () => {
    const looped = new Error("again");
    looped.cause = looped;

    expect(reasonOf(looped).split(": ")).toHaveLength(5);
  });
});

describe("proxyFor", () => {
  it("fails with the cause a conversion failed for", async () => {
    failure = new Error(
      "VideoFrame processing queue of track 1 failed (see .cause of this error)",
      { cause: new Error("The frame could not be resized") }
    );

    const exit = await Effect.runPromiseExit(proxyFor(new Blob()));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.squash(exit.cause)).toMatchObject({
        _tag: "ProxyError",
        message: expect.stringContaining("The frame could not be resized"),
      });
    }
  });
});
