import { describe, expect, it } from "vitest";
import { commandLead } from "@/lib/studio/commands";

const CWD = "/Users/me/projects/my-video";

describe("commandLead", () => {
  it("takes the cd off the front, wherever it goes", () => {
    expect(commandLead(`cd ${CWD} && ls -la`)).toBe(`cd ${CWD} && `);
    expect(commandLead("cd /tmp && curl -sL https://neon.com/")).toBe(
      "cd /tmp && "
    );
  });

  it("reads through the quotes around the folder", () => {
    expect(commandLead(`cd "${CWD}" && ls`)).toBe(`cd "${CWD}" && `);
  });

  it("takes the environment set in front of the program too", () => {
    expect(commandLead("M=/Users/me/notes python summarise.py")).toBe(
      "M=/Users/me/notes "
    );
  });

  it("takes a cd and an assignment together", () => {
    expect(commandLead(`cd ${CWD} && NODE_ENV=test bun test`)).toBe(
      `cd ${CWD} && NODE_ENV=test `
    );
  });

  it("leaves a command that starts with its program alone", () => {
    expect(commandLead("ls -la")).toBe("");
    expect(commandLead("bun run build")).toBe("");
  });

  it("does not mistake an argument for an assignment", () => {
    expect(commandLead("git log --grep from=a")).toBe("");
    expect(commandLead("echo a=b")).toBe("");
  });
});
