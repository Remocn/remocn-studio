// biome-ignore-all lint/performance/noAwaitInLoops: Install shared resources and render sequentially to bound GPU use and test seek order.
import { expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CryptoHasher } from "bun";
import { Effect } from "effect";
import { REMOCN_DIR_ENV, TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { shaderCatalogueEntry } from "@/shared/shader-presets";
import { SHADER_DESCRIPTORS, shaderCreation } from "@/shared/shaders";
import {
  applyStudioOperation,
  type StudioDocument,
} from "@/shared/studio-document";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import { shaderResourcePlan } from "../library/shaders";

const PRESETS = [
  "shader-grain-gradient-sunrise",
  "shader-mesh-gradient-aurora",
  "shader-swirl-candy",
  "shader-warp-silk",
];

it.skipIf(process.env.REMOCN_SHADER_CATALOG_RENDER !== "1")(
  "renders the entire installed catalogue, deterministic seeks and frozen clocks",
  async () => {
    const require = createRequire(
      resolve("test/fixtures/render-smoke/package.json")
    );
    const { bundle } = require("@remotion/bundler") as {
      bundle: (options: Record<string, unknown>) => Promise<string>;
    };
    const { renderStill, openBrowser } = require("@remotion/renderer") as {
      renderStill: (options: Record<string, unknown>) => Promise<unknown>;
      openBrowser: (
        browser: string,
        options: Record<string, unknown>
      ) => Promise<{ close: (options: { silent: boolean }) => Promise<void> }>;
    };
    const sharp = createRequire(resolve("package.json"))(
      "sharp"
    ) as typeof import("sharp");
    const root = await mkdtemp(join(tmpdir(), "remocn-shader-catalog-"));
    const priorRemocn = process.env[REMOCN_DIR_ENV];
    const priorTemplate = process.env[TEMPLATE_DIR_ENV];
    process.env[REMOCN_DIR_ENV] = resolve("remocn");
    process.env[TEMPLATE_DIR_ENV] = resolve("templates/remotion");
    try {
      const imports: string[] = [];
      const entries: string[] = [];
      const documents: Record<string, StudioDocument> = {};
      const empty: StudioDocument = {
        definitions: [],
        objects: [],
        operations: [],
        version: 1,
        video: "intro",
      };
      for (const descriptor of SHADER_DESCRIPTORS) {
        const plan = await Effect.runPromise(
          shaderResourcePlan(descriptor.slug)
        );
        for (const file of plan.files) {
          const target = join(root, file.path);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, file.content);
        }
        imports.push(
          `import {${descriptor.exportName}Adapter} from './lib/studio-shaders-v1/${descriptor.slug.slice(7)}';`
        );
        entries.push(
          `'${descriptor.slug}': {revision:'${descriptor.revision}', component:${descriptor.exportName}Adapter}`
        );
        documents[descriptor.slug] = applyStudioOperation(
          empty,
          shaderCreation(
            descriptor,
            shaderTargetFixture,
            "create",
            "shader",
            0
          ),
          shaderTargetFixture
        );
      }
      for (const slug of PRESETS) {
        const entry = shaderCatalogueEntry(slug);
        if (!entry) {
          throw new Error(`${slug} is not described`);
        }
        documents[slug] = applyStudioOperation(
          empty,
          shaderCreation(
            entry.descriptor,
            shaderTargetFixture,
            "create",
            "shader",
            0,
            entry
          ),
          shaderTargetFixture
        );
      }
      await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
      await writeFile(
        join(root, "src/documents.json"),
        JSON.stringify(documents)
      );
      await writeFile(
        join(root, "src/index.tsx"),
        `
import React from 'react';
import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {StudioObjects} from './lib/studio-objects-v7';
import {StudioShaderSlot} from './lib/studio-objects-v7/shaders';
import documents from './documents.json';
${imports.join("\n")}
const registry = {${entries.join(",")}};
function Video({slug = 'shader-mesh-gradient', speed = 1}) {
 const document = documents[slug];
 const data = {...document, objects: document.objects.map(object => ({...object, values: {...object.values, speed}}))};
 return <StudioObjects document={data}><AbsoluteFill style={{backgroundColor:'#ff0000'}}><StudioShaderSlot id="root-shaders" label="Whole video" durationInFrames={150} sourceRevision="capture" registry={registry}/><div style={{position:'absolute',left:0,top:0,width:20,height:20,backgroundColor:'#00ff00'}}/></AbsoluteFill></StudioObjects>;
}
registerRoot(() => <Composition id="Catalogue" component={Video} width={320} height={180} fps={24} durationInFrames={150}/>);
`
      );
      const serveUrl = await bundle({
        entryPoint: join(root, "src/index.tsx"),
        outDir: join(root, "bundle"),
      });
      const browser = await openBrowser("chrome", {
        chromiumOptions: { gl: "swangle" },
      });
      const composition = {
        defaultProps: {},
        durationInFrames: 150,
        fps: 24,
        height: 180,
        id: "Catalogue",
        props: {},
        width: 320,
      };
      try {
        async function frame(
          slug: string,
          at: number,
          speed: number,
          suffix: string
        ) {
          const output = join(root, `${slug}-${suffix}.png`);
          const props = { slug, speed };
          await renderStill({
            chromiumOptions: { gl: "swangle" },
            composition: { ...composition, props },
            frame: at,
            inputProps: props,
            logLevel: "error",
            output,
            puppeteerInstance: browser,
            serveUrl,
          });
          const { data, info } = await sharp(output)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const pixel = (x: number, y: number) => [
            ...data.subarray(
              (y * info.width + x) * 3,
              (y * info.width + x) * 3 + 3
            ),
          ];
          expect(pixel(10, 10)).toEqual([0, 255, 0]);
          expect(pixel(160, 90)).not.toEqual([255, 0, 0]);
          const samples = new Set<string>();
          for (let y = 30; y < 180; y += 5) {
            for (let x = 30; x < 320; x += 5) {
              samples.add(pixel(x, y).join(","));
            }
          }
          expect(samples.size, slug).toBeGreaterThan(1);
          if (process.env.REMOCN_SHADER_CAPTURE_DIR) {
            await mkdir(process.env.REMOCN_SHADER_CAPTURE_DIR, {
              recursive: true,
            });
            await cp(
              output,
              join(
                process.env.REMOCN_SHADER_CAPTURE_DIR,
                `${slug}-${suffix}.png`
              )
            );
          }
          return new CryptoHasher("sha256").update(data).digest("hex");
        }
        const middles = new Map<string, string>();
        for (const descriptor of SHADER_DESCRIPTORS) {
          const middle = await frame(descriptor.slug, 72, 1, "middle");
          middles.set(descriptor.slug, middle);
          const start = await frame(descriptor.slug, 0, 1, "start");
          expect(start).not.toBe(middle);
          expect(await frame(descriptor.slug, 72, 1, "repeat")).toBe(middle);
          expect(await frame(descriptor.slug, 149, 0, "frozen-end")).toBe(
            await frame(descriptor.slug, 0, 0, "frozen-start")
          );
        }
        for (const slug of PRESETS) {
          const entry = shaderCatalogueEntry(slug);
          const speed = Number(entry?.values.speed ?? 1);
          const middle = await frame(slug, 72, speed, "middle");
          expect(middle, slug).not.toBe(
            middles.get(entry?.descriptor.slug ?? "")
          );
          expect(await frame(slug, 72, speed, "repeat")).toBe(middle);
        }
      } finally {
        await browser.close({ silent: true });
      }
    } finally {
      if (priorRemocn === undefined) {
        delete process.env[REMOCN_DIR_ENV];
      } else {
        process.env[REMOCN_DIR_ENV] = priorRemocn;
      }
      if (priorTemplate === undefined) {
        delete process.env[TEMPLATE_DIR_ENV];
      } else {
        process.env[TEMPLATE_DIR_ENV] = priorTemplate;
      }
      await rm(root, { force: true, recursive: true });
    }
  },
  600_000
);
