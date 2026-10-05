"use client";

import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useState,
} from "react";
import {
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
  Volume2Icon,
  VolumeXIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  type AudioPlayer,
  audioTime,
  useAudioPlayer,
} from "@/hooks/use-audio-player";
import type { Asset } from "@/shared/library";
import { stillFileOf } from "@/shared/library";
import { AssetTypeIcon } from "./asset-type-icon";

interface AssetActions {
  onPick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function SoundAsset({
  asset,
  ...actions
}: { asset: Asset } & AssetActions) {
  const player = useAudioPlayer(stillFileOf(asset));
  return <SoundAssetView asset={asset} player={player} {...actions} />;
}

export function SoundAssetView({
  asset,
  player,
  onPick,
  onRemove,
}: {
  asset: Asset;
  player: AudioPlayer;
} & AssetActions) {
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const changeVolume = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.currentTarget.value);
      if (player.ref.current !== null) {
        player.ref.current.volume = value;
        player.ref.current.muted = false;
        setVolume(value);
        setMuted(false);
      }
    },
    [player.ref]
  );
  const toggleMute = useCallback(() => {
    const audio = player.ref.current;
    if (audio !== null) {
      audio.muted = !audio.muted;
      setMuted(audio.muted);
    }
  }, [player.ref]);
  const changeRate = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = Number(event.currentTarget.value);
      if (player.ref.current !== null) {
        player.ref.current.playbackRate = value;
        setRate(value);
      }
    },
    [player.ref]
  );
  const duration = player.duration || asset.duration || 0;
  const unavailable = player.url === null;
  return (
    <section
      aria-label={`Sound asset: ${asset.name}`}
      className="min-w-0 rounded-xl bg-muted"
    >
      <audio
        aria-label={`Listen to ${asset.name}`}
        onDurationChange={player.onMetadata}
        onEnded={player.onPause}
        onError={player.onError}
        onLoadedMetadata={player.onMetadata}
        onPause={player.onPause}
        onPlay={player.onPlay}
        onTimeUpdate={player.onTime}
        preload="none"
        ref={player.ref}
        src={player.url ?? undefined}
      >
        <track kind="captions" label="Audio" />
      </audio>
      <div className="flex min-h-[76px] min-w-0 items-center gap-3 px-3 py-3">
        <AssetTypeIcon
          aria-hidden="true"
          className="size-6 shrink-0"
          type="audio"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {onPick === undefined ? (
            <p className="truncate text-sm" title={asset.name}>
              {asset.name}
            </p>
          ) : (
            <button
              aria-label={`${asset.name}, Audio`}
              className="truncate rounded-sm text-left text-sm outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
              onClick={onPick}
              title={asset.name}
              type="button"
              value={asset.slug}
            >
              {asset.name}
            </button>
          )}
          <p className="truncate text-muted-foreground text-xs tabular-nums">
            {soundKind(asset)}
            {duration > 0 ? ` · ${audioTime(duration)}` : ""}
          </p>
        </div>
        <Button
          aria-label={`${player.playing ? "Pause" : "Play"} ${asset.name}`}
          disabled={player.pending || unavailable}
          onClick={player.toggle}
          size="icon-sm"
          variant="ghost"
        >
          <PlayState player={player} />
        </Button>
        <Popover>
          <PopoverTrigger
            aria-label={`Audio controls for ${asset.name}`}
            render={<Button size="icon-sm" variant="ghost" />}
          >
            <MoreHorizontalIcon />
          </PopoverTrigger>
          <PopoverPopup
            align="end"
            aria-label={`Audio controls for ${asset.name}`}
            className="w-72 max-w-[calc(100vw-32px)]"
          >
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="flex justify-between tabular-nums">
                  <span>Position</span>
                  <span>
                    {audioTime(player.position)} / {audioTime(duration)}
                  </span>
                </span>
                <input
                  aria-label={`Seek ${asset.name}`}
                  aria-valuetext={`${audioTime(player.position)} of ${audioTime(duration)}`}
                  className="h-7 w-full accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid disabled:opacity-45"
                  disabled={player.duration <= 0 || player.unavailable}
                  max={player.duration || 1}
                  min={0}
                  onChange={player.onSeek}
                  step={0.01}
                  type="range"
                  value={Math.min(player.position, player.duration)}
                />
              </label>
              <div className="flex items-center gap-2">
                <Button
                  aria-label={`${muted ? "Unmute" : "Mute"} ${asset.name}`}
                  disabled={unavailable}
                  onClick={toggleMute}
                  size="icon-sm"
                  variant="ghost"
                >
                  {muted ? <VolumeXIcon /> : <Volume2Icon />}
                </Button>
                <input
                  aria-label={`Volume for ${asset.name}`}
                  aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
                  className="h-7 min-w-0 flex-1 accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid disabled:opacity-45"
                  disabled={unavailable}
                  max={1}
                  min={0}
                  onChange={changeVolume}
                  step={0.01}
                  type="range"
                  value={muted ? 0 : volume}
                />
              </div>
              <label className="flex items-center justify-between gap-3 text-xs">
                Playback speed
                <select
                  className="h-8 rounded-xl bg-control px-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid disabled:opacity-45"
                  disabled={unavailable}
                  onChange={changeRate}
                  value={rate}
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                    <option key={value} value={value}>
                      {value}×
                    </option>
                  ))}
                </select>
              </label>
              <SoundSource asset={asset} />
              {player.url === null ? null : (
                <a
                  className="rounded-md text-foreground text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
                  download
                  href={player.url}
                >
                  Download audio
                </a>
              )}
              {onRemove === undefined ? null : (
                <Button
                  className="justify-start"
                  onClick={onRemove}
                  size="sm"
                  value={asset.slug}
                  variant="destructive-outline"
                >
                  <Trash2Icon />
                  Delete {asset.name}
                </Button>
              )}
            </div>
          </PopoverPopup>
        </Popover>
      </div>
      {player.error === null ? null : (
        <p className="px-3 pb-3 text-destructive text-xs" role="alert">
          {player.error}
        </p>
      )}
    </section>
  );
}

function PlayState({ player }: { player: AudioPlayer }) {
  if (player.pending) {
    return <Spinner />;
  }
  return player.playing ? <PauseIcon /> : <PlayIcon />;
}

function soundKind({ source }: Asset) {
  if (source?.provider !== "elevenlabs") {
    return "Audio";
  }
  return "forceInstrumental" in source ? "Music" : "Sound effect";
}

function SoundSource({ asset }: { asset: Asset }) {
  const { source } = asset;
  if (source?.provider !== "elevenlabs") {
    return null;
  }
  return (
    <div className="space-y-1 text-muted-foreground text-xs">
      <p>ElevenLabs · {source.connectionName}</p>
      <p className="whitespace-pre-wrap break-words">{source.text}</p>
      <p className="break-words">
        {source.format} ·{" "}
        {source.durationSeconds === null
          ? "Automatic duration"
          : `${source.durationSeconds} seconds`}
      </p>
    </div>
  );
}
