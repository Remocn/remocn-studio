import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useNotificationConsent } from "@/hooks/use-notification-consent";
import type { StudioSettings } from "@/lib/studio/settings";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";
import { LINUX, MAC, withAgent } from "@/test/user-agent";

type Permission = "default" | "denied" | "granted";

function shim(permission: Permission, answer: Permission = permission) {
  const posted: string[] = [];
  const shimmed = Object.assign(
    function Shim(title: string, options?: { body?: string }) {
      posted.push(`${title}: ${options?.body ?? ""}`);
    },
    {
      permission,
      posted,
      requestPermission: mock(() => {
        shimmed.permission = answer;
        return Promise.resolve(answer);
      }),
    }
  );
  stubGlobal("Notification", shimmed);
  return shimmed;
}

function core() {
  const written: [string, unknown][] = [];
  const opened: string[] = [];
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:notification|is_permission_granted") {
      return false;
    }
    if (cmd === "plugin:store|load") {
      return 1;
    }
    if (cmd === "plugin:store|set") {
      const { key, value } = payload as { key: string; value: unknown };
      written.push([key, value]);
      return null;
    }
    if (cmd === "plugin:store|save") {
      return null;
    }
    if (cmd === "plugin:opener|open_url") {
      opened.push((payload as { url: string }).url);
      return null;
    }
    if (cmd === "plugin:event|listen") {
      return 1;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return { opened, written };
}

function settings(
  notifications: boolean | null,
  events: Partial<StudioSettings["notifyEvents"]> = {}
): StudioSettings {
  return {
    notifications,
    notifyEvents: {
      export: null,
      sidecar: null,
      turnEnded: null,
      waiting: null,
      ...events,
    },
  } as StudioSettings;
}

describe("useNotificationConsent", () => {
  let ipc: ReturnType<typeof core>;

  beforeEach(() => {
    ipc = core();
  });

  afterEach(() => {
    unstubAllGlobals();
    withAgent(LINUX);
  });

  it("is off until asked, and asks the OS when the master switch goes on", async () => {
    const shimmed = shim("default", "granted");
    const { result } = renderHook(() => useNotificationConsent(settings(null)));

    await waitFor(() => expect(result.current.permission).toBe("default"));
    expect(result.current.isEnabled).toBe(false);
    expect(shimmed.requestPermission).not.toHaveBeenCalled();

    act(() => result.current.toggle(true));

    await waitFor(() => expect(result.current.isOn).toBe(true));
    expect(shimmed.requestPermission).toHaveBeenCalledTimes(1);
    expect(ipc.written).toContainEqual(["notifications", "enabled"]);
  });

  it("keeps the wish when the OS says no, and opens nothing on Linux", async () => {
    shim("default", "denied");
    const { result } = renderHook(() => useNotificationConsent(settings(null)));
    await waitFor(() => expect(result.current.permission).toBe("default"));

    act(() => result.current.toggle(true));

    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isOn).toBe(false);
    expect(ipc.opened).toHaveLength(0);
  });

  it("reads a remembered switch as on once the OS agrees", async () => {
    shim("granted");
    const { result } = renderHook(() => useNotificationConsent(settings(true)));

    await waitFor(() => expect(result.current.isOn).toBe(true));
  });

  it("grants by asking on Linux, whether never asked or refused before", async () => {
    const asked = shim("default", "granted");
    const first = renderHook(() => useNotificationConsent(settings(true)));
    await waitFor(() =>
      expect(first.result.current.permission).toBe("default")
    );

    act(() => first.result.current.grant());

    await waitFor(() =>
      expect(first.result.current.permission).toBe("granted")
    );
    expect(asked.requestPermission).toHaveBeenCalledTimes(1);
    expect(ipc.opened).toHaveLength(0);

    const refused = shim("denied");
    const second = renderHook(() => useNotificationConsent(settings(true)));
    await waitFor(() =>
      expect(second.result.current.permission).toBe("denied")
    );

    act(() => second.result.current.grant());

    await waitFor(() =>
      expect(refused.requestPermission).toHaveBeenCalledTimes(1)
    );
    expect(ipc.opened).toHaveLength(0);
  });

  it("keeps the wish when macOS says no, and opens System Settings", async () => {
    withAgent(MAC);
    shim("default", "denied");
    const { result } = renderHook(() => useNotificationConsent(settings(null)));
    await waitFor(() => expect(result.current.permission).toBe("default"));

    act(() => result.current.toggle(true));

    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isOn).toBe(false);
    await waitFor(() => expect(ipc.opened).toHaveLength(1));
  });

  it("grants on macOS by asking while never asked, and by System Settings once refused", async () => {
    withAgent(MAC);
    const asked = shim("default", "granted");
    const first = renderHook(() => useNotificationConsent(settings(true)));
    await waitFor(() =>
      expect(first.result.current.permission).toBe("default")
    );

    act(() => first.result.current.grant());

    await waitFor(() =>
      expect(first.result.current.permission).toBe("granted")
    );
    expect(asked.requestPermission).toHaveBeenCalledTimes(1);
    expect(ipc.opened).toHaveLength(0);

    const refused = shim("denied");
    const second = renderHook(() => useNotificationConsent(settings(true)));
    await waitFor(() =>
      expect(second.result.current.permission).toBe("denied")
    );

    act(() => second.result.current.grant());

    await waitFor(() => expect(ipc.opened).toHaveLength(1));
    expect(refused.requestPermission).not.toHaveBeenCalled();
  });

  it("is unavailable without a transport", async () => {
    stubGlobal("Notification", undefined);
    const { result } = renderHook(() => useNotificationConsent(settings(true)));

    await waitFor(() => expect(result.current.permission).toBe("unavailable"));
    expect(result.current.isOn).toBe(false);
  });

  it("turns off without asking anything, and writes it down", async () => {
    const shimmed = shim("granted");
    const { result } = renderHook(() => useNotificationConsent(settings(true)));
    await waitFor(() => expect(result.current.isOn).toBe(true));

    act(() => result.current.toggle(false));

    expect(result.current.isOn).toBe(false);
    expect(shimmed.requestPermission).not.toHaveBeenCalled();
    expect(ipc.written).toContainEqual(["notifications", "disabled"]);
  });

  it("keeps every event on by default and writes one down when switched", () => {
    shim("granted");
    const { result } = renderHook(() =>
      useNotificationConsent(settings(true, { sidecar: false }))
    );

    expect(result.current.events).toEqual({
      export: true,
      sidecar: false,
      turnEnded: true,
      waiting: true,
    });
    expect(result.current.isEventEnabled("sidecar")).toBe(false);

    act(() => result.current.setEvent("export", false));

    expect(result.current.isEventEnabled("export")).toBe(false);
    expect(ipc.written).toContainEqual(["notifyExport", "disabled"]);
  });
});
