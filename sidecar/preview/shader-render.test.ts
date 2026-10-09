import { afterAll, describe, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CryptoHasher, spawn } from "bun";
import { MESH_GRADIENT, shaderCreation } from "@/shared/shaders";
import {
  applyStudioOperation,
  type StudioDocument,
} from "@/shared/studio-document";
import { shaderTargetFixture } from "@/test/fixtures/shaders";

const enabled = process.env.REMOCN_SHADER_RENDER === "1";
const folders: string[] = [];
afterAll(async () => {
  await Promise.all(
    folders.map((folder) => rm(folder, { force: true, recursive: true }))
  );
});

describe.skipIf(!enabled)("project-local shader capture", () => {
  it("draws Mesh behind foreground, repeats out-of-order seeks and freezes speed zero", async () => {
    const require = createRequire(
      resolve("test/fixtures/render-smoke/package.json")
    );
    const { bundle } = require("@remotion/bundler") as {
      bundle: (options: {
        entryPoint: string;
        outDir: string;
      }) => Promise<string>;
    };
    const { renderStill, renderMedia, getVideoMetadata, RenderInternals } =
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
          fps: number;
          durationInSeconds: number;
        }>;
        renderStill: (options: Record<string, unknown>) => Promise<unknown>;
      };
    const sharp = createRequire(resolve("package.json"))(
      "sharp"
    ) as typeof import("sharp");
    const root = await mkdtemp(join(tmpdir(), "remocn-shader-render-"));
    folders.push(root);
    await mkdir(join(root, "src/lib"), { recursive: true });
    await Promise.all(
      ["studio-objects-v7", "studio-shaders-v1"].map((runtime) =>
        cp(
          resolve("templates/remotion/src/lib", runtime),
          join(root, "src/lib", runtime),
          { recursive: true }
        )
      )
    );
    await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
    const empty: StudioDocument = {
      definitions: [],
      objects: [],
      operations: [],
      version: 1,
      video: "intro",
    };
    const operation = shaderCreation(
      MESH_GRADIENT,
      shaderTargetFixture,
      "create-mesh",
      "mesh",
      0
    );
    const document = applyStudioOperation(
      empty,
      operation,
      shaderTargetFixture
    );
    await writeFile(join(root, "src/studio.json"), JSON.stringify(document));
    await writeFile(
      join(root, "src/index.tsx"),
      `
import React from 'react';
import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {StudioObjects} from './lib/studio-objects-v7';
import {StudioShaderSlot} from './lib/studio-objects-v7/shaders';
import {MeshGradientAdapter} from './lib/studio-shaders-v1/mesh-gradient';
import document from './studio.json';
const registry = {'shader-mesh-gradient': {revision: '${MESH_GRADIENT.revision}', component: MeshGradientAdapter}};
function Video({speed = 1}) {
 const data = {...document, objects: document.objects.map(object => ({...object, values: {...object.values, speed}}))};
 return <StudioObjects document={data}><AbsoluteFill style={{backgroundColor:'#ff0000'}}><StudioShaderSlot id="root-shaders" label="Whole video" durationInFrames={150} sourceRevision="capture" registry={registry}/><div style={{position:'absolute', left:0, top:0, width:30, height:30, backgroundColor:'#00ff00'}}/></AbsoluteFill></StudioObjects>;
}
registerRoot(() => <Composition id="Shader" component={Video} width={320} height={180} fps={24} durationInFrames={150}/>);
`
    );
    const serveUrl = await bundle({
      entryPoint: join(root, "src/index.tsx"),
      outDir: join(root, "bundle"),
    });
    const composition = {
      defaultProps: {},
      durationInFrames: 150,
      fps: 24,
      height: 180,
      id: "Shader",
      props: {},
      width: 320,
    };
    async function frame(at: number, speed: number, name: string) {
      const output = join(root, `${name}.png`);
      await renderStill({
        chromiumOptions: { gl: "swangle" },
        composition: { ...composition, props: { speed } },
        frame: at,
        inputProps: { speed },
        logLevel: "error",
        output,
        serveUrl,
      });
      const { data, info } = await sharp(output)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const offset = (y: number, x: number) =>
        (y * info.width + x) * info.channels;
      expect([...data.subarray(offset(10, 10), offset(10, 10) + 3)]).toEqual([
        0, 255, 0,
      ]);
      expect([
        ...data.subarray(offset(90, 160), offset(90, 160) + 3),
      ]).not.toEqual([255, 0, 0]);
      if (process.env.REMOCN_SHADER_CAPTURE_DIR) {
        await mkdir(process.env.REMOCN_SHADER_CAPTURE_DIR, { recursive: true });
        await cp(
          output,
          join(process.env.REMOCN_SHADER_CAPTURE_DIR, `${name}.png`)
        );
      }
      return new CryptoHasher("sha256").update(data).digest("hex");
    }
    const middle = await frame(72, 1, "mesh-middle");
    const start = await frame(0, 1, "mesh-start");
    await frame(149, 1, "mesh-end");
    expect(await frame(72, 1, "mesh-middle-repeat")).toEqual(middle);
    expect(start).not.toEqual(middle);
    expect(await frame(149, 0, "mesh-static-end")).toEqual(
      await frame(0, 0, "mesh-static-start")
    );
    const output = join(root, "mesh.mp4");
    await renderMedia({
      chromiumOptions: { gl: "swangle" },
      codec: "h264",
      composition,
      concurrency: 1,
      logLevel: "error",
      outputLocation: output,
      serveUrl,
    });
    const metadata = await getVideoMetadata(output);
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(180);
    expect(metadata.fps).toBe(24);
    // Container duration includes muxing padding; count decoded video frames.
    expect(metadata.durationInSeconds).toBeGreaterThanOrEqual(150 / 24);
    expect(metadata.durationInSeconds).toBeLessThan(152 / 24);
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
        output,
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
    const [raw, error, code] = await Promise.all([
      new Response(child.stdout).arrayBuffer(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) {
      throw new Error(error);
    }
    const bytes = Buffer.from(raw);
    const stride = 320 * 180 * 3;
    expect(bytes.length / stride).toBe(150);
    const exported = bytes.subarray(72 * stride, 73 * stride);
    const expected = await sharp(join(root, "mesh-middle.png"))
      .removeAlpha()
      .raw()
      .toBuffer();
    let difference = 0;
    for (let at = 0; at < stride; at += 1) {
      difference += Math.abs(exported[at] - expected[at]);
    }
    expect(difference / stride).toBeLessThan(4);
    const foreground = (10 * 320 + 10) * 3;
    expect(exported[foreground + 1]).toBeGreaterThan(240);
    expect(exported[foreground]).toBeLessThan(20);
    expect(exported[foreground + 2]).toBeLessThan(20);
    if (process.env.REMOCN_SHADER_CAPTURE_DIR) {
      await cp(output, join(process.env.REMOCN_SHADER_CAPTURE_DIR, "mesh.mp4"));
    }
  }, 240_000);
});
