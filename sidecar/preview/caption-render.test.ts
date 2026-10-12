import { expect, it } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "bun";

it.skipIf(process.env.REMOCN_CAPTION_RENDER !== "1")(
  "renders saved speech timings through trim, rate and scene offset with matching still/export frames",
  async () => {
    const require = createRequire(
      resolve("test/fixtures/render-smoke/package.json")
    );
    const { bundle } = require("@remotion/bundler") as {
      bundle: (options: Record<string, unknown>) => Promise<string>;
    };
    const { renderStill, renderMedia, RenderInternals } =
      require("@remotion/renderer") as {
        renderStill: (options: Record<string, unknown>) => Promise<unknown>;
        renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
        RenderInternals: {
          getExecutablePath: (options: Record<string, unknown>) => string;
        };
      };
    const sharp = createRequire(resolve("package.json"))(
      "sharp"
    ) as typeof import("sharp");
    const root = await mkdtemp(join(tmpdir(), "caption-render-"));
    try {
      await mkdir(join(root, "src"));
      await mkdir(join(root, "public"));
      await symlink(
        resolve("test/fixtures/render-smoke/node_modules"),
        join(root, "node_modules"),
        "dir"
      );
      await cp(
        "test/fixtures/captions/speech.wav",
        join(root, "public/speech.wav")
      );
      await cp(
        "test/fixtures/captions/captions.json",
        join(root, "src/captions.json")
      );
      await Promise.all(
        ["caption-karaoke", "caption-core"].map(async (name) => {
          const manifest = JSON.parse(
            await readFile(`remocn/registry/${name}/manifest.json`, "utf8")
          ) as { files: { file: string; target: string }[] };
          await Promise.all(
            manifest.files.map(async (file) => {
              const target = join(root, file.target);
              await mkdir(dirname(target), { recursive: true });
              await cp(`remocn/registry/${name}/${file.file}`, target);
            })
          );
        })
      );
      await writeFile(
        join(root, "src/index.tsx"),
        `
import React from 'react';
import {AbsoluteFill, Audio, Composition, Sequence, registerRoot, staticFile} from 'remotion';
import {CaptionKaraoke} from './components/remocn/caption-karaoke';
import saved from './captions.json';
const trimMs = 1000;
const rate = 1.5;
const captions = saved.filter(c => c.endMs > trimMs && c.startMs < 8000).map(c => ({...c, startMs: Math.max(0, c.startMs - trimMs) / rate, endMs: (Math.min(8000, c.endMs) - trimMs) / rate, timestampMs: c.timestampMs === null ? null : (c.timestampMs - trimMs) / rate}));
function Video({broken = false}) {
 if (broken) throw new Error('Caption fixture failure');
 return <AbsoluteFill style={{backgroundColor:'#121212', fontFamily:'Arial'}}><Sequence from={30} durationInFrames={140}><Audio src={staticFile('speech.wav')} startFrom={30} endAt={240} playbackRate={rate}/><AbsoluteFill style={{alignItems:'center',justifyContent:'center',padding:30}}><CaptionKaraoke captions={captions} fontSize={42}/></AbsoluteFill></Sequence></AbsoluteFill>;
}
registerRoot(() => <Composition id="Captions" component={Video} width={640} height={360} fps={30} durationInFrames={180}/>);
`
      );
      const serveUrl = await bundle({
        entryPoint: join(root, "src/index.tsx"),
        outDir: join(root, "bundle"),
        publicDir: join(root, "public"),
      });
      const composition = {
        defaultProps: {},
        durationInFrames: 180,
        fps: 30,
        height: 360,
        id: "Captions",
        props: {},
        width: 640,
      };
      async function frame(at: number, name: string) {
        const output = join(root, `${name}.png`);
        await renderStill({
          composition,
          frame: at,
          logLevel: "error",
          output,
          serveUrl,
        });
        return await sharp(output).removeAlpha().raw().toBuffer();
      }
      const middle = await frame(60, "caption-middle");
      const start = await frame(0, "caption-start");
      expect(middle.equals(start)).toBe(false);
      expect((await frame(60, "caption-repeat")).equals(middle)).toBe(true);
      expect((await frame(179, "caption-end")).equals(start)).toBe(true);
      await expect(
        renderStill({
          composition: { ...composition, props: { broken: true } },
          frame: 60,
          inputProps: { broken: true },
          logLevel: "error",
          output: join(root, "broken.png"),
          serveUrl,
        })
      ).rejects.toThrow("Caption fixture failure");
      const output = join(root, "captions.mp4");
      await renderMedia({
        codec: "h264",
        composition,
        concurrency: 1,
        logLevel: "error",
        outputLocation: output,
        serveUrl,
      });
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
          "-ss",
          "2",
          "-i",
          output,
          "-frames:v",
          "1",
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
      const [data, error, code] = await Promise.all([
        new Response(child.stdout).arrayBuffer(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      if (code !== 0) {
        throw new Error(error);
      }
      const encoded = Buffer.from(data);
      expect(encoded.length).toBe(middle.length);
      let difference = 0;
      for (let at = 0; at < middle.length; at += 1) {
        difference += Math.abs(middle[at] - encoded[at]);
      }
      expect(difference / middle.length).toBeLessThan(4);
      const capture = process.env.REMOCN_CAPTION_CAPTURE_DIR;
      if (capture) {
        await mkdir(capture, { recursive: true });
        await Promise.all(
          [
            "caption-middle.png",
            "caption-start.png",
            "caption-end.png",
            "captions.mp4",
          ].map((file) => cp(join(root, file), join(capture, file)))
        );
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  },
  120_000
);
