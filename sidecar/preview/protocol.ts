import { Schema } from "effect";
import { Still, StillEvent } from "@/shared/ipc";

export const RENDER_BASE = "/__remocn/render";

export const HostCommand = Schema.Struct({
  composition: Schema.NonEmptyString,
  frame: Schema.Int,
  id: Schema.NonEmptyString,
  type: Schema.Literal("still"),
});

export const HostReply = Schema.Union([
  Schema.Struct({
    event: StillEvent,
    id: Schema.NonEmptyString,
    type: Schema.Literal("still-progress"),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    still: Still,
    type: Schema.Literal("still-done"),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    message: Schema.String,
    type: Schema.Literal("still-failed"),
  }),
]);

export type HostCommand = (typeof HostCommand)["Type"];
export type HostReply = (typeof HostReply)["Type"];

export const decodeHostCommand = Schema.decodeExit(
  Schema.fromJsonString(HostCommand)
);

export const decodeHostReply = Schema.decodeExit(
  Schema.fromJsonString(HostReply)
);
