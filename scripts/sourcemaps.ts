/**
 * Uploads the sourcemaps a crash report needs to be readable, then removes
 * the ones that must not ship.
 *
 * **Where this runs is the whole design.** Sentry matches a minified frame to
 * a map by a *debug id* that `sentry-cli sourcemaps inject` writes into the
 * built JavaScript itself, so the inject has to be the last thing that touches
 * those bytes. `tauri-action` offers no hook between its
 * `beforeBuildCommand` and the bundling that copies resources into the `.app`
 * — but `beforeBuildCommand` is `tauri:before-build`, which is this repo's own
 * script, so this is the last line of it. Run anywhere else, a later rebuild
 * would overwrite the debug id and every uploaded map would match nothing.
 *
 * Doing nothing is the normal case: with no `SENTRY_AUTH_TOKEN` — which is
 * every local build and every build until #268's Sentry project exists — it
 * uploads nothing and still does the one thing that is not optional, which is
 * making sure `out/` ships no `.map` files.
 *
 * The sidecar half needs its comment taken out first. `bun build
 * --sourcemap=external` writes a `//# debugId=` line into the bundle and the
 * matching id into the map — the reason `sidecar:build` had to move from
 * `--outfile` to `--outdir`, which is what bun requires for an external map —
 * but a comment is all it writes. The SDK learns a frame's debug id at runtime
 * from `globalThis._sentryDebugIds`, which only inject's snippet fills, and
 * inject skips any file that already carries the comment. So v1.0.0 and
 * v1.0.1 uploaded a map for `main.js` that no event could name: every sidecar
 * report arrived with no `debug_meta` and stayed minified (REM-652). With the
 * line gone, inject reuses the map's own id, puts the snippet below the
 * `// @bun` pragma, and shifts the map by the lines it adds — all measured
 * against `@sentry/bun` with a capturing transport.
 *
 * `@sentry/cli` is deliberately not a dependency: its postinstall downloads a
 * platform binary of some 20 MB, and `bun install` runs in three CI jobs that
 * would pay for it to do nothing. `bunx` fetches it on the one path that uses
 * it.
 */

import { spawn } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { crashRelease } from "@/shared/crash";

const SENTRY_CLI = "@sentry/cli@2";
const EXPORT_DIR = "out";
const SIDECAR_DIR = "sidecar-dist";
const BUN_DEBUG_ID = /\n\/\/# debugId=[0-9A-Fa-f]+\s*$/;

const token = process.env.SENTRY_AUTH_TOKEN ?? "";
const org = process.env.SENTRY_ORG ?? "";
const project = process.env.SENTRY_PROJECT ?? "";
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

const manifest: { version: string } = JSON.parse(
  await readFile("package.json", "utf8")
);
const release = crashRelease(manifest.version);

try {
  if (token === "" || org === "" || project === "" || dsn === "") {
    console.log(
      "sourcemaps: nothing uploaded — SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT and NEXT_PUBLIC_SENTRY_DSN are what turn this on"
    );
  } else {
    await dropBunDebugId(join(SIDECAR_DIR, "main.js"));

    // Both bundles go up under one release, which is what makes a crash that
    // starts in the webview and ends in the sidecar read as one story.
    for (const dir of [EXPORT_DIR, SIDECAR_DIR]) {
      // biome-ignore lint/performance/noAwaitInLoops: a release step, and the upload has to follow this directory's own inject
      await sentry(["sourcemaps", "inject", dir]);
      await sentry([
        "sourcemaps",
        "upload",
        "--release",
        release,
        "--strip-common-prefix",
        dir,
      ]);
    }
  }
} catch (cause) {
  // Loud, but not fatal. An expired token or a Sentry outage would otherwise
  // mean no release at all, and the same trade is already made for the Pexels
  // key one step above: the build succeeds and the release is the poorer for
  // it. What it costs is unsymbolicated frames for this one version — the
  // warning below is what says so, in the job log, next to the upload that
  // did not happen.
  console.warn(
    `sourcemaps: NOT UPLOADED — ${cause instanceof Error ? cause.message : String(cause)}`
  );
  console.warn(
    `sourcemaps: ${release} will report minified frames until its maps are uploaded by hand`
  );
} finally {
  // A `finally`, and not merely the next statement. This is the only part of
  // the script that is not optional: the static export *is* the app bundle, so
  // a `.map` left in `out/` ships the studio's own sources inside every
  // release. The catch above swallows today, so the two would run either way —
  // but the day someone decides a failed upload should fail the build, the
  // maps must still go, and a `finally` is what keeps that true without anyone
  // having to notice. The sidecar's map is already safe, since
  // `tauri.conf.json` names `main.js` as a resource and not the file beside
  // it, and is removed for tidiness rather than for that reason.
  await removeMaps(EXPORT_DIR);
  await removeMaps(SIDECAR_DIR);
}

function sentry(args: readonly string[]): Promise<void> {
  const child = spawn("bunx", [SENTRY_CLI, ...args], {
    env: { ...process.env, SENTRY_ORG: org, SENTRY_PROJECT: project },
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`sentry-cli ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function dropBunDebugId(file: string): Promise<void> {
  const source = await readFile(file, "utf8");

  await writeFile(file, source.replace(BUN_DEBUG_ID, "\n"));
}

async function removeMaps(dir: string): Promise<void> {
  let entries: string[];

  try {
    entries = await readdir(dir, { recursive: true });
  } catch {
    // Nothing built here. `sidecar:build` and `next build` both run before
    // this in `tauri:before-build`, so this is a hand-run, not a failure.
    return;
  }

  let removed = 0;
  for (const entry of entries) {
    if (entry.endsWith(".map")) {
      // biome-ignore lint/performance/noAwaitInLoops: a handful of files in a release step
      await rm(join(dir, entry), { force: true });
      removed += 1;
    }
  }

  console.log(`sourcemaps: removed ${removed} map(s) from ${dir}/`);
}
