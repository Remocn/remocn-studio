import { expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build, spawn } from "bun";
import precisionLoader from "../../preview/shader-precision-loader.cjs";

const CUSTOM_SHADER_FRAGMENT =
  /[/\\]studio-shaders-v1[/\\](?:caustics|strata|weave)-fragment\.ts$/;

it.skipIf(
  process.env.REMOCN_SHADER_WEBKIT !== "1" || process.platform !== "darwin"
)(
  "draws copied custom adapters in native WebKit with compatible uniform precision",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "shader-webkit-"));
    async function run(args: string[]) {
      const child = spawn(args, { stderr: "pipe", stdout: "pipe" });
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ code, stderr, stdout }).toMatchObject({ code: 0 });
      return stdout;
    }
    try {
      const output = await build({
        entrypoints: [resolve("test/fixtures/shader-webkit/index.tsx")],
        format: "iife",
        plugins: [
          {
            name: "native-shader-precision",
            setup(plugin) {
              plugin.onLoad(
                {
                  filter: CUSTOM_SHADER_FRAGMENT,
                },
                async (args) => ({
                  contents: precisionLoader(await readFile(args.path, "utf8")),
                  loader: "ts",
                })
              );
            },
          },
        ],
        target: "browser",
      });
      expect(output.success).toBe(true);
      const page = join(root, "index.html");
      await writeFile(join(root, "bundle.js"), await output.outputs[0].text());
      await writeFile(
        page,
        '<html><body><script>window.onerror = (message) => window.webkit.messageHandlers.result.postMessage(JSON.stringify({ok:false,message}));</script><script src="bundle.js"></script></body></html>'
      );
      const runner = join(root, "probe");
      await run([
        "swiftc",
        "-module-cache-path",
        join(tmpdir(), "remocn-swift-module-cache"),
        resolve("test/fixtures/shader-webkit/probe.swift"),
        "-o",
        runner,
      ]);
      const result = JSON.parse((await run([runner, page])).trim());
      expect(result.ok).toBe(true);
      expect(
        result.results.map((entry: { name: string }) => entry.name).sort()
      ).toEqual(["caustics", "strata", "weave"]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  },
  60_000
);
