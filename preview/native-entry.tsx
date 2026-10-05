import type { PlayerRef } from "@remotion/player";
import { Component } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { configureBridge } from "./bridge";
import { releaseFrameClips } from "./frame-clips";
import { revealAll } from "./hidden";
import { restoreSelection, selectedAnchor } from "./inspect";
import { release, releaseDetachedMedia } from "./media-release";
import {
  delayScope,
  disposeNativeRemotion,
  pendingRenders,
} from "./native-remotion";
import { mountStyles } from "./native-style";
import type { PlaybackPosition } from "./playback-position";
import { configurePlayback, Preview } from "./player-runtime";
import { watchPresence } from "./presence";
import type { EntrySignal, PreviewCommand, PreviewMessage } from "./protocol";
import { configureSurface, type SurfaceEnvironment } from "./surface";

const PAINT_GRACE_MS = 3000;
const SETTLE_MS = 15_000;

interface RuntimePosition extends PlaybackPosition {
  muted: boolean;
  volume: number;
}

interface NativeEnvironment extends SurfaceEnvironment {
  emit: (message: PreviewMessage | EntrySignal) => void;
  position: RuntimePosition | null;
  subscribe: (receive: (command: PreviewCommand) => void) => () => void;
}

export function mount(element: HTMLElement, environment: NativeEnvironment) {
  let player: PlayerRef | null = null;
  let resumed: PlaybackPosition = environment.position ?? {
    frame: 0,
    playing: false,
  };
  let lastFrame = 0;
  let painted = false;
  let watching = 0;
  let settling = 0;

  const paint = () => {
    if (painted) {
      return;
    }
    painted = true;
    cancelAnimationFrame(watching);
    clearTimeout(settling);
    environment.emit({ type: "native.painted" });
  };
  const watch = () => {
    if (document.hidden) {
      paint();
      return;
    }
    const started = performance.now();
    const tick = () => {
      if (
        pendingRenders() === 0 ||
        performance.now() - started > PAINT_GRACE_MS
      ) {
        watching = requestAnimationFrame(() => {
          watching = requestAnimationFrame(paint);
        });
        return;
      }
      watching = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(watching);
    watching = requestAnimationFrame(tick);
  };

  const stopSurface = configureSurface(environment);
  const stopBridge = configureBridge(environment);
  const stopPlayback = configurePlayback(environment.project, {
    initial: environment.position,
    onPlayer: (ref, position, duration) => {
      player = ref;
      resumed = position;
      lastFrame = Math.max(0, duration - 1);
      if (ref === null) {
        return;
      }
      const audio = environment.position;
      if (audio) {
        ref.setVolume(audio.volume);
        if (audio.muted) {
          ref.mute();
        } else {
          ref.unmute();
        }
      }
      if (!painted) {
        watch();
      }
    },
    onUnplayable: paint,
  });
  const stopStyles = mountStyles(environment.root);
  const root = createRoot(element);
  const stopMedia = releaseDetachedMedia(element);
  const stopPresence = watchPresence(element, (ids) =>
    environment.emit({ ids, type: "studio.present" })
  );
  const stopClips = releaseFrameClips(environment.root, element);
  const registrationTimeout = window.setTimeout(() => {
    environment.emit({
      message: "The project did not register a video root.",
      type: "native.error",
    });
  }, 30_000);
  const stopRoot = Internals.waitForRoot((Root: React.FC) => {
    clearTimeout(registrationTimeout);
    settling = window.setTimeout(paint, SETTLE_MS);
    root.render(
      <PreviewBoundary environment={environment}>
        <Internals.DelayRenderContextType.Provider value={delayScope}>
          <Preview Root={Root} />
        </Internals.DelayRenderContextType.Provider>
      </PreviewBoundary>
    );
  });
  let disposed = false;

  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      clearTimeout(registrationTimeout);
      clearTimeout(settling);
      cancelAnimationFrame(watching);
      stopRoot();
      const media = [
        ...element.querySelectorAll<HTMLMediaElement>("audio, video"),
      ];
      try {
        root.unmount();
      } finally {
        disposeNativeRemotion();
        stopPlayback();
        stopMedia();
        stopPresence();
        stopClips();
        stopStyles();
        revealAll();
        stopSurface();
        stopBridge();
        for (const item of media) {
          release(item);
        }
      }
    },
    position: (): RuntimePosition | null =>
      player === null
        ? null
        : {
            frame: player.getCurrentFrame(),
            muted: player.isMuted(),
            playing: player.isPlaying(),
            volume: player.getVolume(),
          },
    selection: selectedAnchor,
    start: (position: PlaybackPosition | null, selection: string | null) => {
      if (disposed) {
        return;
      }
      restoreSelection(selection);
      const ref = player;
      if (ref === null) {
        return;
      }
      const at = position ?? resumed;
      const frame = Math.max(0, Math.min(lastFrame, Math.round(at.frame)));
      if (ref.getCurrentFrame() !== frame) {
        ref.seekTo(frame);
      }
      if (at.playing && !ref.isPlaying()) {
        ref.play();
      }
    },
  };
}

class PreviewBoundary extends Component<
  {
    children: React.ReactNode;
    environment: NativeEnvironment;
  },
  { failed: boolean }
> {
  state: { failed: boolean } = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.environment.emit({
      message:
        "The video could not render. Fix the project, then retry the preview.",
      type: "native.error",
    });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
