import { describe, expect, it } from "vitest";
import {
  dropReference,
  dropReferences,
  insertReferences,
  lostReferences,
  referenceAt,
  referenceOf,
  segmentsOf,
} from "@/shared/references";

function dropped(source: string, index: number, count: number): string {
  return dropReference(source, index, count).text;
}

function shape(source: string, count: number) {
  return segmentsOf(source, count).map((segment) =>
    segment.kind === "reference"
      ? { index: segment.index, kind: segment.kind }
      : { kind: segment.kind, text: segment.text }
  );
}

describe("referenceOf", () => {
  it("numbers attachments from one", () => {
    expect(referenceOf(0)).toBe("[Image #1]");
    expect(referenceOf(2)).toBe("[Image #3]");
  });
});

describe("segmentsOf", () => {
  it("leaves a message without references in one piece", () => {
    expect(shape("build a title card", 2)).toEqual([
      { kind: "text", text: "build a title card" },
    ]);
  });

  it("cuts the text at every reference", () => {
    expect(shape("compare [Image #1] with [Image #2], please", 2)).toEqual([
      { kind: "text", text: "compare " },
      { index: 0, kind: "reference" },
      { kind: "text", text: " with " },
      { index: 1, kind: "reference" },
      { kind: "text", text: ", please" },
    ]);
  });

  it("keeps a reference past the last attachment as plain text", () => {
    expect(shape("use [Image #7] instead", 3)).toEqual([
      { kind: "text", text: "use [Image #7] instead" },
    ]);
  });

  it("resolves nothing when nothing is attached", () => {
    expect(shape("use [Image #1]", 0)).toEqual([
      { kind: "text", text: "use [Image #1]" },
    ]);
  });

  it("reads neither a zeroth image nor a padded number", () => {
    expect(shape("[Image #0] and [Image #01]", 3)).toEqual([
      { kind: "text", text: "[Image #0] and [Image #01]" },
    ]);
  });

  it("gives every segment its own id", () => {
    const ids = segmentsOf("a [Image #1] b [Image #2] c", 2).map(
      (segment) => segment.id
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("insertReferences", () => {
  it("puts the reference where the caret is", () => {
    expect(insertReferences("compare  with that", 8, 0, 1)).toEqual({
      caret: 18,
      text: "compare [Image #1] with that",
    });
  });

  it("leaves the caret after the reference", () => {
    const { caret, text } = insertReferences("look at", 7, 0, 1);

    expect(text).toBe("look at [Image #1] ");
    expect(caret).toBe(text.length);
  });

  it("spaces the reference off the words around it", () => {
    expect(insertReferences("look at", 7, 0, 1).text).toBe(
      "look at [Image #1] "
    );
    expect(insertReferences("", 0, 0, 1).text).toBe("[Image #1] ");
  });

  it("numbers a run of references in the order they arrived", () => {
    expect(insertReferences("", 0, 1, 3).text).toBe(
      "[Image #2] [Image #3] [Image #4] "
    );
  });

  it("changes nothing when nothing was attached", () => {
    expect(insertReferences("hello", 2, 0, 0)).toEqual({
      caret: 2,
      text: "hello",
    });
  });
});

describe("dropReference", () => {
  it("takes the reference out with the attachment", () => {
    expect(dropped("use [Image #1] here", 0, 1)).toBe("use here");
  });

  it("renumbers what is left so the text and the list agree", () => {
    expect(
      dropped("compare [Image #1] and [Image #2] and [Image #3]", 0, 3)
    ).toBe("compare and [Image #1] and [Image #2]");
  });

  it("leaves lower references where they are", () => {
    expect(
      dropped("compare [Image #1] and [Image #2] and [Image #3]", 1, 3)
    ).toBe("compare [Image #1] and and [Image #2]");
  });

  it("eats the space after the reference when there is none before it", () => {
    expect(dropped("[Image #1] and [Image #2]", 0, 2)).toBe("and [Image #1]");
  });

  it("leaves a number nobody was pointing at alone", () => {
    expect(dropped("use [Image #1] not [Image #7]", 0, 3)).toBe(
      "use not [Image #7]"
    );
  });

  it("removes every mention of the attachment that went", () => {
    expect(dropped("[Image #1] then [Image #1] again", 0, 1)).toBe(
      "then again"
    );
  });

  it("leaves the caret where the reference was", () => {
    const result = dropReference("compare [Image #1] and [Image #2]", 0, 2, 8);

    expect(result.text).toBe("compare and [Image #1]");
    expect(result.text.slice(0, result.caret)).toBe("compare");
  });

  it("follows the mention the caret was at, not the first", () => {
    const result = dropReference("[Image #1] then [Image #1]", 0, 1, 16);

    expect(result.text).toBe("then");
    expect(result.caret).toBe(4);
  });
});

describe("referenceAt", () => {
  const TEXT = "compare [Image #1] and [Image #2]";

  it("takes the whole reference when backspacing just after it", () => {
    expect(referenceAt(TEXT, 2, 18, false)).toEqual({
      end: 18,
      index: 0,
      start: 8,
    });
  });

  it("takes the whole reference from inside it, either way", () => {
    expect(referenceAt(TEXT, 2, 12, false)?.index).toBe(0);
    expect(referenceAt(TEXT, 2, 12, true)?.index).toBe(0);
  });

  it("takes the whole reference when deleting forward at its start", () => {
    expect(referenceAt(TEXT, 2, 8, true)?.index).toBe(0);
  });

  it("leaves the character before the reference to an ordinary backspace", () => {
    expect(referenceAt(TEXT, 2, 8, false)).toBeNull();
  });

  it("leaves the character after the reference to an ordinary delete", () => {
    expect(referenceAt(TEXT, 2, 18, true)).toBeNull();
  });

  it("is blind to a number past the last attachment", () => {
    expect(referenceAt("use [Image #7]", 3, 14, false)).toBeNull();
  });
});

describe("lostReferences", () => {
  it("reports the reference that left the text", () => {
    expect(
      lostReferences(
        "compare [Image #1] and [Image #2]",
        "compare and [Image #2]",
        2
      )
    ).toEqual([0]);
  });

  it("reports every reference a wholesale delete took", () => {
    expect(lostReferences("[Image #1] [Image #2] [Image #3]", "", 3)).toEqual([
      0, 1, 2,
    ]);
  });

  it("reports nothing when a reference is only mentioned once more", () => {
    expect(
      lostReferences("[Image #1]", "[Image #1] and [Image #1]", 1)
    ).toEqual([]);
  });

  it("reports nothing for an attachment that was never referenced", () => {
    expect(lostReferences("hello", "hell", 2)).toEqual([]);
  });
});

describe("dropReferences", () => {
  it("removes several at once and renumbers what survives", () => {
    expect(
      dropReferences("a [Image #1] b [Image #2] c [Image #3]", [0, 2], 3)
    ).toBe("a b [Image #1] c");
  });
});
