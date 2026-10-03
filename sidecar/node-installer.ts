import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { NodeDownload } from "@/shared/ipc";

export class NodeInstallError extends Data.TaggedError("NodeInstallError")<{
  message: string;
}> {}

export const RELEASE_INDEX = "https://nodejs.org/dist/index.json";

const SEMVER = /^v\d+\.\d+\.\d+$/;

interface Release {
  lts: string | false;
  version: string;
}

export function newestLts(releases: readonly unknown[]): string | null {
  for (const entry of releases) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const release = entry as Partial<Release>;

    if (
      typeof release.version === "string" &&
      typeof release.lts === "string" &&
      SEMVER.test(release.version)
    ) {
      return release.version;
    }
  }

  return null;
}

export function installerUrl(version: string): string {
  return `https://nodejs.org/dist/${version}/node-${version}.pkg`;
}

export const latestLts: Effect.Effect<string, NodeInstallError> =
  Effect.tryPromise({
    catch: (cause) =>
      new NodeInstallError({
        message: `could not reach nodejs.org: ${errorMessage(cause)}`,
      }),
    try: async () => {
      const answer = await fetch(RELEASE_INDEX);

      if (!answer.ok) {
        throw new Error(`nodejs.org answered ${answer.status}`);
      }

      return (await answer.json()) as unknown[];
    },
  }).pipe(
    Effect.flatMap((releases) => {
      const version = newestLts(releases);

      return version === null
        ? Effect.fail(
            new NodeInstallError({
              message: "nodejs.org lists no LTS release right now",
            })
          )
        : Effect.succeed(version);
    })
  );

export function downloadInstaller(
  version: string,
  onProgress: (event: NodeDownload) => Effect.Effect<void>
): Effect.Effect<string, NodeInstallError> {
  return Effect.callback<string, NodeInstallError>((resume) => {
    const controller = new AbortController();

    const run = async () => {
      const folder = path.join(tmpdir(), "remocn-studio-node");
      await mkdir(folder, { recursive: true });

      const file = path.join(folder, `node-${version}.pkg`);
      await rm(file, { force: true });

      const answer = await fetch(installerUrl(version), {
        signal: controller.signal,
      });

      if (!(answer.ok && answer.body)) {
        throw new Error(`nodejs.org answered ${answer.status}`);
      }

      const declared = answer.headers.get("content-length");
      const total = declared === null ? null : Number.parseInt(declared, 10);
      let received = 0;

      const body = Readable.fromWeb(
        answer.body as unknown as Parameters<typeof Readable.fromWeb>[0]
      );

      body.on("data", (chunk: Buffer) => {
        received += chunk.length;
        Effect.runSync(
          onProgress({
            received,
            total: total === null || Number.isNaN(total) ? null : total,
            type: "progress",
          })
        );
      });

      await pipeline(body, createWriteStream(file));

      return file;
    };

    run().then(
      (file) => resume(Effect.succeed(file)),
      (cause) =>
        resume(
          Effect.fail(new NodeInstallError({ message: errorMessage(cause) }))
        )
    );

    return Effect.sync(() => controller.abort());
  });
}

export function openInstaller(
  file: string
): Effect.Effect<boolean, NodeInstallError> {
  return Effect.callback<boolean, NodeInstallError>((resume) => {
    const child = spawn("/usr/bin/open", [file], { stdio: "ignore" });

    child.once("error", (cause) =>
      resume(
        Effect.fail(
          new NodeInstallError({
            message: `could not open ${file}: ${errorMessage(cause)}`,
          })
        )
      )
    );

    child.once("exit", (code) => resume(Effect.succeed(code === 0)));

    return Effect.sync(() => child.kill());
  });
}

export function installNode(
  onProgress: (event: NodeDownload) => Effect.Effect<void>
): Effect.Effect<{ opened: boolean; version: string }, NodeInstallError> {
  return Effect.gen(function* () {
    const version = yield* latestLts;
    const file = yield* downloadInstaller(version, onProgress);
    const opened = yield* openInstaller(file);

    return { opened, version };
  });
}
