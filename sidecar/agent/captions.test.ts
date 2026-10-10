import { expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  matchesSource,
  publishTranscript,
  sourceIdentity,
  validateCaptions,
} from "../../agent/skills/motion-design/rules/caption-data.mjs";
import { CAPTION_BRIEF } from "./captions";

const captions = [
  { confidence: 0.9, endMs: 100, startMs: 10, text: " Hello", timestampMs: 50 },
];
it("publishes validated source-bound captions without replacing corrected data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "caption-data-test-"));
  try {
    const media = join(dir, "speech.wav");
    await writeFile(media, "first speech source");
    const source = await sourceIdentity(media);
    const metadata = {
      backend: "test",
      endMs: null,
      language: "en",
      model: "fixture",
      source,
      startMs: 0,
    };
    const output = join(dir, "captions");
    const file = await publishTranscript(output, captions, metadata);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(captions);
    expect(
      JSON.parse(await readFile(join(output, "source.json"), "utf8"))
    ).toEqual(metadata);
    expect(matchesSource(metadata, await sourceIdentity(media))).toBe(true);
    expect(matchesSource(metadata, await sourceIdentity(media, 1))).toBe(false);
    const segment = { ...metadata, endMs: 5000, startMs: 1000 };
    expect(matchesSource(segment, source)).toBe(false);
    expect(matchesSource(segment, source, { endMs: 4000, startMs: 2000 })).toBe(
      true
    );
    expect(matchesSource(segment, source, { endMs: 6000, startMs: 2000 })).toBe(
      false
    );
    await writeFile(
      file,
      JSON.stringify([{ ...captions[0], text: " Corrected" }])
    );
    await expect(publishTranscript(output, captions, metadata)).rejects.toThrow(
      "already exists"
    );
    expect(await readFile(file, "utf8")).toContain("Corrected");
    await writeFile(media, "changed source at same path");
    expect(matchesSource(metadata, await sourceIdentity(media))).toBe(false);
    await expect(
      publishTranscript(join(dir, "invalid"), [], metadata)
    ).rejects.toThrow("no speech");
    expect(await readdir(dir)).toEqual(expect.not.arrayContaining(["invalid"]));
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(
      publishTranscript(
        join(dir, "cancelled"),
        captions,
        metadata,
        cancellation.signal
      )
    ).rejects.toThrow();
    expect(await readdir(dir)).toEqual(
      expect.not.arrayContaining(["cancelled"])
    );
    expect(
      (await readdir(dir)).some((name) => name.startsWith(".captions-"))
    ).toBe(false);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});
it("refuses invalid timestamps, absent fields and out-of-order data", () => {
  expect(() => validateCaptions([])).toThrow();
  expect(() => validateCaptions([{ ...captions[0], endMs: 0 }])).toThrow();
  expect(() =>
    validateCaptions([{ ...captions[0], startMs: Number.NaN }])
  ).toThrow();
  expect(() =>
    validateCaptions([{ ...captions[0], timestampMs: undefined }])
  ).toThrow();
  expect(() =>
    validateCaptions([captions[0], { ...captions[0], startMs: 0 }])
  ).toThrow();
});
it("routes a selected style to the supplied workflow without silently changing providers or styles", async () => {
  expect(CAPTION_BRIEF).toContain(
    "do not recreate its effect or substitute Basic Captions"
  );
  expect(CAPTION_BRIEF).toContain("never silently upload media");
  const guide = await readFile(
    "agent/skills/motion-design/rules/studio-captions.md",
    "utf8"
  );
  expect(guide).toContain("localMs = (sourceMs - trimMs) / rate");
  expect(guide).toContain("preserve the old valid transcript");
});
