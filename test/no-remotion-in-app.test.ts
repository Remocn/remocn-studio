import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Transpiler } from "bun";

const ROOT = path.resolve(import.meta.dir, "..");
const APP = [
  "app",
  "components",
  "hooks",
  "lib",
  "scripts",
  "shared",
  "sidecar",
  "test",
  "types",
];
const WEBVIEW = ["app", "components", "hooks", "lib"];
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIPPED = /\.(test\.[cm]?[jt]sx?|d\.ts)$/;
const REMOTION =
  /^(remotion|@remotion\/player|__remocn_project_remotion)(\/|$)/;
const PREVIEW = `preview${path.sep}`;
const REMOTION_FREE = ["preview/playback-rate.ts", "preview/protocol.ts"].map(
  (file) => path.join(...file.split("/"))
);

function sources(folders: readonly string[]): string[] {
  return folders.flatMap((folder) =>
    readdirSync(path.join(ROOT, folder), { recursive: true })
      .map((entry) => path.join(folder, String(entry)))
      .filter(
        (file) =>
          SOURCE.test(file) &&
          !SKIPPED.test(file) &&
          !file.startsWith(`test${path.sep}fixtures${path.sep}`)
      )
  );
}

function importsOf(file: string): string[] {
  const loader = file.endsWith("x") ? "tsx" : "ts";
  const transpiler = new Transpiler({ loader });
  return transpiler
    .scanImports(readFileSync(path.join(ROOT, file), "utf8"))
    .map((entry) => entry.path);
}

function resolved(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = specifier.slice(2);
  } else if (specifier.startsWith(".")) {
    base = path.join(path.dirname(from), specifier);
  } else {
    return null;
  }
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return (
    candidates.find((candidate) => {
      const absolute = path.join(ROOT, candidate);
      return existsSync(absolute) && statSync(absolute).isFile();
    }) ?? null
  );
}

function previewModulesOf(file: string): string[] {
  return importsOf(file).flatMap((specifier) => {
    const target = resolved(file, specifier);
    return target?.startsWith(PREVIEW) ? [target] : [];
  });
}

function reachesRemotion(file: string, seen = new Set<string>()): boolean {
  if (seen.has(file)) {
    return false;
  }
  seen.add(file);
  return importsOf(file).some((specifier) => {
    if (REMOTION.test(specifier)) {
      return true;
    }
    const target = resolved(file, specifier);
    return target !== null && reachesRemotion(target, seen);
  });
}

describe("the app bundles no Remotion", () => {
  it("imports neither remotion nor @remotion/player outside the preview runtime", () => {
    const files = sources(APP);
    const offenders = files.filter((file) =>
      importsOf(file).some((specifier) => REMOTION.test(specifier))
    );

    expect(files.length).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });

  it("takes from the preview runtime only the modules that carry no Remotion", () => {
    const offenders = sources(WEBVIEW).flatMap((file) =>
      previewModulesOf(file)
        .filter((target) => !REMOTION_FREE.includes(target))
        .map((target) => `${file} → ${target}`)
    );

    expect(offenders).toEqual([]);
  });

  it("keeps the modules it may take free of Remotion", () => {
    expect(REMOTION_FREE.filter((file) => reachesRemotion(file))).toEqual([]);
    expect(reachesRemotion(path.join("preview", "player-runtime.tsx"))).toBe(
      true
    );
  });
});
