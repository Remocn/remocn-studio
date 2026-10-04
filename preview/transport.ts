import type { PlayerRef } from "@remotion/player";
import { type RefObject, useEffect } from "react";
import { post, route } from "./bridge";

export function usePlayerTransport(
  player: RefObject<PlayerRef | null>,
  composition: string | null,
  durationInFrames: number,
  cancelReplay: () => void
) {
  useEffect(() => {
    const ref = player.current;
    if (ref === null || composition === null) {
      return;
    }

    let buffering = false;
    let error: string | null = null;
    let muted = ref.isMuted();
    let volume = ref.getVolume();
    const announce = () => {
      post({
        buffering,
        compositionId: composition,
        error,
        muted,
        type: "transport.state",
        volume,
      });
    };
    const toggle = () => {
      cancelReplay();
      error = null;
      try {
        if (ref.isPlaying()) {
          ref.pause();
        } else {
          ref.play();
        }
      } catch {
        error = "Playback could not start. Press Play to try again.";
      }
      announce();
    };
    const step = (direction: -1 | 1) => {
      cancelReplay();
      ref.pause();
      ref.seekTo(
        Math.max(
          0,
          Math.min(durationInFrames - 1, ref.getCurrentFrame() + direction)
        )
      );
    };
    const report = () => {
      muted = ref.isMuted();
      volume = ref.getVolume();
      announce();
      post({
        frame: ref.getCurrentFrame(),
        playing: ref.isPlaying(),
        type: "playhead",
      });
    };
    const setAudio = (next: { muted: boolean; volume: number }) => {
      if (
        !Number.isFinite(next.volume) ||
        next.volume < 0 ||
        next.volume > 1 ||
        typeof next.muted !== "boolean"
      ) {
        return;
      }
      ref.setVolume(next.volume);
      if (next.muted) {
        ref.mute();
      } else {
        ref.unmute();
      }
    };
    const stopCommands = route("transport", {
      "transport.audio": setAudio,
      "transport.request": report,
      "transport.step": (command) => {
        if (command.direction === -1 || command.direction === 1) {
          step(command.direction);
        }
      },
      "transport.toggle": toggle,
    });
    const onWaiting = () => {
      buffering = true;
      announce();
    };
    const onResume = () => {
      buffering = false;
      announce();
    };
    const onError = () => {
      error = "The preview could not play. Check the video and try again.";
      announce();
    };
    const onVolume = ({ detail }: { detail: { volume: number } }) => {
      ({ volume } = detail);
      announce();
    };
    const onMute = ({ detail }: { detail: { isMuted: boolean } }) => {
      muted = detail.isMuted;
      announce();
    };

    ref.addEventListener("volumechange", onVolume);
    ref.addEventListener("mutechange", onMute);
    ref.addEventListener("waiting", onWaiting);
    ref.addEventListener("resume", onResume);
    ref.addEventListener("error", onError);
    announce();

    return () => {
      stopCommands();
      ref.removeEventListener("volumechange", onVolume);
      ref.removeEventListener("mutechange", onMute);
      ref.removeEventListener("waiting", onWaiting);
      ref.removeEventListener("resume", onResume);
      ref.removeEventListener("error", onError);
    };
  }, [cancelReplay, composition, durationInFrames, player]);
}
