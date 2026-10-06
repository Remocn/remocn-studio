import { afterEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntegrationsSection } from "@/components/studio/integrations-section";
import { LINUX, MAC, withAgent } from "@/test/user-agent";

const KEYCHAIN_LINE = /Keys stay in this Mac’s keychain/;
const KEYRING_LINE = /Keys stay in your system keyring/;

const ELEVENLABS = {
  authorization: ["api-key"],
  capabilities: ["audio"],
  id: "elevenlabs",
  name: "ElevenLabs",
};

const FIGMA = {
  authorization: ["personal-token"],
  capabilities: ["import"],
  id: "figma",
  name: "Figma",
};

const ADD = /Add integration/;
const ACCOUNT = /studio@remocn\.dev/;
const WORK = /work@remocn\.dev/;
const HOME = /home@remocn\.dev/;
const KEY_GOES = /Its key is deleted/;
const UNREACHED = /could not be reached/;
const FIGMA_NAME = /Figma/;
const ELEVENLABS_NAME = /ElevenLabs/;

function connection(shape: Record<string, unknown> = {}) {
  return {
    account: "studio@remocn.dev",
    capabilities: ["audio"],
    detail: null,
    disabled: false,
    id: "cn_1",
    name: "My ElevenLabs",
    provider: "elevenlabs",
    state: "connected",
    ...shape,
  };
}

function studio(
  options: {
    account?: string | null;
    begin?: Error;
    confirm?: Error;
    catalogue?: unknown[];
    connections?: unknown[];
    remove?: unknown;
  } = {}
) {
  const seen: string[] = [];
  let listed = options.connections ?? [];

  mockIPC((cmd, args) => {
    seen.push(cmd);

    if (cmd === "integrations_catalogue") {
      return options.catalogue ?? [ELEVENLABS, FIGMA];
    }
    if (cmd === "integrations_list") {
      return listed;
    }
    if (cmd === "integrations_remove") {
      listed = [];
      return options.remove ?? { detail: null, withdrawn: true };
    }
    if (cmd === "integrations_begin") {
      if (options.begin) {
        throw options.begin;
      }
      return {
        account:
          options.account === undefined ? "studio@remocn.dev" : options.account,
        capabilities: ["audio"],
        provider: "elevenlabs",
      };
    }
    if (cmd === "integrations_confirm") {
      if (options.confirm) {
        throw options.confirm;
      }
      const saved = connection({ name: (args as { name: string }).name });
      listed = [saved];
      return saved;
    }
    if (cmd === "integrations_cancel") {
      return null;
    }
    return null;
  });

  return seen;
}

describe("the services group", () => {
  it("says nothing is connected, and how to change that", async () => {
    studio();
    render(<IntegrationsSection />);

    expect(await screen.findByText("Nothing is connected yet")).toBeVisible();
    expect(screen.getByRole("button", { name: ADD })).toBeVisible();
    expect(screen.getByText(KEYCHAIN_LINE)).toBeVisible();
  });

  describe("on Linux", () => {
    afterEach(() => {
      withAgent(MAC);
    });

    it("says the keys stay in the system keyring", async () => {
      withAgent(LINUX);
      studio();
      render(<IntegrationsSection />);

      expect(await screen.findByText(KEYRING_LINE)).toBeVisible();
    });
  });

  it("offers nothing to add when this build carries no service", async () => {
    studio({ catalogue: [] });
    render(<IntegrationsSection />);

    expect(
      await screen.findByText(
        "This build carries no service the studio can connect to."
      )
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: ADD })).toBeNull();
  });

  it("shows a row with its service, account, capabilities and state", async () => {
    studio({ connections: [connection()] });
    render(<IntegrationsSection />);

    expect(await screen.findByText("My ElevenLabs")).toBeVisible();
    expect(screen.getByText("ElevenLabs", { selector: "span" })).toBeVisible();
    expect(screen.getByText(ACCOUNT)).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
  });

  it("tells two connections of one service apart by name and account", async () => {
    studio({
      connections: [
        connection({ account: "work@remocn.dev", id: "cn_1", name: "Work" }),
        connection({ account: "home@remocn.dev", id: "cn_2", name: "Home" }),
      ],
    });
    render(<IntegrationsSection />);

    expect(await screen.findByText("Work")).toBeVisible();
    expect(screen.getByText("Home")).toBeVisible();
    expect(screen.getByText(WORK)).toBeVisible();
    expect(screen.getByText(HOME)).toBeVisible();
  });

  it("says a connection needs authorizing, in the service's own words", async () => {
    studio({
      connections: [
        connection({
          detail: "ElevenLabs rejected that key.",
          state: "needs-authorization",
        }),
      ],
    });
    render(<IntegrationsSection />);

    expect(await screen.findByText("Action needed")).toBeVisible();
    expect(screen.getByText("ElevenLabs rejected that key.")).toBeVisible();
  });

  it("reads a disabled connection as off rather than as connected", async () => {
    studio({ connections: [connection({ disabled: true })] });
    render(<IntegrationsSection />);

    expect(await screen.findByText("Off")).toBeVisible();
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.getByRole("button", { name: "Enable" })).toBeVisible();
  });
});

