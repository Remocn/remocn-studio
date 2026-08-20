import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SKILLS_CLI = "skills@1.5.20";

const SOURCES = [
  { repo: "Remocn/remocn", skills: ["remocn"] },
  {
    repo: "remotion-dev/skills",
    skills: ["remotion-best-practices", "remotion-interactivity"],
  },
] as const;

const ROOT = resolve(import.meta.dirname, "..");
const VENDOR = join(ROOT, "agent", "skills");
const LOCK = join(ROOT, "agent", "skills-lock.json");

interface LockEntry {
  readonly computedHash: string;
  readonly skillPath: string;
  readonly source: string;
  readonly sourceType: string;
}

type Lock = Record<string, LockEntry>;

type Tree = Map<string, string>;

async function fetchSkills(
  repo: string,
  skills: readonly string[]
): Promise<{ dir: string; lock: Lock }> {
  const dir = await mkdtemp(join(tmpdir(), "remocn-skills-"));

  const code = await new Promise<number>((settle, fail) => {
    const child = spawn(
      "bunx",
      [
        SKILLS_CLI,
        "add",
        repo,
        ...skills.flatMap((skill) => ["--skill", skill]),
        "--agent",
        "claude-code",
        "--yes",
        "--copy",
        "--project",
      ],
      {
        cwd: dir,
        env: { ...process.env, DISABLE_TELEMETRY: "1" },
        stdio: "inherit",
      }
    );

    child.on("error", fail);
    child.on("close", (status) => settle(status ?? 1));
  });

  if (code !== 0) {
    throw new Error(`\`skills add ${repo}\` exited with ${code}`);
  }

  const raw = JSON.parse(await readFile(join(dir, "skills-lock.json"), "utf8"));

  return { dir: join(dir, ".claude", "skills"), lock: raw.skills as Lock };
}

type Leaf = readonly [string, string];

async function treeOf(dir: string): Promise<Tree> {
  const walk = async (current: string, prefix: string): Promise<Leaf[]> => {
    const entries = await readdir(current, { withFileTypes: true });

    const nested = await Promise.all(
      entries.map(async (entry): Promise<Leaf[]> => {
        const path = join(current, entry.name);
        const key = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

        if ((await lstat(path)).isSymbolicLink()) {
          throw new Error(
            `${path} is a symlink; the vendored copy must be real files`
          );
        }

        if (entry.isDirectory()) {
          return await walk(path, key);
        }

        const hash = createHash("sha256");
        hash.update(await readFile(path));
        return [[key, hash.digest("hex")]];
      })
    );

    return nested.flat();
  };

  const leaves = await walk(dir, "");
  return new Map(leaves.sort(([left], [right]) => left.localeCompare(right)));
}

function drift(fresh: Tree, vendored: Tree, skill: string): string[] {
  const found: string[] = [];

  for (const [path, hash] of fresh) {
    const mine = vendored.get(path);

    if (mine === undefined) {
      found.push(`missing  ${skill}/${path}`);
    } else if (mine !== hash) {
      found.push(`changed  ${skill}/${path}`);
    }
  }

  for (const path of vendored.keys()) {
    if (!fresh.has(path)) {
      found.push(`extra    ${skill}/${path}`);
    }
  }

  return found;
}

async function vendor(
  skill: string,
  from: string,
  checking: boolean
): Promise<string[]> {
  const to = join(VENDOR, skill);
  const fresh = await treeOf(from);

  if (checking) {
    const vendored = await treeOf(to).catch(() => new Map() as Tree);
    return drift(fresh, vendored, skill);
  }

  await rm(to, { force: true, recursive: true });
  await cp(from, to, { dereference: true, recursive: true });
  process.stdout.write(`synced ${skill} (${fresh.size} files)\n`);
  return [];
}

async function main(): Promise<void> {
  const checking = process.argv.includes("--check");

  const fetched: Awaited<ReturnType<typeof fetchSkills>>[] = [];
  for (const source of SOURCES) {
    // biome-ignore lint/performance/noAwaitInLoops: two parallel `bunx skills` race in bun's shared cache and one flakes with exit 1
    fetched.push(await fetchSkills(source.repo, source.skills));
  }

  const handled = await Promise.all(
    SOURCES.flatMap((source, index) =>
      source.skills.map(async (skill) => {
        const entry = fetched[index].lock[skill];

        if (entry === undefined) {
          throw new Error(
            `${source.repo} no longer publishes a skill ${skill}`
          );
        }

        return {
          drifted: await vendor(
            skill,
            join(fetched[index].dir, skill),
            checking
          ),
          entry,
          skill,
        };
      })
    )
  );

  await Promise.all(
    fetched.map((source) =>
      rm(resolve(source.dir, "..", ".."), { force: true, recursive: true })
    )
  );

  const lock: Lock = {};
  for (const item of handled) {
    lock[item.skill] = item.entry;
  }

  const found = handled.flatMap((item) => item.drifted);
  const serialised = `${JSON.stringify({ skills: lock, version: 1 }, null, 2)}\n`;

  if (!checking) {
    await writeFile(LOCK, serialised);
    return;
  }

  const current = await readFile(LOCK, "utf8").catch(() => "");
  if (current !== serialised) {
    found.push("changed  skills-lock.json");
  }

  if (found.length > 0) {
    process.stderr.write(
      `${["the vendored skills have drifted from upstream:", ...found, "", "run `bun run skills:sync` to refresh them"].join("\n")}\n`
    );
    process.exit(1);
  }

  process.stdout.write(
    `vendored skills are up to date (${Object.keys(lock).length} skills)\n`
  );
}

await main();
