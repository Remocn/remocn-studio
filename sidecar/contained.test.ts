import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { escapee, realPathOf } from "./contained";

let root = "";
let project = "";
let outside = "";

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "remocn-contained-")));
  project = join(root, "project");
  outside = join(root, "outside");

  await mkdir(join(project, "src", "scenes"), { recursive: true });
  await mkdir(join(outside, "deep"), { recursive: true });
  await writeFile(join(project, "package.json"), "{}");
  await writeFile(join(outside, "x"), "");
  await symlink(join(outside, "deep"), join(project, "linkdir"));
  await symlink(join(outside, "new.txt"), join(project, "dangling"));
  await symlink("src/scenes", join(project, "scenes"));
  await symlink("loop-b", join(project, "loop-a"));
  await symlink("loop-a", join(project, "loop-b"));
});

afterAll(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("escapee", () => {
  it("climbs from where a link lands, not from the link", async () => {
    expect(await escapee(project, [], ["linkdir/../x"])).toBe(
      join(outside, "x")
    );
    expect(await escapee(project, [], [`${project}/linkdir/../x`])).toBe(
      join(outside, "x")
    );
  });

  it("follows a dangling link to the file it would create", async () => {
    expect(await escapee(project, [], ["dangling"])).toBe(
      join(outside, "new.txt")
    );
  });

  it("keeps a file not yet created inside the folder", async () => {
    expect(
      await escapee(project, [], ["src/scenes/Intro.tsx", "src/new/Deep.tsx"])
    ).toBe(null);
  });

  it("keeps a `..` that stays inside the folder", async () => {
    expect(await escapee(project, [], ["src/../package.json"])).toBe(null);
    expect(await escapee(project, [], ["scenes/../Main.tsx"])).toBe(null);
  });

  it("names a plain `..` that climbs out", async () => {
    expect(await escapee(project, [], ["../outside/x"])).toBe(
      join(outside, "x")
    );
  });

  it("takes `~` and file:// literally, as the tools do", async () => {
    expect(await escapee(project, [], ["~/notes.txt", "file:///etc"])).toBe(
      null
    );
  });
});

describe("realPathOf", () => {
  it("resolves a link inside the folder that stays inside", async () => {
    expect(await realPathOf(join(project, "scenes", "Intro.tsx"))).toBe(
      join(project, "src", "scenes", "Intro.tsx")
    );
  });

  it("gives up on a link loop rather than walking it forever", async () => {
    expect(await realPathOf(join(project, "loop-a", "file"))).toBe(
      join(project, "loop-a", "file")
    );
  });
});
