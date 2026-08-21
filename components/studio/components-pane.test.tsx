import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentsPane } from "@/components/studio/components-pane";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Asset } from "@/shared/library";
import type { MotionRole } from "@/shared/motion";

function asset(shape: Partial<Asset> = {}): Asset {
  return {
    category: null,
    clip: null,
    createdAt: 1,
    dependencies: [],
    description: "",
    duration: null,
    files: ["Neon.tsx"],
    name: "Neon Title",
    path: "/library/assets/neon-title",
    preview: null,
    proxied: false,
    role: null,
    slug: "neon-title",
    source: null,
    type: "component",
    ...shape,
  };
}

function shipped(name: string, role: MotionRole, category: string): Asset {
  return asset({
    category,
    name,
    role,
    slug: `remocn/${name.toLowerCase().replaceAll(" ", "-")}`,
  });
}

function pane(props: {
  assets?: readonly Asset[];
  bundled?: readonly Asset[];
}) {
  const removed: string[] = [];
  const onRemove = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
    removed.push(event.currentTarget.value);
  });

  const view = render(
    <SidebarProvider>
      <ComponentsPane
        assets={props.assets ?? []}
        bundled={props.bundled ?? []}
        error={null}
        isLoading={false}
        onPick={vi.fn()}
        onRemove={onRemove}
        onRetry={vi.fn()}
      />
    </SidebarProvider>
  );

  return { container: view.container, removed };
}

function fakeAssetProtocol() {
  const internals = window as unknown as {
    __TAURI_INTERNALS__: { convertFileSrc: (path: string) => string };
  };

  internals.__TAURI_INTERNALS__.convertFileSrc = (path) =>
    `asset://localhost/${encodeURIComponent(path)}`;
}

describe("ComponentsPane", () => {
  beforeEach(() => {
    clearMocks();
    mockIPC(() => undefined);
    fakeAssetProtocol();
  });

  it("heads each group with the role and how many are in it", () => {
    pane({
      bundled: [
        shipped("Soft Blur In", "entry", "Typography"),
        shipped("Whip Pan", "transition", "Transitions"),
        shipped("Zoom Blur", "transition", "Transitions"),
      ],
    });

    const headings = screen.getAllByRole("heading", { level: 3 });

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Entry1",
      "Transition2",
    ]);
  });

  it("files a saved behaviour under its role, beside the shipped ones", () => {
    pane({
      assets: [asset({ name: "My Reveal", role: "entry", slug: "my-reveal" })],
      bundled: [shipped("Soft Blur In", "entry", "Typography")],
    });

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((one) => one.textContent)
    ).toEqual(["Entry2"]);
    expect(screen.getByText("My Reveal")).toBeInTheDocument();
  });

  it("offers to delete what the person saved, never what the studio ships", () => {
    pane({
      assets: [asset({ name: "My Reveal", role: "entry", slug: "my-reveal" })],
      bundled: [shipped("Soft Blur In", "entry", "Typography")],
    });

    expect(
      screen.getByRole("button", { name: "Delete My Reveal" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Soft Blur In" })
    ).toBeNull();
  });

  it("says what the pane is for while nothing is in it", () => {
    pane({});

    expect(screen.getByText("No components yet")).toBeInTheDocument();
  });
});
