import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Renders preview.mp4 and poster.png for every bundled remocn component, into
// remocn/registry/<name>/ beside the vendored sources. Run after remocn:sync;
// the outputs are deliberately outside the lock, since encoders are not
// byte-reproducible across machines. Needs the network (bun install and the
// docs example scenes) and a long leash: ~99 renders.
//
// Components whose docs preview mounts an example scene (transitions need two
// child scenes) are rendered through that same example, fetched from the pin;
// anything that cannot be mounted is skipped out loud and its card keeps the
// icon.
const PIN = "0797bfe319bd2dae06eea5a9f67591e1b31392e5";
const RAW = `https://raw.githubusercontent.com/Remocn/remocn/${PIN}`;

const CLIP_SECONDS = 6;
const CLIP_WIDTH = 640;

const ROOT = resolve(import.meta.dirname, "..");
const VENDOR = join(ROOT, "remocn");
const REGISTRY = join(VENDOR, "registry");

interface PreviewEntry {
  readonly compositionHeight: number;
  readonly compositionWidth: number;
  readonly defaults: Record<string, unknown>;
  readonly durationInFrames: number;
  readonly fps: number;
  readonly previewBackdrop?: { type?: string; value?: string };
}

interface Manifest {
  readonly category: string | null;
  readonly componentName: string | null;
  readonly dependencies: readonly string[];
  readonly files: readonly { file: string; target: string }[];
  readonly name: string;
  readonly preview: PreviewEntry | null;
  readonly registryDependencies: readonly string[];
}

interface Mount {
  readonly exported: string;
  readonly importPath: string;
  readonly manifest: Manifest;
}

async function fetched(path: string): Promise<string> {
  const answer = await fetch(`${RAW}/${path}`);
  if (!answer.ok) {
    throw new Error(`${path}: ${answer.status} ${answer.statusText}`);
  }
  return await answer.text();
}

async function manifestOf(name: string): Promise<Manifest> {
  return JSON.parse(
    await readFile(join(REGISTRY, name, "manifest.json"), "utf8")
  ) as Manifest;
}

// __index__.tsx knows how the docs preview mounts each component: straight
// from the registry, or through an example scene under components/docs.
const INDEX_ENTRY =
  /"?([a-z0-9-]+)"?:\s*\{\s*load:\s*\(\)\s*=>\s*import\(\s*"(@\/[^"]+)",?\s*\)\.then\(\s*\(m\)\s*=>\s*\(\{\s*default:\s*m\.([A-Za-z0-9_]+)/g;

async function mountsOf(names: readonly string[]): Promise<Map<string, Mount>> {
  const source = await fetched("registry/__index__.tsx");
  const entries = new Map<string, { exported: string; importPath: string }>();

  for (const match of source.matchAll(INDEX_ENTRY)) {
    const [, slug, importPath, exported] = match;
    if (
      slug !== undefined &&
      importPath !== undefined &&
      exported !== undefined
    ) {
      entries.set(slug, { exported, importPath });
    }
  }

  const mounts = new Map<string, Mount>();
  for (const name of names) {
    const entry = entries.get(name);
    if (entry === undefined) {
      console.warn(`${name}: no mount in __index__.tsx, skipping`);
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: a build script, run once
    mounts.set(name, { ...entry, manifest: await manifestOf(name) });
  }
  return mounts;
}

const EXAMPLE_IMPORT = /"@\/components\/docs\/examples\/([a-z0-9-]+)"/g;

// An example scene may pull sibling helpers (canvas-scenes and friends); the
// closure is fetched flat into src/examples/.
async function fetchExamples(
  first: readonly string[],
  dir: string
): Promise<void> {
  const queue = [...first];
  const seen = new Set(queue);

  while (queue.length > 0) {
    const name = queue.shift();
    if (name === undefined) {
      break;
    }

    // biome-ignore lint/performance/noAwaitInLoops: the queue grows while walking
    const source = await fetched(`components/docs/examples/${name}.tsx`);
    await writeFile(join(dir, `${name}.tsx`), source, "utf8");

    for (const match of source.matchAll(EXAMPLE_IMPORT)) {
      const [, referenced] = match;
      if (referenced !== undefined && !seen.has(referenced)) {
        seen.add(referenced);
        queue.push(referenced);
      }
    }
  }
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((settle, fail) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", fail);
    child.on("close", (code) =>
      code === 0 ? settle() : fail(new Error(`${command} exited with ${code}`))
    );
  });
}

