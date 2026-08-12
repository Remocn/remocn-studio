import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

// The pin is the whole contract: registry-artifacts/*.json are committed
// upstream, so one commit names every file this script will ever fetch.
// Updating the set is a deliberate bump of this constant, never a side effect
// of running the script.
const PIN = "0797bfe319bd2dae06eea5a9f67591e1b31392e5";

const REPO = "Remocn/remocn";
const RAW = `https://raw.githubusercontent.com/${REPO}/${PIN}`;

// The shipped set: the five categories the studio shows. Anything a component
// needs beyond them (icons, the shared runtime) rides in transitively and
// carries no category, which is what keeps it out of the grid.
const CATEGORIES = [
  { label: "Typography", slug: "typography" },
  { label: "Transitions", slug: "transitions" },
  { label: "Shaders", slug: "shaders" },
  { label: "Filters", slug: "filters" },
  { label: "Effects", slug: "effects" },
] as const;

const ROOT = resolve(import.meta.dirname, "..");
const VENDOR = join(ROOT, "remocn");
const REGISTRY = join(VENDOR, "registry");
const LOCK = join(VENDOR, "lock.json");

interface ArtifactFile {
  readonly content: string;
  readonly path: string;
  readonly target?: string;
}

interface Artifact {
  readonly dependencies?: readonly string[];
  readonly description?: string;
  readonly files: readonly ArtifactFile[];
  readonly name: string;
  readonly registryDependencies?: readonly string[];
  readonly title?: string;
}

interface PreviewEntry {
  readonly compositionHeight: number;
  readonly compositionWidth: number;
  readonly defaults: Record<string, unknown>;
  readonly durationInFrames: number;
  readonly fps: number;
  readonly previewBackdrop?: unknown;
}

async function fetched(path: string): Promise<string> {
  const answer = await fetch(`${RAW}/${path}`);
  if (!answer.ok) {
    throw new Error(`${path}: ${answer.status} ${answer.statusText}`);
  }
  return await answer.text();
}

// The category assignment lives nowhere in the registry itself — it is the
// docs tree: content/docs/<category>/<name>.mdx, one page per component.
async function componentsOf(slug: string): Promise<string[]> {
  const listing = await fetch(
    `https://api.github.com/repos/${REPO}/contents/content/docs/${slug}?ref=${PIN}`,
    { headers: { accept: "application/vnd.github+json" } }
  );
  if (!listing.ok) {
    throw new Error(`docs/${slug}: ${listing.status} ${listing.statusText}`);
  }

  const entries = (await listing.json()) as readonly {
    name: string;
    type: string;
  }[];

  const names = entries
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
    .map((name) => name.slice(0, -".mdx".length));

  // Some categories keep their pages one level down, in components/.
  const nested = entries.some(
    (entry) => entry.type === "dir" && entry.name === "components"
  )
    ? await componentsOf(`${slug}/components`)
    : [];

  return [...names, ...nested];
}

