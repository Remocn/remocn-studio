import { expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { ShaderInsertion } from "@/hooks/use-shader-insertion";
import type { Asset } from "@/shared/library";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import { ShadersPane } from "./shaders-pane";

const ATTACH = /attach/i;
const asset: Asset = {
  audiomap: null,
  category: "Shaders",
  clip: null,
  createdAt: 1,
  dependencies: [],
  description: "",
  duration: null,
  files: [],
  name: "Mesh Gradient",
  path: "/remocn/shader-mesh-gradient",
  preview: null,
  proxied: false,
  role: "scene",
  slug: "remocn/shader-mesh-gradient",
  source: null,
  type: "component",
};
function insertion(): ShaderInsertion {
  return {
    adaptation: false,
    blockExport: false,
    busy: false,
    cancel: mock(),
    canPrepare: false,
    eligible: [shaderTargetFixture],
    onPick: mock(),
    preparation: undefined,
    preparationDisabled: false,
    preparationError: null,
    prepareVideo: mock(),
    preparing: false,
    recovery: null,
    retry: mock(),
    selectTarget: mock(),
    state: null,
    target: shaderTargetFixture,
    unavailable: null,
    undo: mock(),
  };
}
it("inserts through the shader action and names its target without a composer attachment", () => {
  const action = insertion();
  render(
    <SidebarProvider>
      <ShadersPane
        assets={[asset]}
        error={null}
        insertion={action}
        isLoading={false}
        onRetry={mock()}
      />
    </SidebarProvider>
  );
  expect(screen.getByText("Add to Intro")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Mesh Gradient, Component" })
  );
  expect(action.onPick).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: ATTACH })).toBeNull();
});
it("keeps the refusal visible and disables insertion when the scene is unavailable", () => {
  const action = {
    ...insertion(),
    target: null,
    unavailable: "This video needs a shader slot.",
  };
  render(
    <SidebarProvider>
      <ShadersPane
        assets={[asset]}
        error={null}
        insertion={action}
        isLoading={false}
        onRetry={mock()}
      />
    </SidebarProvider>
  );
  expect(screen.getByText(action.unavailable)).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Add a shader" })).toBeDisabled();
});

it("renders a separate agent preparation action and disables shader cards until verification", () => {
  const action = {
    ...insertion(),
    canPrepare: true,
    eligible: [],
    preparation: {
      historyId: "chat",
      message: "Agent unavailable. Check Settings.",
      phase: "failed" as const,
    },
    target: null,
    unavailable: "This scene needs preparation.",
  };
  render(
    <SidebarProvider>
      <ShadersPane
        assets={[asset]}
        error={null}
        insertion={action}
        isLoading={false}
        onRetry={mock()}
      />
    </SidebarProvider>
  );
  expect(
    screen.getByRole("group", { name: "Add a shader" }).hasAttribute("disabled")
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry preparation" }));
  expect(action.prepareVideo).toHaveBeenCalledTimes(1);
  expect(action.onPick).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t prepare video");
  const details = screen
    .getByText("Agent unavailable. Check Settings.")
    .closest("details");
  expect(details).not.toHaveAttribute("open");
  expect(screen.queryByText(action.unavailable)).toBeNull();
});

it.each([
  ["preparing", "Preparing video…"],
  ["validating", "Checking video…"],
  ["activating", "Connecting shaders…"],
] as const)(
  "shows one compact %s status without a disabled action or duplicate explanation",
  (phase, label) => {
    const message = "The agent is preparing a working copy (attempt 1 of 3).";
    const action = {
      ...insertion(),
      canPrepare: true,
      eligible: [],
      preparation: { historyId: "chat", message, phase },
      preparationDisabled: true,
      preparing: true,
      target: null,
      unavailable: message,
    };
    render(
      <SidebarProvider>
        <ShadersPane
          assets={[asset]}
          error={null}
          insertion={action}
          isLoading={false}
          onRetry={mock()}
        />
      </SidebarProvider>
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(screen.queryByText(message)).toBeNull();
    expect(
      screen.queryByText("Select a video and scene to add a shader.")
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Preparing video…" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Prepare video" })).toBeNull();
    expect(screen.getByRole("group", { name: "Add a shader" })).toBeDisabled();
  }
);

it("offers preparation once, then returns to the scene target when ready", () => {
  const action = {
    ...insertion(),
    canPrepare: true,
    eligible: [],
    target: null,
    unavailable: "Unsupported authored scene root.",
  };
  const pane = (value: ShaderInsertion) => (
    <SidebarProvider>
      <ShadersPane
        assets={[asset]}
        error={null}
        insertion={value}
        isLoading={false}
        onRetry={mock()}
      />
    </SidebarProvider>
  );
  const { rerender } = render(pane(action));
  expect(screen.getByText("Enable shaders for this video")).toBeInTheDocument();
  expect(screen.queryByText(action.unavailable)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Prepare video" }));
  expect(action.prepareVideo).toHaveBeenCalledTimes(1);
  rerender(
    pane({
      ...insertion(),
      preparation: {
        historyId: "chat",
        message: "Video prepared. Choose a scene and add a shader.",
        phase: "ready",
      },
    })
  );
  expect(screen.getByText("Add to Intro")).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button", { name: "Prepare video" })).toBeNull();
});
