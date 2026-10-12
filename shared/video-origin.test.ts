import { expect, it } from "bun:test";
import { Exit, Schema } from "effect";
import { VideoOrigin } from "./video-origin";

const decode = Schema.decodeUnknownExit(VideoOrigin);

it.each(["0.9.9", "1.0.0", "1.0.0-rc.1", "1.0.1+build.4", "2.0.0-beta.1"])(
  "records exact creation version %s independently of eligibility",
  (version) => {
    const origin = { createdWithStudioVersion: version, version: 1 };
    expect(decode(origin)).toEqual(Exit.succeed(origin));
  }
);

it.each([
  "",
  "1",
  "1.0",
  "^1.0.0",
  "v1.0.0",
  "01.0.0",
  "1.0.0-01",
  "1.0.0-",
  "1.0.0+",
  " 1.0.0",
])("rejects invalid creation version %s", (version) => {
  expect(
    Exit.isFailure(decode({ createdWithStudioVersion: version, version: 1 }))
  ).toBe(true);
});

it("rejects missing or unsupported metadata formats", () => {
  for (const origin of [
    null,
    {},
    { version: 1 },
    { createdWithStudioVersion: "1.0.0", version: 2 },
  ]) {
    expect(Exit.isFailure(decode(origin))).toBe(true);
  }
});
