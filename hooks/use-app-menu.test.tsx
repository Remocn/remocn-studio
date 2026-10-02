import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useAppMenu } from "@/hooks/use-app-menu";
import { type Command, SHORTCUTS } from "@/lib/studio/command-registry";

function command(
  id: string,
  title: string,
  extra: Partial<Command> = {}
): Command {
  return {
    enabled: true,
    group: "actions",
    id,
    run: () => undefined,
    title,
    ...extra,
  };
}

const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";

function withAgent(agent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: agent,
  });
}

interface Menus {
  handlers: Map<string, () => void>;
  installs: number;
}

function core(): Menus {
  const menus: Menus = { handlers: new Map(), installs: 0 };
  let next = 1;
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:menu|new") {
      const { handler, options } = payload as {
        handler?: { onmessage: () => void };
        options: { text?: string };
      };
      if (handler && options.text) {
        menus.handlers.set(options.text, handler.onmessage);
      }
      const rid = next;
      next += 1;
      return [rid, `id-${rid}`];
    }
    if (cmd === "plugin:menu|set_as_app_menu") {
      menus.installs += 1;
      return null;
    }
    return null;
  });
  return menus;
}

function registry(run: () => void, enabled = true): readonly Command[] {
  return [
    command("export", "Export…", {
      enabled: enabled ? true : { reason: "No preview." },
      menu: "video",
      run,
      shortcut: SHORTCUTS.export,
    }),
  ];
}

describe("useAppMenu on Linux", () => {
  afterEach(() => {
    withAgent(LINUX);
  });

  it("installs no menu bar and answers that none is up", async () => {
    withAgent(LINUX);
    const menus = core();
    const { result } = renderHook(() => useAppMenu(registry(() => undefined)));

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(menus.installs).toBe(0);
    expect(menus.handlers.size).toBe(0);
    expect(result.current).toBe(false);
  });
});

describe("useAppMenu", () => {
  let menus: Menus;

  beforeEach(() => {
    withAgent(MAC);
    menus = core();
  });

  afterEach(() => {
    withAgent(LINUX);
  });

  it("installs once for a registry whose closures change but whose shape does not", async () => {
    const first = mock();
    const second = mock();
    const view = renderHook(
      ({ commands }: { commands: readonly Command[] }) => useAppMenu(commands),
      { initialProps: { commands: registry(first) } }
    );

    await waitFor(() => expect(view.result.current).toBe(true));
    view.rerender({ commands: registry(second) });
    view.rerender({ commands: registry(second) });

    expect(menus.installs).toBe(1);

    menus.handlers.get("Export…")?.();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("reinstalls when a row's availability changes", async () => {
    const view = renderHook(
      ({ commands }: { commands: readonly Command[] }) => useAppMenu(commands),
      { initialProps: { commands: registry(mock()) } }
    );

    await waitFor(() => expect(menus.installs).toBe(1));
    view.rerender({ commands: registry(mock(), false) });

    await waitFor(() => expect(menus.installs).toBe(2));
  });

  it("answers false when there is no core to install into", async () => {
    mockIPC(() => {
      throw new Error("no core");
    });
    const view = renderHook(() => useAppMenu(registry(mock())));

    await waitFor(() => expect(view.result.current).toBe(false));
  });
});
