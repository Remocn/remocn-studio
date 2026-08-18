import { Cause, Effect, Exit } from "effect";
import { SIDECAR_PROTOCOL } from "@/shared/ipc";
import { layerProcess, SidecarChannel } from "./channel";
import { handlers } from "./handlers";
import { ProjectStore } from "./history/projects";
import { openStores } from "./history/sqlite";
import { HistoryStore } from "./history/store";
import { runHost } from "./host";
import { untilOrphaned, untilSignalled } from "./lifecycle";
import { runPreviewHost } from "./preview/host";
import { PREVIEW_HOST_FLAG } from "./preview/supervisor";
import { runToolsHost } from "./tools/host";
import { TOOLS_HOST_FLAG } from "./tools/protocol";

const sidecar = Effect.gen(function* () {
  const channel = yield* SidecarChannel;

  yield* channel.log(`listening on stdio, protocol ${SIDECAR_PROTOCOL}`);

  const stores = yield* openStores(channel.log);

  const reason = yield* Effect.raceAll([
    runHost(handlers).pipe(Effect.as("the host closed stdin")),
    untilOrphaned,
    untilSignalled,
  ]).pipe(
    Effect.provideService(HistoryStore, stores.history),
    Effect.provideService(ProjectStore, stores.projects)
  );

  yield* channel.log(reason);
}).pipe(Effect.scoped, Effect.provide(layerProcess));

const main = (() => {
  if (process.argv.includes(PREVIEW_HOST_FLAG)) {
    return runPreviewHost;
  }
  if (process.argv.includes(TOOLS_HOST_FLAG)) {
    return runToolsHost;
  }
  return sidecar;
})();

const exit = await Effect.runPromiseExit(main);

if (Exit.isFailure(exit)) {
  process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
}

process.exit(Exit.isSuccess(exit) ? 0 : 1);
