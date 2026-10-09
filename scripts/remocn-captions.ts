import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Transpiler } from "bun";
import { CAPTION_NAMES, CAPTIONS_PIN, requiredSource } from "./remocn-sources";
import { rewritten } from "./remocn-sync";

interface Artifact {
  dependencies?: string[];
  description?: string;
  files: { target: string; content: string }[];
  name: string;
  registryDependencies?: string[];
  title?: string;
}

export interface BundleLock {
  captionsPin?: string;
  files: Record<string, string>;
  pin: string;
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export async function syncCaptions(
  vendor = resolve(import.meta.dirname, "../remocn"),
  readSource: (path: string) => Promise<string> = (path) =>
    requiredSource(CAPTIONS_PIN, path)
): Promise<void> {
  const lock: BundleLock = JSON.parse(
    await readFile(join(vendor, "lock.json"), "utf8")
  );
  const index: { categories: string[]; components: string[] } = JSON.parse(
    await readFile(join(vendor, "index.json"), "utf8")
  );
  const manifestSource = await readSource("registry/__manifest__.ts");
  const transpiled = new Transpiler({ loader: "ts" }).transformSync(
    manifestSource
  );
  const { default: previews } = (await import(
    `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
  )) as { default: Record<string, unknown> };
  const planned = new Map<string, string>();
  const targets = new Map<string, string>();
  await Promise.all(
    Object.keys(lock.files)
      .filter((entry) => entry.endsWith("/manifest.json"))
      .map(async (key) => {
        const manifest = JSON.parse(
          await readFile(join(vendor, key), "utf8")
        ) as { files: { file: string; target: string }[] };
        await Promise.all(
          manifest.files.map(async (file) => {
            targets.set(
              file.target,
              await readFile(join(vendor, key, "..", file.file), "utf8")
            );
          })
        );
      })
  );
  const seen = new Set<string>();
  const visit = async (name: string): Promise<void> => {
    if (seen.has(name)) {
      return;
    }
    seen.add(name);
    const artifact: Artifact = JSON.parse(
      await readSource(`registry-artifacts/${name}.json`)
    );
    if (artifact.name !== name) {
      throw new Error(`Registry name mismatch for ${name}`);
    }
    const dependencies = (artifact.registryDependencies ?? []).map((entry) => {
      if (!entry.startsWith("@remocn/")) {
        throw new Error(`Unsupported registry dependency: ${entry}`);
      }
      return entry.slice("@remocn/".length);
    });
    const files = artifact.files.map((file) => {
      const target = `src/${file.target}`;
      const content = rewritten(file.content, file.target);
      const previous = targets.get(target);
      if (previous !== undefined && previous !== content) {
        throw new Error(`Conflicting registry target: ${target}`);
      }
      targets.set(target, content);
      const stored = basename(file.target);
      planned.set(`registry/${name}/${stored}`, content);
      return { file: stored, target };
    });
    const isCaption = (CAPTION_NAMES as readonly string[]).includes(name);
    planned.set(
      `registry/${name}/manifest.json`,
      encode({
        category: isCaption ? "Captions" : null,
        componentName: null,
        dependencies: artifact.dependencies ?? [],
        description: artifact.description ?? "",
        files,
        name,
        preview: previews[name] ?? null,
        registryDependencies: dependencies,
        sourcePin: CAPTIONS_PIN,
        title: artifact.title ?? name,
      })
    );
    await Promise.all(dependencies.map(visit));
  };
  await Promise.all(CAPTION_NAMES.map(visit));
  for (const [key, content] of planned) {
    if (lock.files[key] !== undefined && lock.files[key] !== hash(content)) {
      throw new Error(`Refusing to replace bundled file: ${key}`);
    }
  }
  await Promise.all(
    [...planned].map(async ([key, content]) => {
      const path = join(vendor, key);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, content);
      lock.files[key] = hash(content);
    })
  );
  index.categories = [...new Set([...index.categories, "Captions"])];
  index.components = [
    ...new Set([...index.components, ...CAPTION_NAMES]),
  ].sort();
  const encoded = encode(index);
  await writeFile(join(vendor, "index.json"), encoded);
  lock.files["index.json"] = hash(encoded);
  lock.captionsPin = CAPTIONS_PIN;
  lock.files = Object.fromEntries(
    Object.entries(lock.files).sort(([a], [b]) => a.localeCompare(b))
  );
  await writeFile(join(vendor, "lock.json"), encode(lock));
  console.log(
    `Vendored ${CAPTION_NAMES.length} caption styles and their dependency closure at ${CAPTIONS_PIN.slice(0, 12)}.`
  );
}
