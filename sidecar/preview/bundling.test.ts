import { describe, expect, it } from "bun:test";
import {
  BUNDLE_FLAGS,
  isHotUpdate,
  renderOnly,
  WATCH_CACHE,
  watched,
} from "./bundling";

describe("BUNDLE_FLAGS", () => {
  // Remotion turns this into a webpack filesystem cache that lands inside the
  // person's project at node_modules/.cache/webpack — 9 GB across four
  // projects, corrupt on nearly every run because stopping the preview kills
  // the host mid-write, and measured to save no compile time at all.
  it("never writes a webpack cache into the person's project", () => {
    expect(BUNDLE_FLAGS.enableCaching).toBe(false);
  });

  it("compiles for the Player, not for a render", () => {
    expect(BUNDLE_FLAGS.environment).toBe("development");
  });
});

class HotModuleReplacementPlugin {}
class ReactFreshWebpackPlugin {}
class ProgressPlugin {}
class CaseSensitivePathsPlugin {}

describe("renderOnly", () => {
  const refreshLoader =
    "/r/node_modules/@remotion/bundler/dist/fast-refresh/loader.js";
  const config = {
    entry: [
      "/r/node_modules/@remotion/bundler/dist/fast-refresh/runtime.js",
      "/r/node_modules/@remotion/bundler/dist/setup-environment.js",
      "/r/src/index.ts",
    ],
    module: {
      rules: [
        {
          test: "tsx",
          use: [
            { loader: "/r/node_modules/esbuild-loader/dist/index.cjs" },
            { loader: refreshLoader },
          ],
        },
        { oneOf: [{ use: [refreshLoader, "style-loader"] }] },
      ],
    },
    output: { filename: "bundle.js", path: "/out" },
    plugins: [
      new ReactFreshWebpackPlugin(),
      new CaseSensitivePathsPlugin(),
      new HotModuleReplacementPlugin(),
      new ProgressPlugin(),
    ],
  };

  it("keeps nothing a render never reads: no HMR, no React Refresh, no progress", () => {
    const rendered = renderOnly(config, "/preview");

    expect(
      (rendered.plugins as object[]).map((plugin) => plugin.constructor.name)
    ).toEqual(["CaseSensitivePathsPlugin"]);
    expect(rendered.entry).toEqual([
      "/r/node_modules/@remotion/bundler/dist/setup-environment.js",
      "/r/src/index.ts",
    ]);
    expect(JSON.stringify(rendered.module)).not.toContain("fast-refresh");
    expect(JSON.stringify(rendered.module)).toContain("esbuild-loader");
    expect(JSON.stringify(rendered.module)).toContain("style-loader");
  });

  it("applies the same scoped precision compatibility to export as native preview", () => {
    const rendered = renderOnly(config, "/preview");
    const { rules } = rendered.module as {
      rules: { enforce?: string; test?: RegExp; use?: string[] }[];
    };
    const precision = rules.at(-1);
    expect(precision?.enforce).toBe("pre");
    expect(precision?.use).toEqual(["/preview/shader-precision-loader.cjs"]);
    for (const name of ["caustics", "strata", "weave"]) {
      expect(
        precision?.test?.test(
          `/project/src/lib/studio-shaders-v1/${name}-fragment.ts`
        )
      ).toBe(true);
    }
    expect(
      precision?.test?.test("/project/src/authored/caustics-fragment.ts")
    ).toBe(false);
    expect(
      precision?.test?.test(
        "/project/src/lib/studio-shaders-v1/mesh-gradient.tsx"
      )
    ).toBe(false);
    expect(config.module.rules).toHaveLength(2);
  });

  it("cleans its output folder on every emit", () => {
    expect(renderOnly(config, "/preview").output).toEqual({
      clean: true,
      filename: "bundle.js",
      path: "/out",
    });
  });

  it("recognises webpack's hot-update files", () => {
    expect(isHotUpdate("main.4f2a.hot-update.js")).toBe(true);
    expect(isHotUpdate("main.4f2a.hot-update.js.map")).toBe(true);
    expect(isHotUpdate("4f2a.hot-update.json")).toBe(true);
    expect(isHotUpdate("bundle.js")).toBe(false);
  });
});

describe("watched", () => {
  // What Remotion 4.0.520's webpackConfig hands back with enableCaching off.
  const remotion = {
    cache: false,
    mode: "development",
    watchOptions: {
      aggregateTimeout: 0,
      ignored: ["**/.git/**", "**/.turbo/**", "**/node_modules/**"],
      poll: undefined,
    },
  };

  it("keeps a cache in memory, never on disk", () => {
    const { config } = watched(remotion);

    expect(config.cache).toEqual({ maxGenerations: 1, type: "memory" });
    expect(config.cache).toBe(WATCH_CACHE);
    expect(config.mode).toBe("development");
  });

  it("watches with the project's own options, node_modules ignored", () => {
    expect(watched(remotion).options).toEqual(remotion.watchOptions);
  });

  it("watches with webpack's defaults when the config names none", () => {
    expect(watched({ cache: false }).options).toEqual({});
  });

  it("leaves the config it was given alone", () => {
    watched(remotion);

    expect(remotion.cache).toBe(false);
  });
});
