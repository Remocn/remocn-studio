import { describe, expect, it } from "vitest";
import { attachmentOf, mediaLabel } from "@/lib/studio/attachments";

describe("attachmentOf", () => {
  it("reads the name and media type from the path", () => {
    expect(attachmentOf("/Users/me/Desktop/Shot 1.PNG")).toEqual({
      mediaType: "image/png",
      name: "Shot 1.PNG",
      path: "/Users/me/Desktop/Shot 1.PNG",
    });
  });

  it("treats jpg and jpeg as the same media type", () => {
    expect(attachmentOf("/a/b.jpg")?.mediaType).toBe("image/jpeg");
    expect(attachmentOf("/a/b.jpeg")?.mediaType).toBe("image/jpeg");
  });

  it("refuses anything the model cannot look at", () => {
    expect(attachmentOf("/a/b.mp4")).toBeNull();
    expect(attachmentOf("/a/b")).toBeNull();
  });
});

describe("mediaLabel", () => {
  it("names the format in the way a chip can show it", () => {
    expect(mediaLabel("image/webp")).toBe("WEBP");
  });
});
