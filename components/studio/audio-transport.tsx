"use client";

import { PauseIcon, PlayIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { type AudioPlayer, audioTime } from "@/hooks/use-audio-player";

export function AudioTransport({
  name,
  player,
}: {
  name: string;
  player: AudioPlayer;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-field px-3 py-2">
      <audio
        aria-label={`Audio for ${name}`}
        onDurationChange={player.onMetadata}
        onEnded={player.onPause}
        onError={player.onError}
        onLoadedMetadata={player.onMetadata}
        onPause={player.onPause}
        onPlay={player.onPlay}
        onTimeUpdate={player.onTime}
        preload="metadata"
        ref={player.ref}
        src={player.url ?? undefined}
      >
        <track kind="captions" label="Sound effect" />
      </audio>
      <Button
        aria-label={`${player.playing ? "Pause" : "Play"} ${name}`}
        className="shrink-0"
        disabled={player.pending || player.url === null}
        onClick={player.toggle}
        size="icon"
        type="button"
        variant="outline"
      >
        <PlayState player={player} />
      </Button>
      <div className="flex min-w-0 flex-1 flex-col">
        <input
          aria-label={`Seek ${name}`}
          aria-valuetext={`${audioTime(player.position)} of ${audioTime(player.duration)}`}
          className="h-7 w-full cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-45"
          disabled={player.duration <= 0 || player.unavailable}
          max={player.duration || 1}
          min={0}
          onChange={player.onSeek}
          step={0.01}
          type="range"
          value={Math.min(player.position, player.duration)}
        />
        <div
          aria-hidden="true"
          className="flex justify-between text-muted-foreground text-xs tabular-nums"
        >
          <span>{audioTime(player.position)}</span>
          <span>
            {player.duration > 0 ? audioTime(player.duration) : "—:—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlayState({ player }: { player: AudioPlayer }) {
  if (player.pending) {
    return <Spinner />;
  }
  return player.playing ? (
    <PauseIcon className="size-4" />
  ) : (
    <PlayIcon className="relative left-0.5 size-4" />
  );
}
