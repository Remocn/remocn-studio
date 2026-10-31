import { Schema } from "effect";

export const SOUND_FORMATS = ["mp3_44100_128", "mp3_44100_192"] as const;
export const SOUND_MODEL = "eleven_text_to_sound_v2";
export const SoundFormat = Schema.Literals(SOUND_FORMATS);
const text = Schema.String.check(
  Schema.makeFilter((value) => value.trim().length > 0 && value.length <= 5000)
);

export const SoundRequest = Schema.Struct({
  connectionId: Schema.NonEmptyString,
  durationSeconds: Schema.NullOr(
    Schema.Finite.check(Schema.isBetween({ maximum: 30, minimum: 0.5 }))
  ),
  format: SoundFormat,
  kind: Schema.optionalKey(Schema.Literal("sound")),
  name: text,
  text,
});
export type SoundRequest = typeof SoundRequest.Type;

export const MUSIC_MODEL = "music_v1";
export const MusicRequest = Schema.Struct({
  connectionId: Schema.NonEmptyString,
  durationSeconds: Schema.NullOr(
    Schema.Finite.check(Schema.isBetween({ maximum: 600, minimum: 3 }))
  ),
  forceInstrumental: Schema.Boolean,
  format: Schema.Literal("mp3_44100_128"),
  kind: Schema.Literal("music"),
  name: text,
  text: Schema.String.check(
    Schema.makeFilter(
      (value) => value.trim().length > 0 && value.length <= 4100
    )
  ),
});
export type MusicRequest = typeof MusicRequest.Type;
export const SPEECH_MODELS = [
  "elevenlabs/eleven-v4",
  "elevenlabs/eleven-v4-turbo",
] as const;
export const SpeechRequest = Schema.Struct({
  connectionId: Schema.NonEmptyString,
  durationSeconds: Schema.Null,
  format: Schema.Literal("mp3"),
  kind: Schema.Literal("speech"),
  model: Schema.Literals(SPEECH_MODELS),
  name: text,
  text: Schema.String.check(
    Schema.makeFilter(
      (value) => value.trim().length > 0 && Array.from(value).length <= 10_000
    )
  ),
  voice: Schema.NonEmptyString,
});
export type SpeechRequest = typeof SpeechRequest.Type;
export const AudioRequest = Schema.Union([
  SpeechRequest,
  MusicRequest,
  SoundRequest,
]);
export type AudioRequest = typeof AudioRequest.Type;

export const SoundRef = Schema.Struct({ id: Schema.NonEmptyString });
export const SoundOperation = Schema.Struct({
  account: Schema.NullOr(Schema.String),
  connectionName: Schema.NonEmptyString,
  cost: Schema.NullOr(Schema.String),
  createdAt: Schema.Int,
  detail: Schema.NullOr(Schema.String),
  file: Schema.NullOr(Schema.NonEmptyString),
  id: Schema.NonEmptyString,
  model: Schema.optionalKey(Schema.NonEmptyString),
  provider: Schema.optionalKey(Schema.Literals(["elevenlabs", "openrouter"])),
  providerRequestId: Schema.NullOr(Schema.String),
  request: AudioRequest,
  state: Schema.Literals([
    "prepared",
    "generating",
    "completed",
    "imported",
    "failed",
    "uncertain",
    "cancelled",
  ]),
});
export type SoundOperation = typeof SoundOperation.Type;

export const GeneratedSoundSource = Schema.Struct({
  author: Schema.String,
  authorUrl: Schema.String,
  connectionId: Schema.NonEmptyString,
  connectionName: Schema.NonEmptyString,
  durationSeconds: SoundRequest.fields.durationSeconds,
  format: SoundFormat,
  id: Schema.NonEmptyString,
  model: Schema.Literal(SOUND_MODEL),
  provider: Schema.Literal("elevenlabs"),
  text,
  url: Schema.String,
});

export const GeneratedMusicSource = Schema.Struct({
  ...GeneratedSoundSource.fields,
  durationSeconds: MusicRequest.fields.durationSeconds,
  forceInstrumental: Schema.Boolean,
  format: MusicRequest.fields.format,
  model: Schema.Literal(MUSIC_MODEL),
});

export const GeneratedOpenRouterSource = Schema.Struct({
  ...GeneratedSoundSource.fields,
  durationSeconds: Schema.NullOr(Schema.Finite),
  forceInstrumental: Schema.optionalKey(Schema.Boolean),
  format: Schema.String,
  kind: Schema.Literals(["sound", "music", "speech"]),
  model: Schema.NonEmptyString,
  provider: Schema.Literal("openrouter"),
  text: Schema.String,
  voice: Schema.optionalKey(Schema.String),
});

export function audioProvider(operation: SoundOperation): string {
  return operation.provider === "openrouter" ? "OpenRouter" : "ElevenLabs";
}

export function audioFormat(operation: SoundOperation): string {
  return operation.provider === "openrouter" ? "mp3" : operation.request.format;
}

export function audioKind(request: AudioRequest): string {
  return { music: "music", sound: "sound effect", speech: "narration" }[
    request.kind ?? "sound"
  ];
}

function requestSummary(request: AudioRequest): string {
  if (request.kind === "music") {
    return `Music · ${request.forceInstrumental ? "Instrumental" : "Vocals allowed"}`;
  }
  if (request.kind === "speech") {
    return `Narration · ${request.model} · ${request.voice}`;
  }
  return "Sound effect";
}

export function soundSummary(operation: SoundOperation): string {
  const { request } = operation;
  return [
    `${audioProvider(operation)} · ${operation.connectionName}${operation.account === null ? "" : ` (${operation.account})`}`,
    requestSummary(request),
    request.text,
    `Duration: ${request.durationSeconds === null ? "Automatic" : `${request.durationSeconds} seconds`}`,
    `Format: ${audioFormat(operation)}`,
    ...(operation.model ? [`Model: ${operation.model}`] : []),
    ...(operation.provider === "openrouter" && request.durationSeconds !== null
      ? ["Duration is a prompt request, not a guaranteed output length."]
      : []),
    `This request spends credits on your ${audioProvider(operation)} account. Send once; no automatic paid retry.`,
  ].join("\n");
}
