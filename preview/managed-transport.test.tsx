import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, render, screen } from "@testing-library/react";
import { Exit } from "effect";
import type { ComponentType, ReactNode } from "react";
import { decodePreviewMessage } from "@/lib/studio/preview";
import { MESH_GRADIENT, shaderCreation } from "@/shared/shaders";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import { type TestSurface, withSurface } from "@/test/surface";
import { documentFixture } from "../test/fixtures/studio-document";
import managedLoader from "./managed-loader.cjs";
import { managedTransport } from "./managed-transport";
import type { MessageOf, PreviewCommand } from "./protocol";

mock.module("remotion", () => ({ useCurrentFrame: () => 0 }));

function runtimePath(version: string) {
  return path.resolve(
    import.meta.dir,
    `../templates/remotion/src/lib/studio-objects-v${version}/index.tsx`
  );
}

interface Reader {
  bind: Record<string, string>;
  number: (field: string) => number;
  palette: (field: string) => readonly string[];
  text: (field: string) => string;
}

let v5: {
  StudioObjects: ComponentType<{ children: ReactNode; document: unknown }>;
  useStudioObject: (id: string) => Reader;
};

function Heading({ id }: { id: string }) {
  const object = v5.useStudioObject(id);
  return (
    <h1 {...object.bind} data-size={object.number("size")}>
      {object.text("text")}
    </h1>
  );
}

let surface: TestSurface;
let restore: () => void;

beforeEach(() => {
  surface = withSurface();
  const parent = Object.getOwnPropertyDescriptor(window, "parent");
  const add = window.addEventListener;
  const remove = window.removeEventListener;
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: { postMessage: managedTransport.postMessage },
  });
  window.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    if (type === "message" && typeof listener === "function") {
      managedTransport.addEventListener("message", listener);
      return;
    }
    add.call(window, type, listener, options);
  }) as typeof window.addEventListener;
  window.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) => {
    if (type === "message" && typeof listener === "function") {
      managedTransport.removeEventListener("message", listener);
      return;
    }
    remove.call(window, type, listener, options);
  }) as typeof window.removeEventListener;
  restore = () => {
    window.addEventListener = add;
    window.removeEventListener = remove;
    if (parent) {
      Object.defineProperty(window, "parent", parent);
    }
  };
});

afterEach(() => {
  restore();
});

function mounted() {
  return render(
    <v5.StudioObjects document={documentFixture}>
      <Heading id="first" />
      <Heading id="third" />
    </v5.StudioObjects>
  );
}

async function readies(): Promise<MessageOf<"studio.ready">[]> {
  await act(() => surface.flush());
  return surface.sent.filter(
    (message): message is MessageOf<"studio.ready"> =>
      message.type === "studio.ready"
  );
}

function generationOf(view: ReturnType<typeof render>): string {
  const generation = view.container.firstElementChild?.getAttribute(
    "data-studio-generation"
  );
  if (!generation) {
    throw new Error("The runtime rendered no generation.");
  }
  return generation;
}

function sizeOf(id: string): string | null {
  return screen.getByText(id).getAttribute("data-size");
}

describe.each(["5", "7"])(
  "the managed transport and runtime v%s",
  (version) => {
    beforeEach(async () => {
      v5 = (await import(runtimePath(version))) as unknown as typeof v5;
    });
    it("is a runtime the loader knows how to rewrite onto the transport", () => {
      const rewritten = managedLoader.call(
        { getOptions: () => ({ transport: "./managed-transport" }) },
        readFileSync(runtimePath(version), "utf8")
      );

      expect(rewritten).toContain(
        '__remocnTransport.addEventListener("message", receive)'
      );
      expect(rewritten).not.toContain("window.parent.postMessage(");
    });

    it("answers studio.request with studio.ready", async () => {
      const view = mounted();
      const before = (await readies()).length;

      act(() => surface.send({ type: "studio.request" }));
      const after = await readies();

      expect(after.length).toBe(before + 1);
      expect(after.at(-1)).toEqual({
        generation: generationOf(view),
        lastOperationId: null,
        source: "remocn-preview",
        type: "studio.ready",
        video: "intro",
      });
      expect(Exit.isSuccess(decodePreviewMessage(after.at(-1)))).toBe(true);
    });

    it("renders a draft the webview built", () => {
      const view = mounted();
      const draft: PreviewCommand = {
        field: "size",
        generation: generationOf(view),
        objectId: "third",
        type: "studio.draft",
        value: 72,
      };

      act(() => surface.send(draft));

      expect(sizeOf("third")).toBe("72");
      expect(sizeOf("first")).toBe("48");
    });

    it("renders a batch the webview built", () => {
      const view = mounted();
      const batch: PreviewCommand = {
        generation: generationOf(view),
        objectId: "first",
        type: "studio.batch",
        values: { size: 90, text: "renamed" },
      };

      act(() => surface.send(batch));

      expect(screen.getByText("renamed").getAttribute("data-size")).toBe("90");
    });

    it("stops delivering once the runtime unmounts", () => {
      const view = mounted();
      const generation = generationOf(view);
      view.unmount();

      expect(() =>
        surface.send({
          field: "size",
          generation,
          objectId: "third",
          type: "studio.draft",
          value: 10,
        })
      ).not.toThrow();
    });
    it.skipIf(version !== "7")(
      "renders ordered palette drafts and rejects invalid, stale or out-of-bounds palettes",
      () => {
        const creation = shaderCreation(
          MESH_GRADIENT,
          shaderTargetFixture,
          "insert",
          "shader-1",
          0
        );
        const document = {
          ...documentFixture,
          definitions: [...documentFixture.definitions, creation.definition],
          objects: [...documentFixture.objects, creation.object],
        };
        function PaletteReader() {
          const object = v5.useStudioObject("shader-1");
          return (
            <output {...object.bind}>
              {object.palette("colors").join(",")}
            </output>
          );
        }
        const view = render(
          <v5.StudioObjects document={document}>
            <PaletteReader />
          </v5.StudioObjects>
        );
        const generation = generationOf(view);
        const colors = ["#ff0000", "#00000000", "#ff0000"];
        act(() =>
          surface.send({
            field: "colors",
            generation,
            objectId: "shader-1",
            type: "studio.draft",
            value: colors,
          })
        );
        expect(screen.getByRole("status").textContent).toBe(colors.join(","));
        for (const value of [
          [],
          ["red"],
          new Array(11).fill("#000000"),
          [0, 0, 1, 1] as const,
        ]) {
          act(() =>
            surface.send({
              field: "colors",
              generation,
              objectId: "shader-1",
              type: "studio.draft",
              value,
            })
          );
          expect(screen.getByRole("status").textContent).toBe(colors.join(","));
        }
        act(() =>
          surface.send({
            field: "colors",
            generation: "old",
            objectId: "shader-1",
            type: "studio.draft",
            value: ["#ffffff"],
          })
        );
        expect(screen.getByRole("status").textContent).toBe(colors.join(","));
        view.rerender(
          <v5.StudioObjects
            document={{
              ...document,
              objects: document.objects.map((object) =>
                object.id === "shader-1"
                  ? {
                      ...object,
                      values: { ...object.values, colors: ["#abcdef"] },
                    }
                  : object
              ),
            }}
          >
            <PaletteReader />
          </v5.StudioObjects>
        );
        expect(screen.getByRole("status").textContent).toBe("#abcdef");
      }
    );
  }
);
