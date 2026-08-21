import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockPane } from "@/components/studio/stock-pane";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { StockItem } from "@/shared/library";

const NOTHING_FOUND = /Nothing on Pexels matches/;

function item(shape: Partial<StockItem> = {}): StockItem {
  return {
    author: "Joey Farina",
    authorUrl: "https://www.pexels.com/@joey",
    download: "https://images.pexels.com/photos/1/a.jpeg",
    duration: null,
    height: 100,
    id: "1",
    kind: "photo",
    name: "Golden rocks",
    thumbnail: "https://images.pexels.com/photos/1/a.jpeg?h=350",
    url: "https://www.pexels.com/photo/golden-rocks-1/",
    width: 100,
    ...shape,
  };
}

interface Calls {
  saved: string[];
  searched: { kind: string; page: number; query: string }[];
}

function install(configured: boolean, items: readonly StockItem[]): Calls {
  const calls: Calls = { saved: [], searched: [] };

  mockIPC((cmd, payload) => {
    if (cmd !== "sidecar_request") {
      return;
    }

    const { method, params } = payload as {
      method: string;
      params: Record<string, unknown>;
    };

    if (method === "library.stockStatus") {
      return { configured };
    }
    if (method === "library.stockSearch") {
      calls.searched.push(
        params as unknown as { kind: string; page: number; query: string }
      );
      return { items, nextPage: null, total: items.length };
    }
    if (method === "library.stockSave") {
      calls.saved.push(String(params.id));
      return {
        category: null,
        clip: null,
        createdAt: 1,
        dependencies: [],
        description: "",
        duration: null,
        files: ["a.jpeg"],
        name: "Golden rocks",
        path: "/library/assets/golden-rocks",
        preview: null,
        proxied: false,
        role: null,
        slug: "golden-rocks",
        source: null,
        type: "img",
      };
    }
  });

  return calls;
}

function pane(onSaved = vi.fn()) {
  render(
    <SidebarProvider>
      <StockPane kind="photo" onOpenSettings={vi.fn()} onSaved={onSaved} />
    </SidebarProvider>
  );
}

beforeEach(() => {
  clearMocks();
});

describe("StockPane", () => {
  it("asks for a key when none is configured", async () => {
    install(false, []);
    pane();

    expect(
      await screen.findByText("Pexels needs an API key")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeEnabled();
  });

  it("invites a search while the field is empty", async () => {
    install(true, []);
    pane();

    expect(await screen.findByText("Search the stock")).toBeInTheDocument();
  });

  it("searches after a pause and renders the results", async () => {
    const calls = install(true, [item()]);
    pane();

    await userEvent.type(screen.getByLabelText("Search Pexels"), "rocks");

    expect(
      await screen.findByRole("button", { name: "Save Golden rocks" })
    ).toBeInTheDocument();
    expect(screen.getByText("Joey Farina")).toBeInTheDocument();
    expect(calls.searched).toEqual([
      { kind: "photo", page: 1, query: "rocks" },
    ]);
  });

  it("saves a result and tells the library", async () => {
    const onSaved = vi.fn();
    const calls = install(true, [item()]);
    pane(onSaved);

    await userEvent.type(screen.getByLabelText("Search Pexels"), "rocks");
    await userEvent.click(
      await screen.findByRole("button", { name: "Save Golden rocks" })
    );

    await waitFor(() => {
      expect(calls.saved).toEqual(["1"]);
    });
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole("button", { name: "Golden rocks is in the library" })
    ).toBeDisabled();
  });

  it("says when nothing matches", async () => {
    install(true, []);
    pane();

    await userEvent.type(screen.getByLabelText("Search Pexels"), "nothing");

    expect(await screen.findByText(NOTHING_FOUND)).toBeInTheDocument();
  });
});
