import { Schema } from "effect";
import { ExportEvent, Exported, Still, StillEvent } from "@/shared/ipc";

export const RENDER_BASE = "/__remocn/render";

export const HostCommand = Schema.Union([
  Schema.Struct({
    composition: Schema.NonEmptyString,
    frame: Schema.Int,
    id: Schema.NonEmptyString,
    type: Schema.Literal("still"),
  }),
  Schema.Struct({
    composition: Schema.NonEmptyString,
    id: Schema.NonEmptyString,
    type: Schema.Literal("warm"),
  }),
  Schema.Struct({
    composition: Schema.NonEmptyString,
    id: Schema.NonEmptyString,
    type: Schema.Literal("export"),
  }),
  Schema.Struct({
    composition: Schema.NonEmptyString,
    frame: Schema.Int,
    id: Schema.NonEmptyString,
    type: Schema.Literal("clip"),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    type: Schema.Literal("cancel"),
  }),
]);

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
    type: Schema.Literal("warm-done"),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    message: Schema.String,
    type: Schema.Literal("still-failed"),
  }),
  Schema.Struct({
    event: ExportEvent,
    id: Schema.NonEmptyString,
    type: Schema.Literal("export-progress"),
  }),
  Schema.Struct({
    exported: Exported,
    id: Schema.NonEmptyString,
    type: Schema.Literal("export-done"),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    message: Schema.String,
    type: Schema.Literal("export-failed"),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    path: Schema.NonEmptyString,
    type: Schema.Literal("clip-done"),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    message: Schema.String,
    type: Schema.Literal("clip-failed"),
  }),
]);

export type HostCommand = (typeof HostCommand)["Type"];
export type HostReply = (typeof HostReply)["Type"];
export type StillCommand = Extract<HostCommand, { type: "still" | "warm" }>;
export type ExportCommand = Extract<HostCommand, { type: "export" }>;
export type ClipCommand = Extract<HostCommand, { type: "clip" }>;

export const decodeHostCommand = Schema.decodeExit(
  Schema.fromJsonString(HostCommand)
);

export const decodeHostReply = Schema.decodeExit(
  Schema.fromJsonString(HostReply)
);
