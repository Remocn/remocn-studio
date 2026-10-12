import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { presetProblem, type ShaderPresetValues } from "@/shared/shaders";

// shared/shader-presets.json is derived, never written by hand: every value
// comes from the preset object a vendored remocn preset ships, and a preset
// the Studio cannot describe faithfully is listed as excluded with its reason
// instead of being offered with altered values. remocn:sync writes it and
// remocn:check fails when it has drifted from remocn/. Run on its own, it
// regenerates the file from what is vendored now.

const ROOT = resolve(import.meta.dirname, "..");
const VENDOR = join(ROOT, "remocn");
const OUTPUT = join(ROOT, "shared", "shader-presets.json");

interface Manifest {
  readonly files: readonly { readonly file: string }[];
  readonly name: string;
  readonly presetOf?: string;
  readonly title: string;
}

export interface PresetCatalogue {
  readonly excluded: readonly { reason: string; slug: string }[];
  readonly presets: readonly {
    base: string;
    slug: string;
    title: string;
    values: ShaderPresetValues;
  }[];
}

const SHADER_PREFIX = /^Shader /;
const PRESET_OBJECT =
  /export const \w+Preset = (\{[\s\S]*?\n\}) satisfies \w+;/;

// The preset object is a plain literal — identifiers as keys, double-quoted
// strings, numbers, arrays, trailing commas — so quoting its keys and dropping
// the trailing commas is all it takes to read it as JSON, without evaluating
// a vendored file or importing the component it sits beside.
export function presetValues(name: string, source: string): ShaderPresetValues {
  const literal = PRESET_OBJECT.exec(source)?.[1];
  if (literal === undefined) {
    throw new Error(`${name}: no exported preset object`);
  }
  const json = literal
    .replace(/^(\s*)([A-Za-z_$][\w$]*):/gm, '$1"$2":')
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(json) as ShaderPresetValues;
  } catch (cause) {
    throw new Error(`${name}: the preset object is not a plain literal`, {
      cause,
    });
  }
}

export async function vendoredPresets(
  vendor: string = VENDOR
): Promise<PresetCatalogue> {
  const index = JSON.parse(
    await readFile(join(vendor, "index.json"), "utf8")
  ) as { components: readonly string[] };
  const manifests = await Promise.all(
    index.components.map(
      async (name) =>
        JSON.parse(
          await readFile(
            join(vendor, "registry", name, "manifest.json"),
            "utf8"
          )
        ) as Manifest
    )
  );

  const described = await Promise.all(
    manifests.flatMap((manifest) => {
      const base = manifest.presetOf;
      const [file] = manifest.files;
      if (base === undefined || file === undefined) {
        return [];
      }
      return [
        readFile(
          join(vendor, "registry", manifest.name, file.file),
          "utf8"
        ).then((source) => ({
          base,
          slug: manifest.name,
          title: manifest.title.replace(SHADER_PREFIX, ""),
          values: presetValues(manifest.name, source),
        })),
      ];
    })
  );

  const presets: PresetCatalogue["presets"][number][] = [];
  const excluded: PresetCatalogue["excluded"][number][] = [];
  for (const preset of described) {
    const reason = presetProblem(preset);
    if (reason === null) {
      presets.push(preset);
    } else {
      excluded.push({ reason, slug: preset.slug });
    }
  }

  const bySlug = (left: { slug: string }, right: { slug: string }) =>
    left.slug.localeCompare(right.slug);
  return { excluded: excluded.sort(bySlug), presets: presets.sort(bySlug) };
}

export async function writeShaderPresets(): Promise<void> {
  const catalogue = await vendoredPresets();
  await writeFile(OUTPUT, `${JSON.stringify(catalogue, null, 2)}\n`);
  spawnSync("bun", ["x", "biome", "format", "--write", OUTPUT], {
    cwd: ROOT,
    stdio: "ignore",
  });
  console.log(
    `Described ${catalogue.presets.length} shader presets, excluded ${catalogue.excluded.length}.`
  );
  for (const { reason, slug } of catalogue.excluded) {
    console.log(`  excluded ${slug}: ${reason}`);
  }
}

export async function shaderPresetsDrift(): Promise<string | null> {
  const expected = await vendoredPresets();
  const actual = JSON.parse(await readFile(OUTPUT, "utf8")) as unknown;
  return isDeepStrictEqual(actual, expected)
    ? null
    : "shared/shader-presets.json differs from the vendored presets. Run bun run remocn:sync, or bun scripts/shader-presets.ts on its own.";
}

if (import.meta.main) {
  await writeShaderPresets();
}
