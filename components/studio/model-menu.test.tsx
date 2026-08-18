import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelMenu } from "@/components/studio/model-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProviderAccounts } from "@/hooks/use-provider-accounts";

const MODEL_CHIP = /Model:/;

const SIGNED_OUT: ProviderAccounts = {
  codex: {
    detail: "Codex is not signed in.",
    fix: { command: "codex login", type: "command" },
    id: "codex",
    state: "failed",
    title: "Codex is not logged in",
  },
};

function renderMenu(shape: {
  accounts?: ProviderAccounts;
  canPickProvider?: boolean;
  provider?: "claude" | "codex";
}) {
  const onPick = vi.fn();

  render(
    <TooltipProvider>
      <ModelMenu
        accounts={shape.accounts ?? {}}
        canPickProvider={shape.canPickProvider ?? true}
        models={{ claude: "claude-opus-5", codex: "", copilot: "", grok: "" }}
        onPick={onPick}
        provider={shape.provider ?? "claude"}
      />
    </TooltipProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: MODEL_CHIP }));

  return { onPick };
}

describe("ModelMenu", () => {
  it("leads with the current provider's model on the chip", () => {
    renderMenu({});

    expect(screen.getByRole("button", { name: "Model: Opus 5" })).toBeVisible();
  });

  it("groups the models by provider and marks the experimental one", () => {
    renderMenu({});

    expect(
      screen.getByText("Claude", { selector: "span" })
    ).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getAllByText("Experimental")).toHaveLength(3);
  });

  it("tells a signed-out provider to sign in and refuses to pick it", () => {
    renderMenu({ accounts: SIGNED_OUT });

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(
      screen.getByText("Codex").closest("[role='menuitem']")
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("locks the other providers once the session has spoken, and says why", async () => {
    renderMenu({ canPickProvider: false, provider: "claude" });

    const codex = screen.getByText("Codex").closest("[role='menuitem']");
    expect(codex).toHaveAttribute("aria-disabled", "true");
    expect(
      screen
        .getByText("Claude", { selector: "span" })
        .closest("[role='menuitem']")
    ).not.toHaveAttribute("aria-disabled", "true");

    fireEvent.pointerEnter(codex as Element);
    fireEvent.mouseEnter(codex as Element);
    fireEvent.pointerMove(codex as Element);
    await screen.findByText(
      "This session already speaks another provider — start a new session to switch."
    );
  });
});
