import { beforeEach, describe, expect, it, mock } from "bun:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetsPane } from "@/components/studio/assets-pane";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Asset } from "@/shared/library";

const NEON_ROW = /^Neon Title/;
const A_BADGE = /^\d+:\d\d$/;

function asset(shape: Partial<Asset> = {}): Asset {
  return {
    audiomap: null,
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
  const onPick = mock((event: React.MouseEvent<HTMLButtonElement>) => {
    picked.push(event.currentTarget.value);
  });
  const onRemove = mock((event: React.MouseEvent<HTMLButtonElement>) => {
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
        onRetry={mock()}
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

    expect(screen.getByText("Component")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Neon Title, Component" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Logo, Image" })
    ).toBeInTheDocument();
  });

  it("keeps every card in the responsive library list", () => {
    pane({
      assets: [asset(), asset({ name: "Logo", slug: "logo", type: "img" })],
    });

    const grid = screen.getByRole("list", { name: "Asset library" });
    expect(grid.querySelectorAll("li")).toHaveLength(2);
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

  it("keeps audio playback controls separate from picking and deleting the asset", async () => {
    const { picked, removed } = pane({
      assets: [
        asset({
          duration: 8,
          files: ["door.wav"],
          name: "Door",
          slug: "door",
          type: "audio",
        }),
      ],
    });
    const audio = screen.getByLabelText("Listen to Door") as HTMLAudioElement;
    Object.defineProperties(audio, {
      duration: { value: 8 },
      paused: { value: true },
      play: { value: mock(async () => fireEvent.play(audio)) },
    });
    fireEvent.loadedMetadata(audio);
    await userEvent.click(screen.getByRole("button", { name: "Play Door" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pause Door" })).toBeEnabled()
    );
    expect(picked).toEqual([]);
    expect(removed).toEqual([]);
    await userEvent.click(
      screen.getByRole("button", { name: "Audio controls for Door" })
    );
    fireEvent.change(screen.getByRole("slider", { name: "Seek Door" }), {
      target: { value: "3" },
    });
    expect(audio.currentTime).toBe(3);
    fireEvent.change(screen.getByRole("slider", { name: "Volume for Door" }), {
      target: { value: "0.25" },
    });
    expect(audio.volume).toBe(0.25);
    await userEvent.click(screen.getByRole("button", { name: "Mute Door" }));
    expect(audio.muted).toBe(true);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Playback speed" }),
      "1.5"
    );
    expect(audio.playbackRate).toBe(1.5);
    expect(
      screen.getByRole("link", { name: "Download audio" })
    ).toHaveAttribute("download");
    await userEvent.click(screen.getByRole("button", { name: "Delete Door" }));
    expect(removed).toEqual(["door"]);
    expect(picked).toEqual([]);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Door, Audio" }));
    expect(picked).toEqual(["door"]);
  });

  it("offers a way back when the library could not be read", () => {
    pane({ error: "the sidecar is not running" });

    expect(screen.getByText("The library is unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  // The field used to be `sticky` inside the scroller, and WKWebView hit-tests
  // a stuck element where it was laid out: once the grid had scrolled, a click
  // on the field landed on the tile underneath. Pinned above the viewport,
  // there is nothing for the hit test to disagree with.
  it("keeps the search field out of the scroller", () => {
    const { container } = pane({});

    const field = container.querySelector('input[aria-label="Search by name"]');
    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );

    expect(field).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(viewport?.contains(field)).toBe(false);
  });
});