// `@/components/remocn/x` in a file that will land at
// src/components/remocn/y.tsx becomes `./x`: the vendored copy is rewritten
// once, here, so the user's project needs no alias configuration at all.
export function rewritten(content: string, target: string): string {
  const from = dirname(target);

  return content.replace(
    /(["'])@\/([^"']+)\1/g,
    (_, quote: string, path: string) => {
      const walked = relative(from, path).replaceAll("\\", "/");
      const spelled = walked.startsWith(".") ? walked : `./${walked}`;
      return `${quote}${spelled}${quote}`;
    }
  );
}

function referencedName(dependency: string): string | null {
  return dependency.startsWith("@remocn/")
    ? dependency.slice("@remocn/".length)
    : null;
}

const TYPE_IMPORT = /^import type [^;]+;$/m;
const ANY_IMPORT = /^import[^;]+;$/m;

async function previewManifest(): Promise<Record<string, PreviewEntry>> {
  const source = await fetched("registry/__manifest__.ts");
  // The one import is type-only; stripping it makes the file self-contained
  // enough for bun to import directly.
  const standalone = source.replace(TYPE_IMPORT, "");
  const temp = join(VENDOR, "__manifest__.tmp.ts");
  await writeFile(
    temp,
    standalone.replace("BackdropFill", "unknown").replace(ANY_IMPORT, "")
  );

  try {
    const loaded = (await import(temp)) as {
      previewManifest: Record<string, PreviewEntry>;
    };
    return loaded.previewManifest;
  } finally {
    await rm(temp, { force: true });
  }
}

interface VendoredFile {
  readonly file: string;
  readonly target: string;
}

interface VendoredManifest {
  readonly category: string | null;
  readonly componentName: string | null;
  readonly dependencies: readonly string[];
  readonly description: string;
  readonly files: readonly VendoredFile[];
  readonly name: string;
  readonly preview: PreviewEntry | null;
  readonly registryDependencies: readonly string[];
  readonly title: string;
}

// registry/__index__.tsx is the one upstream file that knows which export is
// the component: `"soft-blur-in": { load: () => import(…).then((m) => ({
// default: m.SoftBlurIn }))`. The preview renderer needs that name to mount
// anything at all.
// Only entries whose preview mounts the registry component itself: a handful
// mount an example scene from the docs instead (transitions needing two child
// scenes), and those stay null — the preview renderer skips what it cannot
// mount and the card keeps its icon.
const INDEX_ENTRY =
  /"?([a-z0-9-]+)"?:\s*\{\s*load:\s*\(\)\s*=>\s*import\(\s*"@\/registry\/[^"]+",?\s*\)\.then\(\s*\(m\)\s*=>\s*\(\{\s*default:\s*m\.([A-Za-z0-9_]+)/g;

async function componentNames(): Promise<ReadonlyMap<string, string>> {
  const source = await fetched("registry/__index__.tsx");
  const names = new Map<string, string>();

  for (const match of source.matchAll(INDEX_ENTRY)) {
    const [, slug, exported] = match;
    if (slug !== undefined && exported !== undefined) {
      names.set(slug, exported);
    }
  }

  return names;
}

function baseNameOf(target: string): string {
  return target.split("/").at(-1) ?? target;
}

interface VendorContext {
  readonly byCategory: ReadonlyMap<string, string>;
  readonly exports: ReadonlyMap<string, string>;
  readonly manifests: VendoredManifest[];
  readonly previews: Record<string, PreviewEntry>;
  readonly seen: Set<string>;
  readonly written: Map<string, string>;
}

async function vendorFile(
  name: string,
  dir: string,
  file: ArtifactFile,
  written: Map<string, string>
): Promise<VendoredFile> {
  const { content, path, target } = file;
  if (target === undefined) {
    throw new Error(`${name}: ${path} has no target`);
  }

  const stored = baseNameOf(target);
  const relocated = rewritten(content, target);
  await writeFile(join(dir, stored), relocated);
  written.set(`registry/${name}/${stored}`, sha256(relocated));
  return { file: stored, target: `src/${target}` };
}

async function vendorItem(name: string, ctx: VendorContext): Promise<void> {
  if (ctx.seen.has(name)) {
    return;
  }
  ctx.seen.add(name);

  const artifact = JSON.parse(
    await fetched(`registry-artifacts/${name}.json`)
  ) as Artifact;

  const registryDependencies = (artifact.registryDependencies ?? [])
    .map(referencedName)
    .filter((referenced): referenced is string => referenced !== null);

  const dir = join(REGISTRY, name);
  await mkdir(dir, { recursive: true });

  const files: VendoredFile[] = [];
  for (const file of artifact.files) {
    // biome-ignore lint/performance/noAwaitInLoops: manifest order must match the artifact's
    files.push(await vendorFile(name, dir, file, ctx.written));
  }

  const manifest: VendoredManifest = {
    category: ctx.byCategory.get(name) ?? null,
    componentName: ctx.exports.get(name) ?? null,
    dependencies: artifact.dependencies ?? [],
    description: artifact.description ?? "",
    files,
    name,
    preview: ctx.previews[name] ?? null,
    registryDependencies,
    title: artifact.title ?? name,
  };
  ctx.manifests.push(manifest);

  const encoded = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(dir, "manifest.json"), encoded);
  ctx.written.set(`registry/${name}/manifest.json`, sha256(encoded));

  await Promise.all(
    registryDependencies.map((referenced) => vendorItem(referenced, ctx))
  );
}

async function sync(): Promise<void> {
  await mkdir(VENDOR, { recursive: true });

  const listed = await Promise.all(
    CATEGORIES.map(async (category) => ({
      label: category.label,
      names: await componentsOf(category.slug),
    }))
  );

  const byCategory = new Map<string, string>();
  for (const category of listed) {
    for (const name of category.names) {
      byCategory.set(name, category.label);
    }
  }

  const previews = await previewManifest();
  const exports = await componentNames();

  await rm(REGISTRY, { force: true, recursive: true });

  const ctx: VendorContext = {
    byCategory,
    exports,
    manifests: [],
    previews,
    seen: new Set(),
    written: new Map(),
  };

  await Promise.all(
    [...byCategory.keys()].map((name) => vendorItem(name, ctx))
  );

  const { manifests, written } = ctx;
  manifests.sort((left, right) => left.name.localeCompare(right.name));
  const index = {
    categories: CATEGORIES.map((category) => category.label),
    components: manifests
      .filter((manifest) => manifest.category !== null)
      .map((manifest) => manifest.name),
  };
  const encodedIndex = `${JSON.stringify(index, null, 2)}\n`;
  await writeFile(join(VENDOR, "index.json"), encodedIndex);
  written.set("index.json", sha256(encodedIndex));

  const lock = {
    files: Object.fromEntries(
      [...written.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    pin: PIN,
  };
  await writeFile(LOCK, `${JSON.stringify(lock, null, 2)}\n`);

  const shipped = manifests.filter((manifest) => manifest.category !== null);
  console.log(
    `Vendored ${manifests.length} registry items (${shipped.length} shipped, ${
      manifests.length - shipped.length
    } transitive) at ${PIN.slice(0, 12)}.`
  );
}

function sha256(content: string): string {
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}

// Check answers two questions without the network: has anything under
// remocn/ been edited by hand, and does the lock still speak for the pin
// this script names.
async function check(): Promise<void> {
  const lock = JSON.parse(await readFile(LOCK, "utf8")) as {
    files: Record<string, string>;
    pin: string;
  };

  const wrong: string[] = [];

  if (lock.pin !== PIN) {
    wrong.push(`lock pin ${lock.pin} does not match the script's ${PIN}`);
  }

  const found = new Set<string>();
  const inspect = async (dir: string, key: string, name: string) => {
    if (key === "lock.json" || key.endsWith(".mp4") || key.endsWith(".png")) {
      return;
    }
    found.add(key);
    const { [key]: expected } = lock.files;
    if (expected === undefined) {
      wrong.push(`${key} is not in the lock`);
      return;
    }
    if (sha256(await readFile(join(dir, name), "utf8")) !== expected) {
      wrong.push(`${key} differs from the vendored copy`);
    }
  };
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries.map((entry) => {
        const key = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
        return entry.isDirectory()
          ? walk(join(dir, entry.name), key)
          : inspect(dir, key, entry.name);
      })
    );
  };
  await walk(VENDOR, "");

  for (const key of Object.keys(lock.files)) {
    if (!found.has(key)) {
      wrong.push(`${key} is in the lock but missing on disk`);
    }
  }

  if (wrong.length > 0) {
    for (const line of wrong) {
      console.error(line);
    }
    process.exit(1);
  }

  console.log(`remocn/ matches the lock at ${PIN.slice(0, 12)}.`);
}

const { 2: mode } = process.argv;
if (mode === "--check") {
  await check();
} else if (import.meta.main) {
  await sync();
}
