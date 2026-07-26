import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";
import { review, signatureOf } from "@/sidecar/claude/permission";

let project = "";
let elsewhere = "";

async function verdict(toolName: string, input: Record<string, unknown>) {
  return await Effect.runPromise(review(project, toolName, input));
}

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "remocn-permission-"));

  project = join(root, "project");
  elsewhere = join(root, "elsewhere");

  await mkdir(join(project, "src"), { recursive: true });
  await mkdir(elsewhere, { recursive: true });
  await writeFile(join(project, "src", "Scene.tsx"), "export const a = 1;\n");
  await writeFile(join(elsewhere, "secret.txt"), "shh\n");
  await symlink(elsewhere, join(project, "escape"));

  elsewhere = await realpath(elsewhere);
});

describe("review", () => {
  it("lets a file tool inside the folder through without asking", async () => {
    expect(
      await verdict("Read", { file_path: join(project, "src", "Scene.tsx") })
    ).toEqual({ kind: "allow" });
  });

  it("lets a write to a file that does not exist yet through", async () => {
    expect(
      await verdict("Write", {
        content: "export const b = 2;\n",
        file_path: join(project, "src", "new", "Title.tsx"),
      })
    ).toEqual({ kind: "allow" });
  });

  it("resolves a relative path against the folder", async () => {
    expect(await verdict("Edit", { file_path: "src/Scene.tsx" })).toEqual({
      kind: "allow",
    });
  });

  it("asks when the path climbs out of the folder", async () => {
    const answer = await verdict("Write", {
      file_path: join(project, "..", "elsewhere", "secret.txt"),
    });

    expect(answer).toEqual({
      kind: "ask",
      reason: "outside",
      signature: expect.any(String),
    });
  });

  it("asks when a symlink inside the folder points out of it", async () => {
    const answer = await verdict("Read", {
      file_path: join(project, "escape", "secret.txt"),
    });

    expect(answer.kind).toBe("ask");
  });

  it("follows the symlink to a signature outside the folder", async () => {
    const answer = await verdict("Read", {
      file_path: join(project, "escape", "secret.txt"),
    });

    expect(answer).toHaveProperty(
      "signature",
      signatureOf("Read", join(elsewhere, "secret.txt"))
    );
  });

  it("always asks for Bash, whatever the command touches", async () => {
    expect(await verdict("Bash", { command: "bun add remotion" })).toEqual({
      kind: "ask",
      reason: "bash",
      signature: signatureOf("Bash", "bun add remotion"),
    });
  });

  it("asks once per exact command, so the same command is one signature", async () => {
    const first = await verdict("Bash", { command: "bun install" });
    const second = await verdict("Bash", { command: "bun install" });

    expect(first).toEqual(second);
  });

  it("asks for a tool it has no path rule for", async () => {
    expect(await verdict("WebFetch", { url: "https://example.com" })).toEqual({
      kind: "ask",
      reason: "tool",
      signature: signatureOf("WebFetch", ""),
    });
  });

  it("lets a search without a path default to the folder", async () => {
    expect(await verdict("Grep", { pattern: "useCurrentFrame" })).toEqual({
      kind: "allow",
    });
  });

  it("asks for the plan itself when Claude wants to leave plan mode", async () => {
    expect(
      await verdict("ExitPlanMode", { plan: "1. Build the title card" })
    ).toEqual({
      kind: "ask",
      reason: "plan",
      signature: signatureOf("ExitPlanMode", "1. Build the title card"),
    });
  });
});
