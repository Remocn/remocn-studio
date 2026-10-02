import { afterEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect, Exit } from "effect";
import {
  isGranted,
  post,
  readPermission,
  requestPermission,
} from "@/lib/studio/notifications";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";

function shim(
  permission: "default" | "denied" | "granted",
  answer: "default" | "denied" | "granted" = permission
) {
  const posted: { body: string | undefined; title: string }[] = [];
  const shimmed = class {
    static permission = permission;
    static requestPermission = mock(() => Promise.resolve(answer));
    constructor(title: string, options?: { body?: string }) {
      posted.push({ body: options?.body, title });
    }
  };
  stubGlobal("Notification", shimmed);
  return { posted, shimmed };
}

afterEach(() => {
  unstubAllGlobals();
});

describe("notifications", () => {
  it("reads a granted permission off the shim", async () => {
    shim("granted");

    expect(await Effect.runPromise(isGranted)).toBe(true);
  });

  it("asks the core when the shim has not been asked yet", async () => {
    shim("default");
    mockIPC((cmd) => {
      if (cmd === "plugin:notification|is_permission_granted") {
        return false;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    expect(await Effect.runPromise(isGranted)).toBe(false);
  });

  it("reads the permission off the shim, asking the core only while it is default", async () => {
    shim("denied");
    expect(await Effect.runPromise(readPermission)).toBe("denied");

    shim("default");
    mockIPC((cmd) => {
      if (cmd === "plugin:notification|is_permission_granted") {
        return true;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
    expect(await Effect.runPromise(readPermission)).toBe("granted");

    mockIPC(() => false);
    expect(await Effect.runPromise(readPermission)).toBe("default");
  });

  it("answers denied when the person refused", async () => {
    shim("default", "denied");

    expect(await Effect.runPromise(requestPermission)).toBe("denied");
  });

  it("posts a title and a body", async () => {
    const { posted } = shim("granted");

    await Effect.runPromise(post("Intro", "The turn finished."));

    expect(posted).toEqual([{ body: "The turn finished.", title: "Intro" }]);
  });

  it("fails with a worded error when the shim throws", async () => {
    stubGlobal(
      "Notification",
      class {
        static permission = "granted";
        constructor() {
          throw new Error("no notification center");
        }
      }
    );

    const exit = await Effect.runPromiseExit(post("Intro", "x"));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("fails as a tagged error without a transport", async () => {
    stubGlobal("Notification", undefined);

    const exit = await Effect.runPromiseExit(isGranted);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("NotificationError");
    }
  });
});
