import { Cause, Effect, Exit } from "effect";
import { SIDECAR_PROTOCOL } from "@/shared/ipc";
import { layerProcess, SidecarChannel } from "./channel";
import { handlers } from "./handlers";
import { runHost } from "./host";
import { untilOrphaned, untilSignalled } from "./lifecycle";

const main = Effect.gen(function* () {
  const channel = yield* SidecarChannel;

  yield* channel.log(`listening on stdio, protocol ${SIDECAR_PROTOCOL}`);

  const reason = yield* Effect.raceAll([
    runHost(handlers).pipe(Effect.as("the host closed stdin")),
    untilOrphaned,
    untilSignalled,
  ]);

  yield* channel.log(reason);
}).pipe(Effect.scoped, Effect.provide(layerProcess));

const exit = await Effect.runPromiseExit(main);

if (Exit.isFailure(exit)) {
  process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
}

process.exit(Exit.isSuccess(exit) ? 0 : 1);
