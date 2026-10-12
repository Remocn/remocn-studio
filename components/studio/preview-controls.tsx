"use client";

import type { ReactNode } from "react";
import {
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
  Volume2Icon,
  VolumeXIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SliderPrimitive } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import {
  type PreviewTransport,
  useTransportEdge,
  useTransportFrame,
} from "@/hooks/use-preview-transport";
import type { PreviewViewing } from "@/hooks/use-preview-viewing";
import { useSeekScenes } from "@/hooks/use-seek-scenes";
import { cn } from "@/lib/utils";
import { DOCK_ACTIONS } from "./dock-layout";
import { HintTooltip } from "./hint-tooltip";

export function PreviewControls({
  transport,
  playShortcut = "Space",
  status,
  viewing,
}: {
  transport: PreviewTransport;
  playShortcut?: string;
  status?: ReactNode;
  viewing?: Pick<PreviewViewing, "canEnter" | "toggle" | "viewing">;
}) {
  const {
    buffering,
    cycleRate,
    error,
    muted,
    next,
    playing,
    previous,
    rate,
    rateMarks,
    rateStep,
    rates,
    ready,
    setRateStep,
    setVolume,
    toggle,
    toggleMute,
    volume,
  } = transport;
  const edge = useTransportEdge(transport);

  return (
    <fieldset
      aria-label="Playback controls"
      className="@container flex min-w-0 shrink-0 flex-col gap-0.5"
    >
      <SeekBar transport={transport} />
      <div className={cn(DOCK_ACTIONS, "shrink-0 gap-1")}>
        <HintTooltip
          label="Previous frame"
          render={
            <Button
              aria-label="Previous frame"
              className="size-8 text-muted-foreground sm:size-8"
              disabled={!ready || edge === "start"}
              onClick={previous}
              size="icon"
              variant="ghost"
            />
          }
          shortcut="←"
          side="top"
        >
          <StepBackIcon />
        </HintTooltip>
        <HintTooltip
          label={playing ? "Pause" : "Play"}
          render={
            <Button
              aria-label={playing ? "Pause" : "Play"}
              className="size-8 sm:size-8"
              disabled={!ready}
              onClick={toggle}
              size="icon"
              variant="ghost"
            />
          }
          shortcut={playShortcut}
          side="top"
        >
          <PlaybackGlyph buffering={buffering} playing={playing} />
        </HintTooltip>
        <HintTooltip
          label="Next frame"
          render={
            <Button
              aria-label="Next frame"
              className="size-8 text-muted-foreground sm:size-8"
              disabled={!ready || edge === "end"}
              onClick={next}
              size="icon"
              variant="ghost"
            />
          }
          shortcut="→"
          side="top"
        >
          <StepForwardIcon />
        </HintTooltip>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-2">
          {error ? (
            <span
              className="truncate text-center text-destructive text-xs"
              role="alert"
              title={error}
            >
              {error}
            </span>
          ) : (
            status
          )}
        </div>
        <HintTooltip
          label="Playback speed"
          render={
            <Button
              aria-label={`Playback speed ${rate}×`}
              className="@min-[28rem]:hidden h-8 min-w-10 px-1.5 font-medium text-muted-foreground text-xs tabular-nums sm:h-8"
              disabled={!ready}
              onClick={cycleRate}
              size="sm"
              variant="ghost"
            />
          }
          side="top"
        >
          {rate}×
        </HintTooltip>
        <div className="@min-[28rem]:flex hidden shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="w-9 text-end font-medium text-muted-foreground text-xs tabular-nums"
          >
            {rate}×
          </span>
          <PillSlider
            className="w-20"
            disabled={!ready}
            label="Playback speed"
            marks={rateMarks}
            max={rates.length - 1}
            onChange={setRateStep}
            value={rateStep}
            valueText={`${rate}×`}
          />
        </div>
        <HintTooltip
          label={muted ? "Unmute" : "Mute"}
          render={
            <Button
              aria-label={muted ? "Unmute" : "Mute"}
              className="size-8 text-muted-foreground sm:size-8"
              disabled={!ready}
              onClick={toggleMute}
              size="icon"
              variant="ghost"
            />
          }
          side="top"
        >
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
        </HintTooltip>
        <PillSlider
          className="@min-[28rem]:flex hidden w-20"
          disabled={!ready}
          label="Volume"
          max={100}
          onChange={setVolume}
          value={volume}
          valueText={`${volume}%`}
        />
        {viewing === undefined ? null : (
          <HintTooltip
            label={viewing.viewing ? "Exit full screen" : "Full screen"}
            render={
              <Button
                aria-label={
                  viewing.viewing ? "Exit full screen" : "Full screen"
                }
                className="size-8 text-muted-foreground sm:size-8"
                disabled={!(viewing.viewing || viewing.canEnter)}
                onClick={viewing.toggle}
                size="icon"
                variant="ghost"
              />
            }
            shortcut={viewing.viewing ? "Esc" : "F"}
            side="top"
          >
            {viewing.viewing ? <MinimizeIcon /> : <MaximizeIcon />}
          </HintTooltip>
        )}
      </div>
    </fieldset>
  );
}