async function placeVendored(src: string): Promise<Set<string>> {
  const index = JSON.parse(
    await readFile(join(VENDOR, "index.json"), "utf8")
  ) as { components: string[] };

  const placed = new Set<string>();
  const dependencies = new Set<string>(["remotion"]);

  const all = new Set(index.components);
  for (const name of index.components) {
    // biome-ignore lint/performance/noAwaitInLoops: the closure set grows while walking
    const manifest = await manifestOf(name);
    for (const referenced of manifest.registryDependencies) {
      all.add(referenced);
    }
  }

  for (const name of all) {
    // biome-ignore lint/performance/noAwaitInLoops: a build script, run once
    const manifest = await manifestOf(name);
    for (const dependency of manifest.dependencies) {
      dependencies.add(dependency);
    }
    for (const file of manifest.files) {
      const target = join(src, "..", file.target);
      // biome-ignore lint/performance/noAwaitInLoops: a build script, run once
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(REGISTRY, name, file.file), target);
      placed.add(name);
    }
  }

  await writeFile(
    join(src, "..", "package.json"),
    JSON.stringify(
      {
        dependencies: Object.fromEntries(
          [...dependencies]
            .sort()
            .map((name) => [name, name.startsWith("@remotion/") ? "4" : "*"])
        ),
        devDependencies: {
          "@remotion/bundler": "4",
          "@remotion/google-fonts": "4",
          "@remotion/renderer": "4",
          "@types/react": "19",
          react: "19",
          "react-dom": "19",
        },
        name: "remocn-previews",
        private: true,
      },
      null,
      2
    ),
    "utf8"
  );

  return placed;
}

function importLineOf(mount: Mount): string {
  const { exported, importPath, manifest } = mount;

  if (importPath.startsWith("@/components/docs/examples/")) {
    const example = importPath.slice("@/components/docs/examples/".length);
    return `import { ${exported} as C_${identifier(manifest.name)} } from "../examples/${example}";`;
  }

  return `import { ${exported} as C_${identifier(manifest.name)} } from "../components/remocn/${manifest.name}";`;
}

function identifier(slug: string): string {
  return slug.replaceAll("-", "_");
}

function rootOf(mounts: readonly Mount[]): string {
  const imports = mounts.map(importLineOf).join("\n");

  const scenes: string[] = [];
  const compositions: string[] = [];

  for (const mount of mounts) {
    const entry = mount.manifest.preview;
    if (entry === null) {
      continue;
    }
    const fps = entry.fps > 0 ? entry.fps : 30;
    const duration = Math.min(
      entry.durationInFrames,
      Math.round(CLIP_SECONDS * fps)
    );
    const backdrop =
      entry.previewBackdrop?.type === "color" &&
      typeof entry.previewBackdrop.value === "string"
        ? entry.previewBackdrop.value
        : "transparent";
    const name = identifier(mount.manifest.name);

    scenes.push(`const S_${name}: React.FC = () => (
  <AbsoluteFill style={{ ...FONT_VARIABLES, backgroundColor: ${JSON.stringify(backdrop)}, alignItems: "center", justifyContent: "center" }}>
    <C_${name} {...(${JSON.stringify(entry.defaults)} as Record<string, unknown>)} />
  </AbsoluteFill>
);`);

    compositions.push(`      <Composition
        id="${mount.manifest.name}"
        component={S_${name}}
        durationInFrames={${duration}}
        fps={${fps}}
        width={${entry.compositionWidth}}
        height={${entry.compositionHeight}}
      />`);
  }

  // The components style themselves with the site's font variables
  // (var(--font-geist-sans) and friends); without a definition they fall back
  // to the system font and the previews stop looking like remocn.dev. The
  // wrapper defines them from the same faces the site uses.
  return `import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
${imports}

const geist = loadGeist();
const geistMono = loadGeistMono();

const FONT_VARIABLES = {
  "--font-geist-mono": geistMono.fontFamily,
  "--font-geist-sans": geist.fontFamily,
} as React.CSSProperties;

${scenes.join("\n\n")}

export const Root: React.FC = () => (
  <>
${compositions.join("\n")}
  </>
);
`;
}

