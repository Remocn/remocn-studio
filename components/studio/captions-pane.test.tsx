import { beforeEach, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CAPTION_NAMES } from "@/scripts/remocn-sources";
import type { Asset } from "@/shared/library";
import { CaptionsPane } from "./captions-pane";

const assets: Asset[] = CAPTION_NAMES.map((name) => ({
  audiomap: null,
  category: "Captions",
  clip: null,
  createdAt: 0,
  dependencies: [],
  description: "",
  duration: null,
  files: [],
  name,
  path: "/bundled",
  preview: null,
  proxied: false,
  role: null,
  slug: `remocn/${name}`,
  source: null,
  type: "component",
}));
beforeEach(() => {
  mockIPC(() => null);
});
function pane({
  error = null,
  isLoading = false,
  unavailable = null,
  rows = assets,
}: {
  error?: string | null;
  isLoading?: boolean;
  unavailable?: string | null;
  rows?: Asset[];
} = {}) {
  const pick = mock();
  const retry = mock();
  const view = render(
    <SidebarProvider>
      <CaptionsPane
        assets={rows}
        error={error}
        isLoading={isLoading}
        onPick={pick}
        onRetry={retry}
        unavailable={unavailable}
      />
    </SidebarProvider>
  );
  return { ...view, pick, retry };
}
it("shows all styles without role groups, helpers or deletion, and filters by name", () => {
  const { pick } = pane({
    rows: [
      ...assets,
      {
        ...assets[0],
        category: null,
        name: "helper",
        slug: "remocn/caption-core",
      },
    ],
  });
  expect(screen.getAllByRole("button", { name: CAPTION_BUTTON })).toHaveLength(
    31
  );
  expect(screen.queryByText("helper")).toBeNull();
  expect(screen.queryByRole("button", { name: DELETE_BUTTON })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "karaoke" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "caption-karaoke, Component" })
  );
  expect(pick).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "absent-style" },
  });
  expect(screen.getByText(EMPTY_SEARCH)).toBeTruthy();
});
it("keeps a locked composer unchanged and explains why", async () => {
  const { pick } = pane({
    unavailable: "Answer the request in chat to add a caption style.",
  });
  expect(
    screen.getByRole("group", { name: "Choose a caption style" })
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole("button", { name: "caption-karaoke, Component" })
  );
  expect(pick).not.toHaveBeenCalled();
});
it("shows loading and retries a failed catalogue", () => {
  const loading = pane({ isLoading: true });
  expect(screen.getByText("Loading captions…")).toBeTruthy();
  loading.unmount();
  const { retry } = pane({ error: "Could not load caption styles." });
  expect(screen.getByRole("alert").textContent).toContain("Could not load");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledTimes(1);
});
it("explains unavailable resources and offers reload", () => {
  const { retry } = pane({ rows: [] });
  fireEvent.click(screen.getByRole("button", { name: "Reload captions" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

const CAPTION_BUTTON = /caption-.*, Component/;
const DELETE_BUTTON = /Delete/;
const EMPTY_SEARCH = /Nothing here is called/;