function SeekBar({ transport }: { transport: PreviewTransport }) {
  const { duration, lastFrame, ready, scenes, seekTo } = transport;
  const { frame, position } = useTransportFrame(transport);
  const sceneBar = useSeekScenes({
    frame,
    scenes,
    seekTo,
    totalFrames: lastFrame + 1,
  });

  return (
    <>
      {sceneBar.segments.length === 0 ? null : (
        <nav
          aria-label="Scenes"
          className="relative h-4"
          ref={sceneBar.measure}
        >
          {sceneBar.segments.map((segment) => (
            <button
              aria-label={`Go to ${segment.name}`}
              className={cn(
                "absolute inset-y-0 truncate px-2 text-left text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:-outline-offset-2 disabled:pointer-events-none",
                segment.id === sceneBar.current && "text-foreground"
              )}
              disabled={!ready}
              key={segment.id}
              onClick={sceneBar.onPick}
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
              title={segment.name}
              type="button"
              value={segment.from}
            >
              {segment.labeled ? segment.name : null}
            </button>
          ))}
        </nav>
      )}
      <PlaybackSlider
        disabled={!ready || lastFrame === 0}
        end={ready ? duration : "--:--"}
        label="Video position"
        marks={sceneBar.segments.slice(1).map((segment) => segment.left)}
        max={Math.max(1, lastFrame)}
        onChange={seekTo}
        start={ready ? position : "--:--"}
        title={`Frame ${frame + 1} of ${lastFrame + 1}`}
        value={frame}
        valueText={`${position}, frame ${frame + 1} of ${lastFrame + 1}`}
      />
    </>
  );
}

function PlaybackGlyph({
  buffering,
  playing,
}: Pick<PreviewTransport, "buffering" | "playing">) {
  if (buffering && playing) {
    return <Spinner className="size-4" />;
  }
  if (playing) {
    return <PauseIcon className="fill-current" />;
  }
  return <PlayIcon className="translate-x-px fill-current" />;
}

function PlaybackSlider({
  disabled,
  end,
  label,
  marks = [],
  max,
  onChange,
  start,
  title,
  value,
  valueText,
}: {
  disabled: boolean;
  end?: string;
  label: string;
  marks?: readonly number[];
  max: number;
  onChange: (value: number) => void;
  start?: string;
  title?: string;
  value: number;
  valueText: string;
}) {
  return (
    <SliderPrimitive.Root
      disabled={disabled}
      max={max}
      min={0}
      onValueChange={onChange}
      step={1}
      thumbAlignment="edge"
      value={value}
    >
      <SliderPrimitive.Control
        className="group relative flex h-8 w-full touch-none select-none overflow-hidden rounded-md bg-foreground/5 has-focus-visible:outline-2 has-focus-visible:outline-ring has-focus-visible:outline-solid has-focus-visible:outline-offset-2 data-disabled:pointer-events-none data-disabled:opacity-45"
        title={title}
      >
        <SliderPrimitive.Track className="relative h-full w-full">
          <SliderPrimitive.Indicator className="bg-foreground/10 transition-colors group-hover:bg-foreground/15 group-data-dragging:bg-foreground/15" />
          {marks.map((left) => (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-2 w-px -translate-x-1/2 bg-foreground/50"
              key={left}
              style={{ left: `${left}%` }}
            />
          ))}
          <SliderPrimitive.Thumb
            aria-label={label}
            aria-valuetext={valueText}
            className="h-5 w-[3px] rounded-full bg-foreground outline-none"
          />
        </SliderPrimitive.Track>
        {start === undefined ? null : (
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-medium text-foreground text-xs tabular-nums">
            {start}
          </span>
        )}
        {end === undefined ? null : (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground text-xs tabular-nums">
            {end}
          </span>
        )}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

function PillSlider({
  className,
  disabled,
  label,
  max,
  marks = [],
  onChange,
  value,
  valueText,
}: {
  className?: string;
  disabled: boolean;
  label: string;
  max: number;
  onChange: (value: number) => void;
  marks?: readonly number[];
  value: number;
  valueText: string;
}) {
  return (
    <SliderPrimitive.Root
      className={cn("shrink-0", className)}
      disabled={disabled}
      max={max}
      min={0}
      onValueChange={onChange}
      step={1}
      thumbAlignment="edge"
      value={value}
    >
      <SliderPrimitive.Control
        className="group flex h-5 w-full touch-none select-none items-center overflow-hidden rounded-md bg-foreground/5 has-focus-visible:outline-2 has-focus-visible:outline-ring has-focus-visible:outline-solid has-focus-visible:outline-offset-2 data-disabled:pointer-events-none data-disabled:opacity-45"
        title={`${label}: ${valueText}`}
      >
        <SliderPrimitive.Track className="relative h-full w-full">
          <SliderPrimitive.Indicator className="bg-foreground/10 transition-colors group-hover:bg-foreground/15 group-data-dragging:bg-foreground/15" />
          {marks.map((mark) => (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/35"
              key={mark}
              style={{ left: `calc(0.625rem + (100% - 1.25rem) * ${mark})` }}
            />
          ))}
          <SliderPrimitive.Thumb
            aria-label={label}
            aria-valuetext={valueText}
            className="h-3.5 w-[3px] rounded-full bg-foreground outline-none"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
