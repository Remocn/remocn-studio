import { describe, expect, it, mock } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import {
  StudioObjects,
  useStudioObject,
} from "../templates/remotion/src/lib/studio-objects-v1";
import { documentFixture } from "../test/fixtures/studio-document";
import { managedIdentity, managedRoot } from "./managed-objects";

const v1Document = documentFixture as React.ComponentProps<
  typeof StudioObjects
>["document"];

mock.module("remotion", () => ({ useCurrentFrame: () => 12 }));

it("v7 preserves geometry, text, switch and easing readers", async () => {
  const v7 = await import("../templates/remotion/src/lib/studio-objects-v7");
  const data = {
    ...documentFixture,
    definitions: [
      {
        fields: [
          ...["x", "y", "width", "height"].map((id) => ({
            id,
            type: "number",
            unit: "px",
          })),
          { id: "text", type: "text" },
          { id: "curve", type: "easing" },
          { id: "visible", type: "boolean" },
        ],
        id: "box",
        version: 1,
      },
    ],
    objects: [
      {
        definition: "box",
        id: "box-1",
        label: "Box",
        parentId: null,
        values: {
          curve: [0, 0, 1, 1],
          height: 40,
          text: "Hello",
          visible: true,
          width: 100,
          x: 10,
          y: 20,
        },
      },
    ],
  };
  function Box() {
    const object = v7.useStudioObject("box-1");
    const geometry = object.geometry(
      { height: "height", width: "width", x: "x", y: "y" },
      { offset: { x: 5 }, scale: 2 }
    );
    return (
      <div
        {...object.bind}
        {...object.bindText("text")}
        {...geometry.bind}
        data-curve={object.easing("curve").join(",")}
        data-visible={object.flag("visible")}
        style={geometry.style}
      >
        {object.text("text")}
      </div>
    );
  }
  render(
    <v7.StudioObjects document={data}>
      <Box />
    </v7.StudioObjects>
  );
  const box = screen.getByText("Hello");
  expect(box.style.left).toBe("15px");
  expect(box.style.width).toBe("100px");
  expect(box.style.scale).toBe("2");
  expect(box.getAttribute("data-studio-geometry-frame")).toBe("12");
  expect(box.getAttribute("data-studio-text-field")).toBe("text");
  expect(box.getAttribute("data-curve")).toBe("0,0,1,1");
  expect(box.getAttribute("data-visible")).toBe("true");
});

function Heading({ id }: { id: string }) {
  const object = useStudioObject(id);
  return (
    <h1 {...object.bind} style={{ fontSize: object.number("size") }}>
      <span>{object.text("text")}</span>
    </h1>
  );
}

describe("managed runtime", () => {
  it("binds independent repeated roots without introducing layout wrappers", () => {
    const { container } = render(
      <StudioObjects document={v1Document}>
        <Heading id="first" />
        <Heading id="third" />
      </StudioObjects>
    );
    expect(container.children).toHaveLength(2);
    const word = screen.getByText("third");
    const root = managedRoot(word, container);
    expect(root?.tagName).toBe("H1");
    expect(root?.getAttribute("data-studio-object")).toBe("third");
    if (root === null) {
      throw new Error("Missing root");
    }
    expect(managedIdentity(root)?.video).toBe("intro");
    expect(
      screen
        .getByText("first")
        .parentElement?.getAttribute("data-studio-object")
    ).toBe("first");
  });
  it("previews only matching-generation drafts and keeps repeated objects independent", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "parent");
    const parent = { postMessage: mock() };
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parent,
    });
    const view = render(
      <StudioObjects document={v1Document}>
        <Heading id="first" />
        <Heading id="third" />
      </StudioObjects>
    );
    try {
      const generation = view.container.firstElementChild?.getAttribute(
        "data-studio-generation"
      );
      const post = (
        value: number,
        token: string | null | undefined,
        source: unknown = parent
      ) =>
        act(() => {
          window.dispatchEvent(
            new MessageEvent("message", {
              data: {
                field: "size",
                generation: token,
                objectId: "third",
                source: "remocn-studio",
                type: "studio.draft",
                value,
              },
              source: source as Window,
            })
          );
        });
      post(72, generation);
      expect(screen.getByText("third").parentElement?.style.fontSize).toBe(
        "72px"
      );
      expect(screen.getByText("first").parentElement?.style.fontSize).toBe(
        "48px"
      );
      post(90, "stale");
      post(120, generation, window);
      expect(screen.getByText("third").parentElement?.style.fontSize).toBe(
        "72px"
      );
      expect(parent.postMessage).toHaveBeenCalled();
    } finally {
      view.unmount();
      if (descriptor) {
        Object.defineProperty(window, "parent", descriptor);
      }
    }
  });
});
