import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetsPane } from "@/components/studio/assets-pane";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Asset } from "@/shared/library";

const NEON_ROW = /^Neon Title/;
const A_BADGE = /^\d+:\d\d$/;

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

function pane(
  props: {
    assets?: readonly Asset[];
    error?: string | null;
    isLoading?: boolean;
  } = {}
) {
  const picked: string[] = [];
  const removed: string[] = [];
  const onPick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
    picked.push(event.currentTarget.value);
  });
  const onRemove = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
    removed.push(event.currentTarget.value);
  });

  const view = render(
    <SidebarProvider>
      <AssetsPane
        assets={props.assets ?? [asset()]}
        error={props.error ?? null}
        isLoading={props.isLoading ?? false}
        isOver={false}
        onPick={onPick}
        onRemove={onRemove}
        onRetry={vi.fn()}
      />
    </SidebarProvider>
  );

  return { container: view.container, onPick, picked, removed };
}

// The asset protocol is not a thing under jsdom, and `clearMocks()` drops
// `__TAURI_INTERNALS__` between tests, so the fake is installed per test.
function fakeAssetProtocol() {
  const internals = window as unknown as {
    __TAURI_INTERNALS__: { convertFileSrc: (path: string) => string };
  };

  internals.__TAURI_INTERNALS__.convertFileSrc = (path) =>
    `asset://localhost/${encodeURIComponent(path)}`;
}

describe("AssetsPane", () => {
  beforeEach(() => {
    clearMocks();
    mockIPC(() => undefined);
    fakeAssetProtocol();
  });

  it("says what the library is for while it is empty", () => {
    pane({ assets: [] });

    expect(screen.getByText("Nothing saved yet")).toBeInTheDocument();
  });

  it("names each card, and says its kind to a screen reader", () => {
    pane({
      assets: [asset(), asset({ name: "Logo", slug: "logo", type: "img" })],
    });

    expect(screen.getByText("Neon Title")).toBeInTheDocument();
    expect(screen.getByText("Logo")).toBeInTheDocument();

    // The kind is no longer a second line on the card — the tile shows it.
    expect(
      screen.getByRole("button", { name: "Neon Title, Component" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Logo, Image" })
    ).toBeInTheDocument();
  });

  it("lays the cards out as a grid", () => {
    const { container } = pane({
      assets: [asset(), asset({ name: "Logo", slug: "logo", type: "img" })],
    });

    const grid = container.querySelector(".grid");

    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll('[data-slot="attachment"]')).toHaveLength(2);
  });

  it("renders each tile through the image media variant", () => {
    const { container } = pane({
      assets: [
        asset({
          preview: "/library/assets/intro/preview.png",
          slug: "intro",
          type: "video",
        }),
      ],
    });

    const media = container.querySelector('[data-slot="attachment-media"]');

    expect(media?.getAttribute("data-variant")).toBe("image");
  });

  it("badges a clip with how long it runs", () => {
    pane({
      assets: [
        asset({
          duration: 272,
          files: ["intro.mp4"],
          name: "Intro",
          slug: "intro",
          type: "video",
        }),
      ],
    });

    expect(screen.getByText("04:32")).toBeInTheDocument();
  });

  it("badges nothing when the length was never measured", () => {
    pane({ assets: [asset({ duration: null })] });

    expect(screen.queryByText(A_BADGE)).toBeNull();
  });

  it("hands the picked asset's slug back on the button's value", async () => {
    const { onPick, picked } = pane();

    await userEvent.click(screen.getByRole("button", { name: NEON_ROW }));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(picked).toEqual(["neon-title"]);
  });

  it("shows a stored still as the picture, not the video", () => {
    const { container } = pane({
      assets: [
        asset({
          files: ["intro.mp4"],
          name: "Intro",
          preview: "/library/assets/intro/preview.png",
          slug: "intro",
          type: "video",
        }),
      ],
    });

    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("falls back to the video itself when no still was ever taken", () => {
    const { container } = pane({
      assets: [
        asset({
          files: ["intro.mp4"],
          name: "Intro",
          preview: null,
          slug: "intro",
          type: "video",
        }),
      ],
    });

    const video = container.querySelector("video");

    expect(video).not.toBeNull();
    // Seeking past zero is what makes a frame paint at all.
    expect(video?.getAttribute("src")).toContain("#t=0.1");
  });

  it("leaves a sound with its icon, having no frame to show", () => {
    const { container } = pane({
      assets: [
        asset({
          files: ["theme.wav"],
          name: "Theme",
          preview: null,
          slug: "theme",
          type: "audio",
        }),
      ],
    });

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("gives every card a delete button of its own", async () => {
    const { picked, removed } = pane({
      assets: [asset(), asset({ name: "Logo", slug: "logo", type: "img" })],
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Neon Title" })
    );

    expect(removed).toEqual(["neon-title"]);
    // The trigger covers the card, so deleting must not also insert the asset.
    expect(picked).toEqual([]);
  });

  it("offers a way back when the library could not be read", () => {
    pane({ error: "the sidecar is not running" });

    expect(screen.getByText("The library is unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });
});