async function main(): Promise<void> {
  const index = JSON.parse(
    await readFile(join(VENDOR, "index.json"), "utf8")
  ) as { components: string[] };

  const only = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const wanted = only.length > 0 ? only : index.components;

  const temp = join(tmpdir(), `remocn-previews-${PIN.slice(0, 8)}`);
  const src = join(temp, "src");
  const examplesDir = join(src, "examples");
  await mkdir(examplesDir, { recursive: true });

  console.log(`scaffolding in ${temp}`);
  await placeVendored(src);

  const mounts = await mountsOf(wanted);

  const examples = [...mounts.values()]
    .map((mount) => mount.importPath)
    .filter((path) => path.startsWith("@/components/docs/examples/"))
    .map((path) => path.slice("@/components/docs/examples/".length));
  await fetchExamples(examples, examplesDir);

  const mountable = [...mounts.values()].filter(
    (mount) =>
      mount.manifest.preview !== null &&
      (mount.importPath.startsWith("@/components/docs/examples/") ||
        mount.manifest.componentName !== null)
  );

  await mkdir(join(src, "remotion"), { recursive: true });
  await writeFile(join(src, "remotion", "Root.tsx"), rootOf(mountable), "utf8");
  await writeFile(
    join(src, "remotion", "index.ts"),
    'import { registerRoot } from "remotion";\nimport { Root } from "./Root";\n\nregisterRoot(Root);\n',
    "utf8"
  );

  console.log("bun install…");
  await run("bun", ["install"], temp);

  const require_ = createRequire(join(temp, "package.json"));
  const { bundle } = require_("@remotion/bundler") as {
    bundle: (options: Record<string, unknown>) => Promise<string>;
  };
  const renderer = require_("@remotion/renderer") as {
    renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
    renderStill: (options: Record<string, unknown>) => Promise<unknown>;
    selectComposition: (
      options: Record<string, unknown>
    ) => Promise<Record<string, unknown> & { width: number }>;
  };

  console.log("bundling…");
  const serveUrl = await bundle({
    entryPoint: join(src, "remotion", "index.ts"),
    onProgress: () => undefined,
    // The example scenes are copied verbatim, so their `@/…` imports resolve
    // through aliases instead of a rewrite: the registry prefix lands on the
    // placed components, the docs prefix on the fetched examples.
    webpackOverride: (config: Record<string, unknown>) => {
      const resolveEntry = (config.resolve ?? {}) as Record<string, unknown>;
      const alias = (resolveEntry.alias ?? {}) as Record<string, unknown>;

      // Webpack tries aliases in key order and "@" is a prefix of the other
      // two, so the specific entries must come first — fromEntries over an
      // array keeps that order where an object literal would be re-sorted by
      // the formatter.
      const ordered: [string, string][] = [
        ["@/components/docs/examples", examplesDir],
        ["@/registry/remocn", join(src, "components", "remocn")],
        ["@", src],
      ];

      return {
        ...config,
        resolve: {
          ...resolveEntry,
          alias: { ...alias, ...Object.fromEntries(ordered) },
        },
      };
    },
  });

  let done = 0;
  const failedNames: string[] = [];

  const glFlag = process.argv
    .find((arg) => arg.startsWith("--gl="))
    ?.slice("--gl=".length);

  // Noise-heavy content (shaders, dissolves) balloons at the default crf 18;
  // re-running the offenders with a higher crf is how the set stays inside
  // its size budget.
  const crfFlag = process.argv
    .find((arg) => arg.startsWith("--crf="))
    ?.slice("--crf=".length);
  const crf = crfFlag === undefined ? null : Number.parseInt(crfFlag, 10);

  for (const mount of mountable) {
    const { name } = mount.manifest;
    const useGl = mount.manifest.dependencies.includes(
      "@paper-design/shaders-react"
    );
    const gl = glFlag ?? (useGl ? "angle" : null);
    const chromiumOptions = gl === null ? {} : { gl };
    const out = join(REGISTRY, name);

    try {
      // biome-ignore lint/performance/noAwaitInLoops: renders are memory-bound, sequential on purpose
      const composition = await renderer.selectComposition({
        chromiumOptions,
        id: name,
        serveUrl,
      });
      const scale = Math.min(1, CLIP_WIDTH / Math.max(1, composition.width));
      const duration =
        typeof composition.durationInFrames === "number"
          ? composition.durationInFrames
          : 1;

      await renderer.renderMedia({
        ...(crf === null ? {} : { crf }),
        chromiumOptions,
        codec: "h264",
        composition,
        logLevel: "error",
        outputLocation: join(out, "preview.mp4"),
        overwrite: true,
        scale,
        serveUrl,
      });

      await renderer.renderStill({
        chromiumOptions,
        composition,
        frame: Math.min(duration - 1, Math.round((duration * 2) / 3)),
        logLevel: "error",
        output: join(out, "poster.png"),
        overwrite: true,
        scale,
        serveUrl,
      });

      done += 1;
      console.log(`[${done}/${mountable.length}] ${name}`);
    } catch (cause) {
      failedNames.push(name);
      console.warn(`${name} failed: ${String(cause)}`);
    }
  }

  const skipped = wanted.filter(
    (name) => !mountable.some((mount) => mount.manifest.name === name)
  );

  console.log(
    `rendered ${done}/${mountable.length}; skipped (no mount): ${skipped.join(", ") || "none"}; failed: ${failedNames.join(", ") || "none"}`
  );
}

await main();
