// biome-ignore-all lint/performance/noAwaitInLoops: Bound native GPU use and verify each export backend sequentially.
import { expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "bun";
import { renderOnly } from "./bundling";
import type { WebpackConfig } from "./project";

it.skipIf(process.env.REMOCN_SHADER_EXPORT !== "1")(
  "exports copied Caustics, Strata and Weave through the render compiler on desktop and software GL",
  async () => {
    const require = createRequire(
      resolve("test/fixtures/render-smoke/package.json")
    );
    const { bundle } = require("@remotion/bundler") as {
      bundle: (options: Record<string, unknown>) => Promise<string>;
    };
    const { renderMedia, getVideoMetadata, RenderInternals } =
      require("@remotion/renderer") as {
        RenderInternals: {
          getExecutablePath: (input: {
            binariesDirectory: null;
            indent: boolean;
            logLevel: string;
            type: string;
          }) => string;
        };
        renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
        getVideoMetadata: (path: string) => Promise<{
          width: number;
          height: number;
          durationInSeconds: number;
        }>;
      };
    const root = await mkdtemp(join(tmpdir(), "shader-export-"));
    try {
      await mkdir(join(root, "src/lib"), { recursive: true });
      for (const runtime of ["studio-objects-v7", "studio-shaders-v1"]) {
        await cp(
          resolve("templates/remotion/src/lib", runtime),
          join(root, "src/lib", runtime),
          { recursive: true }
        );
      }
      await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
      await writeFile(
        join(root, "src/index.tsx"),
        `
import React from 'react';
import { Composition, registerRoot, useCurrentFrame } from 'remotion';
import { CausticsAdapter } from './lib/studio-shaders-v1/caustics';
import { StrataAdapter } from './lib/studio-shaders-v1/strata';
import { WeaveAdapter } from './lib/studio-shaders-v1/weave';
import caustics from './lib/studio-shaders-v1/descriptors/shader-caustics.json';
import strata from './lib/studio-shaders-v1/descriptors/shader-strata.json';
import weave from './lib/studio-shaders-v1/descriptors/shader-weave.json';
const entries = [[CausticsAdapter, caustics], [StrataAdapter, strata], [WeaveAdapter, weave]];
function Video() {
  const frame = useCurrentFrame();
  return <>{entries.map(([Adapter, descriptor], index) => <div key={descriptor.slug} style={{position:'absolute',width:320,height:180,left:index*320,top:0}}><Adapter frame={frame} fps={24} values={Object.fromEntries(descriptor.definition.fields.map(field => [field.id,field.default]))} onReady={() => {}} onError={message => {throw new Error(message);}}/></div>)}</>;
}
registerRoot(() => <Composition id="Shaders" component={Video} width={960} height={180} fps={24} durationInFrames={6}/>);
`
      );
      const serveUrl = await bundle({
        entryPoint: join(root, "src/index.tsx"),
        outDir: join(root, "bundle"),
        webpackOverride: (config: WebpackConfig) =>
          renderOnly(config, resolve("preview")),
      });
      const backends =
        process.platform === "darwin" ? ["angle", "swangle"] : ["swangle"];
      for (const gl of backends) {
        const outputLocation = join(root, `${gl}.mp4`);
        const errors: string[] = [];
        try {
          await renderMedia({
            chromiumOptions: { gl },
            codec: "h264",
            composition: {
              defaultProps: {},
              durationInFrames: 6,
              fps: 24,
              height: 180,
              id: "Shaders",
              props: {},
              width: 960,
            },
            concurrency: 1,
            logLevel: "error",
            onBrowserLog: (log: { type: string; text: string }) => {
              if (log.type === "error") {
                errors.push(log.text);
              }
            },
            outputLocation,
            serveUrl,
          });
        } catch (cause) {
          throw new Error(`${gl}: ${String(cause)}\n${errors.join("\n")}`, {
            cause,
          });
        }
        expect(errors).toEqual([]);
        const metadata = await getVideoMetadata(outputLocation);
        expect(metadata).toMatchObject({ height: 180, width: 960 });
        expect(metadata.durationInSeconds).toBeGreaterThanOrEqual(0.25);
        expect(metadata.durationInSeconds).toBeLessThan(8 / 24);
        const ffmpeg = RenderInternals.getExecutablePath({
          binariesDirectory: null,
          indent: false,
          logLevel: "error",
          type: "ffmpeg",
        });
        const child = spawn(
          [
            ffmpeg,
            "-v",
            "error",
            "-i",
            outputLocation,
            "-map",
            "0:v:0",
            "-f",
            "image2pipe",
            "-c:v",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
          ],
          {
            env: { ...process.env, DYLD_LIBRARY_PATH: dirname(ffmpeg) },
            stderr: "pipe",
            stdout: "pipe",
          }
        );
        const [raw, stderr, code] = await Promise.all([
          new Response(child.stdout).arrayBuffer(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
        const stride = 960 * 180 * 3;
        const bytes = Buffer.from(raw);
        expect(bytes.length).toBe(stride * 6);
        const frame = bytes.subarray(stride * 3, stride * 4);
        for (const panel of [0, 1, 2]) {
          const colors = new Set<string>();
          for (let y = 10; y < 170; y += 10) {
            for (let x = 10; x < 310; x += 10) {
              const at = (y * 960 + panel * 320 + x) * 3;
              colors.add(frame.subarray(at, at + 3).join(","));
            }
          }
          expect(colors.size).toBeGreaterThan(5);
        }
        if (process.env.REMOCN_SHADER_CAPTURE_DIR) {
          const sharp = createRequire(resolve("package.json"))(
            "sharp"
          ) as typeof import("sharp");
          await mkdir(process.env.REMOCN_SHADER_CAPTURE_DIR, {
            recursive: true,
          });
          await sharp(frame, { raw: { channels: 3, height: 180, width: 960 } })
            .png()
            .toFile(
              join(process.env.REMOCN_SHADER_CAPTURE_DIR, `export-${gl}.png`)
            );
          await cp(
            outputLocation,
            join(process.env.REMOCN_SHADER_CAPTURE_DIR, `export-${gl}.mp4`)
          );
        }
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  },
  120_000
);
