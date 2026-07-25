import { Player } from "@remotion/player";
import { useContext, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { connectHotReload } from "./hot";

const MAIN_ID = "Main";
const MESSAGE_SOURCE = "remocn-preview";

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
  const picked = pick(compositions);

  useEffect(() => {
    window.parent.postMessage(describe(picked, compositions.length), "*");
  }, [compositions.length, picked]);

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
      style={{ height: "100%", width: "100%" }}
    />
  );
}

function describe(picked: ReturnType<typeof pick>, total: number) {
  if (picked === null) {
    return {
      compositionId: null,
      isFallback: false,
      source: MESSAGE_SOURCE,
      total,
      unmeasured: false,
    };
  }

  return {
    compositionId: picked.id,
    isFallback: picked.isFallback,
    source: MESSAGE_SOURCE,
    total,
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

function pick(compositions: AnyComposition[]) {
  if (compositions.length === 0) {
    return null;
  }

  const main = compositions.find((composition) => composition.id === MAIN_ID);
  const chosen = main ?? compositions[0];

  return {
    id: chosen.id,
    isFallback: main === undefined,
    metadata: measured(chosen),
  };
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
