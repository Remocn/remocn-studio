import "@remotion/studio/renderEntry";
import { Player, type PlayerRef } from "@remotion/player";
import { useContext, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { onCommand, post } from "./bridge";
import { connectHotReload } from "./hot";
import { armInspect, freezeInspect, type Stage as Spot } from "./inspect";
import { armSnapshot, type Frame } from "./snapshot";

const MAIN_ID = "Main";

connectHotReload();

Internals.waitForRoot((Root: React.FC) => {
  const element = Internals.getPreviewDomElement();
  if (element === null) {
    return;
  }
  createRoot(element).render(<Preview Root={Root} />);
});

function Preview({ Root }: { readonly Root: React.FC }) {
  return (
    <Internals.CompositionManagerProvider
      currentCompositionMetadata={null}
      initialCanvasContent={null}
      initialCompositions={[]}
      onlyRenderComposition={null}
    >
      <Internals.RemotionRootContexts
        audioEnabled={window.remotion_audioEnabled}
        audioLatencyHint={window.remotion_audioLatencyHint ?? "playback"}
        frameState={null}
        logLevel={window.remotion_logLevel ?? "info"}
        numberOfAudioTags={window.remotion_numberOfAudioTags ?? 0}
        previewSampleRate={window.remotion_previewSampleRate ?? null}
        videoEnabled={window.remotion_videoEnabled}
      >
        <Root />
        <Stage />
      </Internals.RemotionRootContexts>
    </Internals.CompositionManagerProvider>
  );
}

function Stage() {
  const { compositions } = useContext(Internals.CompositionManager);
  const picked = pick(compositions, preferredId());
  const player = useRef<PlayerRef>(null);

  useEffect(() => {
    post(describe(picked, compositions.length));
  }, [compositions.length, picked]);

  usePreviewCommands(player, {
    composition: picked?.id ?? null,
    fps: picked?.metadata?.fps ?? 30,
    height: picked?.metadata?.height ?? 0,
    width: picked?.metadata?.width ?? 0,
  });

  if (picked === null || picked.metadata === null) {
    return null;
  }

  const { component, defaultProps, durationInFrames, fps, height, width } =
    picked.metadata;

  return (
    <Player
      acknowledgeRemotionLicense
      component={component}
      compositionHeight={height}
      compositionWidth={width}
      controls
      durationInFrames={durationInFrames}
      fps={fps}
      inputProps={defaultProps}
      loop
      ref={player}
      style={{ height: "100%", width: "100%" }}
    />
  );
}

interface Playing {
  composition: string | null;
  fps: number;
  height: number;
  width: number;
}

function usePreviewCommands(
  player: React.RefObject<PlayerRef | null>,
  video: Playing
) {
  const playing = useRef(video);
  playing.current = video;

  const spot = useRef<Spot>({
    composition: () => playing.current.composition ?? "",
    fps: () => playing.current.fps,
    frame: () => player.current?.getCurrentFrame() ?? 0,
  });

  const frame = useRef<Frame>({
    composition: () => playing.current.composition ?? "",
    frame: () => player.current?.getCurrentFrame() ?? 0,
    height: () => playing.current.height,
    width: () => playing.current.width,
  });

  useEffect(
    () =>
      onCommand((command) => {
        if (command.type === "inspect") {
          if (command.armed) {
            player.current?.pause();
          }
          post({
            paused: player.current !== null,
            status: armInspect(command.armed, spot.current),
            type: "inspect",
          });
          return;
        }

        if (command.type === "snapshot") {
          if (command.armed) {
            player.current?.pause();
          }
          post({
            paused: player.current !== null,
            status: armSnapshot(command.armed, frame.current),
            type: "snapshot",
          });
          return;
        }

        if (command.type === "freeze") {
          freezeInspect(command.frozen);
          return;
        }

        player.current?.pause();
        player.current?.seekTo(command.frame);
      }),
    [player]
  );
}

function preferredId(): string | null {
  return (window as unknown as { remocn_preferred: string | null })
    .remocn_preferred;
}

function describe(picked: ReturnType<typeof pick>, total: number) {
  if (picked === null) {
    return {
      compositionId: null,
      reason: "none",
      total,
      type: "composition",
      unmeasured: false,
    };
  }

  return {
    compositionId: picked.id,
    reason: picked.reason,
    total,
    type: "composition",
    unmeasured: picked.metadata === null,
  };
}

interface AnyComposition {
  component: React.FC;
  defaultProps?: Record<string, unknown>;
  durationInFrames: number | undefined;
  fps: number | undefined;
  height: number | undefined;
  id: string;
  width: number | undefined;
}

function pick(compositions: AnyComposition[], preferred: string | null) {
  if (compositions.length === 0) {
    return null;
  }

  const byFolder =
    preferred === null
      ? undefined
      : compositions.find((composition) => composition.id === preferred);

  if (byFolder !== undefined) {
    return { id: byFolder.id, metadata: measured(byFolder), reason: "folder" };
  }

  const main = compositions.find((composition) => composition.id === MAIN_ID);

  if (main !== undefined) {
    return { id: main.id, metadata: measured(main), reason: "main" };
  }

  const [first] = compositions;

  return { id: first.id, metadata: measured(first), reason: "first" };
}

function measured(composition: AnyComposition) {
  const { durationInFrames, fps, height, width } = composition;

  if (
    durationInFrames === undefined ||
    fps === undefined ||
    height === undefined ||
    width === undefined
  ) {
    return null;
  }

  return {
    component: composition.component,
    defaultProps: composition.defaultProps ?? {},
    durationInFrames,
    fps,
    height,
    width,
  };
}
