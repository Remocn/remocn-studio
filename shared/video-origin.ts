import { Schema } from "effect";

export const VIDEO_ORIGIN_FILE = "studio-origin.json";
export const SHADER_UPGRADE_MIN_VERSION = "1.0.0";

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const VideoOrigin = Schema.Struct({
  createdWithStudioVersion: Schema.String.check(Schema.isPattern(SEMVER)),
  version: Schema.Literal(1),
});
