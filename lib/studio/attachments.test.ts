import { describe, expect, it } from "vitest";
import {
  attachmentOf,
  IMAGE_EXTENSIONS,
  isImageMediaType,
  isMediaType,
  isPlayable,
  mediaOf,
  PLAYABLE_EXTENSIONS,
} from "@/lib/studio/attachments";

describe("mediaOf", () => {
  it("reads a picture, a video and a sound off their extensions", () => {
    expect(mediaOf("/tmp/logo.PNG")).toEqual({
      mediaType: "image/png",
      name: "logo.PNG",
      path: "/tmp/logo.PNG",
    });
    expect(mediaOf("/tmp/intro.mp4")?.mediaType).toBe("video/mp4");
    expect(mediaOf("/tmp/clip.mov")?.mediaType).toBe("video/quicktime");
    expect(mediaOf("/tmp/theme.mp3")?.mediaType).toBe("audio/mpeg");
    expect(mediaOf("/tmp/voice.m4a")?.mediaType).toBe("audio/mp4");
  });

  it("answers null for anything the app cannot carry", () => {
    expect(mediaOf("/tmp/notes.md")).toBeNull();
    expect(mediaOf("/tmp/Makefile")).toBeNull();
    expect(mediaOf("")).toBeNull();
  });
});

describe("attachmentOf", () => {
  it("takes pictures, because only a picture can reach the model", () => {
    expect(attachmentOf("/tmp/shot.png")?.mediaType).toBe("image/png");
  });

  it("refuses video and audio, which travel as media instead", () => {
    expect(attachmentOf("/tmp/intro.mp4")).toBeNull();
    expect(attachmentOf("/tmp/theme.wav")).toBeNull();
  });
});

describe("the two extension lists", () => {
  it("split cleanly, with nothing in both", () => {
    const overlap = IMAGE_EXTENSIONS.filter((extension) =>
      PLAYABLE_EXTENSIONS.includes(extension)
    );

    expect(overlap).toEqual([]);
    expect(IMAGE_EXTENSIONS).toContain("png");
    expect(PLAYABLE_EXTENSIONS).toContain("mp4");
    expect(PLAYABLE_EXTENSIONS).toContain("wav");
  });
});

describe("isPlayable", () => {
  it("is what tells a file that plays from one the model can look at", () => {
    expect(isPlayable("image/png")).toBe(false);
    expect(isPlayable("video/mp4")).toBe(true);
    expect(isPlayable("audio/wav")).toBe(true);
  });
});

describe("the media type guards", () => {
  it("narrow to what the contract actually carries", () => {
    expect(isImageMediaType("image/png")).toBe(true);
    expect(isImageMediaType("video/mp4")).toBe(false);
    expect(isMediaType("video/mp4")).toBe(true);
    expect(isMediaType("application/pdf")).toBe(false);
  });
});
