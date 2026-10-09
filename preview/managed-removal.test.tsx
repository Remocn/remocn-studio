import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import type { StudioDocument } from "@/shared/studio-document";
import { documentFixture } from "../test/fixtures/studio-document";

mock.module("remotion", () => ({ useCurrentFrame: () => 0 }));

interface Reader {
  bind: Record<string, string>;
  number: (field: string) => number;
  text: (field: string) => string;
}

type Provider = ComponentType<{ children: ReactNode; document: unknown }>;
type Hook = (id: string) => Reader;

let v6: { StudioObjects: Provider; useStudioObject: Hook };
let v5: { useStudioObject: Hook };

beforeAll(async () => {
  v6 = (await import(
    "../templates/remotion/src/lib/studio-objects-v6"
  )) as unknown as typeof v6;
  v5 = (await import(
    "../templates/remotion/src/lib/studio-objects-v5"
  )) as unknown as typeof v5;
});

const grouped: StudioDocument = {
  ...documentFixture,
  objects: documentFixture.objects.map((item) =>
    item.id === "third" ? { ...item, parentId: "second" } : item
  ),
};

function removing(...ids: string[]): StudioDocument {
  return {
    ...grouped,
    objects: grouped.objects.map((item) =>
      ids.includes(item.id) ? { ...item, removed: true } : item
    ),
  };
}

function Heading({ id, legacy = false }: { id: string; legacy?: boolean }) {
  const object = (legacy ? v5 : v6).useStudioObject(id);
  return (
    <h1 {...object.bind} data-size={object.number("size")}>
      {object.text("text")}
    </h1>
  );
}

let runtimeVersion = "6";
function hidden(root: ParentNode): string {
  return (
    root.querySelector(`style[data-studio-runtime="${runtimeVersion}"]`)
      ?.textContent ?? ""
  );
}

describe.each(["6", "7"])("studio-objects-v%s", (version) => {
  beforeEach(async () => {
    runtimeVersion = version;
    v6 = (await import(
      `../templates/remotion/src/lib/studio-objects-v${version}`
    )) as unknown as typeof v6;
  });
  it("hides a removed object's root and keeps its values readable", () => {
    const { container } = render(
      <v6.StudioObjects document={removing("first")}>
        <Heading id="first" />
        <Heading id="second" />
      </v6.StudioObjects>
    );
    expect(hidden(container)).toBe(
      '[data-studio-object="first"]{display:none!important}'
    );
    const root = screen.getByText("first");
    expect(root.getAttribute("data-studio-object")).toBe("first");
    expect(root.getAttribute("data-size")).toBe("48");
    expect(getComputedStyle(root).display).toBe("none");
    expect(getComputedStyle(screen.getByText("second")).display).not.toBe(
      "none"
    );
  });

  it("hides a removed group's descendants with it", () => {
    const { container } = render(
      <v6.StudioObjects document={removing("second")}>
        <Heading id="second" />
        <Heading id="third" />
      </v6.StudioObjects>
    );
    expect(hidden(container).split("\n")).toEqual([
      '[data-studio-object="second"]{display:none!important}',
      '[data-studio-object="third"]{display:none!important}',
    ]);
  });

  it("marks itself and hides nothing when nothing is removed", () => {
    const { container } = render(
      <v6.StudioObjects document={grouped}>
        <Heading id="first" />
      </v6.StudioObjects>
    );
    expect(
      container.querySelector(`style[data-studio-runtime="${runtimeVersion}"]`)
    ).not.toBeNull();
    expect(hidden(container)).toBe("");
  });

  it.skipIf(version === "7")(
    "serves components that still import the hook from v5",
    () => {
      render(
        <v6.StudioObjects document={removing("first")}>
          <Heading id="second" legacy />
        </v6.StudioObjects>
      );
      expect(screen.getByText("second").getAttribute("data-size")).toBe("48");
    }
  );
  it.skipIf(version !== "7")(
    "rejects a legacy hook under the new provider instead of mixing contexts",
    () => {
      expect(() =>
        render(
          <v6.StudioObjects document={grouped}>
            <Heading id="first" legacy />
          </v6.StudioObjects>
        )
      ).toThrow("inside StudioObjects");
    }
  );
});
