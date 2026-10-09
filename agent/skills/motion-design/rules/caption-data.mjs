import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export async function sourceIdentity(path, audioTrack = 0) {
  if (!Number.isInteger(audioTrack) || audioTrack < 0)
    throw new Error("Choose a valid audio track index.");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return { path: resolve(path), sha256: hash.digest("hex"), audioTrack };
}

/** @param {{startMs: number, endMs: number | null}} [interval] */
export function matchesSource(
  provenance,
  source,
  interval = { startMs: 0, endMs: null }
) {
  return (
    provenance?.source?.sha256 === source.sha256 &&
    provenance?.source?.audioTrack === source.audioTrack &&
    Number.isFinite(interval.startMs) &&
    provenance.startMs <= interval.startMs &&
    (provenance.endMs === null ||
      (interval.endMs !== null &&
        Number.isFinite(interval.endMs) &&
        interval.endMs <= provenance.endMs &&
        interval.endMs > interval.startMs))
  );
}

export function validateCaptions(captions) {
  if (!Array.isArray(captions) || captions.length === 0)
    throw new Error("The transcript contains no speech captions.");
  let previous = -Infinity;
  for (const caption of captions) {
    if (
      typeof caption.text !== "string" ||
      !caption.text.trim() ||
      !Number.isFinite(caption.startMs) ||
      !Number.isFinite(caption.endMs) ||
      caption.startMs < 0 ||
      caption.endMs <= caption.startMs ||
      caption.startMs < previous
    )
      throw new Error(
        "The transcript contains invalid or out-of-order word timings."
      );
    if (caption.timestampMs !== null && !Number.isFinite(caption.timestampMs))
      throw new Error("The transcript has an invalid timestamp.");
    if (
      caption.confidence !== null &&
      (!Number.isFinite(caption.confidence) ||
        caption.confidence < 0 ||
        caption.confidence > 1)
    )
      throw new Error("The transcript has an invalid confidence value.");
    previous = caption.startMs;
  }
  return captions;
}

export async function publishTranscript(
  directory,
  captions,
  provenance,
  signal
) {
  signal?.throwIfAborted();
  validateCaptions(captions);
  if (
    !provenance?.source?.path ||
    !/^[a-f0-9]{64}$/.test(provenance.source.sha256) ||
    !Number.isInteger(provenance.source.audioTrack) ||
    provenance.source.audioTrack < 0 ||
    !Number.isFinite(provenance.startMs) ||
    provenance.startMs < 0 ||
    (provenance.endMs !== null &&
      (!Number.isFinite(provenance.endMs) ||
        provenance.endMs <= provenance.startMs)) ||
    !provenance.language ||
    !provenance.backend ||
    !provenance.model
  )
    throw new Error(
      "Record the transcript source, interval, language, backend and model before saving."
    );
  const target = resolve(directory);
  const exists = await access(target).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  );
  if (exists)
    throw new Error(
      "A transcript already exists here. Reuse it or choose a new directory."
    );
  const staging = join(dirname(target), `.${basename(target)}-${randomUUID()}`);
  await mkdir(staging, { recursive: true });
  try {
    await writeFile(
      join(staging, "captions.json"),
      `${JSON.stringify(captions, null, 2)}\n`
    );
    await writeFile(
      join(staging, "source.json"),
      `${JSON.stringify(provenance, null, 2)}\n`
    );
    signal?.throwIfAborted();
    await rename(staging, target);
  } finally {
    await rm(staging, { force: true, recursive: true });
  }
  return join(target, "captions.json");
}
