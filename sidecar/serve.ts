import { Effect } from "effect";
import { SIDECAR_PROTOCOL } from "@/shared/ipc";
import { acpPool } from "./acp/pool";
import { layerProcess, SidecarChannel } from "./channel";
import { handlers } from "./handlers";
import { ProjectStore } from "./history/projects";
import { openStores } from "./history/sqlite";
import { HistoryStore } from "./history/store";
import { VideoStore } from "./history/videos";
import { runHost } from "./host";
import { untilOrphaned, untilSignalled } from "./lifecycle";
import { untilBroken } from "./pipes";
import { previewRoot, prunePreviewOutputs } from "./preview/outputs";

export const runSidecar = Effect.gen(function* () {
  const channel = yield* SidecarChannel;

  yield* channel.log(`listening on stdio, protocol ${SIDECAR_PROTOCOL}`);

  const stores = yield* openStores(channel.log);

  yield* Effect.addFinalizer(() => acpPool.disposeAll);

  yield* Effect.forkScoped(
    stores.projects.list.pipe(
      Effect.flatMap((projects) =>
        prunePreviewOutputs({
          known: projects.map((project) => project.path),
          now: Date.now(),
          root: previewRoot(),
        })
      ),
      Effect.flatMap((removed) =>
        removed.length === 0
          ? Effect.void
          : channel.log(
              `pruned ${removed.length} stale preview output(s): ${removed.join(", ")}`
            )
      ),
      Effect.ignore
    )
  );

  const reason = yield* Effect.raceAll([
    runHost(handlers).pipe(Effect.as("the host closed stdin")),
    untilBroken(process.stdout, "the host closed stdout"),
    untilOrphaned,
    untilSignalled,
  ]).pipe(
    Effect.provideService(HistoryStore, stores.history),
    Effect.provideService(ProjectStore, stores.projects),
    Effect.provideService(VideoStore, stores.videos)
  );

  yield* channel.log(reason);
}).pipe(Effect.scoped, Effect.provide(layerProcess));
