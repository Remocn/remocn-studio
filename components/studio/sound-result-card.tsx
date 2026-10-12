"use client";

import { CheckIcon, ClapperboardIcon, RotateCcwIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSoundResult } from "@/hooks/use-sound-result";
import type { SoundResult } from "@/shared/ipc";
import { AudioTransport } from "./audio-transport";
import { useStudio, useStudioTurn } from "./studio-provider";

const ACTION_LABELS = {
  idle: "Use in video",
  queued: "Queued",
  sending: "Sending…",
  sent: "Request sent",
} as const;

export function SoundResultCard({ result }: { result: SoundResult }) {
  const { composerActions, environment, openedProject, openedVideo } =
    useStudio();
  const turn = useStudioTurn();
  const model = useSoundResult(result, {
    composer: composerActions,
    environment,
    openedProject,
    openedVideo,
    turn,
  });
  return <SoundResultView model={model} result={result} />;
}

export function SoundResultView({
  model,
  result,
}: {
  model: ReturnType<typeof useSoundResult>;
  result: SoundResult;
}) {
  const { action, disabled, locked, onRegenerate, onUse, player } = model;
  const { asset } = result;
  const error = player.error ?? action.error;
  return (
    <section
      aria-label={`Generated ${result.request.kind === "music" ? "music" : "sound"}: ${asset.name}`}
      className="my-1 min-w-0 rounded-xl bg-secondary p-4 text-card-foreground"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 font-medium text-foreground text-xs">
          <CheckIcon aria-hidden="true" className="size-3.5" />
          {result.request.kind === "music" ? "Music ready" : "Sound ready"}
        </p>
        <span className="text-muted-foreground text-xs">
          ElevenLabs · Saved to library
        </span>
      </div>
      <h3 className="mb-1 break-words font-medium text-sm">{asset.name}</h3>
      <p
        className="mb-4 line-clamp-2 whitespace-pre-wrap break-words text-muted-foreground text-sm"
        title={result.request.text}
      >
        {result.request.text}
      </p>
      <AudioTransport name={asset.name} player={player} />
      {error === null ? null : (
        <p className="mt-3 text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          className="min-w-28"
          disabled={disabled || action.state !== "idle"}
          onClick={onUse}
          size="sm"
          type="button"
        >
          {action.state === "sending" ? <Spinner /> : <ClapperboardIcon />}
          {ACTION_LABELS[action.state]}
        </Button>
        <Button
          disabled={locked}
          onClick={onRegenerate}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcwIcon />
          Regenerate
        </Button>
      </div>
    </section>
  );
}
