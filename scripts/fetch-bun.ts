import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BINARIES = join(ROOT, "src-tauri", "binaries");
const SIDECAR_NAME = "remocn-studio-bun";

const TARGETS = [
  { asset: "bun-darwin-aarch64", triple: "aarch64-apple-darwin" },
  { asset: "bun-darwin-x64", triple: "x86_64-apple-darwin" },
  { asset: "bun-linux-x64-baseline", triple: "x86_64-unknown-linux-gnu" },
  { asset: "bun-linux-aarch64", triple: "aarch64-unknown-linux-gnu" },
] as const;

async function pinnedVersion(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(join(ROOT, "package.json"), "utf8")
  ) as { packageManager?: string };

  const declared = manifest.packageManager ?? "";
  const version = declared.startsWith("bun@") ? declared.slice(4) : "";

  if (version.length === 0) {
    throw new Error(
      'package.json has no "packageManager": "bun@<version>" to pin the shipped runtime to'
    );
  }

  return version;
}

function installedVersion(binary: string): string | null {
  if (!existsSync(binary)) {
    return null;
  }

  const said = spawnSync(binary, ["--version"], { encoding: "utf8" });

  return said.status === 0 ? said.stdout.trim() : null;
}

async function fetchTarget(
  version: string,
  asset: string,
  triple: string
): Promise<void> {
  const binary = join(BINARIES, `${SIDECAR_NAME}-${triple}`);

  if (installedVersion(binary) === version) {
    process.stdout.write(`bun ${version} for ${triple} is already here\n`);
    return;
  }

  const url = `https://github.com/oven-sh/bun/releases/download/bun-v${version}/${asset}.zip`;
  process.stdout.write(`fetching ${url}\n`);

  const answer = await fetch(url);

  if (!answer.ok) {
    throw new Error(`${url} answered ${answer.status}`);
  }

  const staging = join(BINARIES, `.${asset}`);
  await rm(staging, { force: true, recursive: true });
  await mkdir(staging, { recursive: true });

  const archive = join(staging, "bun.zip");
  await writeFile(archive, Buffer.from(await answer.arrayBuffer()));

  const unzipped = spawnSync("unzip", ["-o", "-j", archive, "-d", staging], {
    encoding: "utf8",
  });

  if (unzipped.status !== 0) {
    throw new Error(`could not unzip ${archive}: ${unzipped.stderr}`);
  }

  await copyFile(join(staging, "bun"), binary);
  await chmod(binary, 0o755);
  await rm(staging, { force: true, recursive: true });

  process.stdout.write(`wrote ${binary}\n`);
}

const pinned = await pinnedVersion();
await mkdir(BINARIES, { recursive: true });

// The Tauri CLI names the one triple it builds. Run by hand, every build for
// this machine's operating system is fetched — both architectures, since a
// release bundles for each.
const only = process.env.TAURI_ENV_TARGET_TRIPLE;
const hostOs = process.platform === "darwin" ? "apple-darwin" : "linux-gnu";
const wanted =
  only === undefined
    ? TARGETS.filter((target) => target.triple.endsWith(hostOs))
    : TARGETS.filter((target) => target.triple === only);

if (wanted.length === 0) {
  throw new Error(`no bun build is mapped for the target triple ${only}`);
}

await Promise.all(
  wanted.map((target) => fetchTarget(pinned, target.asset, target.triple))
);