describe("removing a connection", () => {
  it("asks first, and names what goes with it", async () => {
    studio({ connections: [connection()] });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText(KEY_GOES)).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeVisible();
  });

  it("removes nothing while the question stands", async () => {
    const seen = studio({ connections: [connection()] });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(seen).not.toContain("integrations_remove");
    expect(screen.getByText("My ElevenLabs")).toBeVisible();
  });

  it("says so when the service could not be told", async () => {
    studio({
      connections: [connection()],
      remove: {
        detail:
          "ElevenLabs could not be reached, so the key may still work there.",
        withdrawn: false,
      },
    });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove" }).at(-1) as HTMLElement
    );

    expect(await screen.findByText(UNREACHED)).toBeVisible();
  });
});

describe("adding an integration", () => {
  it("walks choose, then authorize, without a mouse", async () => {
    studio();
    render(<IntegrationsSection />);

    const add = await screen.findByRole("button", { name: ADD });
    add.focus();
    expect(add).toHaveFocus();
    fireEvent.click(add);

    expect(await screen.findByText("Choose a service")).toBeVisible();

    const figma = screen.getByRole("button", { name: FIGMA_NAME });
    figma.focus();
    expect(figma).toHaveFocus();
    fireEvent.click(figma);

    expect(
      await screen.findByLabelText("Personal access token for Figma")
    ).toBeVisible();
  });

  it("asks for the right kind of secret per service", async () => {
    studio();
    render(<IntegrationsSection />);

    fireEvent.click(await screen.findByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));

    expect(
      await screen.findByLabelText("API key for ElevenLabs")
    ).toBeVisible();
  });

  it("never shows a stored secret back", async () => {
    studio();
    render(<IntegrationsSection />);

    fireEvent.click(await screen.findByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));

    const field = (await screen.findByLabelText(
      "API key for ElevenLabs"
    )) as HTMLInputElement;

    expect(field.type).toBe("password");
    expect(field.value).toBe("");
  });

  it("leaves the list as it was when the add is cancelled", async () => {
    studio({ connections: [connection()] });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("Choose a service")).toBeNull()
    );
    expect(screen.getByText("My ElevenLabs")).toBeVisible();
  });
});

describe("connection form feedback", () => {
  it.each([
    { account: "Kapishdima", clear: false, expected: "Kapishdima" },
    { account: null, clear: false, expected: "ElevenLabs" },
    { account: "Kapishdima", clear: true, expected: "Kapishdima" },
  ])(
    "returns to the list without requiring a custom name: %j",
    async ({ account, clear, expected }) => {
      studio({ account });
      render(<IntegrationsSection />);
      fireEvent.click(await screen.findByRole("button", { name: ADD }));
      fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));
      fireEvent.change(screen.getByLabelText("API key for ElevenLabs"), {
        target: { value: "test-key" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Verify access" }));
      const name = await screen.findByLabelText("Name this connection");
      expect(name).toHaveValue(expected);
      if (clear) {
        fireEvent.change(name, { target: { value: "   " } });
      }
      const save = screen.getByRole("button", {
        name: "Save and return to integrations",
      });
      expect(save).toBeEnabled();
      fireEvent.click(save);
      expect(await screen.findByText("Connected")).toBeVisible();
      expect(screen.getByText(expected, { selector: "p" })).toBeVisible();
      expect(screen.queryByLabelText("Connection progress")).toBeNull();
      expect(screen.getByRole("button", { name: ADD })).toBeVisible();
    }
  );

  it("keeps the form open and explains a failed save", async () => {
    studio({ confirm: new Error("Could not save to keychain.") });
    render(<IntegrationsSection />);
    fireEvent.click(await screen.findByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));
    fireEvent.change(screen.getByLabelText("API key for ElevenLabs"), {
      target: { value: "test-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify access" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Save and return to integrations",
      })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save to keychain."
    );
    expect(screen.getByLabelText("Name this connection")).toHaveValue(
      "studio@remocn.dev"
    );
    expect(
      screen.getByRole("button", { name: "Save and return to integrations" })
    ).toBeEnabled();
    expect(screen.queryByText("Connected")).toBeNull();
  });

  it("verifies access and saves through native form submission", async () => {
    const seen = studio();
    render(<IntegrationsSection />);
    fireEvent.click(await screen.findByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));
    const secret = screen.getByLabelText("API key for ElevenLabs");
    expect(
      screen.getByRole("button", { name: "Verify access" })
    ).toBeDisabled();
    fireEvent.change(secret, { target: { value: "test-key" } });
    fireEvent.submit(secret.closest("form") as HTMLFormElement);
    expect(await screen.findByText("Access verified")).toBeVisible();
    const name = screen.getByLabelText("Name this connection");
    fireEvent.change(name, { target: { value: "My ElevenLabs" } });
    fireEvent.submit(name.closest("form") as HTMLFormElement);
    expect(await screen.findByText("My ElevenLabs")).toBeVisible();
    expect(seen).toContain("integrations_confirm");
    expect(screen.queryByLabelText("Connection progress")).toBeNull();
  });

  it("associates a rejected key with its input and permits retry", async () => {
    studio({ begin: new Error("ElevenLabs rejected that key.") });
    render(<IntegrationsSection />);
    fireEvent.click(await screen.findByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));
    const secret = screen.getByLabelText("API key for ElevenLabs");
    fireEvent.change(secret, { target: { value: "test-key" } });
    fireEvent.submit(secret.closest("form") as HTMLFormElement);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ElevenLabs rejected that key."
    );
    expect(secret).toHaveAttribute("aria-invalid", "true");
    expect(secret).toHaveAttribute(
      "aria-describedby",
      "integration-secret-help integration-error"
    );
    expect(screen.getByRole("button", { name: "Verify access" })).toBeEnabled();
  });
});
