import { Cause, Effect, Exit } from "effect";
import { SIDECAR_PROTOCOL } from "@/shared/ipc";
import { layerProcess, SidecarChannel } from "./channel";
import { handlers } from "./handlers";
import { openHistory } from "./history/sqlite";
import { HistoryStore } from "./history/store";
import { runHost } from "./host";
import { untilOrphaned, untilSignalled } from "./lifecycle";
import { runPreviewHost } from "./preview/host";
import { PREVIEW_HOST_FLAG } from "./preview/supervisor";

const sidecar = Effect.gen(function* () {
  const channel = yield* SidecarChannel;

  yield* channel.log(`listening on stdio, protocol ${SIDECAR_PROTOCOL}`);

  const history = yield* openHistory(channel.log);

  const reason = yield* Effect.raceAll([
    runHost(handlers).pipe(Effect.as("the host closed stdin")),
    untilOrphaned,
    untilSignalled,
  ]).pipe(Effect.provideService(HistoryStore, history));

  yield* channel.log(reason);
}).pipe(Effect.scoped, Effect.provide(layerProcess));

const main = process.argv.includes(PREVIEW_HOST_FLAG)
  ? runPreviewHost
  : sidecar;

const exit = await Effect.runPromiseExit(main);

if (Exit.isFailure(exit)) {
  process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
}

process.exit(Exit.isSuccess(exit) ? 0 : 1);
