// @vitest-environment node
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type AcpError, AUTH_REQUIRED, spawnAcp } from "./connection";

// A stand-in agent speaking just enough ACP to exercise both directions of
// the peer: answers initialize and session/new, streams one update, raises
// one client request and echoes its answer back inside the prompt result.
const FAKE_AGENT = `#!/usr/bin/env node
const readline = require("node:readline");
const lines = readline.createInterface({ input: process.stdin });
const write = (frame) => process.stdout.write(JSON.stringify(frame) + "\\n");
const mode = process.env.FAKE_ACP ?? "ok";

let pendingPermission = null;

lines.on("line", (line) => {
  if (!line.trim()) return;
  const frame = JSON.parse(line);

  if (frame.method === "initialize") {
    write({ jsonrpc: "2.0", id: frame.id, result: { protocolVersion: 1, agentInfo: { name: "Fake", version: "9.9.9" } } });
    return;
  }

  if (frame.method === "session/new") {
    if (mode === "auth") {
      write({ jsonrpc: "2.0", id: frame.id, error: { code: -32000, message: "Authentication required" } });
      return;
    }
    write({ jsonrpc: "2.0", id: frame.id, result: { sessionId: "s-1" } });
    return;
  }

  if (frame.method === "session/prompt") {
    write({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s-1", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } } } });
    pendingPermission = frame.id;
    write({ jsonrpc: "2.0", id: 900, method: "session/request_permission", params: { sessionId: "s-1", options: [{ optionId: "allow", kind: "allow_once" }] } });
    return;
  }

  if (frame.id === 900) {
    write({ jsonrpc: "2.0", id: pendingPermission, result: { stopReason: "end_turn", echoed: frame.result } });
  }
});
`;

function fakeAgent(): string {
  const dir = mkdtempSync(join(tmpdir(), "remocn-acp-"));
  const path = join(dir, "fake-acp");
  writeFileSync(path, FAKE_AGENT);
  chmodSync(path, 0o755);
  return path;
}

describe("spawnAcp", () => {
  it("speaks both directions: requests out, updates in, requests in", async () => {
    const notifications: unknown[] = [];
    const served: unknown[] = [];

    const peer = spawnAcp({
      args: [],
      command: fakeAgent(),
      cwd: tmpdir(),
      log: () => undefined,
      onNotification: (method, params) => notifications.push([method, params]),
      onRequest: (method, params) => {
        served.push([method, params]);
        return Promise.resolve({ outcome: { optionId: "allow" } });
      },
    });

    const initialized = await peer.request<{
      agentInfo: { version: string };
    }>("initialize", { protocolVersion: 1 });
    expect(initialized.agentInfo.version).toBe("9.9.9");

    await peer.request("session/new", { cwd: "/tmp" });

    const answered = await peer.request<{ echoed: unknown }>("session/prompt", {
      sessionId: "s-1",
    });

    expect(answered.echoed).toEqual({ outcome: { optionId: "allow" } });
    expect(notifications).toHaveLength(1);
    expect(served).toHaveLength(1);

    peer.kill();
    await peer.exited;
  });

  it("carries the agent's error code, which is how a login ask is told apart", async () => {
    const peer = spawnAcp({
      args: [],
      command: fakeAgent(),
      cwd: tmpdir(),
      log: () => undefined,
      onNotification: () => undefined,
      onRequest: () => Promise.resolve({}),
    });

    process.env.FAKE_ACP = "auth";
    try {
      const auth = spawnAcp({
        args: [],
        command: fakeAgent(),
        cwd: tmpdir(),
        log: () => undefined,
        onNotification: () => undefined,
        onRequest: () => Promise.resolve({}),
      });

      await auth.request("initialize", { protocolVersion: 1 });
      const refused = await auth
        .request("session/new", { cwd: "/tmp" })
        .then(() => null)
        .catch((cause: AcpError) => cause);

      expect(refused?.code).toBe(AUTH_REQUIRED);
      auth.kill();
      await auth.exited;
    } finally {
      delete process.env.FAKE_ACP;
    }

    peer.kill();
    await peer.exited;
  });

  it("fails what is pending when the agent dies mid-answer", async () => {
    const peer = spawnAcp({
      args: [],
      command: fakeAgent(),
      cwd: tmpdir(),
      log: () => undefined,
      onNotification: () => undefined,
      onRequest: () => Promise.resolve({}),
    });

    await peer.request("initialize", { protocolVersion: 1 });
    const hanging = peer.request("session/nowhere", {});
    peer.kill();

    await expect(hanging).rejects.toThrow("exited before it answered");
  });
});
