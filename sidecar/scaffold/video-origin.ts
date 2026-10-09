import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { version } from "@/package.json";
import { APP_VERSION_ENV } from "@/shared/ipc";
import { VIDEO_ORIGIN_FILE, VideoOrigin } from "@/shared/video-origin";

const decode = Schema.decodeUnknownEffect(VideoOrigin);

export async function stampVideoOrigin(folder: string): Promise<void> {
  const origin = await Effect.runPromise(
    decode({
      createdWithStudioVersion: process.env[APP_VERSION_ENV] ?? version,
      version: 1,
    })
  );
  await writeFile(
    join(folder, VIDEO_ORIGIN_FILE),
    `${JSON.stringify(origin, null, 2)}\n`,
    { flag: "wx" }
  );
}
