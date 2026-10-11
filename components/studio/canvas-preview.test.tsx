import { describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createRef } from "react";
import {
  CanvasStage,
  InspectorPanel,
  InspectorToggle,
} from "@/components/studio/canvas-preview";
import type { CanvasLayers } from "@/hooks/use-canvas-layers";
import {
  type PreviewCameraControl,
  usePreviewCamera,
} from "@/hooks/use-preview-camera";

type Metadata = ComponentProps<typeof CanvasStage>["metadata"];

const VIDEO = {
  durationInFrames: 90,
  fps: 30,
  height: 1080,
  width: 1920,
} as Metadata;

function mount() {
  const view: { current: PreviewCameraControl | null } = { current: null };
  const nativeStage = createRef<HTMLDivElement>();
  function Harness() {
    const camera = usePreviewCamera(VIDEO, null, () => undefined);
    view.current = camera;
    return (
      <div ref={camera.viewport}>
        <CanvasStage
          camera={camera}
          metadata={VIDEO}
          nativeStage={nativeStage}
          shown
          watching={false}
        />
      </div>
    );
  }
  render(<Harness />);
  const stage = nativeStage.current?.parentElement as HTMLElement;
  const toggle = () =>
    act(() => {
      view.current?.toggleOutside();
    });
  return { stage, toggle };
}

describe("CanvasStage", () => {
  it("lets content outside the frame show while it is dimmed", () => {
    const { stage } = mount();

    expect(stage).not.toHaveClass("overflow-clip");
  });

  it("clips the video to the frame while content outside is hidden", () => {
    const { stage, toggle } = mount();

    toggle();
    expect(stage).toHaveClass("overflow-clip");

    toggle();
    expect(stage).not.toHaveClass("overflow-clip");
  });
});

function layersOf(shown: boolean, floating = false) {
  return {
    active: shown ? "layers" : null,
    enabled: false,
    floating,
    onView: mock(),
    shown,
    toggle: mock(),
    view: "layers",
  } as unknown as CanvasLayers;
}

describe("InspectorToggle", () => {
  it("reads as pressed while the inspector is open and hides it on click", async () => {
    const layers = layersOf(true);
    render(<InspectorToggle layers={layers} />);
    const toggle = screen.getByRole("button", { name: "Inspector" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.focus(toggle);
    expect(
      await screen.findByText("Hide layers and properties")
    ).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(layers.toggle).toHaveBeenCalledTimes(1);
  });

  it("stays in place unpressed while the inspector is closed and shows it on click", async () => {
    const layers = layersOf(false);
    render(<InspectorToggle layers={layers} />);
    const toggle = screen.getByRole("button", { name: "Inspector" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.focus(toggle);
    expect(
      await screen.findByText("Show layers and properties")
    ).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(layers.toggle).toHaveBeenCalledTimes(1);
  });
});

describe("InspectorPanel", () => {
  const panel = (layers: CanvasLayers) =>
    render(
      <InspectorPanel
        duration="0:03"
        hasSelection={false}
        layers={layers}
        metadata={VIDEO}
        videoName="Intro"
      />
    );

  it("holds only its views, with no show or hide control of its own", () => {
    panel(layersOf(true));
    const bar = screen.getByRole("navigation", { name: "Inspector views" });
    expect(
      within(bar)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Video details", "Inspect"]);
  });

  it("sits its docked bar on the toolbar's line below the ruler, and a floating one at its top", () => {
    const docked = panel(layersOf(true));
    expect(
      screen.getByRole("navigation", { name: "Inspector views" }).className
    ).toContain("pt-[calc(var(--canvas-ruler)+0.5rem)]");
    docked.unmount();
    panel(layersOf(true, true));
    expect(
      screen.getByRole("navigation", { name: "Inspector views" }).className
    ).not.toContain("--canvas-ruler");
  });
});
